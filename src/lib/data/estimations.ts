import 'server-only'
import { cadre, type PrismaCadre } from '@/lib/prisma'
import type { StatutClient, StatutEstimation, TypeClient } from '@/generated/prisma/client'
import { composerReference, formaterMontant } from '@/lib/domaine/estimation'
import { ajouterJours, aujourdHui } from '@/lib/domaine/dates'

/**
 * Couche d'accès aux données — calculateur d'estimations.
 *
 * INVARIANT N°2 : aucun appel Prisma n'est écrit hors de `lib/data/`. C'est le
 * seul dossier à auditer quand on se demande qui peut lire quoi.
 *
 * Toutes les fonctions reçoivent le client **déjà cadré** : la condition
 * d'entreprise est injectée par l'extension de `lib/prisma.ts`. Ne l'écrivez PAS
 * à la main — la doubler masquerait le jour où l'extension cesserait d'agir.
 */

/** Prisma rend des `Decimal` ; ils ne traversent pas la frontière serveur/client. */
type Decimalish = { toString(): string }
function nombre(valeur: Decimalish): number {
  return Number(valeur.toString())
}

const VIVANTES = { deletedAt: null } as const

/* ══════════════════════════════════════════════════════════════════
   Grille de tarifs — lecture seule ici. L'écran d'administration l'écrit.
   ══════════════════════════════════════════════════════════════════ */

export type ProduitCalculateur = {
  id: string
  nom: string
  unite: string
  prixUnitaire: number
}

export type GrilleCalculateur = {
  id: string
  numero: number
  produits: ProduitCalculateur[]
}

/**
 * Grille active de l'entreprise — celle que le calculateur propose.
 *
 * Les produits retirés du catalogue sont écartés de la saisie, mais restent
 * lisibles dans les estimations passées : elles en ont recopié les valeurs.
 */
export async function grilleActive(db: PrismaCadre): Promise<GrilleCalculateur | null> {
  const grille = await db.grilleTarifs.findFirst({
    where: { actif: true },
    orderBy: { numero: 'desc' },
    select: {
      id: true,
      numero: true,
      produits: {
        where: { actif: true },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        select: { id: true, nom: true, unite: true, prixUnitaire: true },
      },
    },
  })

  if (!grille) return null

  return {
    id: grille.id,
    numero: grille.numero,
    produits: grille.produits.map((p) => ({
      id: p.id,
      nom: p.nom,
      unite: p.unite,
      prixUnitaire: nombre(p.prixUnitaire),
    })),
  }
}

/* ══════════════════════════════════════════════════════════════════
   Clients — recherche et création rapide (EST-7)
   ══════════════════════════════════════════════════════════════════ */

export type ClientRattachement = {
  id: string
  nom: string
  type: TypeClient
  statut: StatutClient
}

/**
 * Clients de l'entreprise, pour le rattachement de fin d'appel.
 *
 * La liste est chargée entière et filtrée à l'écran : pendant un appel, un
 * aller-retour réseau par frappe se sent. Elle est volontairement réduite à
 * quatre colonnes — le CRM sert les fiches complètes.
 */
export async function listerClientsPourRattachement(
  db: PrismaCadre,
): Promise<ClientRattachement[]> {
  return db.client.findMany({
    where: VIVANTES,
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true, type: true, statut: true },
  })
}

export async function creerClientRapide(
  db: PrismaCadre,
  entree: { nom: string; telephone: string },
): Promise<{ id: string; nom: string }> {
  return db.client.create({
    // Deux champs seulement : le reste de la fiche se complète plus tard depuis
    // le CRM. Un formulaire complet ici ferait perdre l'appel.
    data: cadre({
      type: 'particulier' as const,
      nom: entree.nom,
      telephone: entree.telephone || null,
    }),
    select: { id: true, nom: true },
  })
}

/* ══════════════════════════════════════════════════════════════════
   Estimations — lecture
   ══════════════════════════════════════════════════════════════════ */

