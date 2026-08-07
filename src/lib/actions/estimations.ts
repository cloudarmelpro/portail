'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createActionCloisonnee } from '@/lib/safe-action'
import { entreprise as infoEntreprise } from '@/config/entreprises'
import {
  changerStatutEstimation as changerStatut,
  creerClientRapide as creerClient,
  enregistrerEstimation as enregistrer,
  grilleActive,
  type LigneDocument,
} from '@/lib/data/estimations'
import {
  AJUSTEMENTS_VIDES,
  TAUX_COURANTS,
  arrondirCent,
  calculer,
  dateValidite,
} from '@/lib/domaine/estimation'
import {
  changerStatutEstimationSchema,
  creerClientRapideSchema,
  dupliquerEstimationSchema,
  emettreEstimationSchema,
  enregistrerEstimationSchema,
} from '@/lib/validations/estimations'
import type { EntrepriseSlug } from '@/config/entreprises'
import type { PrismaCadre } from '@/lib/prisma'
import type { SessionApp } from '@/lib/guards'
import { ErreurMetier } from '@/lib/erreurs'

/**
 * Actions du calculateur — toutes issues de `createActionCloisonnee`.
 *
 * Le traitement ne reçoit jamais que le client Prisma déjà cadré : il n'a aucun
 * moyen d'écrire dans une autre entreprise, même en se trompant de `where`.
 */

type Entree = z.infer<typeof enregistrerEstimationSchema> & {
  origineId?: string
}

function chemins(slug: EntrepriseSlug): string[] {
  return [`/calculateur/${slug}`, `/calculateur/${slug}/estimations`, '/calculateur']
}

/**
 * Cœur commun à l'enregistrement et à la duplication.
 *
 * Les totaux sont RECALCULÉS ici, à partir des valeurs recopiées : ceux affichés
 * par le navigateur ne sont qu'un affichage, et l'entrée d'un Server Action n'a
 * aucune valeur de preuve. Les taux et les prix retenus sont ceux que le
 * document conservera (exigence EST-12).
 */
async function poserEstimation(
  entree: Entree,
  ctx: { db: PrismaCadre; entreprise: EntrepriseSlug; session: SessionApp },
) {
  const grille = await grilleActive(ctx.db)
  const parId = new Map(grille?.produits.map((p) => [p.id, p]) ?? [])

  /**
   * Une ligne recopie le produit, elle ne le référence pas. Quand `produitId`
   * désigne un produit encore au catalogue, la grille fait foi ; sinon — révision
   * d'une estimation dont le produit a été retiré — les valeurs figées reçues
   * sont conservées telles quelles.
   */
  const lignes = entree.lignes.map((l) => {
    const produit = l.produitId ? parId.get(l.produitId) : undefined
    return {
      designation: produit?.nom ?? l.designation,
      unite: produit?.unite ?? l.unite,
      prixUnitaire: produit?.prixUnitaire ?? l.prixUnitaire,
      quantite: l.quantite,
    }
  })

  const ajustements = {
    ...AJUSTEMENTS_VIDES,
    fraisDeplacement: entree.fraisDeplacement,
    majorationPct: entree.majorationPct,
    rabaisMontant: entree.rabaisMontant,
    rabaisPct: entree.rabaisPct,
  }

  const totaux = calculer(lignes, ajustements, TAUX_COURANTS)

  const lignesDocument: LigneDocument[] = lignes.map((l, i) => ({
    ...l,
    sousTotal: totaux.lignes[i] ?? 0,
  }))

  const maintenant = new Date()

  const resultat = await enregistrer(ctx.db, {
    prefixe: infoEntreprise(ctx.entreprise).prefixe,
    annee: maintenant.getFullYear(),
    clientId: entree.clientId,
    lignes: lignesDocument,
    fraisDeplacement: totaux.fraisDeplacement,
    // Les pourcentages ne passent PAS par l'arrondi au cent : la colonne les
    // stocke à trois décimales, et 9,975 % arrondi à 9,98 % serait un autre taux.
    majorationPct: entree.majorationPct,
    rabaisMontant: arrondirCent(entree.rabaisMontant),
    rabaisPct: entree.rabaisPct,
    sousTotal: totaux.sousTotal,
    tps: totaux.tps,
    tvq: totaux.tvq,
    total: totaux.total,
    tauxTps: TAUX_COURANTS.tps,
    tauxTvq: TAUX_COURANTS.tvq,
    valideJusquau: dateValidite(maintenant),
    grilleId: entree.grilleId ?? grille?.id ?? null,
    origineId: entree.origineId ?? null,
    creeParId: ctx.session.userId,
    creeParNom: ctx.session.nom,
    marquerContacte: entree.marquerContacte,
  })

  for (const chemin of chemins(ctx.entreprise)) revalidatePath(chemin)
  // La chronologie du client vient de changer. `layout` couvre toutes les routes
  // sous /crm : leur forme exacte appartient à l'autre module, on ne la devine pas.
  revalidatePath('/crm', 'layout')

  return resultat
}

