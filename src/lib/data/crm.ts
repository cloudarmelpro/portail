import 'server-only'
import type { StatutClient, TypeClient, TypeInteraction } from '@/generated/prisma/client'
import { cadre, type PrismaCadre } from '@/lib/prisma'
import { STATUTS_FERMES } from '@/config/crm'
import { ajouterJours, aujourdHui, retardEnJours } from '@/lib/domaine/dates'

/**
 * Couche d'accès aux données — CRM.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INVARIANT N°2, version cloisonnée. Aucune fonction de ce fichier n'importe
 * `prisma` : toutes reçoivent `db: PrismaCadre`, déjà cadré sur une entreprise.
 *
 * La condition d'entreprise est injectée par l'extension. Ne l'écrivez PAS à la
 * main dans un `where` : la doubler masquerait le jour où l'extension cesserait
 * d'agir, et ce jour-là rien ne lèverait d'erreur — un client de Paysagement
 * s'afficherait simplement dans le dossier Développement web.
 *
 * Corollaire : jamais de `findUnique`. L'extension ajoute `entrepriseSlug` au
 * `where`, que `findUnique` refuse — il n'accepte que des champs uniques.
 * `findFirst` accompagne l'identifiant de la condition au lieu de le remplacer.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * D'où vient la date de relance d'un client.
 *
 * Le schéma la porte sur `Interaction.prochaineActionLe`, jamais sur le client.
 * La relance courante est donc celle de la DERNIÈRE interaction : consigner un
 * nouvel appel remplace le plan précédent, il ne s'y ajoute pas. Sans cette
 * règle, une relance oubliée resterait « en retard » à perpétuité alors que le
 * dossier a avancé.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Toutes les requêtes excluent les fiches supprimées, sauf mention contraire. */
const VIVANTS = { deletedAt: null } as const

const FERMES: StatutClient[] = [...STATUTS_FERMES]

/** Fenêtre d'alerte sur la validité des estimations — exigence CRM-6. */
export const JOURS_AVANT_EXPIRATION = 7

/* ══════════════════════════════════════════════════════════════════
   Lectures
   ══════════════════════════════════════════════════════════════════ */

/** Compte affiché sur les cartes de choix d'entreprise. Un dossier perdu ne compte plus. */
export async function compterClientsActifs(db: PrismaCadre): Promise<number> {
  return db.client.count({ where: { ...VIVANTS, statut: { not: 'perdu' } } })
}

export const CLES_TRI = ['nom', 'type', 'statut', 'dernier', 'relance'] as const
export type CleTri = (typeof CLES_TRI)[number]

export type OptionsListe = {
  recherche?: string
  statut?: StatutClient
  type?: TypeClient
  tri: CleTri
  sens: 'asc' | 'desc'
  page: number
  parPage: number
}

export type LigneClient = {
  id: string
  nom: string
  type: TypeClient
  statut: StatutClient
  derniereType: TypeInteraction | null
  derniereLe: Date | null
  relanceLe: Date | null
}

export type PageClients = {
  lignes: LigneClient[]
  total: number
  page: number
  pages: number
}

/**
 * CRM-8 — recherche, filtres, tri par colonne, pagination.
 *
 * Le tri et la pagination sont faits en mémoire, pas en SQL. Deux des cinq
 * colonnes triables — dernière interaction et prochaine relance — sont des
 * valeurs dérivées d'une relation, que Prisma ne sait pas ordonner côté base.
 * Trier deux colonnes ici et trois là-bas donnerait deux comportements de
 * pagination différents selon la colonne cliquée. L'outil sert trois personnes
 * et quelques centaines de fiches par entreprise : ramener l'ensemble filtré
 * coûte moins que cette incohérence.
 */
