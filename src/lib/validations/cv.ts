import { z } from 'zod'
import { TAILLE_MAX_OCTETS, TYPES_ACCEPTES } from '@/lib/storage'

/**
 * Schémas de la banque de CV, partagés entre le formulaire et la fabrique
 * d'actions. Une seule source de vérité pour les règles de saisie.
 */

const typeMime = z.enum(TYPES_ACCEPTES, {
  message: 'Formats acceptés : PDF, DOC et DOCX.',
})

export const preparerTeleversementSchema = z.object({
  nom: z.string().trim().min(1, 'Nom de fichier manquant.').max(255),
  typeMime,
  taille: z
    .number()
    .int()
    .positive()
    .max(TAILLE_MAX_OCTETS, 'La taille maximale est de 10 Mo par fichier.'),
})

/**
 * Forme EXACTE d'une clé produite par `nouvelleCle` : `cv/<uuid>.<ext>`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elle était acceptée telle quelle, et rien ne la rattachait à celle qu'on
 * venait d'émettre.
 *
 * Deux conséquences. La confirmation pouvait être rejouée : deux lignes
 * `FichierCv` désignant le même objet, dont la première purge efface le contenu
 * — la seconde reste alors en liste et son téléchargement mène nulle part.
 *
 * Et surtout, l'action efface l'objet dont on lui donne la clé quand le type ne
 * convient pas. C'était donc une primitive « supprime cet objet du stockage »
 * ouverte à tout titulaire de `cv:televerser`, sans `cv:supprimer` et sans
 * entrée « Suppression d'un CV » au journal. Seul le fait que les clés sont des
 * UUID jamais transmis au navigateur d'autrui la rendait inoffensive — une
 * garantie qui tient à ce qui n'a pas encore fuité.
 * ─────────────────────────────────────────────────────────────────────────
 */
const cleCv = z
  .string()
  .regex(
    /^cv\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/,
    'Clé de dépôt invalide.',
  )

export const confirmerTeleversementSchema = z.object({
  cle: cleCv,
  nom: z.string().trim().min(1).max(255),
  categorieIds: z.array(z.string().min(1)).default([]),
})

export const deplacerFichierSchema = z.object({
  fichierId: z.string().min(1),
  categorieIds: z.array(z.string().min(1)).default([]),
  /** Contrôle de concurrence : rejette une modification faite sur une version périmée. */
  version: z.number().int().min(0),
})

export const supprimerFichierSchema = z.object({
  fichierId: z.string().min(1),
})

export const restaurerFichierSchema = z.object({
  fichierId: z.string().min(1),
})

const nomCategorie = z
  .string()
  .trim()
  .min(2, 'Au moins deux caractères.')
  .max(60, 'Soixante caractères au maximum.')

export const creerCategorieSchema = z.object({ nom: nomCategorie })

export const renommerCategorieSchema = z.object({
  categorieId: z.string().min(1),
  nom: nomCategorie,
  /** Version lue à l'affichage — contrôle de concurrence, TR-10. */
  version: z.number().int().min(0),
})

export const supprimerCategorieSchema = z.object({
  categorieId: z.string().min(1),
})

export const reordonnerCategoriesSchema = z.object({
  /** Identifiants dans l'ordre voulu — la position dans le tableau fait l'ordre. */
  categorieIds: z.array(z.string().min(1)).min(1),
})