export const enregistrerEstimation = createActionCloisonnee({
  permission: 'calculateur:ecrire',
  schema: enregistrerEstimationSchema,
  action: 'Création d’une estimation',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.clientId,
  handler: poserEstimation,
})

/**
 * Exigence EST-11 — la révision est le cas le plus fréquent.
 *
 * L'original n'est jamais modifié : la copie est une estimation neuve, avec son
 * propre numéro, et `origineId` garde le lien entre les deux.
 */
export const dupliquerEstimation = createActionCloisonnee({
  permission: 'calculateur:ecrire',
  schema: dupliquerEstimationSchema,
  action: 'Duplication d’une estimation',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.origineId,
  handler: poserEstimation,
})

export const creerClientRapide = createActionCloisonnee({
  // Créer une fiche relève du CRM, même déclenché depuis le calculateur : c'est
  // la permission du module qui écrit qui décide, pas celle de l'écran d'où l'on
  // vient.
  permission: 'crm:ecrire',
  schema: creerClientRapideSchema,
  action: 'Création d’une fiche client',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.nom,
  async handler(entree, { db, entreprise }) {
    const client = await creerClient(db, {
      nom: entree.nom,
      telephone: entree.telephone,
    })
    revalidatePath('/crm', 'layout')
    for (const chemin of chemins(entreprise)) revalidatePath(chemin)
    return client
  },
})

/** Brouillon → Envoyé. À partir de la date d'émission, le document est figé. */
export const emettreEstimation = createActionCloisonnee({
  permission: 'calculateur:ecrire',
  schema: emettreEstimationSchema,
  action: 'Émission d’une estimation',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.estimationId,
  async handler(entree, { db, entreprise }) {
    const applique = await changerStatut(db, {
      id: entree.estimationId,
      statut: 'envoye',
      version: entree.version,
      emettre: true,
    })

    if (applique === 'transition') {
      throw new ErreurMetier(
        'Ce changement de statut n’est pas possible depuis l’état actuel de l’estimation.',
      )
    }

    if (applique === 'concurrence') {
      throw new ErreurMetier(
        'Cette estimation a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    for (const chemin of chemins(entreprise)) revalidatePath(chemin)
    revalidatePath(`/calculateur/${entreprise}/estimations/${entree.estimationId}`)
    return { ok: true }
  },
})

export const changerStatutEstimation = createActionCloisonnee({
  permission: 'calculateur:ecrire',
  schema: changerStatutEstimationSchema,
  action: 'Changement de statut d’une estimation',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.estimationId,
  async handler(entree, { db, entreprise }) {
    const applique = await changerStatut(db, {
      id: entree.estimationId,
      statut: entree.statut,
      version: entree.version,
      emettre: false,
    })

    if (applique === 'transition') {
      throw new ErreurMetier(
        'Ce changement de statut n’est pas possible depuis l’état actuel de l’estimation.',
      )
    }

    if (applique === 'concurrence') {
      throw new ErreurMetier(
        'Cette estimation a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    for (const chemin of chemins(entreprise)) revalidatePath(chemin)
    revalidatePath(`/calculateur/${entreprise}/estimations/${entree.estimationId}`)
    return { ok: true }
  },
})
