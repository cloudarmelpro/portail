import { ajouterJours, aujourdHui } from '@/lib/domaine/dates'

/**
 * Domaine de calcul du suivi des heures.
 *
 * Ni Prisma, ni React, ni Next : ce module reçoit des nombres et des paramètres,
 * il retourne des totaux. C'est ce qui le rend vérifiable sans base de données,
 * et c'est là que se concentre l'effort de test unitaire (`tests/heures.spec.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Deux unités entières, et elles ne sortent jamais d'ici en flottant.
 *
 * Les durées circulent en **centièmes d'heure**, les montants en **cents**.
 * Un quart d'heure additionné soixante fois par semaine doit tomber juste :
 * en virgule flottante 0,1 + 0,2 ≠ 0,3, et l'écart finit par se lire sur un
 * registre de paie conservé six ans.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Une heure saisie le lundi doit rester au lundi. Le serveur tourne en UTC :
 * sans ce fuseau explicite, entre 20 h et minuit au Québec la « semaine
 * courante » basculerait sur la suivante un dimanche soir.
 *
 * Réexporté depuis `config/dates.ts` — deux constantes coexistaient, l'une
 * disant `America/Montreal` et l'autre `America/Toronto`. Elles décrivent le
 * même fuseau, mais deux noms pour une seule idée finissent toujours par
 * diverger le jour où l'une des deux change.
 */
export { FUSEAU as FUSEAU_QUEBEC } from '@/config/dates'

/** Bornes de saisie — la colonne est un `Decimal(4,2)`. */
export const CENTIEMES_MAX_JOUR = 2400

/* ══════════════════════════════════════════════════════════════════
   Conversion et format
   ══════════════════════════════════════════════════════════════════ */

const DECIMAL = /^(-)?(\d*)(?:[.,](\d*))?$/

/**
 * Convertit une valeur à deux décimales en entier de centièmes.
 *
 * Sert aux heures (centièmes d'heure) comme aux montants (cents) : les deux
 * colonnes sont des `Decimal(_, 2)`. La troisième décimale, si elle existe,
 * arrondit au plus proche — elle ne peut pas venir de la base, seulement d'une
 * saisie trop précise.
 */
export function enCentiemes(valeur: string | number): number {
  const m = DECIMAL.exec(String(valeur).trim())
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) {
    throw new Error(`Valeur décimale invalide : « ${String(valeur)} ».`)
  }

  const signe = m[1] ? -1 : 1
  const entier = m[2] === '' ? 0 : Number(m[2])
  const decimales = (m[3] ?? '').padEnd(3, '0')
  const centiemes = Number(decimales.slice(0, 2))
  const suivante = Number(decimales[2])

  return signe * (entier * 100 + centiemes + (suivante >= 5 ? 1 : 0))
}

/** Réciproque, pour l'affichage seulement — jamais pour un calcul. */
export function enUnites(centiemes: number): number {
  return centiemes / 100
}

export type LectureCellule =
  { etat: 'vide' } | { etat: 'valeur'; centiemes: number } | { etat: 'invalide' }

/**
 * Lecture d'une cellule de la grille.
 *
 * « Vide » et « zéro » sont deux réponses différentes : la première dit que la
 * saisie n'existe pas, la seconde qu'elle vaut zéro heure. La distinction
 * remonte jusqu'à `CorrectionHeures.ancienneValeur` (exigence HEU-10).
 */
export function lireCellule(texte: string): LectureCellule {
  const t = texte.trim()
  if (t === '') return { etat: 'vide' }
  if (!/^\d{1,2}([.,]\d{1,2})?$/.test(t)) return { etat: 'invalide' }

  const centiemes = enCentiemes(t)
  if (centiemes > CENTIEMES_MAX_JOUR) return { etat: 'invalide' }
  return { etat: 'valeur', centiemes }
}

/** « 37,25 » · « 8 » — sans zéros inutiles, comme dans la grille. */
export function formaterHeures(centiemes: number): string {
  const signe = centiemes < 0 ? '-' : ''
  const absolu = Math.abs(centiemes)
  const entier = Math.trunc(absolu / 100)
  const reste = absolu % 100
  if (reste === 0) return `${signe}${entier}`
  const decimales = String(reste).padStart(2, '0').replace(/0$/, '')
  return `${signe}${entier},${decimales}`
}

/** « 22,50 » — deux décimales conservées, pour un champ de saisie de taux. */
export function formaterDecimal(centiemes: number): string {
  return enUnites(centiemes).toFixed(2).replace('.', ',')
}

/** « 37,25 h » — l'unité accompagne toujours le nombre dans l'interface. */
export function formaterHeuresAvecUnite(centiemes: number): string {
  return `${formaterHeures(centiemes)} h`
}

const MONNAIE = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })

export function formaterMontant(cents: number): string {
  return MONNAIE.format(enUnites(cents))
}

/* ══════════════════════════════════════════════════════════════════
   Totaux, heures supplémentaires, montants
   ══════════════════════════════════════════════════════════════════ */

