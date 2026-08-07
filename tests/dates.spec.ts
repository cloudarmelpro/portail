import { afterEach, describe, expect, it } from 'vitest'
import { ajouterJours, aujourdHui, retardEnJours } from '@/lib/domaine/dates'

/**
 * Le jour civil du domaine — `lib/domaine/dates.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le mode de panne est NOCTURNE et SAISONNIER.
 *
 * Le serveur tourne en UTC : passé 19 h à Montréal l'hiver — 20 h l'été — son
 * horloge est déjà au lendemain. Un « aujourd'hui » lu sur elle fait remonter
 * les relances de DEMAIN dans la liste du jour, chaque soir, puis tout rentre
 * dans l'ordre au matin. Personne ne voit le défaut à l'heure où on regarde le
 * tableau de bord.
 *
 * Tous les instants ci-dessous sont écrits en UTC — `…Z`. Aucune assertion ne
 * dépend donc du fuseau de la machine qui exécute les tests, et le fuseau du
 * domaine reste celui qu'`Intl` reçoit, pas celui du processus.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Jour civil, tel que la base le rend pour une colonne `@db.Date`. */
function jour(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function enIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const TZ_ORIGINALE = process.env.TZ

afterEach(() => {
  process.env.TZ = TZ_ORIGINALE
})

describe('aujourdHui — 23 h 30 à Montréal, le serveur est déjà demain', () => {
  /*
    Hiver : Montréal est à UTC−5. Le 14 janvier à 23 h 30 heure locale, il est
    déjà le 15 à 4 h 30 UTC.
  */
  const SOIR_HIVER = new Date('2026-01-15T04:30:00.000Z')

  /*
    Été : Montréal est à UTC−4. Le 15 juillet à 23 h 30 heure locale, il est
    déjà le 16 à 3 h 30 UTC.
  */
  const SOIR_ETE = new Date('2026-07-16T03:30:00.000Z')

  it('rend le 14 janvier, pas le 15', () => {
    expect(enIso(aujourdHui(SOIR_HIVER))).toBe('2026-01-14')
  })

  it('rend le 15 juillet, pas le 16', () => {
    expect(enIso(aujourdHui(SOIR_ETE))).toBe('2026-07-15')
  })

  it('une relance prévue demain n’est pas comptée aujourd’hui — hiver', () => {
    const demain = jour('2026-01-15')

    // Négatif : à venir. La borne du tableau de bord est « échéance ≤ jour ».
    expect(retardEnJours(demain, aujourdHui(SOIR_HIVER))).toBe(-1)
    expect(demain.getTime()).toBeGreaterThan(aujourdHui(SOIR_HIVER).getTime())
  })

  it('une relance prévue demain n’est pas comptée aujourd’hui — été', () => {
    const demain = jour('2026-07-16')

    expect(retardEnJours(demain, aujourdHui(SOIR_ETE))).toBe(-1)
    expect(demain.getTime()).toBeGreaterThan(aujourdHui(SOIR_ETE).getTime())
  })

  it('la relance du jour et celle d’hier gardent leur place', () => {
    const jourHiver = aujourdHui(SOIR_HIVER)

    expect(retardEnJours(jour('2026-01-14'), jourHiver)).toBe(0)
    expect(retardEnJours(jour('2026-01-13'), jourHiver)).toBe(1)
    expect(retardEnJours(jour('2026-01-07'), jourHiver)).toBe(7)
  })
})

/**
 * L'heure avancée déplace la frontière du jour de soixante minutes. Une
 * soustraction d'heures en dur passe l'une de ces deux assertions et rate
 * l'autre, quel que soit le décalage choisi.
 */
describe('aujourdHui — la frontière suit l’heure avancée', () => {
  it('4 h 30 UTC en janvier, c’est encore la veille au Québec', () => {
    expect(enIso(aujourdHui(new Date('2026-01-15T04:30:00.000Z')))).toBe('2026-01-14')
  })

  it('4 h 30 UTC en juillet, c’est déjà le jour même', () => {
    expect(enIso(aujourdHui(new Date('2026-07-15T04:30:00.000Z')))).toBe('2026-07-15')
  })

  it('minuit trente à Montréal ouvre bien le jour nouveau', () => {
    expect(enIso(aujourdHui(new Date('2026-01-15T05:30:00.000Z')))).toBe('2026-01-15')
  })

  it('midi UTC tombe le même jour des deux côtés', () => {
    expect(enIso(aujourdHui(new Date('2026-03-02T12:00:00.000Z')))).toBe('2026-03-02')
  })
})

/**
 * Le VPS de déploiement n'est pas garanti à Montréal, et l'atelier de
 * développement ne l'est pas non plus. Le fuseau du processus ne doit donc
 * changer aucune réponse.
 */
describe('aujourdHui — indépendant du fuseau du processus', () => {
  const SOIR = new Date('2026-01-15T04:30:00.000Z')

  for (const tz of ['UTC', 'America/Toronto', 'Europe/Paris', 'Pacific/Kiritimati']) {
    it(`TZ=${tz}`, () => {
      process.env.TZ = tz
      expect(enIso(aujourdHui(SOIR))).toBe('2026-01-14')
    })
  }
})

describe('ajouterJours — les jours sont à minuit UTC', () => {
  it('avance de sept jours sans dériver', () => {
    expect(enIso(ajouterJours(jour('2026-01-14'), 7))).toBe('2026-01-21')
  })

  it('traverse le passage à l’heure avancée sans perdre d’heure', () => {
    // Le changement d'heure de 2026 au Québec tombe le 8 mars.
    expect(enIso(ajouterJours(jour('2026-03-05'), 7))).toBe('2026-03-12')
  })

  it('recule aussi bien qu’il avance', () => {
    expect(enIso(ajouterJours(jour('2026-01-01'), -1))).toBe('2025-12-31')
  })
})
