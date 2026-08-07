import { z } from 'zod'
import { ENTREPRISES } from '@/config/entreprises'
import { CENTIEMES_MAX_JOUR, enIso, jour, lundiDe } from '@/lib/domaine/heures'

/**
 * Schémas du suivi des heures, partagés entre les formulaires et la fabrique
 * d'actions. Une seule source de vérité pour les règles de saisie.
 */

const identifiant = z.string().trim().min(1).max(40)

/** Jour civil, jamais un horodatage : la colonne en base est un `DATE`. */
const jourIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')

/**
 * Les heures circulent en centièmes entiers, du navigateur jusqu'à la base :
 * un flottant sur le fil réintroduirait la dérive que le `Decimal` évite.
 *
 * `null` demande la suppression de la saisie. « Pas de saisie » n'est pas
 * « zéro heure » — la distinction remonte au journal des corrections.
 */
const centiemesJour = z
  .number()
  .int('Les heures se saisissent au centième.')
  .min(0)
  .max(CENTIEMES_MAX_JOUR, 'Vingt-quatre heures au maximum par jour.')

const celluleSchema = z.object({
  employeId: identifiant,
  date: jourIso,
  centiemes: centiemesJour.nullable(),
  /**
   * Valeur que l'écran croit enregistrée — `null` s'il croit la cellule vide.
   * Faute de colonne `version` sur `SaisieJour`, c'est elle qui sert de version :
   * l'écriture est refusée si la base ne la porte plus.
   */
  avant: centiemesJour.nullable(),
})

/**
 * Toute cellule tombe dans la semaine annoncée par `debut`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'était une faille, et elle était exploitable.
 *
 * `debut` et `saisies[].date` sont deux champs INDÉPENDANTS du même corps de
 * requête. Le handler déduisait la période de `debut` pour vérifier qu'elle
 * n'était pas clôturée, puis écrivait chaque cellule à SA propre date. Il
 * suffisait donc d'annoncer une semaine ouverte et de viser des dates d'une
 * période close : le verrou de clôture examinait une période, l'écriture en
 * touchait une autre.
 *
 * Trois dégâts se cumulaient. Le registre clos était réécrit ; l'entrée d'audit
 * nommait la mauvaise semaine ; et la ligne de correction partait sans motif,
 * donc invisible de l'écran des corrections — celui-là même qu'exige HEU-10
 * pour répondre à « qui a réécrit un registre clos ».
 *
 * La règle est ICI, dans le schéma, et non dans le handler : la fabrique valide
 * avant d'appeler, et aucune action ne peut donc l'oublier. Un Server Action
 * n'est pas protégé par l'écran qui l'appelle.
 * ─────────────────────────────────────────────────────────────────────────
 */
function memeSemaine(entree: { debut: string; saisies: { date: string }[] }, ctx: z.RefinementCtx) {
  const lundi = lundiDe(jour(entree.debut))
  const dimanche = new Date(lundi)
  dimanche.setUTCDate(dimanche.getUTCDate() + 6)

  const premier = enIso(lundi)
  const dernier = enIso(dimanche)

  entree.saisies.forEach((cellule, index) => {
    if (cellule.date < premier || cellule.date > dernier) {
      ctx.addIssue({
        code: 'custom',
        path: ['saisies', index, 'date'],
        message: 'Cette date n’appartient pas à la semaine enregistrée.',
      })
    }
  })
}

export const enregistrerSemaineSchema = z
  .object({
    debut: jourIso,
    saisies: z.array(celluleSchema).max(700),
  })
  .superRefine(memeSemaine)

export const copierSemainePrecedenteSchema = z.object({
  debut: jourIso,
})

export const cloturerPeriodeSchema = z.object({
  debut: jourIso,
  fin: jourIso,
})

/**
 * Le motif est obligatoire et il est long : c'est lui qui distingue une
 * correction légitime d'une réécriture d'un registre déjà clôturé (HEU-10).
 */
export const corrigerSemaineSchema = z
  .object({
    debut: jourIso,
    motif: z
      .string()
      .trim()
      .min(5, 'Indiquez le motif de la correction.')
      .max(300, 'Trois cents caractères au maximum.'),
    saisies: z.array(celluleSchema).min(1, 'Aucune modification à consigner.').max(700),
  })
  // Même verrou : `debut` ne nomme pas seulement l'entrée d'audit, il borne ce
  // que la correction a le droit de toucher.
  .superRefine(memeSemaine)

const slugs = ENTREPRISES.map((e) => e.slug)

const champsEmploye = {
  nom: z
    .string()
    .trim()
    .min(2, 'Au moins deux caractères.')
    .max(80, 'Quatre-vingts caractères au maximum.'),
  entrepriseSlug: z.enum(slugs as [string, ...string[]], {
    message: 'Choisissez une entreprise.',
  }),
  /** Facultatif : sans taux, seules les heures sont totalisées (HEU-8). */
  tauxHoraire: z
    .string()
    .trim()
    .regex(/^\d{1,6}([.,]\d{1,2})?$/, 'Indiquez un taux comme 22,50.')
    .nullable(),
  actif: z.boolean(),
  notes: z.string().trim().max(500, 'Cinq cents caractères au maximum.').nullable(),
}

export const creerEmployeSchema = z.object(champsEmploye)

export const modifierEmployeSchema = z.object({
  ...champsEmploye,
  employeId: identifiant,
  /** Contrôle de concurrence : rejette une modification faite sur une version périmée. */
  version: z.number().int().min(0),
})

/** Bornes de l'export — validées côté route, hors de la fabrique d'actions. */
export const periodeExportSchema = z.object({
  debut: jourIso,
  fin: jourIso,
})
