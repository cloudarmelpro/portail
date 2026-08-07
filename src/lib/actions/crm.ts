'use server'

import { revalidatePath } from 'next/cache'
import { createActionCloisonnee } from '@/lib/safe-action'
import type { DonneesClient } from '@/lib/data/crm'
import {
  ajouterInteraction as ajouterInteractionEnBase,
  changerStatut as changerStatutEnBase,
  creerClient as creerClientEnBase,
  modifierClient as modifierClientEnBase,
  planifierRelance as planifierRelanceEnBase,
  restaurerClient as restaurerClientEnBase,
  supprimerClient as supprimerClientEnBase,
} from '@/lib/data/crm'
import {
  ajouterInteractionSchema,
  changerStatutSchema,
  creerClientSchema,
  modifierClientSchema,
  planifierRelanceSchema,
  restaurerClientSchema,
  supprimerClientSchema,
} from '@/lib/validations/crm'
import { LIBELLE_STATUT_CLIENT } from '@/config/crm'
import { ErreurMetier } from '@/lib/erreurs'

/**
 * Actions du CRM — toutes issues de `createActionCloisonnee`.
 *
 * Le traitement reçoit `db`, un client Prisma déjà cadré sur l'entreprise
 * validée. Il n'a aucun moyen d'écrire ailleurs, même en se trompant de `where`.
 *
 * `revalidatePath(…, 'layout')` porte sur le dossier entier plutôt que sur la
 * page courante : une interaction ajoutée depuis une fiche change aussi le
 * tableau de bord des relances et la liste.
 */

/**
 * Ces deux messages n'atteignent PAS encore l'écran : la fabrique remplace le
 * texte de toute erreur du traitement par « Une erreur est survenue. Réessayez ».
 * Lever reste néanmoins juste — c'est ce qui empêche le journal d'inscrire une
 * modification qui n'a pas eu lieu. Voir le rapport de module.
 */
const CONFLIT =
  'Cette fiche a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.'
const INTROUVABLE = 'Cette page n’existe pas.'

/** Isole les champs de la fiche de l'enveloppe de l'action — entreprise, version. */
function champsFiche(e: DonneesClient): DonneesClient {
  return {
    type: e.type,
    nom: e.nom,
    personneRessource: e.personneRessource,
    courriel: e.courriel,
    telephone: e.telephone,
    adresse: e.adresse,
    provenance: e.provenance,
    notes: e.notes,
  }
}

export const creerClient = createActionCloisonnee({
  permission: 'crm:ecrire',
  schema: creerClientSchema,
  action: 'Création d’une fiche client',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.nom,
  async handler(entree, { db, entreprise }) {
    const clientId = await creerClientEnBase(db, champsFiche(entree))

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { clientId }
  },
})

export const modifierClient = createActionCloisonnee({
  permission: 'crm:ecrire',
  schema: modifierClientSchema,
  action: 'Modification d’une fiche client',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.nom,
  async handler(entree, { db, entreprise }) {
    const fait = await modifierClientEnBase(
      db,
      entree.clientId,
      entree.version,
      champsFiche(entree),
    )
    if (!fait) throw new ErreurMetier(CONFLIT)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { clientId: entree.clientId }
  },
})

export const changerStatut = createActionCloisonnee({
  // CRM-5 — la confirmation et le motif sont vérifiés par le schéma : une
  // action appelée directement en HTTP ne verra jamais la boîte de dialogue.
  permission: 'crm:ecrire',
  schema: changerStatutSchema,
  action: 'Changement de statut d’un client',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) =>
    e.motifCloture
      ? `${e.clientId} → ${LIBELLE_STATUT_CLIENT[e.statut]} (${e.motifCloture})`
      : `${e.clientId} → ${LIBELLE_STATUT_CLIENT[e.statut]}`,
  async handler(entree, { db, entreprise }) {
    const fait = await changerStatutEnBase(
      db,
      entree.clientId,
      entree.version,
      entree.statut,
      entree.motifCloture,
    )
    if (!fait) throw new ErreurMetier(CONFLIT)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { statut: entree.statut }
  },
})

export const ajouterInteraction = createActionCloisonnee({
  permission: 'crm:ecrire',
  schema: ajouterInteractionSchema,
  action: 'Ajout d’une interaction',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.clientId,
  async handler(entree, { db, entreprise, session }) {
    const fait = await ajouterInteractionEnBase(db, {
      clientId: entree.clientId,
      type: entree.type,
      date: entree.date,
      resume: entree.resume,
      prochaineAction: entree.prochaineAction,
      prochaineActionLe: entree.prochaineActionLe,
      auteurId: session.userId,
      auteurNom: session.nom,
    })
    if (!fait) throw new ErreurMetier(INTROUVABLE)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { ok: true }
  },
})

export const planifierRelance = createActionCloisonnee({
  permission: 'crm:ecrire',
  schema: planifierRelanceSchema,
  action: 'Modification d’une fiche client',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.clientId,
  async handler(entree, { db, entreprise }) {
    const fait = await planifierRelanceEnBase(
      db,
      entree.clientId,
      entree.interactionId,
      entree.version,
      entree.prochaineAction,
      entree.prochaineActionLe,
    )
    if (!fait) throw new ErreurMetier(CONFLIT)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { ok: true }
  },
})

export const supprimerClient = createActionCloisonnee({
  // CRM-7 — la fiche est marquée supprimée, jamais effacée.
  permission: 'crm:supprimer',
  schema: supprimerClientSchema,
  action: 'Suppression d’une fiche client',
  sensible: true,
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.clientId,
  async handler(entree, { db, entreprise }) {
    const fait = await supprimerClientEnBase(db, entree.clientId)
    if (!fait) throw new ErreurMetier(INTROUVABLE)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { ok: true }
  },
})

export const restaurerClient = createActionCloisonnee({
  // CRM-7 — « les enregistrements restent restaurables ». La donnée l'était ;
  // l'écran manquait, donc l'exigence ne l'était pas.
  permission: 'crm:supprimer',
  schema: restaurerClientSchema,
  action: 'Restauration d’une fiche client',
  sensible: true,
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.clientId,
  async handler(entree, { db, entreprise }) {
    const fait = await restaurerClientEnBase(db, entree.clientId)
    if (!fait) throw new ErreurMetier(INTROUVABLE)

    revalidatePath(`/crm/${entreprise}`, 'layout')
    return { ok: true }
  },
})