export type ParametresCalcul = {
  /** Seuil hebdomadaire, en centièmes d'heure. 4000 = 40 h. */
  seuilCentiemes: number
  /** Majoration, en centièmes. 150 = 1,5 fois le taux. */
  majorationCentiemes: number
}

/**
 * Norme québécoise. Ces valeurs ne servent qu'à la vérification et au repli :
 * la source réelle est la table `ParametresPaie`, parce qu'un seuil fixé dans
 * le code obligerait à un déploiement pour suivre une décision du législateur
 * (exigences HEU-7 et HEU-9).
 */
export const PARAMETRES_DEFAUT: ParametresCalcul = {
  seuilCentiemes: 4000,
  majorationCentiemes: 150,
}

export type Repartition = {
  total: number
  normales: number
  supplementaires: number
}

export const REPARTITION_VIDE: Repartition = { total: 0, normales: 0, supplementaires: 0 }

export function totalSemaine(centiemesParJour: readonly number[]): number {
  let total = 0
  for (const c of centiemesParJour) total += c
  return total
}

/**
 * Le seuil est un plancher strict : 40,00 h ne produit aucune heure
 * supplémentaire, 40,25 h en produit un quart.
 */
export function repartirSemaine(total: number, p: ParametresCalcul): Repartition {
  const supplementaires = Math.max(0, total - p.seuilCentiemes)
  return { total, normales: total - supplementaires, supplementaires }
}

export function depasseSeuil(total: number, p: ParametresCalcul): boolean {
  return total > p.seuilCentiemes
}

/**
 * Les heures supplémentaires se comptent **par semaine**, jamais sur le total
 * de la période : deux semaines à 35 h et 45 h ne donnent pas 80 h normales.
 */
export function cumuler(repartitions: readonly Repartition[]): Repartition {
  const cumul = { total: 0, normales: 0, supplementaires: 0 }
  for (const r of repartitions) {
    cumul.total += r.total
    cumul.normales += r.normales
    cumul.supplementaires += r.supplementaires
  }
  return cumul
}

/** Division entière avec arrondi au plus proche, sans passer par un flottant. */
function arrondirDivision(numerateur: number, denominateur: number): number {
  const quotient = Math.trunc(numerateur / denominateur)
  const reste = numerateur - quotient * denominateur
  if (Math.abs(reste) * 2 < denominateur) return quotient
  return quotient + (numerateur < 0 ? -1 : 1)
}

/**
 * Montant de la période, en cents.
 *
 * `null` quand le taux n'est pas renseigné : seules les heures sont alors
 * totalisées (exigence HEU-8). Un taux à zéro dirait « travaille gratuitement »,
 * ce qui n'est pas la même chose qu'inconnu.
 */
export function montantCents(
  r: Repartition,
  tauxCents: number | null,
  p: ParametresCalcul,
): number | null {
  if (tauxCents === null) return null
  const numerateur =
    r.normales * tauxCents * 100 + r.supplementaires * tauxCents * p.majorationCentiemes
  return arrondirDivision(numerateur, 10_000)
}

export type Compilation = Repartition & { montantCents: number | null }

/**
 * Compilation d'un employé sur une période — exigence HEU-6.
 * Une entrée par semaine, chacune répartie avant d'être cumulée.
 */
export function compilerPeriode(
  semaines: readonly (readonly number[])[],
  tauxCents: number | null,
  p: ParametresCalcul,
): Compilation {
  const cumul = cumuler(semaines.map((s) => repartirSemaine(totalSemaine(s), p)))
  return { ...cumul, montantCents: montantCents(cumul, tauxCents, p) }
}

/* ══════════════════════════════════════════════════════════════════
   Calendrier
   ══════════════════════════════════════════════════════════════════ */

const MS_JOUR = 86_400_000

/**
 * Toutes les dates du module sont des `Date` à minuit **UTC**, image exacte de
 * la colonne `DATE` de PostgreSQL. UTC n'a pas d'heure d'été : l'arithmétique
 * par tranches de 24 h y est toujours juste.
 */
