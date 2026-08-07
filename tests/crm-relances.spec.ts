import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aujourdHui, retardEnJours } from '@/lib/domaine/dates'
import { compteRelances, retardEnMots } from '@/components/crm/format'

/**
 * CRM-6 — « à relancer aujourd'hui » et « en retard » sont deux groupes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Les fondre en un seul total est un défaut d'ERGONOMIE, pas d'affichage.
 *
 * « 7 à faire aujourd'hui » dont quatre traînent depuis la semaine dernière se
 * traite comme sept : la gérante en fait sept, se croit à jour, et les quatre
 * retards restent exactement où ils étaient.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `lib/data/crm.ts` est marqué `server-only` : l'importer ici échouerait au
 * chargement. Ce qui s'exécute est donc le domaine pur ; la partition qui s'y
 * adosse est vérifiée sur le texte source, comme dans `crm.spec.ts`.
 */

function lire(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8')
}

const PAGE = lire('src', 'app', '(app)', 'crm', '[entreprise]', 'page.tsx')
const DATA = lire('src', 'lib', 'data', 'crm.ts')
const DATES = lire('src', 'lib', 'domaine', 'dates.ts')

/** Jour civil, tel que la base le rend pour une colonne `@db.Date`. */
function jour(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/**
 * La partition du tableau de bord, reproduite sur des échéances nues. Le code
 * de production classe de la même façon, avec la même fonction — voir plus bas
 * le contrôle sur le texte de `relancesEchues`.
 */
function classer(echeances: string[], maintenant: Date) {
  const j = aujourdHui(maintenant)
  const retards = echeances.map((e) => retardEnJours(jour(e), j))

  return {
    // La requête ne ramène que les échéances atteintes : « ≤ jour ».
    enRetard: retards.filter((r) => r > 0).length,
    duJour: retards.filter((r) => r === 0).length,
    aVenir: retards.filter((r) => r < 0).length,
  }
}

describe('Le soir venu, la relance de demain reste demain', () => {
  const ECHEANCES_HIVER = ['2026-01-07', '2026-01-13', '2026-01-14', '2026-01-15']
  const ECHEANCES_ETE = ['2026-07-08', '2026-07-14', '2026-07-15', '2026-07-16']

  it('23 h 30 le 14 janvier — deux retards, une relance du jour, rien de demain', () => {
    // 23 h 30 à Montréal, UTC−5 : le serveur est déjà le 15.
    const compte = classer(ECHEANCES_HIVER, new Date('2026-01-15T04:30:00.000Z'))

    expect(compte).toEqual({ enRetard: 2, duJour: 1, aVenir: 1 })
  })

  it('23 h 30 le 15 juillet — l’heure avancée ne change rien au verdict', () => {
    // 23 h 30 à Montréal, UTC−4 : le serveur est déjà le 16.
    const compte = classer(ECHEANCES_ETE, new Date('2026-07-16T03:30:00.000Z'))

    expect(compte).toEqual({ enRetard: 2, duJour: 1, aVenir: 1 })
  })

  it('au matin, le classement est le même qu’à 23 h 30 la veille', () => {
    const soir = classer(ECHEANCES_HIVER, new Date('2026-01-15T04:30:00.000Z'))
    const matin = classer(ECHEANCES_HIVER, new Date('2026-01-14T13:00:00.000Z'))

    expect(matin).toEqual(soir)
  })
})

describe('lib/data/crm.ts — une seule fenêtre, partagée', () => {
  it('lit le jour du domaine plutôt que d’en calculer un', () => {
    expect(DATA).toContain(`from '@/lib/domaine/dates'`)
    expect(DATA).not.toContain('Intl.DateTimeFormat')
  })

  it('rend deux groupes, et non une liste à trier par l’écran', () => {
    expect(DATA).toContain('enRetard: courantes.filter((r) => r.retardJours > 0)')
    expect(DATA).toContain('duJour: courantes.filter((r) => r.retardJours <= 0)')
  })
})

/**
 * Une deuxième fenêtre de calcul du jour, même juste le jour où on l'écrit,
 * finit par diverger de la première. Reconstruire un jour civil demande
 * `Date.UTC` ou `setUTCDate` : hors du domaine, ces deux-là sont interdits.
 */
describe('Aucun fichier du CRM ne recalcule « aujourd’hui »', () => {
  const FICHIERS = [
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'page.tsx'],
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'clients', 'page.tsx'],
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'clients', '[client]', 'page.tsx'],
    ['src', 'components', 'crm', 'tableau-clients.tsx'],
    ['src', 'components', 'crm', 'tableau-relances.tsx'],
    ['src', 'components', 'crm', 'format.ts'],
    ['src', 'lib', 'data', 'crm.ts'],
  ]

  for (const chemin of FICHIERS) {
    it(chemin.join('/'), () => {
      const source = lire(...chemin)

      expect(source).not.toContain('Date.UTC(')
      expect(source).not.toContain('setUTCDate(')

      if (source.includes('aujourdHui')) {
        expect(source).toContain(`from '@/lib/domaine/dates'`)
      }
    })
  }
})

describe('lib/domaine/dates.ts — le fuseau est déclaré, jamais soustrait', () => {
  it('passe le fuseau du domaine à Intl', () => {
    expect(DATES).toContain('timeZone: FUSEAU')
  })

  it('ne compense aucun décalage à la main', () => {
    // Le Québec passe à l'heure avancée : une constante d'heures serait juste
    // huit mois par an.
    expect(DATES).not.toMatch(/3[_ ]?600[_ ]?000/)
    expect(DATES).not.toMatch(/getUTCHours|setUTCHours/)
  })
})

describe('Le tableau de bord affiche deux sections nommées et comptées', () => {
  it('sépare le retard du jour même', () => {
    expect(PAGE).toContain('titre="En retard"')
    expect(PAGE).toContain('titre="À faire aujourd’hui"')
    expect(PAGE).toContain('relances={relances.enRetard}')
    expect(PAGE).toContain('relances={relances.duJour}')
  })

  it('donne son compte à chacune', () => {
    expect(PAGE).toContain('compte={relances.enRetard.length}')
    expect(PAGE).toContain('compte={relances.duJour.length}')
  })

  it('ne déduit plus le compte du jour d’un total', () => {
    expect(PAGE).not.toContain('relances.length - enRetard')
  })

  it('reprend les états vides de la section 19', () => {
    expect(PAGE).toContain('Aucune relance prévue aujourd’hui')
    expect(PAGE).toContain('Aucune soumission en attente')
  })
})

describe('Les compteurs déclinent le zéro et le singulier', () => {
  it('compte les relances', () => {
    expect(compteRelances(0)).toBe('Aucune relance')
    expect(compteRelances(1)).toBe('1 relance')
    expect(compteRelances(12)).toBe('12 relances')
  })

  it('dit le retard en toutes lettres', () => {
    expect(retardEnMots(0)).toBe('Aujourd’hui')
    expect(retardEnMots(1)).toBe('En retard de 1 jour')
    expect(retardEnMots(9)).toBe('En retard de 9 jours')
  })
})