export type EstimationListe = {
  id: string
  reference: string
  clientNom: string
  clientId: string | null
  date: Date
  total: number
  statut: StatutEstimation
  valideJusquau: Date | null
  version: number
}

export async function compterEstimations(db: PrismaCadre): Promise<number> {
  return db.estimation.count({ where: VIVANTES })
}

/**
 * Fenêtre des estimations bientôt périmées — la tuile du tableau de bord CRM
 * mène ici avec ce filtre. Seules les estimations ENVOYÉES comptent : un
 * brouillon n'attend la réponse de personne.
 */
function fenetreExpiration() {
  // `valideJusquau` est une colonne `@db.Date` : les bornes se posent à minuit
  // UTC, là où la valeur a été écrite. Le jour de référence, lui, est celui du
  // QUÉBEC — le processus tourne en UTC et serait déjà demain dès 19 h.
  const debut = aujourdHui()
  return { statut: 'envoye' as const, valideJusquau: { gte: debut, lte: ajouterJours(debut, 7) } }
}

export async function listerEstimations(
  db: PrismaCadre,
  filtre: { expirantSousSeptJours?: boolean } = {},
  /*
    Aperçu de l'entrée du module : cinq lignes. Sans elle, on désérialisait tout
    le dossier — trois dossiers à cinq cents estimations font quinze cents lignes
    ramenées pour en afficher quinze. Le tri étant fait en base, la coupe l'est
    aussi : `take` rend exactement les mêmes lignes que l'ancien `.slice(0, 5)`.
  */
  limite?: number,
): Promise<EstimationListe[]> {
  const lignes = await db.estimation.findMany({
    where: {
      ...VIVANTES,
      ...(filtre.expirantSousSeptJours && fenetreExpiration()),
    },
    orderBy: { createdAt: 'desc' },
    ...(limite !== undefined && { take: limite }),
    select: {
      id: true,
      reference: true,
      clientId: true,
      createdAt: true,
      total: true,
      statut: true,
      valideJusquau: true,
      version: true,
      client: { select: { nom: true } },
    },
  })

  return lignes.map((e) => ({
    id: e.id,
    reference: e.reference,
    clientId: e.clientId,
    // Un client supprimé délie l'estimation sans l'effacer : le document reste
    // consultable, il n'a simplement plus de dossier.
    clientNom: e.client?.nom ?? 'Client retiré du dossier',
    date: e.createdAt,
    total: nombre(e.total),
    statut: e.statut,
    valideJusquau: e.valideJusquau,
    version: e.version,
  }))
}

export type LigneDocument = {
  designation: string
  unite: string
  prixUnitaire: number
  quantite: number
  sousTotal: number
}

export type EstimationDocument = {
  id: string
  reference: string
  statut: StatutEstimation
  version: number
  date: Date
  emiseLe: Date | null
  valideJusquau: Date | null
  origineId: string | null
  creeParNom: string
  client: {
    id: string
    nom: string
    telephone: string | null
    adresse: string | null
  } | null
  lignes: LigneDocument[]
  fraisDeplacement: number
  majorationPct: number
  rabaisMontant: number
  rabaisPct: number
  sousTotal: number
  tps: number
  tvq: number
  total: number
  tauxTps: number
  tauxTvq: number
}

/**
 * Une estimation telle qu'elle a été émise — exigence EST-12.
 *
 * Rien n'est recalculé : ni les montants, ni les taux, ni les libellés de
 * lignes. Une estimation relue dans deux ans doit afficher ce que le client a
 * reçu, pas ce que les tarifs d'aujourd'hui produiraient.
 */
