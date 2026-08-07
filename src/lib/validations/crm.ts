import { z } from 'zod'
import type { StatutClient, TypeClient, TypeInteraction } from '@/generated/prisma/client'
import {
  LIBELLE_TYPE_CLIENT,
  LIBELLE_TYPE_INTERACTION,
  ORDRE_STATUT_CLIENT,
  STATUTS_FERMES,
} from '@/config/crm'
import { estEntreprise, type EntrepriseSlug } from '@/config/entreprises'

/**
 * Schémas du CRM, partagés entre les formulaires et la fabrique d'actions.
 *
 * Les listes de valeurs sont DÉRIVÉES des libellés de `config/crm.ts` plutôt que
 * réécrites : un statut ajouté au schéma Prisma casse la compilation de
 * `config/crm.ts` avant d'atteindre ce fichier, et rien ne peut diverger.
 */

const TYPES_CLIENT = Object.keys(LIBELLE_TYPE_CLIENT) as [TypeClient, ...TypeClient[]]
const TYPES_INTERACTION = Object.keys(LIBELLE_TYPE_INTERACTION) as [
  TypeInteraction,
  ...TypeInteraction[],
]
const STATUTS_CLIENT = [...ORDRE_STATUT_CLIENT] as [StatutClient, ...StatutClient[]]
const FERMES: readonly StatutClient[] = STATUTS_FERMES

/**
 * Le slug arrive de l'URL ou d'un champ caché : il est saisi par l'utilisateur.
 * `createActionCloisonnee` le revalide de son côté — ce contrôle-ci ne fait que
 * rejeter l'entrée plus tôt, avec un message utilisable.
 */
export const slugEntreprise = z.custom<EntrepriseSlug>(estEntreprise, 'Cette page n’existe pas.')

/** Champ texte facultatif : la chaîne vide d'un formulaire vaut « non renseigné ». */
function facultatif(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))
}

/**
 * Les colonnes de date sont en `@db.Date` : elles n'ont pas d'heure. On fixe
 * minuit UTC pour que la valeur relue soit exactement celle qui a été saisie,
 * quel que soit le fuseau du serveur.
 */
function jourUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

const dateJour = z.iso.date('Indiquez une date valide.').transform(jourUtc)

const dateJourFacultative = z
  .union([z.literal(''), z.iso.date('Indiquez une date valide.')])
  .optional()
  .transform((v) => (v ? jourUtc(v) : null))

const nomClient = z
  .string()
  .trim()
  .min(2, 'Au moins deux caractères.')
  .max(160, 'Cent soixante caractères au maximum.')

const courrielClient = z
  .union([z.literal(''), z.email('Le format attendu est nom@domaine.ca')])
  .optional()
  .transform((v) => (v ? v : null))

/** CRM-3 — champs de la fiche client. */
export const creerClientSchema = z.object({
  entreprise: slugEntreprise,
  type: z.enum(TYPES_CLIENT),
  nom: nomClient,
  personneRessource: facultatif(120),
  courriel: courrielClient,
  telephone: facultatif(40),
  adresse: facultatif(240),
  provenance: facultatif(120),
  notes: facultatif(4000),
})

export const modifierClientSchema = creerClientSchema.extend({
  clientId: z.string().min(1),
  /** Contrôle de concurrence : rejette une modification faite sur une version périmée. */
  version: z.number().int().min(0),
})

/**
 * CRM-5 — le passage à Gagné ou Perdu exige une confirmation et un motif. La
 * confirmation est affaire d'interface ; le motif, lui, se vérifie ici : une
 * action appelée directement en HTTP ne verra jamais la boîte de dialogue.
 */
export const changerStatutSchema = z
  .object({
    entreprise: slugEntreprise,
    clientId: z.string().min(1),
    statut: z.enum(STATUTS_CLIENT),
    motifCloture: facultatif(500),
    version: z.number().int().min(0),
  })
  .refine((v) => !FERMES.includes(v.statut) || Boolean(v.motifCloture), {
    path: ['motifCloture'],
    message: 'Indiquez le motif de la décision.',
  })

/** CRM-4 — type, date, résumé, et prochaine action prévue avec sa date. */
export const ajouterInteractionSchema = z
  .object({
    entreprise: slugEntreprise,
    clientId: z.string().min(1),
    type: z.enum(TYPES_INTERACTION),
    date: dateJour,
    resume: z
      .string()
      .trim()
      .min(2, 'Au moins deux caractères.')
      .max(2000, 'Deux mille caractères au maximum.'),
    prochaineAction: facultatif(200),
    prochaineActionLe: dateJourFacultative,
  })
  .refine((v) => !v.prochaineAction || v.prochaineActionLe !== null, {
    path: ['prochaineActionLe'],
    message: 'Indiquez la date de la prochaine action.',
  })

/**
 * Report ou annulation d'une relance déjà planifiée. Elle porte sur une
 * interaction précise — voir la note d'en-tête de `lib/data/crm.ts` sur la
 * façon dont un client obtient sa date de relance.
 */
export const planifierRelanceSchema = z.object({
  entreprise: slugEntreprise,
  clientId: z.string().min(1),
  interactionId: z.string().min(1),
  prochaineAction: facultatif(200),
  prochaineActionLe: dateJourFacultative,
  version: z.number().int().min(0),
})

/** CRM-7 — suppression réversible : la fiche est marquée, jamais effacée. */
export const supprimerClientSchema = z.object({
  entreprise: slugEntreprise,
  clientId: z.string().min(1),
})

/** CRM-7 — la contrepartie de la suppression, exigée par le même point. */
export const restaurerClientSchema = supprimerClientSchema