export function jour(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Date invalide : « ${iso} ».`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function enIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Relayées depuis `lib/domaine/dates.ts`, où elles sont écrites une seule fois.
 * Deux implémentations de « quel jour sommes-nous » finissent par diverger, et
 * l'écart ne se voit qu'à la clôture d'une période — donc trop tard.
 */
export { ajouterJours, aujourdHui }

export function ecartJours(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_JOUR)
}

/** Lundi de la semaine contenant `d`. La semaine de travail commence lundi. */
export function lundiDe(d: Date): Date {
  const jourSemaine = d.getUTCDay()
  return ajouterJours(d, -((jourSemaine + 6) % 7))
}

export function joursDeSemaine(lundi: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i))
}

/**
 * Jour civil venu d'une adresse : `null` au lieu d'une exception.
 *
 * `2026-02-31` passe le motif mais `jour()` la reporte au 3 mars. Un report
 * silencieux ouvrirait une autre semaine que celle inscrite dans l'URL — donc
 * une autre clé de brouillon, sans que rien ne le signale.
 */
export function jourOuNull(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = jour(iso)
  return enIso(d) === iso ? d : null
}

/**
 * Lundi de la semaine à afficher, d'après le paramètre d'URL — exigence HEU-6.
 *
 * Le paramètre est lisible, modifiable à la main et partageable : tout ce qui
 * n'est pas une semaine échue se replie sur la semaine courante. Une semaine à
 * venir n'a aucune heure travaillée à relire, et la grille refuserait de toute
 * façon d'y écrire.
 */
export function resoudreSemaine(valeur: string | string[] | undefined, reference: Date): Date {
  const courante = lundiDe(reference)
  if (typeof valeur !== 'string') return courante

  const demande = jourOuNull(valeur)
  if (demande === null) return courante

  const lundi = lundiDe(demande)
  return lundi > courante ? courante : lundi
}

/**
 * Ancrage du découpage des périodes de paie : premier lundi de 2026.
 *
 * Les périodes ne peuvent pas glisser avec la semaine consultée, sinon deux
 * personnes clôtureraient deux découpages différents du même mois. Il faut donc
 * une origine fixe, et elle doit tomber un lundi pour que chaque période
 * contienne des semaines entières.
 */
export const ANCRAGE_PERIODES = '2026-01-05'

export type Periode = { debut: Date; fin: Date }

/** Période de paie contenant `date`, découpée par tranches de `joursPeriode`. */
export function periodeDe(date: Date, joursPeriode: number): Periode {
  /*
    Le multiple de sept est vérifié ICI et pas seulement à la saisie.

    La validation Zod garde le formulaire ; elle ne garde pas une valeur écrite
    directement en base, ni une migration. Or l'invariant « une période contient
    des semaines entières » est ce sur quoi repose `semainesDe` : sans lui, le
    lundi à cheval est compté dans deux périodes, donc sur deux paies. Mieux vaut
    une exception bruyante qu'un total faux de quelques heures.
  */
  if (!Number.isInteger(joursPeriode) || joursPeriode < 7 || joursPeriode % 7 !== 0) {
    throw new Error(
      `Durée de période invalide : ${joursPeriode}. Elle doit compter des semaines entières.`,
    )
  }
  const ancre = jour(ANCRAGE_PERIODES)
  const index = Math.floor(ecartJours(date, ancre) / joursPeriode)
  const debut = ajouterJours(ancre, index * joursPeriode)
  return { debut, fin: ajouterJours(debut, joursPeriode - 1) }
}

/** Les lundis de chaque semaine couverte par une période. */
export function semainesDe(p: Periode): Date[] {
  const semaines: Date[] = []
  for (let d = lundiDe(p.debut); d <= p.fin; d = ajouterJours(d, 7)) semaines.push(d)
  return semaines
}

/**
 * Répartit des saisies datées sur une suite de semaines.
 *
 * Le découpage précède le calcul : les heures supplémentaires se comptent
 * semaine par semaine, et un total de période ne permet pas de les retrouver.
 */
export function grouperParSemaine(
  saisies: readonly { date: string; centiemes: number }[],
  semaines: readonly Date[],
): number[][] {
  const index = new Map<string, number>()
  semaines.forEach((lundi, i) => {
    for (const j of joursDeSemaine(lundi)) index.set(enIso(j), i)
  })

  const groupes: number[][] = semaines.map(() => [])
  for (const s of saisies) {
    const i = index.get(s.date)
    if (i !== undefined) groupes[i].push(s.centiemes)
  }
  return groupes
}

/* ══════════════════════════════════════════════════════════════════
   Libellés de dates
   ══════════════════════════════════════════════════════════════════ */

export const NOMS_JOURS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const

/*
  En minuscules : c'est la forme de la section 19 — « lun 3 », « mar 4 ». La
  capitale obligeait chaque appelant à la retirer, et l'un d'eux finit toujours
  par l'oublier.
*/
export const NOMS_JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const

const MOIS_LONG = new Intl.DateTimeFormat('fr-CA', { month: 'long', timeZone: 'UTC' })
const DATE_LONGUE = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const MOIS_COURT = new Intl.DateTimeFormat('fr-CA', { month: 'short', timeZone: 'UTC' })

export function libelleDate(d: Date): string {
  return DATE_LONGUE.format(d)
}

/** « 3 août » — étiquette d'axe du graphique. */
export function libelleJourMois(d: Date): string {
  return `${d.getUTCDate()} ${MOIS_COURT.format(d)}`
}

function libelleIntervalle(debut: Date, fin: Date): string {
  const moisDebut = MOIS_LONG.format(debut)
  const moisFin = MOIS_LONG.format(fin)
  const annee = fin.getUTCFullYear()
  return moisDebut === moisFin && debut.getUTCFullYear() === annee
    ? `${debut.getUTCDate()} au ${fin.getUTCDate()} ${moisFin} ${annee}`
    : `${debut.getUTCDate()} ${moisDebut} au ${fin.getUTCDate()} ${moisFin} ${annee}`
}

export function libelleSemaine(lundi: Date): string {
  return `Semaine du ${libelleIntervalle(lundi, ajouterJours(lundi, 6))}`
}

export function libellePeriode(p: Periode): string {
  return `Période du ${libelleIntervalle(p.debut, p.fin)}`
}