export async function estimationParId(
  db: PrismaCadre,
  id: string,
): Promise<EstimationDocument | null> {
  const e = await db.estimation.findFirst({
    where: { id, ...VIVANTES },
    select: {
      id: true,
      reference: true,
      statut: true,
      version: true,
      createdAt: true,
      emiseLe: true,
      valideJusquau: true,
      origineId: true,
      creeParNom: true,
      fraisDeplacement: true,
      majorationPct: true,
      rabaisMontant: true,
      rabaisPct: true,
      sousTotal: true,
      tps: true,
      tvq: true,
      total: true,
      tauxTps: true,
      tauxTvq: true,
      client: {
        select: { id: true, nom: true, telephone: true, adresse: true },
      },
      lignes: {
        orderBy: { ordre: 'asc' },
        select: {
          designation: true,
          unite: true,
          prixUnitaire: true,
          quantite: true,
          sousTotal: true,
        },
      },
    },
  })

  if (!e) return null

  return {
    id: e.id,
    reference: e.reference,
    statut: e.statut,
    version: e.version,
    date: e.createdAt,
    emiseLe: e.emiseLe,
    valideJusquau: e.valideJusquau,
    origineId: e.origineId,
    creeParNom: e.creeParNom,
    client: e.client,
    lignes: e.lignes.map((l) => ({
      designation: l.designation,
      unite: l.unite,
      prixUnitaire: nombre(l.prixUnitaire),
      quantite: nombre(l.quantite),
      sousTotal: nombre(l.sousTotal),
    })),
    fraisDeplacement: nombre(e.fraisDeplacement),
    majorationPct: nombre(e.majorationPct),
    rabaisMontant: nombre(e.rabaisMontant),
    rabaisPct: nombre(e.rabaisPct),
    sousTotal: nombre(e.sousTotal),
    tps: nombre(e.tps),
    tvq: nombre(e.tvq),
    total: nombre(e.total),
    tauxTps: nombre(e.tauxTps),
    tauxTvq: nombre(e.tauxTvq),
  }
}

export type EstimationExport = {
  reference: string
  clientNom: string
  date: Date
  valideJusquau: Date | null
  statut: StatutEstimation
  lignes: LigneDocument[]
  /** Ajustements — sans eux, la somme des lignes n'est pas le montant émis. */
  fraisDeplacement: number
  majorationPct: number
  rabaisMontant: number
  rabaisPct: number
  sousTotal: number
  tps: number
  tvq: number
  total: number
}

/**
 * Toutes les estimations avec leurs lignes — export QuickBooks (EST-14).
 *
 * Une seule requête : l'export porte sur l'ensemble du fonds, et une lecture par
 * estimation multiplierait les allers-retours vers Neon par le nombre de lignes
 * du fichier produit.
 */
