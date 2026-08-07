import 'server-only'
import { cadre, prisma, type PrismaCadre } from '@/lib/prisma'
import { estRole, type Module, type Role } from '@/lib/permissions'
import type { EntrepriseSlug } from '@/config/entreprises'

/**
 * Couche d'accès aux données — module d'administration.
 *
 * INVARIANT N°2 : aucun appel Prisma n'est écrit hors d'ici.
 *
 * Deux régimes cohabitent dans ce fichier, et la distinction est délibérée :
 *
 *  · comptes, journal d'audit et paramètres de paie utilisent le client global.
 *    Ils sont **transverses** — l'administrateur lit les trois entreprises sur
 *    un même écran (ADM-4) ;
 *  · les grilles de tarifs reçoivent le client **cadré** (`PrismaCadre`) : elles
 *    sont cloisonnées, et chaque entreprise a son propre catalogue.
 */

/* ══════════════════════════════════════════════════════════════════
   Comptes — ADM-1
   ══════════════════════════════════════════════════════════════════ */

export type UtilisateurListe = {
  id: string
  nom: string
  courriel: string
  /** `null` si la colonne porte une valeur inconnue de `lib/permissions.ts`. */
  role: Role | null
  suspendu: boolean
  motifSuspension: string | null
  /**
   * Colonne `User.derniereConnexionLe`, écrite à l'ouverture de session par un
   * hook de Better Auth. Elle était auparavant déduite de la session la plus
   * récente — les sessions expirant en deux heures, un compte actif finissait
   * par afficher « Jamais connecté ».
   */
  derniereConnexion: Date | null
}

export async function listerUtilisateurs(): Promise<UtilisateurListe[]> {
  const lignes = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      derniereConnexionLe: true,
    },
  })

  return lignes.map((u) => ({
    id: u.id,
    nom: u.name,
    courriel: u.email,
    role: estRole(u.role) ? u.role : null,
    suspendu: u.banned === true,
    motifSuspension: u.banReason,
    derniereConnexion: u.derniereConnexionLe,
  }))
}

export async function utilisateurParCourriel(courriel: string) {
  return prisma.user.findUnique({
    where: { email: courriel.toLowerCase() },
    select: { id: true, name: true, email: true, role: true, banned: true },
  })
}

/**
 * Nombre d'administrateurs encore en état de se connecter.
 *
 * Sert à refuser le geste qui laisserait le portail sans administrateur. La
 * protection contre l'auto-suspension ne suffit pas : deux administrateurs
 * peuvent se suspendre l'un l'autre.
 */
export async function compterAdministrateursActifs(): Promise<number> {
  return prisma.user.count({ where: { role: 'admin', NOT: { banned: true } } })
}

/* ══════════════════════════════════════════════════════════════════
   Grilles de tarifs — ADM-2 et ADM-3
   ══════════════════════════════════════════════════════════════════ */

const MONTANT = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })

export type ProduitVue = {
  id: string
  nom: string
  unite: string
  /** Chaîne et non nombre : un `Decimal` Prisma ne traverse pas la frontière client. */
  prixUnitaire: string
  actif: boolean
}

export type GrilleVue = {
  id: string
  numero: number
  actif: boolean
  ecarts: string[]
  creeParNom: string
  createdAt: Date
  produits: ProduitVue[]
}

export type ProduitEntree = {
  id?: string
  nom: string
  unite: string
  prixUnitaire: string
  actif: boolean
}

const SELECTION_GRILLE = {
  id: true,
  numero: true,
  actif: true,
  ecarts: true,
  creeParNom: true,
  createdAt: true,
  produits: {
    orderBy: { ordre: 'asc' },
    select: { id: true, nom: true, unite: true, prixUnitaire: true, actif: true },
  },
} as const

type LigneGrille = {
  id: string
  numero: number
  actif: boolean
  ecarts: string[]
  creeParNom: string
  createdAt: Date
  produits: { id: string; nom: string; unite: string; prixUnitaire: unknown; actif: boolean }[]
}

