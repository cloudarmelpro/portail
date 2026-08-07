import { z } from 'zod'
import { REFUS_TAILLE_LOGO, REFUS_TYPE_LOGO, TAILLE_MAX_LOGO, TYPES_LOGO } from '@/config/logo'
import { MODULES, ROLES } from '@/lib/permissions'
import { estEntreprise } from '@/config/entreprises'

/**
 * Schémas du module d'administration, partagés entre les formulaires et la
 * fabrique d'actions. Une seule source de vérité pour les règles de saisie.
 */

const nomPersonne = z
  .string()
  .trim()
  .min(2, 'Au moins deux caractères.')
  .max(120, 'Cent vingt caractères au maximum.')

/**
 * Le courriel est ramené en minuscules ici plutôt que dans chaque traitement :
 * c'est la clé qui identifie un compte, et c'est aussi elle qui sert à refuser
 * qu'un administrateur agisse sur le sien.
 */
const courriel = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.email('Le format attendu est nom@domaine.ca'))

const motif = z
  .string()
  .trim()
  .min(3, 'Indiquez un motif.')
  .max(280, 'Deux cent quatre-vingts caractères au maximum.')

export const inviterUtilisateurSchema = z.object({
  nom: nomPersonne,
  courriel,
  role: z.enum(ROLES),
})
export type InviterUtilisateurEntree = z.infer<typeof inviterUtilisateurSchema>

export const modifierUtilisateurSchema = z.object({
  userId: z.string().min(1),
  nom: nomPersonne,
  courriel,
})

/**
 * Les gestes qui portent sur un compte existant le désignent par son courriel et
 * non par son identifiant : c'est ce courriel qui est inscrit au journal comme
 * élément concerné. Un identifiant opaque y serait illisible, et l'y remplacer
 * par un nom transmis depuis le navigateur laisserait forger la trace.
 */
export const changerRoleSchema = z.object({ courriel, role: z.enum(ROLES) })
export const suspendreCompteSchema = z.object({ courriel, motif })
export const reactiverCompteSchema = z.object({ courriel })
export const reinitialiserMotDePasseSchema = z.object({ courriel })

/* ══════════════════════════════════════════════════════════════════
   Grilles de tarifs — ADM-2 et ADM-3
   ══════════════════════════════════════════════════════════════════ */

/**
 * Un prix voyage en chaîne de bout en bout : saisie, validation, colonne
 * `Decimal`. Le convertir en `number` au passage suffirait à perdre le cent que
 * `Decimal` existe précisément pour garder.
 */
export const prixSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s ]/g, '').replace(',', '.'))
  .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), 'Un montant, deux décimales au maximum.')

export const produitTarifSchema = z.object({
  /**
   * Identifiant du produit dans la version en cours, absent pour une ligne
   * ajoutée. Il sert à apparier les lignes pour calculer les écarts — la
   * nouvelle version crée de toute façon ses propres lignes.
   */
  id: z.string().min(1).optional(),
  nom: z
    .string()
    .trim()
    .min(2, 'Au moins deux caractères.')
    .max(120, 'Cent vingt caractères au maximum.'),
  unite: z.string().trim().min(1, 'Indiquez une unité.').max(40, 'Quarante caractères au maximum.'),
  prixUnitaire: prixSchema,
  actif: z.boolean(),
})

export const enregistrerGrilleSchema = z.object({
  entreprise: z.string().refine(estEntreprise, 'Entreprise inconnue.'),
  produits: z.array(produitTarifSchema).min(1, 'Une grille contient au moins un service.'),
  /**
   * Numéro de la version affichée au moment de l'édition — zéro si l'entreprise
   * n'a encore aucune grille. Enregistrer par-dessus une version publiée
   * entre-temps effacerait le travail de l'autre onglet sans que personne le
   * sache.
   */
  depuisNumero: z.number().int().min(0),
})

/* ══════════════════════════════════════════════════════════════════
   Paramètres de paie — HEU-7 et HEU-9
   ══════════════════════════════════════════════════════════════════ */

const duree = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s ]/g, '').replace(',', '.'))
  .refine((v) => /^\d{1,2}(\.\d{1,2})?$/.test(v), 'Un nombre, deux décimales au maximum.')

