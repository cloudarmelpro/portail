import { TAUX_TPS, TAUX_TVQ, VALIDITE_JOURS } from '@/config/taxes'
import { FUSEAU, LOCALE } from '@/config/dates'
import { ajouterJours, aujourdHui } from '@/lib/domaine/dates'

/**
 * Domaine de calcul des estimations — fonctions PURES.
 *
 * Ni Prisma, ni React, ni Next : ce fichier se teste en isolation, sans base ni
 * navigateur. C'est là que se concentre l'effort de test unitaire.
 *
 * Un seul moteur, trois grilles : la mécanique est identique pour les trois
 * entreprises, seuls les produits et les unités changent (exigence EST-5).
 *
 * Tous les montants sont des nombres de dollars. La base stocke des `Decimal` ;
 * la conversion se fait au bord, dans `lib/data/estimations.ts`.
 */

export type LigneCalcul = {
  designation: string
  unite: string
  prixUnitaire: number
  quantite: number
}

/** Exigence EST-2. Le rabais existe en montant ET en pourcentage : convertir l'un en l'autre à la saisie perdrait l'intention. */
export type Ajustements = {
  fraisDeplacement: number
  majorationPct: number
  rabaisMontant: number
  rabaisPct: number
}

export type TauxTaxes = {
  tps: number
  tvq: number
}

export type Totaux = {
  /** Sous-total arrondi de chaque ligne, dans l'ordre reçu. */
  lignes: number[]
  sousTotalLignes: number
  fraisDeplacement: number
  majoration: number
  rabais: number
  /** Assiette taxable — c'est ce montant, et non le total, que portent les deux taxes. */
  sousTotal: number
  tps: number
  tvq: number
  total: number
}

export const AJUSTEMENTS_VIDES: Ajustements = {
  fraisDeplacement: 0,
  majorationPct: 0,
  rabaisMontant: 0,
  rabaisPct: 0,
}

/** Taux courants — pour une NOUVELLE estimation seulement. Une estimation relue porte les siens (EST-12). */
export const TAUX_COURANTS: TauxTaxes = { tps: TAUX_TPS, tvq: TAUX_TVQ }

/**
 * Arrondi au cent.
 *
 * `Math.round(v * 100)` seul se trompe sur les valeurs que la représentation
 * binaire place juste sous la demi-unité — `1.005 * 100` vaut 100,49999999999999
 * et donnerait 1,00 au lieu de 1,01. Le facteur `1 + EPSILON` les ramène du bon
 * côté sans déplacer celles qui n'en ont pas besoin.
 */
