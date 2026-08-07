import { z } from 'zod'
import { type EntrepriseSlug, estEntreprise } from '@/config/entreprises'

/**
 * Schémas du calculateur — partagés entre le formulaire et la fabrique
 * d'actions. Une seule source de vérité pour les règles de saisie.
 */

/**
 * Le slug arrive de l'URL ou d'un champ caché : il n'a aucune valeur de preuve.
 * `estEntreprise` est la dernière barrière avant le cadrage.
 */
const entreprise = z.custom<EntrepriseSlug>(estEntreprise, {
  message: 'Entreprise inconnue.',
})

const montant = z
  .number()
  .min(0, 'Un montant ne peut pas être négatif.')
  .max(9_999_999.99, 'Montant hors des limites.')

const pourcentage = z
  .number()
  .min(0, 'Un pourcentage ne peut pas être négatif.')
  .max(100, 'Cent pour cent au maximum.')

/**
 * Une ligne RECOPIE le produit, elle ne le référence pas (exigence EST-12).
 *
 * `produitId` n'est qu'une piste : quand il désigne un produit encore présent
 * dans la grille active, le serveur reprend le libellé, l'unité et le prix de la
 * grille. Sinon — révision d'une estimation dont le produit a été retiré du
 * catalogue — les valeurs figées transmises ici font foi.
 */
export const ligneEstimationSchema = z.object({
  produitId: z.string().min(1).nullable().default(null),
  designation: z.string().trim().min(1, 'Désignation manquante.').max(200),
  unite: z.string().trim().min(1, 'Unité manquante.').max(30),
  prixUnitaire: montant,
  quantite: z
    .number()
    .positive('La quantité doit être supérieure à zéro.')
    .max(999_999, 'Quantité hors des limites.'),
})

const corpsEstimation = {
  entreprise,
  lignes: z.array(ligneEstimationSchema).min(1, 'Ajoutez au moins un service.').max(60),
  fraisDeplacement: montant.default(0),
  majorationPct: pourcentage.default(0),
  rabaisMontant: montant.default(0),
  rabaisPct: pourcentage.default(0),
  /** Trace de la grille utilisée, jamais dépendance de calcul. */
  grilleId: z.string().min(1).nullable().default(null),
  /** Exigence EST-6 : le rattachement est une action de fin, pas une condition de départ. */
  clientId: z.string().min(1, 'Choisissez un client.'),
  /**
   * Exigence EST-8. Cochée par défaut côté écran, mais sans effet si le client
   * n'est plus au statut Prospect : aucun statut ne change automatiquement.
   */
  marquerContacte: z.boolean().default(true),
}

export const enregistrerEstimationSchema = z.object(corpsEstimation)

/** Exigence EST-11 — l'original n'est jamais modifié : `origineId` garde le lien. */
export const dupliquerEstimationSchema = z.object({
  ...corpsEstimation,
  origineId: z.string().min(1, 'Estimation d’origine manquante.'),
})

export const emettreEstimationSchema = z.object({
  entreprise,
  estimationId: z.string().min(1),
  /** Contrôle de concurrence : rejette une modification faite sur une version périmée. */
  version: z.number().int().min(0),
})

export const changerStatutEstimationSchema = z.object({
  entreprise,
  estimationId: z.string().min(1),
  // « envoye » est absent volontairement : l'émission est une action distincte,
  // qui pose la date d'émission et fige le document.
  statut: z.enum(['accepte', 'refuse', 'expire']),
  version: z.number().int().min(0),
})

/**
 * Création rapide d'une fiche client pendant un appel — deux champs (EST-7).
 *
 * Action distincte de l'enregistrement de l'estimation, et non fondue dedans :
 * la fabrique n'inscrit qu'un libellé par action, et « Création d'une fiche
 * client » ne doit pas disparaître du journal derrière « Création d'une
 * estimation ».
 */
export const creerClientRapideSchema = z.object({
  entreprise,
  nom: z.string().trim().min(2, 'Au moins deux caractères.').max(120),
  telephone: z.string().trim().max(40).default(''),
})