export async function listerClients(db: PrismaCadre, o: OptionsListe): Promise<PageClients> {
  const recherche = o.recherche?.trim()

  const clients = await db.client.findMany({
    where: {
      ...VIVANTS,
      ...(o.statut && { statut: o.statut }),
      ...(o.type && { type: o.type }),
      ...(recherche && {
        OR: [
          { nom: { contains: recherche, mode: 'insensitive' as const } },
          { personneRessource: { contains: recherche, mode: 'insensitive' as const } },
          { courriel: { contains: recherche, mode: 'insensitive' as const } },
          { telephone: { contains: recherche, mode: 'insensitive' as const } },
        ],
      }),
    },
    select: {
      id: true,
      nom: true,
      type: true,
      statut: true,
      interactions: {
        where: VIVANTS,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { type: true, date: true, prochaineActionLe: true },
      },
    },
  })

  const lignes: LigneClient[] = clients.map((c) => {
    const derniere = c.interactions[0] ?? null
    return {
      id: c.id,
      nom: c.nom,
      type: c.type,
      statut: c.statut,
      derniereType: derniere?.type ?? null,
      derniereLe: derniere?.date ?? null,
      relanceLe: derniere?.prochaineActionLe ?? null,
    }
  })

  lignes.sort(comparateur(o.tri, o.sens))

  const total = lignes.length
  const pages = Math.max(1, Math.ceil(total / o.parPage))
  const page = Math.min(Math.max(1, o.page), pages)
  const debut = (page - 1) * o.parPage

  return { lignes: lignes.slice(debut, debut + o.parPage), total, page, pages }
}

/** Rang dans le cycle de vente, pas dans l'alphabet — « Gagné » suit « Soumission envoyée ». */
const RANG_STATUT: Readonly<Record<StatutClient, number>> = {
  prospect: 0,
  contacte: 1,
  soumission_envoyee: 2,
  gagne: 3,
  perdu: 4,
}

function comparateur(tri: CleTri, sens: 'asc' | 'desc') {
  const signe = sens === 'desc' ? -1 : 1

  return (a: LigneClient, b: LigneClient): number => {
    switch (tri) {
      case 'type':
        return signe * a.type.localeCompare(b.type) || a.nom.localeCompare(b.nom, 'fr-CA')
      case 'statut':
        return (
          signe * (RANG_STATUT[a.statut] - RANG_STATUT[b.statut]) ||
          a.nom.localeCompare(b.nom, 'fr-CA')
        )
      case 'dernier':
        return parDate(a.derniereLe, b.derniereLe, signe) || a.nom.localeCompare(b.nom, 'fr-CA')
      case 'relance':
        return parDate(a.relanceLe, b.relanceLe, signe) || a.nom.localeCompare(b.nom, 'fr-CA')
      default:
        return signe * a.nom.localeCompare(b.nom, 'fr-CA')
    }
  }
}

/** Les fiches sans date restent en fin de liste dans les deux sens : elles n'ont rien à dire. */
function parDate(a: Date | null, b: Date | null, signe: number): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return signe * (a.getTime() - b.getTime())
}

export type RelanceDue = {
  clientId: string
  clientNom: string
  interactionType: TypeInteraction
  interactionLe: Date
  prochaineAction: string | null
  prochaineActionLe: Date
  /** Jours de retard, zéro pour une relance du jour. */
  retardJours: number
}

/**
 * Deux groupes distincts, et non deux nuances d'un même total : « sept à faire
 * aujourd'hui » dont quatre traînaient depuis la semaine dernière se traite
 * comme sept, et les quatre restent en arrière.
 */
export type RelancesDues = {
  enRetard: RelanceDue[]
  duJour: RelanceDue[]
}

/**
 * CRM-6 — relances échues et du jour, les retards en tête.
 *
 * La requête ramène toutes les interactions dont l'échéance est atteinte ; le
 * filtre qui suit ne garde que celles qui sont encore la dernière interaction de
 * leur client. C'est le prix de la règle décrite en tête de fichier, et il est
 * payé sur un jeu de lignes déjà restreint par l'index `[entrepriseSlug,
 * prochaineActionLe]`.
 *
 * La borne SQL et le classement qui suit lisent le MÊME `jour` : deux appels à
 * `aujourdHui()` encadreraient minuit un soir sur mille et rendraient un
 * retard négatif.
 */