function versVue(g: LigneGrille): GrilleVue {
  return {
    id: g.id,
    numero: g.numero,
    actif: g.actif,
    ecarts: g.ecarts,
    creeParNom: g.creeParNom,
    createdAt: g.createdAt,
    produits: g.produits.map((p) => ({
      id: p.id,
      nom: p.nom,
      unite: p.unite,
      prixUnitaire: String(p.prixUnitaire),
      actif: p.actif,
    })),
  }
}

export async function grilleActive(db: PrismaCadre): Promise<GrilleVue | null> {
  const g = await db.grilleTarifs.findFirst({
    where: { actif: true },
    orderBy: { numero: 'desc' },
    select: SELECTION_GRILLE,
  })
  return g ? versVue(g) : null
}

/** Historique complet, version courante en tête — ADM-3. */
/**
 * Y a-t-il une grille publiée dans ce dossier ?
 *
 * `grilleActive` ramène la grille AVEC tous ses produits : l'appeler pour n'en
 * tirer qu'un booléen faisait lire les trois catalogues entiers à chaque
 * affichage de l'accueil, pour un nombre compris entre zéro et trois.
 */
export async function aUneGrilleActive(db: PrismaCadre): Promise<boolean> {
  return (await db.grilleTarifs.count({ where: { actif: true } })) > 0
}

export async function listerGrilles(db: PrismaCadre): Promise<GrilleVue[]> {
  const grilles = await db.grilleTarifs.findMany({
    orderBy: { numero: 'desc' },
    select: SELECTION_GRILLE,
  })
  return grilles.map(versVue)
}

/** Cents entiers : comparer deux prix en `number` réintroduirait la virgule flottante. */
function cents(valeur: string): number {
  const [entier = '0', decimales = ''] = valeur.split('.')
  return Number(entier) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2))
}

function montant(valeur: string): string {
  return MONTANT.format(cents(valeur) / 100)
}

/**
 * Écarts avec la version précédente — ADM-3.
 *
 * Calculés à l'enregistrement puis **figés** dans la colonne `ecarts`. Les
 * recalculer à l'affichage donnerait un historique qui change quand on modifie
 * le passé ; ici, l'historique dit ce qu'il a vu.
 *
 * Une liste vide signifie « rien n'a changé » : l'appelant refuse alors de créer
 * une version, sinon l'historique se remplirait de doublons indistinguables.
 */
export function calculerEcarts(
  precedents: ProduitVue[] | null,
  suivants: ProduitEntree[],
): string[] {
  if (precedents === null) return ['Version initiale']

  const avant = new Map(precedents.map((p) => [p.id, p]))
  const ecarts: string[] = []

  for (const p of suivants) {
    const ancien = p.id ? avant.get(p.id) : undefined

    if (!ancien) {
      ecarts.push(`${p.nom} : ajouté à ${montant(p.prixUnitaire)}`)
      continue
    }

    avant.delete(ancien.id)

    if (cents(ancien.prixUnitaire) !== cents(p.prixUnitaire)) {
      ecarts.push(`${p.nom} : ${montant(ancien.prixUnitaire)} → ${montant(p.prixUnitaire)}`)
    }
    if (ancien.actif && !p.actif) ecarts.push(`${p.nom} : retiré du catalogue`)
    if (!ancien.actif && p.actif) ecarts.push(`${p.nom} : remis au catalogue`)
  }

  // Un produit absent de la nouvelle grille n'est pas effacé de l'histoire : il
  // figure dans des estimations passées, et sa disparition est un écart en soi.
  for (const oublie of avant.values()) {
    if (oublie.actif) ecarts.push(`${oublie.nom} : retiré du catalogue`)
  }

  return ecarts
}

export type ResultatVersion =
  { etat: 'publiee'; numero: number } | { etat: 'conflit' } | { etat: 'inchangee' }