export const parametresPaieSchema = z.object({
  seuilSupplementaires: duree.refine((v) => Number(v) > 0, 'Le seuil doit être supérieur à zéro.'),
  majoration: duree.refine((v) => Number(v) >= 1, 'La majoration ne peut pas être inférieure à 1.'),
  /*
    Multiple de sept, et ce n'est pas une commodité d'affichage.

    `ANCRAGE_PERIODES` tombe un lundi pour que chaque période contienne des
    SEMAINES ENTIÈRES — les heures supplémentaires se calculent par semaine
    (HEU-7), pas par période. Avec une durée qui n'est pas un multiple de sept,
    les semaines débordent la période des deux côtés, et le lundi à cheval
    appartient à la fois à la période courante et à la précédente : les mêmes
    heures sont comptées deux fois, sur deux paies.

    HEU-9 dit « paramétrable » — la durée le reste, de une à quatre semaines.
    Ce qui disparaît, c'est la possibilité de choisir une valeur qui fausse le
    calcul sans rien signaler.
  */
  joursPeriode: z
    .number()
    .int()
    .min(7, 'Au moins une semaine.')
    .max(28, 'Quatre semaines au maximum.')
    .refine(
      (v) => v % 7 === 0,
      'La période doit compter des semaines entières : 7, 14, 21 ou 28 jours.',
    ),
  version: z.number().int().min(0),
})

/* ══════════════════════════════════════════════════════════════════
   Journal d'audit — ADM-4
   ══════════════════════════════════════════════════════════════════ */

/** Une date de calendrier saisie dans un filtre, au format `AAAA-MM-JJ`. */
const jour = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), 'Date invalide.')

/**
 * Filtres du journal. Ils arrivent de `searchParams`, donc en chaînes et sans
 * garantie : tout ce qui n'est pas reconnu est simplement ignoré plutôt que de
 * faire échouer l'écran — un filtre inconnu ne doit pas remplacer la liste par
 * une page d'erreur.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────
 * ADM-4 énumère six axes : horodatage, utilisateur, action, élément,
 * entreprise, adresse IP.
 *
 * Les six étaient affichés et exportés ; seuls deux étaient filtrables. Les
 * questions qu'on pose réellement à un journal d'audit — « qu'est-il arrivé au
 * dossier de ce client », « tout ce qui s'est passé sur Paysagement », « d'où
 * venait cette connexion » — n'avaient donc aucune réponse : il fallait faire
 * défiler.
 *
 * Le point qui compte : l'export reprend les mêmes filtres. Ce qui manquait à
 * l'écran manquait aussi au fichier remis à qui le demande.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const filtresJournalSchema = z.object({
  utilisateur: z.string().trim().min(1).optional().catch(undefined),
  module: z.enum(MODULES).optional().catch(undefined),
  entreprise: z.string().refine(estEntreprise).optional().catch(undefined),
  /** Recherche sur le libellé d'action — « suppression », « clôture »… */
  action: z.string().trim().min(1).max(120).optional().catch(undefined),
  /** Recherche sur l'élément concerné — un nom de fichier, une référence. */
  entite: z.string().trim().min(1).max(200).optional().catch(undefined),
  ip: z.string().trim().min(1).max(60).optional().catch(undefined),
  du: jour.optional().catch(undefined),
  au: jour.optional().catch(undefined),
  sensible: z
    .string()
    .optional()
    .transform((v) => v === '1')
    .catch(false),
  page: z.coerce.number().int().min(1).max(9999).optional().catch(undefined),
})

export type FiltresJournalEntree = z.infer<typeof filtresJournalSchema>

/**
 * Coordonnées de l'organisation — EST-10.
 *
 * Les trois champs sont OBLIGATOIRES. Un formulaire qui accepterait une adresse
 * vide laisserait revenir la situation qu'il corrige : un document envoyé au
 * client sans moyen de joindre l'entreprise.
 */
/**
 * Logo d'entreprise — EST-10. Le dépôt se fait en deux temps, comme celui d'un
 * CV : lien signé, écriture directe du navigateur vers le stockage, puis
 * confirmation. Les deux schémas répètent donc la même clé d'entreprise.
 */
export const preparerLogoSchema = z.object({
  entreprise: z.string().refine(estEntreprise, 'Entreprise inconnue.'),
  typeMime: z.enum(TYPES_LOGO, { message: REFUS_TYPE_LOGO }),
  taille: z.number().int().positive().max(TAILLE_MAX_LOGO, REFUS_TAILLE_LOGO),
})

export const confirmerLogoSchema = z.object({
  entreprise: z.string().refine(estEntreprise, 'Entreprise inconnue.'),
  cle: z.string().min(1),
  typeMime: z.enum(TYPES_LOGO),
  version: z.number().int().min(0),
})

export const retirerLogoSchema = z.object({
  entreprise: z.string().refine(estEntreprise, 'Entreprise inconnue.'),
  version: z.number().int().min(0),
})

export const organisationSchema = z.object({
  entreprise: z.string().refine(estEntreprise, 'Entreprise inconnue.'),
  raisonSociale: z.string().trim().min(2, 'Indiquez la raison sociale.').max(120),
  adresse: z.string().trim().min(5, 'Indiquez l’adresse complète.').max(200),
  telephone: z.string().trim().min(8, 'Indiquez un numéro de téléphone.').max(40),
  version: z.number().int().min(0),
})