export function arrondirCent(montant: number): number {
  if (!Number.isFinite(montant)) return 0
  const signe = montant < 0 ? -1 : 1
  return (signe * Math.round(Math.abs(montant) * 100 * (1 + Number.EPSILON))) / 100
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * OÙ A LIEU L'ARRONDI — décision explicite.
 * ─────────────────────────────────────────────────────────────────────────
 * À **chaque montant affiché**, pas seulement sur le total.
 *
 * Chaque sous-total de ligne, chaque ajustement et chaque taxe est montré au
 * client et stocké en `Decimal(12,2)`. Arrondir seulement à la fin donnerait un
 * document dont la colonne des sous-totaux ne s'additionne pas : le client fait
 * la somme sur le papier et trouve un cent manquant, que personne ne sait
 * expliquer six mois plus tard. On préfère la cohérence du document à la
 * précision théorique du total.
 *
 * ORDRE D'APPLICATION DES AJUSTEMENTS
 *   1. sous-total des lignes
 *   2. + frais de déplacement
 *   3. + majoration, en pourcentage du montant obtenu en 2
 *   4. − rabais en montant, puis rabais en pourcentage de ce qui reste
 *   5. = assiette taxable, sur laquelle portent TPS et TVQ
 *
 * La TVQ s'applique au montant HORS TPS depuis 2013 : les deux taxes portent sur
 * la MÊME assiette, elles ne se cumulent pas.
 */
export function calculer(
  lignes: readonly LigneCalcul[],
  ajustements: Ajustements = AJUSTEMENTS_VIDES,
  taux: TauxTaxes = TAUX_COURANTS,
): Totaux {
  const sousTotaux = lignes.map((l) => arrondirCent(l.prixUnitaire * l.quantite))
  const sousTotalLignes = arrondirCent(sousTotaux.reduce((a, s) => a + s, 0))

  const fraisDeplacement = arrondirCent(ajustements.fraisDeplacement)
  const apresFrais = arrondirCent(sousTotalLignes + fraisDeplacement)

  const majoration = arrondirCent((apresFrais * ajustements.majorationPct) / 100)
  const apresMajoration = arrondirCent(apresFrais + majoration)

  const rabaisMontant = Math.min(arrondirCent(ajustements.rabaisMontant), apresMajoration)
  const rabaisPourcentage = arrondirCent(
    ((apresMajoration - rabaisMontant) * ajustements.rabaisPct) / 100,
  )
  // Le rabais ne peut pas dépasser le montant : au-delà, l'assiette deviendrait
  // négative et les taxes changeraient de signe — une estimation qui rembourse.
  const rabais = Math.min(arrondirCent(rabaisMontant + rabaisPourcentage), apresMajoration)

  const sousTotal = arrondirCent(apresMajoration - rabais)
  const tps = arrondirCent(sousTotal * taux.tps)
  const tvq = arrondirCent(sousTotal * taux.tvq)

  return {
    lignes: sousTotaux,
    sousTotalLignes,
    fraisDeplacement,
    majoration,
    rabais,
    sousTotal,
    tps,
    tvq,
    total: arrondirCent(sousTotal + tps + tvq),
  }
}

/* ══════════════════════════════════════════════════════════════════
   Relecture d'une estimation ÉMISE
   ══════════════════════════════════════════════════════════════════ */

/** Ce dont la ventilation a besoin — structurel, pour ne pas tirer `lib/data` ici. */
export type MontantsEmis = {
  lignes: readonly { sousTotal: number }[]
  fraisDeplacement: number
  majorationPct: number
  sousTotal: number
}

export type VentilationEmise = {
  sousTotalLignes: number
  majoration: number
  rabais: number
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * DÉDUIT la ventilation des montants ENREGISTRÉS. N'appelle jamais `calculer`.
 *
 * Le rabais est l'écart entre ce qui a été majoré et le sous-total émis, plutôt
 * qu'une reconstitution des deux rabais : si la mécanique de `calculer` évoluait,
 * une reconstitution divergerait en silence, alors qu'un écart s'additionne
 * toujours jusqu'au total figé (exigence EST-12).
 *
 * Le document imprimé et le PDF s'en servent tous les deux : deux ventilations
 * écrites séparément finiraient par ne plus donner le même papier.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function ventilerEmis(emis: MontantsEmis): VentilationEmise {
  const sousTotalLignes = arrondirCent(emis.lignes.reduce((a, l) => a + l.sousTotal, 0))
  const apresFrais = arrondirCent(sousTotalLignes + emis.fraisDeplacement)
  const majoration = arrondirCent((apresFrais * emis.majorationPct) / 100)

  return {
    sousTotalLignes,
    majoration,
    rabais: arrondirCent(apresFrais + majoration - emis.sousTotal),
  }
}

/* ══════════════════════════════════════════════════════════════════
   Saisie et affichage — fr-CA
   ══════════════════════════════════════════════════════════════════ */

/**
 * Lit un nombre saisi au clavier pendant un appel : « 12,5 », « 1 234,56 »,
 * « 12.5 ». Une saisie incomplète — « 12, », « » — vaut zéro plutôt que NaN :
 * le total doit rester affichable à chaque frappe (exigence EST-4).
 */
export function analyserNombre(saisie: string | number | null | undefined): number {
  if (typeof saisie === 'number') return Number.isFinite(saisie) ? saisie : 0
  if (!saisie) return 0

  const nettoye = saisie
    // La classe des blancs couvre les insécables — fine et normale — que produit
    // le formatage fr-CA des milliers, et qu’un copier-coller ramène tels quels.
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')

  const valeur = Number.parseFloat(nettoye)
  return Number.isFinite(valeur) ? valeur : 0
}

const MONTANT = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const QUANTITE = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function formaterMontant(montant: number): string {
  return MONTANT.format(arrondirCent(montant))
}

export function formaterQuantite(quantite: number): string {
  return QUANTITE.format(quantite)
}

/** Pourcentage tel qu'il s'écrit sur le document : « 9,975 % ». */
export function formaterPourcentage(pourcentage: number): string {
  return `${QUANTITE.format(pourcentage)} %`
}

/**
 * Tarif d'un service — « 45,00 $ / m² ».
 *
 * Exigence EST-1 : pendant un appel, le prix doit se lire sans quitter la ligne
 * de saisie, sinon on ne peut pas répondre au client qui demande le tarif.
 * `formaterMontant` place déjà une insécable devant le symbole : « 45,00 $ » ne
 * se coupe jamais, seule la barre peut passer à la ligne.
 */
export function formaterPrixUnitaire(prixUnitaire: number, unite: string): string {
  return `${formaterMontant(prixUnitaire)} / ${unite}`
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX FAMILLES DE DATES, ET IL NE FAUT PAS LES MÉLANGER.
 * ─────────────────────────────────────────────────────────────────────────
 * Un HORODATAGE — `createdAt`, `emiseLe` — porte une heure : il se lit au
 * calendrier du QUÉBEC, jamais à celui du processus. Le serveur tourne en UTC :
 * sans `FUSEAU`, une estimation enregistrée à 20 h s'imprimerait datée du
 * lendemain, et le décalage change deux fois par an.
 *
 * Une DATE SEULE — `valideJusquau`, colonne `@db.Date` — n'en porte pas. Prisma
 * la rend à minuit UTC. La formater dans le fuseau du Québec reculerait
 * l'affichage d'un jour. Les fonctions « seule » travaillent donc en UTC de bout
 * en bout — la forme que rend aussi `aujourdHui` de `lib/domaine/dates.ts`.
 */
const DATE_LONGUE = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: FUSEAU,
})

const DATE_COURTE = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  timeZone: FUSEAU,
})