/**
 * Passe à « Expiré » les estimations dont la validité est dépassée — EST-13.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le seul statut que le système ait le droit de poser lui-même.
 *
 * EST-8 interdit qu'un statut CLIENT change tout seul, et c'est une règle de
 * confiance : un dossier ne doit pas avancer sans qu'on l'ait décidé. Ici, rien
 * n'est décidé — une date est passée. Refuser de l'inscrire ne préserve aucune
 * intention, cela laisse simplement la base affirmer qu'une soumission de l'an
 * dernier attend encore une réponse.
 *
 * L'opération reste réversible : l'administrateur peut remettre une estimation
 * à « Envoyé » si le client se manifeste en retard.
 *
 * `valideJusquau` est une colonne DATE : la borne se pose donc à minuit UTC, là
 * où la valeur a été écrite. Le jour de l'échéance lui-même reste valide.
 *
 * Le jour de référence vient de `aujourdHui()`, au calendrier du Québec. Avec
 * l'horloge du processus — en UTC sur le VPS —, chaque soirée à partir de 19 h
 * expirait les estimations encore valides jusqu'au lendemain. Et comme cette
 * fonction ÉCRIT en base, le statut faux ne se corrigeait pas au matin.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function expirerEstimationsEchues(db: PrismaCadre): Promise<number> {
  const { count } = await db.estimation.updateMany({
    where: {
      ...VIVANTES,
      statut: 'envoye',
      valideJusquau: { lt: aujourdHui() },
    },
    data: { statut: 'expire', version: { increment: 1 } },
  })
  return count
}

export async function estimationsPourExport(db: PrismaCadre): Promise<EstimationExport[]> {
  const lignes = await db.estimation.findMany({
    /*
      Seules les estimations ENVOYÉES ou ACCEPTÉES partent en comptabilité.

      L'export ramenait tout : brouillons, refusées, expirées. Reprendre ce
      fichier en facturation aurait créé des documents pour des estimations que
      le client a refusées — et pour des brouillons qu'il n'a jamais vus.

      « Refusé » et « Expiré » sont exclus parce qu'ils n'aboutiront pas ;
      « Brouillon » parce qu'il n'a pas été transmis.
    */
    where: { ...VIVANTES, statut: { in: ['envoye', 'accepte'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      reference: true,
      createdAt: true,
      valideJusquau: true,
      statut: true,
      fraisDeplacement: true,
      majorationPct: true,
      rabaisMontant: true,
      rabaisPct: true,
      sousTotal: true,
      tps: true,
      tvq: true,
      total: true,
      client: { select: { nom: true } },
      lignes: {
        orderBy: { ordre: 'asc' },
        select: {
          designation: true,
          unite: true,
          prixUnitaire: true,
          quantite: true,
          sousTotal: true,
        },
      },
    },
  })

  return lignes.map((e) => ({
    reference: e.reference,
    clientNom: e.client?.nom ?? '',
    date: e.createdAt,
    valideJusquau: e.valideJusquau,
    statut: e.statut,
    fraisDeplacement: nombre(e.fraisDeplacement),
    majorationPct: nombre(e.majorationPct),
    rabaisMontant: nombre(e.rabaisMontant),
    rabaisPct: nombre(e.rabaisPct),
    sousTotal: nombre(e.sousTotal),
    tps: nombre(e.tps),
    tvq: nombre(e.tvq),
    total: nombre(e.total),
    lignes: e.lignes.map((l) => ({
      designation: l.designation,
      unite: l.unite,
      prixUnitaire: nombre(l.prixUnitaire),
      quantite: nombre(l.quantite),
      sousTotal: nombre(l.sousTotal),
    })),
  }))
}

/* ══════════════════════════════════════════════════════════════════
   Estimations — écriture
   ══════════════════════════════════════════════════════════════════ */

export type EntreeEnregistrement = {
  prefixe: string
  annee: number
  clientId: string
  lignes: LigneDocument[]
  fraisDeplacement: number
  majorationPct: number
  rabaisMontant: number
  rabaisPct: number
  sousTotal: number
  tps: number
  tvq: number
  total: number
  tauxTps: number
  tauxTvq: number
  valideJusquau: Date
  grilleId: string | null
  origineId: string | null
  creeParId: string
  creeParNom: string
  /** Exigence EST-8 — sans effet si le client n'est plus au statut Prospect. */
  marquerContacte: boolean
}

export type ResultatEnregistrement = {
  id: string
  reference: string
  clientNom: string
  statutClientChange: boolean
}

/**
 * Enregistre une estimation et la fait entrer dans le dossier du client.
 *
 * Tout se joue dans une transaction : le numéro, l'estimation, ses lignes,
 * l'entrée de chronologie et l'éventuel passage à « Contacté ». Un numéro
 * consommé sans estimation laisserait un trou dans la séquence ; une estimation
 * sans entrée de chronologie serait invisible du CRM.
 *
 * L'extension de cloisonnement s'applique aussi à l'intérieur de la transaction :
 * le client transmis au rappel est le client cadré.
 */