export async function relancesEchues(db: PrismaCadre): Promise<RelancesDues> {
  const jour = aujourdHui()

  const dues = await db.interaction.findMany({
    where: {
      ...VIVANTS,
      prochaineActionLe: { not: null, lte: jour },
      client: { deletedAt: null, statut: { notIn: FERMES } },
    },
    orderBy: [{ prochaineActionLe: 'asc' }],
    select: {
      id: true,
      type: true,
      date: true,
      prochaineAction: true,
      prochaineActionLe: true,
      client: {
        select: {
          id: true,
          nom: true,
          interactions: {
            where: VIVANTS,
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  })

  const courantes = dues
    .filter((i) => i.client.interactions[0]?.id === i.id)
    .map((i) => ({
      clientId: i.client.id,
      clientNom: i.client.nom,
      interactionType: i.type,
      interactionLe: i.date,
      prochaineAction: i.prochaineAction,
      // Le filtre de la requête garantit la valeur ; TypeScript, lui, ne le sait pas.
      prochaineActionLe: i.prochaineActionLe as Date,
      retardJours: retardEnJours(i.prochaineActionLe as Date, jour),
    }))

  // Partition, et non deux filtres complémentaires : aucune ligne ramenée par
  // la requête ne peut disparaître entre les deux groupes.
  return {
    enRetard: courantes.filter((r) => r.retardJours > 0),
    duJour: courantes.filter((r) => r.retardJours <= 0),
  }
}

export type SoumissionEnAttente = {
  id: string
  reference: string
  /** Converti au bord : un `Decimal` Prisma ne franchit pas la frontière serveur/client. */
  total: number
  clientId: string | null
  clientNom: string | null
  valideJusquau: Date | null
  expireBientot: boolean
  expiree: boolean
}

/**
 * CRM-6 — soumissions en attente et estimations expirant sous sept jours.
 *
 * Lecture seule : le calculateur est le seul à écrire dans `Estimation`. Une
 * estimation qui expire sans relance est une vente perdue en silence, c'est la
 * seule raison pour laquelle le CRM regarde cette table.
 */
export async function soumissionsEnAttente(db: PrismaCadre): Promise<SoumissionEnAttente[]> {
  const jour = aujourdHui()
  const limite = ajouterJours(jour, JOURS_AVANT_EXPIRATION)

  const estimations = await db.estimation.findMany({
    where: { ...VIVANTS, statut: 'envoye' },
    orderBy: [{ valideJusquau: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      reference: true,
      total: true,
      valideJusquau: true,
      client: { select: { id: true, nom: true } },
    },
  })

  return estimations.map((e) => ({
    id: e.id,
    reference: e.reference,
    total: Number(e.total),
    clientId: e.client?.id ?? null,
    clientNom: e.client?.nom ?? null,
    valideJusquau: e.valideJusquau,
    expireBientot: e.valideJusquau !== null && e.valideJusquau >= jour && e.valideJusquau <= limite,
    expiree: e.valideJusquau !== null && e.valideJusquau < jour,
  }))
}

/**
 * Les derniers clients ouverts dans un dossier — pour l'entrée du module.
 *
 * Trie par création, en base, avec un `take`. `listerClients` charge tout puis
 * ordonne en mémoire, ce qui convient à un tableau paginé mais pas à un aperçu
 * de cinq lignes : ce serait lire trois dossiers entiers pour en montrer quinze.
 */
export async function derniersClients(db: PrismaCadre, limite: number) {
  return db.client.findMany({
    where: VIVANTS,
    orderBy: { createdAt: 'desc' },
    take: limite,
    select: { id: true, nom: true, statut: true, createdAt: true },
  })
}

/**
 * Les dernières interactions consignées dans un dossier — pour l'entrée du module.
 *
 * Triées par date déclarée puis par ordre de saisie : deux appels notés le même
 * jour n'ont que leur `createdAt` pour les départager, et le second doit passer
 * devant le premier.
 *
 * `resume` est un texte libre : c'est la seule colonne du CRM dont la longueur
 * n'a aucune borne. La rangée qui l'affiche doit le tronquer.
 */
export async function dernieresInteractions(db: PrismaCadre, limite: number) {
  return db.interaction.findMany({
    where: { ...VIVANTS, client: { deletedAt: null } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limite,
    select: {
      id: true,
      type: true,
      date: true,
      resume: true,
      client: { select: { id: true, nom: true } },
    },
  })
}

export type FicheClient = NonNullable<Awaited<ReturnType<typeof clientParId>>>

export async function clientParId(db: PrismaCadre, id: string) {
  return db.client.findFirst({
    where: { id, ...VIVANTS },
    select: {
      id: true,
      nom: true,
      type: true,
      statut: true,
      motifCloture: true,
      clotureLe: true,
      personneRessource: true,
      courriel: true,
      telephone: true,
      adresse: true,
      provenance: true,
      notes: true,
      version: true,
      interactions: {
        where: VIVANTS,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          type: true,
          date: true,
          resume: true,
          prochaineAction: true,
          prochaineActionLe: true,
          auteurNom: true,
          version: true,
          estimation: { select: { reference: true, total: true } },
        },
      },
      estimations: {
        where: VIVANTS,
        orderBy: [{ annee: 'desc' }, { numero: 'desc' }],
        select: {
          id: true,
          reference: true,
          total: true,
          statut: true,
          valideJusquau: true,
        },
      },
    },
  })
}

/* ══════════════════════════════════════════════════════════════════
   Écritures — appelées uniquement depuis lib/actions/crm.ts
   ══════════════════════════════════════════════════════════════════ */

export type DonneesClient = {
  type: TypeClient
  nom: string
  personneRessource: string | null
  courriel: string | null
  telephone: string | null
  adresse: string | null
  provenance: string | null
  notes: string | null
}

export async function creerClient(db: PrismaCadre, donnees: DonneesClient): Promise<string> {
  const cree = await db.client.create({ data: cadre(donnees), select: { id: true } })
  return cree.id
}

/**
 * Renvoie `false` si la version reçue est périmée — l'appelant traduit alors en
 * « Rechargez la page avant de recommencer ».
 */
export async function modifierClient(
  db: PrismaCadre,
  id: string,
  version: number,
  donnees: DonneesClient,
): Promise<boolean> {
  const maj = await db.client.updateMany({
    where: { id, version, ...VIVANTS },
    data: { ...donnees, version: { increment: 1 } },
  })
  return maj.count > 0
}

/**
 * CRM-5 — le motif et la date de clôture accompagnent le statut fermé. Rouvrir
 * un dossier les efface : un motif de perte affiché sur un dossier redevenu
 * prospect se lirait comme la décision en cours.
 */
export async function changerStatut(
  db: PrismaCadre,
  id: string,
  version: number,
  statut: StatutClient,
  motifCloture: string | null,
): Promise<boolean> {
  const ferme = FERMES.includes(statut)

  const maj = await db.client.updateMany({
    where: { id, version, ...VIVANTS },
    data: {
      statut,
      motifCloture: ferme ? motifCloture : null,
      clotureLe: ferme ? new Date() : null,
      version: { increment: 1 },
    },
  })
  return maj.count > 0
}

export type DonneesInteraction = {
  clientId: string
  type: TypeInteraction
  date: Date
  resume: string
  prochaineAction: string | null
  prochaineActionLe: Date | null
  auteurId: string
  auteurNom: string
}

/** Renvoie `false` si le client n'existe pas dans CETTE entreprise. */
export async function ajouterInteraction(
  db: PrismaCadre,
  donnees: DonneesInteraction,
): Promise<boolean> {
  /**
   * Le client est relu avec le client cadré AVANT l'insertion. `Interaction`
   * porte sa propre colonne d'entreprise : sans ce contrôle, un `clientId`
   * d'une autre entreprise produirait une interaction rattachée au bon client
   * mais estampillée de la mauvaise entreprise — invisible des deux côtés.
   */
  const client = await db.client.findFirst({
    where: { id: donnees.clientId, ...VIVANTS },
    select: { id: true },
  })
  if (!client) return false

  await db.interaction.create({ data: cadre(donnees), select: { id: true } })
  return true
}

export async function planifierRelance(
  db: PrismaCadre,
  clientId: string,
  interactionId: string,
  version: number,
  prochaineAction: string | null,
  prochaineActionLe: Date | null,
): Promise<boolean> {
  const maj = await db.interaction.updateMany({
    where: { id: interactionId, clientId, version, ...VIVANTS },
    data: { prochaineAction, prochaineActionLe, version: { increment: 1 } },
  })
  return maj.count > 0
}

/** CRM-7 — la fiche est marquée supprimée ; ses interactions restent attachées. */
export async function supprimerClient(db: PrismaCadre, id: string): Promise<boolean> {
  const maj = await db.client.updateMany({
    where: { id, ...VIVANTS },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  })
  return maj.count > 0
}

/**
 * CRM-7 — « les enregistrements restent restaurables ».
 *
 * La donnée l'était depuis le début ; l'écran manquait, donc l'exigence n'était
 * pas tenue. Une politique de restauration sans écran pour l'appliquer est une
 * phrase, pas une garantie.
 */
export async function restaurerClient(db: PrismaCadre, id: string): Promise<boolean> {
  const maj = await db.client.updateMany({
    // La condition inverse de la suppression : on ne restaure QUE ce qui est
    // supprimé, sinon un double appel incrémenterait la version pour rien et
    // ferait échouer l'onglet voisin.
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null, version: { increment: 1 } },
  })
  return maj.count > 0
}

/** Fiches supprimées d'une entreprise, les plus récentes d'abord. */
export async function listerClientsSupprimes(db: PrismaCadre) {
  return db.client.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true,
      nom: true,
      type: true,
      statut: true,
      deletedAt: true,
      _count: { select: { interactions: true, estimations: true } },
    },
  })
}