const DATE_LONGUE_UTC = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const DATE_COURTE_UTC = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

export function formaterDate(date: Date | null): string {
  return date ? DATE_LONGUE.format(date) : '—'
}

/** Colonnes de tableau : l'année encombre là où toutes les dates sont récentes. */
export function formaterDateCourte(date: Date | null): string {
  return date ? DATE_COURTE.format(date) : '—'
}

export function formaterDateSeule(date: Date | null): string {
  return date ? DATE_LONGUE_UTC.format(date) : '—'
}

export function formaterDateSeuleCourte(date: Date | null): string {
  return date ? DATE_COURTE_UTC.format(date) : '—'
}

/**
 * Horodatage ramené au jour civil du QUÉBEC, pour un nom de fichier ou une
 * colonne d'export. `toISOString` — comme les composantes locales du processus —
 * basculerait d'un jour selon l'heure et le fuseau du serveur.
 */
export function dateFichier(date: Date): string {
  return dateFichierSeule(aujourdHui(date))
}

/** Même forme, pour une date seule — lue en UTC, où elle a été écrite. */
export function dateFichierSeule(date: Date): string {
  return composerJour(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function composerJour(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/* ══════════════════════════════════════════════════════════════════
   Numérotation et validité
   ══════════════════════════════════════════════════════════════════ */

/**
 * Référence affichée — « PAY-2026-014 » (exigence EST-10).
 *
 * Elle est STOCKÉE à la création, jamais recalculée à la lecture : le préfixe
 * d'une entreprise peut changer, une estimation déjà transmise au client ne le
 * peut pas.
 */
export function composerReference(prefixe: string, annee: number, numero: number): string {
  return `${prefixe}-${annee}-${String(numero).padStart(3, '0')}`
}

/**
 * Validité par défaut — 30 jours (exigence EST-13).
 *
 * Le compte part du jour civil au QUÉBEC, pas de celui du processus : deux
 * estimations produites le même jour, l'une le matin et l'autre le soir, doivent
 * expirer le même jour — y compris quand le serveur est déjà au lendemain en UTC.
 */
export function dateValidite(depuis: Date): Date {
  return ajouterJours(aujourdHui(depuis), VALIDITE_JOURS)
}