export async function enregistrerEstimation(
  db: PrismaCadre,
  entree: EntreeEnregistrement,
): Promise<ResultatEnregistrement> {
  return db.$transaction(async (tx) => {
    /**
     * Numérotation séquentielle par entreprise et par année (exigence EST-10).
     *
     * L'incrément est une écriture atomique sur une ligne unique : deux
     * estimations nées la même seconde attendent l'une l'autre. Un
     * `max(numero) + 1` calculé à la volée produirait deux fois le même numéro.
     *
     * Le cas de la toute première estimation de l'année reste une course : deux
     * transactions peuvent tenter la création simultanément, l'une échoue sur la
     * contrainte d'unicité et l'utilisateur recommence. Une fois par an et par
     * entreprise au pire — le prix d'une séquence sans doublon.
     */
    const majSequence = await tx.sequenceEstimation.updateMany({
      where: { annee: entree.annee },
      data: { dernier: { increment: 1 } },
    })
    if (majSequence.count === 0) {
      await tx.sequenceEstimation.create({
        data: cadre({ annee: entree.annee, dernier: 1 }),
      })
    }
    const sequence = await tx.sequenceEstimation.findFirstOrThrow({
      where: { annee: entree.annee },
      select: { dernier: true },
    })

    const numero = sequence.dernier
    const reference = composerReference(entree.prefixe, entree.annee, numero)

    const client = await tx.client.findFirstOrThrow({
      where: { id: entree.clientId, ...VIVANTES },
      select: { id: true, nom: true },
    })

    const estimation = await tx.estimation.create({
      data: cadre({
        annee: entree.annee,
        numero,
        reference,
        clientId: client.id,
        fraisDeplacement: entree.fraisDeplacement,
        majorationPct: entree.majorationPct,
        rabaisMontant: entree.rabaisMontant,
        rabaisPct: entree.rabaisPct,
        sousTotal: entree.sousTotal,
        tps: entree.tps,
        tvq: entree.tvq,
        total: entree.total,
        tauxTps: entree.tauxTps,
        tauxTvq: entree.tauxTvq,
        grilleId: entree.grilleId,
        origineId: entree.origineId,
        valideJusquau: entree.valideJusquau,
        creeParId: entree.creeParId,
        creeParNom: entree.creeParNom,
      }),
      select: { id: true },
    })

    // Les lignes recopient le produit — voir EST-12. `createMany` reçoit le slug
    // de l'extension, ligne par ligne.
    await tx.ligneEstimation.createMany({
      data: entree.lignes.map((l, ordre) =>
        cadre({
          estimationId: estimation.id,
          designation: l.designation,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          quantite: l.quantite,
          sousTotal: l.sousTotal,
          ordre,
        }),
      ),
    })

    /*
      ─────────────────────────────────────────────────────────────────────
      La relance en cours est REPORTÉE sur la nouvelle entrée.

      Le CRM déduit la relance courante de la DERNIÈRE interaction du client
      (voir la note de tête de `lib/data/crm.ts`). Cette règle a été écrite pour
      des entrées saisies à la main : consigner un nouvel appel remplace
      délibérément le plan précédent.

      Elle ne survit pas à une interaction créée par une AUTRE partie du système.
      Sans ce report, enregistrer une estimation au dossier faisait disparaître
      la relance planifiée de tous les écrans de suivi — tableau de bord, colonne
      « Prochaine relance », carte de la fiche. La ligne d'origine gardait sa
      date, mais plus personne ne la lisait, et rien ne le signalait.

      C'est le geste le plus courant du produit : on calcule pendant l'appel, on
      enregistre au dossier. Il ne peut pas effacer le rappel qu'on vient de poser.
      ─────────────────────────────────────────────────────────────────────
    */
    const derniere = await tx.interaction.findFirst({
      where: { clientId: client.id, deletedAt: null },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { prochaineAction: true, prochaineActionLe: true },
    })

    // Exigence EST-9 — l'estimation apparaît dans la chronologie avec son montant.
    await tx.interaction.create({
      data: cadre({
        clientId: client.id,
        type: 'soumission' as const,
        date: new Date(),
        resume: `Estimation ${reference} — ${formaterMontant(entree.total)}.`,
        auteurId: entree.creeParId,
        auteurNom: entree.creeParNom,
        estimationId: estimation.id,
        prochaineAction: derniere?.prochaineAction ?? null,
        prochaineActionLe: derniere?.prochaineActionLe ?? null,
      }),
      select: { id: true },
    })

    /**
     * Exigence EST-8. La condition `statut: 'prospect'` est l'invariant : la case
     * ne fait jamais reculer un dossier déjà avancé. Elle est portée par la
     * requête, non par une lecture préalable — entre le `findFirst` et l'`update`,
     * le statut aurait pu changer.
     */
    let statutClientChange = false
    if (entree.marquerContacte) {
      const maj = await tx.client.updateMany({
        where: { id: client.id, statut: 'prospect', ...VIVANTES },
        data: { statut: 'contacte', version: { increment: 1 } },
      })
      statutClientChange = maj.count > 0
    }

    return {
      id: estimation.id,
      reference,
      clientNom: client.nom,
      statutClientChange,
    }
  })
}

