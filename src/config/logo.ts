/**
 * Logo d'entreprise — en-tête du document remis au client (EST-10).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi ces constantes vivent ici et non dans `lib/storage.ts`.
 *
 * Elles sont lues des TROIS côtés : le composant de dépôt, qui est client et
 * filtre avant l'aller-retour ; le schéma Zod, partagé ; et la couche de
 * stockage, qui tranche pour de bon sur les octets reçus. Or `lib/storage.ts`
 * est `server-only` — l'importer depuis le navigateur lève à la compilation.
 *
 * Les recopier de part et d'autre aurait produit trois plafonds qui divergent,
 * et le premier à dériver aurait été celui du client : il ne se voit pas.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le SVG est délibérément absent, et ce n'est pas un oubli : c'est un document
 * XML, il peut porter du script et des références externes, et il finirait rendu
 * dans une page de l'application. Un logo n'a pas besoin d'être exécutable.
 */
export const TYPES_LOGO = ['image/png', 'image/jpeg', 'image/webp'] as const

/**
 * 2 Mo. Un logo tient dans le dixième de ça ; ce plafond n'existe que pour
 * qu'une photo d'appareil déposée par mégarde soit refusée à la porte plutôt
 * qu'embarquée dans chaque devis.
 */
export const TAILLE_MAX_LOGO = 2 * 1024 * 1024

/** Message unique — l'écran et le schéma doivent refuser dans les mêmes termes. */
export const REFUS_TYPE_LOGO = 'Formats acceptés : PNG, JPEG et WebP.'
export const REFUS_TAILLE_LOGO = 'La taille maximale est de 2 Mo.'
