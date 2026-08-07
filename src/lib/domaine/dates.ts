import { FUSEAU } from '@/config/dates'

/**
 * Jour civil du domaine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le jour se lit au calendrier du QUÉBEC, jamais à celui du processus.
 *
 * Le serveur tourne en UTC, et le VPS de déploiement n'est pas garanti à
 * Montréal : entre 19 h et minuit heure locale, l'horloge du conteneur est
 * déjà au lendemain. Une relance prévue demain remonterait « à faire
 * aujourd'hui » chaque soir, et le tableau de bord mentirait tous les jours à
 * la même heure.
 *
 * Le décalage n'est pas constant — cinq heures l'hiver, quatre l'été. Le
 * fuseau est donc confié à `Intl`, jamais soustrait à la main.
 * ─────────────────────────────────────────────────────────────────────────
 */

const MS_JOUR = 86_400_000

const JOUR_QUEBEC = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Jour civil courant au Québec, ramené à minuit UTC — la forme sous laquelle
 * Postgres rend une colonne `@db.Date`, donc la seule qui se compare sans
 * décalage. `maintenant` n'est là que pour les tests : le fuseau, lui, ne
 * s'injecte pas.
 */
export function aujourdHui(maintenant: Date = new Date()): Date {
  const iso = JOUR_QUEBEC.format(maintenant)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Jour civil illisible : « ${iso} ».`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Les jours sont à minuit UTC : l'addition par tranches de 24 h y reste juste. */
export function ajouterJours(jour: Date, n: number): Date {
  return new Date(jour.getTime() + n * MS_JOUR)
}

/** Négatif : à venir. Zéro : le jour même. Positif : jours de retard. */
export function retardEnJours(echeance: Date, jour: Date): number {
  return Math.round((jour.getTime() - echeance.getTime()) / MS_JOUR)
}