/**
 * Change le statut d'une estimation.
 *
 * `version` protège de l'écrasement silencieux : deux onglets qui font avancer
 * la même estimation ne doivent pas se contredire sans que personne le sache.
 */
/**
 * D'où chaque statut peut venir — EST-12.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La condition n'existait pas, et l'interface seule tenait la règle.
 *
 * `where` ne portait que l'identifiant et la version. Émettre une estimation
 * DÉJÀ envoyée la remettait donc à « envoyée » et reposait `emiseLe` à
 * maintenant : le document remis au client changeait de date sans que rien ne
 * l'indique. Et `brouillon → accepte` passait aussi, c'est-à-dire accepter un
 * devis jamais transmis.
 *
 * Un Server Action ne traverse pas l'interface. La règle doit donc être dans la
 * requête, où la base la fait respecter, et non dans les boutons que l'écran
 * choisit d'afficher.
 *
 * `brouillon` n'a aucun prédécesseur : on ne revient jamais en arrière. Une
 * estimation partie chez un client ne redevient pas un brouillon — on en
 * duplique une nouvelle.
 * ─────────────────────────────────────────────────────────────────────────
 */
const STATUTS_PRECEDENTS: Readonly<Record<StatutEstimation, readonly StatutEstimation[]>> = {
  brouillon: [],
  envoye: ['brouillon'],
  accepte: ['envoye'],
  refuse: ['envoye'],
  expire: ['envoye'],
}

/**
 * `transition` distingue un refus de RÈGLE d'un conflit de version : les deux
 * appellent des messages opposés, l'un « rechargez », l'autre « ce n'est pas
 * possible depuis cet état ». La seconde requête n'a lieu que sur l'échec.
 */
export type IssueStatut = 'ok' | 'concurrence' | 'transition'

export async function changerStatutEstimation(
  db: PrismaCadre,
  entree: {
    id: string
    statut: StatutEstimation
    version: number
    /** Pose la date d'émission : à partir de là, le document est figé. */
    emettre: boolean
  },
): Promise<IssueStatut> {
  const depuis = STATUTS_PRECEDENTS[entree.statut]
  if (depuis.length === 0) return 'transition'

  const maj = await db.estimation.updateMany({
    where: {
      id: entree.id,
      version: entree.version,
      statut: { in: [...depuis] },
      ...VIVANTES,
    },
    data: {
      statut: entree.statut,
      version: { increment: 1 },
      ...(entree.emettre && { emiseLe: new Date() }),
    },
  })

  if (maj.count > 0) return 'ok'

  const aLaVersion = await db.estimation.count({
    where: { id: entree.id, version: entree.version, ...VIVANTES },
  })

  return aLaVersion > 0 ? 'transition' : 'concurrence'
}