/**
 * Publie une nouvelle version de la grille — ADM-3.
 *
 * Une grille n'est **jamais** modifiée en place : la version courante est
 * désactivée et une nouvelle est créée. Les estimations déjà émises conservent
 * leurs prix parce qu'elles pointent sur leur propre version.
 */
export async function publierGrille(
  db: PrismaCadre,
  entree: {
    produits: ProduitEntree[]
    depuisNumero: number
    creeParId: string
    creeParNom: string
  },
): Promise<ResultatVersion> {
  return db.$transaction(async (tx) => {
    const courante = await tx.grilleTarifs.findFirst({
      where: { actif: true },
      orderBy: { numero: 'desc' },
      select: SELECTION_GRILLE,
    })

    const numeroCourant = courante?.numero ?? 0
    if (numeroCourant !== entree.depuisNumero) return { etat: 'conflit' }

    const ecarts = calculerEcarts(courante ? versVue(courante).produits : null, entree.produits)
    if (ecarts.length === 0) return { etat: 'inchangee' }

    const dernier = await tx.grilleTarifs.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })

    // La condition d'entreprise est injectée par l'extension de cloisonnement,
    // y compris ici : la doubler à la main masquerait le jour où elle cesserait
    // d'agir.
    await tx.grilleTarifs.updateMany({ where: { actif: true }, data: { actif: false } })

    const grille = await tx.grilleTarifs.create({
      data: cadre({
        numero: (dernier?.numero ?? 0) + 1,
        actif: true,
        ecarts,
        creeParId: entree.creeParId,
        creeParNom: entree.creeParNom,
      }),
      select: { id: true, numero: true },
    })

    await tx.produitTarif.createMany({
      data: entree.produits.map((p, index) =>
        cadre({
          grilleId: grille.id,
          nom: p.nom,
          unite: p.unite,
          prixUnitaire: p.prixUnitaire,
          actif: p.actif,
          ordre: index,
        }),
      ),
    })

    return { etat: 'publiee', numero: grille.numero }
  })
}

/* ══════════════════════════════════════════════════════════════════
   Journal d'audit — ADM-4
   ══════════════════════════════════════════════════════════════════ */

/** Les six axes d'ADM-4, plus le raccourci « actions sensibles ». */
export type FiltresJournal = {
  /** Identifiant de l'auteur. Les entrées d'un compte supprimé n'en ont pas. */
  utilisateur?: string
  module?: Module
  entreprise?: string
  /** Recherche partielle sur le libellé d'action. */
  action?: string
  /** Recherche partielle sur l'élément concerné. */
  entite?: string
  ip?: string
  du?: string
  au?: string
  sensible?: boolean
}

export type EntreeJournal = {
  id: string
  horodatage: Date
  utilisateur: string
  action: string
  entite: string | null
  module: string
  entreprise: EntrepriseSlug | null
  ip: string | null
  sensible: boolean
}

function conditions(f: FiltresJournal) {
  const bornes: { gte?: Date; lt?: Date } = {}
  if (f.du) bornes.gte = new Date(`${f.du}T00:00:00.000Z`)
  if (f.au) {
    // Borne haute exclusive au lendemain : « au 5 août » doit inclure le 5 août.
    const lendemain = new Date(`${f.au}T00:00:00.000Z`)
    lendemain.setUTCDate(lendemain.getUTCDate() + 1)
    bornes.lt = lendemain
  }

  /*
    `contains` insensible à la casse sur l'action et l'élément : on cherche
    « suppression » ou un nom de fichier partiel, pas une correspondance exacte.
    L'entreprise et l'adresse IP, elles, sont des valeurs closes — égalité.
  */
  return {
    ...(f.utilisateur && { userId: f.utilisateur }),
    ...(f.module && { module: f.module }),
    ...(f.entreprise && { entrepriseSlug: f.entreprise }),
    ...(f.action && { action: { contains: f.action, mode: 'insensitive' as const } }),
    ...(f.entite && { entite: { contains: f.entite, mode: 'insensitive' as const } }),
    ...(f.ip && { ip: f.ip }),
    ...(f.sensible && { sensible: true }),
    ...((bornes.gte || bornes.lt) && { createdAt: bornes }),
  }
}

