/**
 * Libellés du CRM et du calculateur.
 *
 * La base stocke des identifiants, l'écran affiche du français. Ces chaînes
 * viennent de la section 19 d'`architecture.MD` — elles ne s'inventent pas au
 * fil de l'écriture, sinon le même statut finit par porter trois noms selon la
 * page où on le lit.
 */
import type {
  StatutClient,
  StatutEstimation,
  TypeClient,
  TypeInteraction,
} from '@/generated/prisma/client'

export const LIBELLE_TYPE_CLIENT: Readonly<Record<TypeClient, string>> = {
  particulier: 'Particulier',
  entreprise: 'Entreprise',
}

export const LIBELLE_STATUT_CLIENT: Readonly<Record<StatutClient, string>> = {
  prospect: 'Prospect',
  contacte: 'Contacté',
  soumission_envoyee: 'Soumission envoyée',
  gagne: 'Gagné',
  perdu: 'Perdu',
}

/** Ordre d'affichage — celui du cycle de vente, pas l'alphabétique. */
export const ORDRE_STATUT_CLIENT = [
  'prospect',
  'contacte',
  'soumission_envoyee',
  'gagne',
  'perdu',
] as const satisfies readonly StatutClient[]

/** Statuts fermés : ni relance à prévoir, ni estimation à envoyer. */
export const STATUTS_FERMES = ['gagne', 'perdu'] as const satisfies readonly StatutClient[]

export const LIBELLE_TYPE_INTERACTION: Readonly<Record<TypeInteraction, string>> = {
  appel: 'Appel',
  courriel: 'Courriel',
  visite: 'Visite',
  soumission: 'Soumission',
}

export const LIBELLE_STATUT_ESTIMATION: Readonly<Record<StatutEstimation, string>> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
}

export const ORDRE_STATUT_ESTIMATION = [
  'brouillon',
  'envoye',
  'accepte',
  'refuse',
  'expire',
] as const satisfies readonly StatutEstimation[]