function versEntree(l: {
  id: string
  createdAt: Date
  utilisateurNom: string
  action: string
  entite: string | null
  module: string
  entrepriseSlug: string | null
  ip: string | null
  sensible: boolean
}): EntreeJournal {
  return {
    id: l.id,
    horodatage: l.createdAt,
    utilisateur: l.utilisateurNom,
    action: l.action,
    entite: l.entite,
    module: l.module,
    entreprise: (l.entrepriseSlug as EntrepriseSlug | null) ?? null,
    ip: l.ip,
    sensible: l.sensible,
  }
}

const CHAMPS_JOURNAL = {
  id: true,
  createdAt: true,
  utilisateurNom: true,
  action: true,
  entite: true,
  module: true,
  entrepriseSlug: true,
  ip: true,
  sensible: true,
} as const

export async function listerJournal(
  filtres: FiltresJournal,
  pagination: { page: number; parPage: number },
): Promise<{ entrees: EntreeJournal[]; total: number }> {
  const where = conditions(filtres)

  const [lignes, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagination.page - 1) * pagination.parPage,
      take: pagination.parPage,
      select: CHAMPS_JOURNAL,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { entrees: lignes.map(versEntree), total }
}

/**
 * Plafond d'export. Un journal qui grossit sans limite finirait par produire un
 * fichier que le conteneur ne peut pas construire en mémoire ; mieux vaut un
 * export tronqué et une période à resserrer qu'une requête qui n'aboutit pas.
 */
export const EXPORT_MAX = 10_000

export async function journalPourExport(filtres: FiltresJournal): Promise<EntreeJournal[]> {
  const lignes = await prisma.auditLog.findMany({
    where: conditions(filtres),
    orderBy: { createdAt: 'desc' },
    take: EXPORT_MAX,
    select: CHAMPS_JOURNAL,
  })
  return lignes.map(versEntree)
}

/** Auteurs présents au journal — alimente la liste déroulante du filtre. */
export async function auteursDuJournal(): Promise<{ id: string; nom: string }[]> {
  const lignes = await prisma.auditLog.findMany({
    where: { userId: { not: null } },
    distinct: ['userId'],
    orderBy: { utilisateurNom: 'asc' },
    select: { userId: true, utilisateurNom: true },
  })

  return lignes
    .filter((l): l is { userId: string; utilisateurNom: string } => l.userId !== null)
    .map((l) => ({ id: l.userId, nom: l.utilisateurNom }))
}

/* ══════════════════════════════════════════════════════════════════
   Paramètres de paie — HEU-7 et HEU-9
   ══════════════════════════════════════════════════════════════════ */

/** Ligne unique : le modèle porte `@id @default("global")`. */
const PAIE = 'global'

export type ParametresPaieVue = {
  seuilSupplementaires: string
  majoration: string
  joursPeriode: number
  version: number
}

/**
 * Les valeurs par défaut sont celles du schéma. Tant que la ligne n'a pas été
 * enregistrée, le module des heures lit ces mêmes défauts : l'écran affiche donc
 * ce qui s'applique réellement, pas des champs vides.
 */
export const PAIE_DEFAUTS: ParametresPaieVue = {
  seuilSupplementaires: '40',
  majoration: '1.5',
  joursPeriode: 14,
  version: 0,
}

export async function parametresPaie(): Promise<ParametresPaieVue> {
  const p = await prisma.parametresPaie.findUnique({ where: { id: PAIE } })
  if (!p) return PAIE_DEFAUTS

  return {
    seuilSupplementaires: String(p.seuilSupplementaires),
    majoration: String(p.majoration),
    joursPeriode: p.joursPeriode,
    version: p.version,
  }
}

export async function enregistrerParametresPaie(entree: {
  seuilSupplementaires: string
  majoration: string
  joursPeriode: number
  version: number
}): Promise<{ etat: 'enregistre' } | { etat: 'conflit' }> {
  const donnees = {
    seuilSupplementaires: entree.seuilSupplementaires,
    majoration: entree.majoration,
    joursPeriode: entree.joursPeriode,
  }

  const maj = await prisma.parametresPaie.updateMany({
    where: { id: PAIE, version: entree.version },
    data: { ...donnees, version: { increment: 1 } },
  })
  if (maj.count === 1) return { etat: 'enregistre' }

  // Aucune ligne mise à jour : soit elle n'existe pas encore, soit un autre
  // onglet l'a déjà fait avancer. `create` tranche — la clé primaire est fixe.
  if (entree.version === 0) {
    try {
      await prisma.parametresPaie.create({ data: { id: PAIE, ...donnees } })
      return { etat: 'enregistre' }
    } catch {
      return { etat: 'conflit' }
    }
  }

  return { etat: 'conflit' }
}

/* ══════════════════════════════════════════════════════════════════
   Organisation — coordonnées du document client (EST-10)
   ══════════════════════════════════════════════════════════════════ */

export type OrganisationVue = {
  raisonSociale: string
  adresse: string
  telephone: string
  /** Clé dans le stockage objet. `null` tant qu'aucun logo n'est déposé. */
  logoCle: string | null
  version: number
}

/**
 * Coordonnées d'UNE entreprise, créées à la première lecture.
 *
 * Cloisonnées : Paysagement, Développement web et Staff augmentation sont trois
 * entreprises distinctes, chacune avec sa raison sociale, son adresse et son
 * téléphone. L'écran d'administration en édite une à la fois, comme les grilles
 * de tarifs.
 */
export async function organisation(db: PrismaCadre): Promise<OrganisationVue> {
  const existante = await db.organisation.findFirst({
    select: {
      raisonSociale: true,
      adresse: true,
      telephone: true,
      logoCle: true,
      version: true,
    },
  })
  if (existante) return existante

  // L'extension pose la colonne d'entreprise ; « cadre » la promet au
  // compilateur sans jamais l'écrire, pour que la base refuse bruyamment le jour
  // où l'extension cesserait d'agir.
  const creee = await db.organisation.create({
    data: cadre({}),
    select: {
      raisonSociale: true,
      adresse: true,
      telephone: true,
      logoCle: true,
      version: true,
    },
  })
  return creee
}

/**
 * Pose ou retire le logo — EST-10.
 *
 * Rend l'ANCIENNE clé, ou `null`. L'appelant s'en sert pour effacer l'objet
 * remplacé : sans cela, chaque changement de logo laisserait un fichier orphelin
 * dans le seau, que plus aucune ligne ne désigne et que rien ne saurait donc
 * retrouver.
 *
 * `false` en second si la ligne a bougé — deux onglets qui déposent un logo en
 * même temps ne doivent pas s'écraser en silence.
 */
export async function enregistrerLogo(
  db: PrismaCadre,
  entree: { cle: string | null; version: number },
): Promise<{ fait: boolean; ancienne: string | null }> {
  const avant = await db.organisation.findFirst({ select: { logoCle: true } })

  const { count } = await db.organisation.updateMany({
    where: { version: entree.version },
    data: { logoCle: entree.cle, version: { increment: 1 } },
  })

  if (count === 0) return { fait: false, ancienne: null }
  return { fait: true, ancienne: avant?.logoCle ?? null }
}

/**
 * Enregistrement sous contrôle de version. Renvoie « false » si la ligne a bougé
 * entre-temps — deux onglets qui corrigent l'adresse ne doivent pas s'écraser.
 */
export async function enregistrerOrganisation(
  db: PrismaCadre,
  entree: { raisonSociale: string; adresse: string; telephone: string; version: number },
): Promise<boolean> {
  const { count } = await db.organisation.updateMany({
    where: { version: entree.version },
    data: {
      raisonSociale: entree.raisonSociale,
      adresse: entree.adresse,
      telephone: entree.telephone,
      version: { increment: 1 },
    },
  })
  return count > 0
}
