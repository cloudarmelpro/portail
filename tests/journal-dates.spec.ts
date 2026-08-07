import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Choix de date du journal d'audit — ADM-4.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Une date sans heure n'est pas un instant.
 *
 * `new Date('2026-08-06')` vaut minuit UTC, soit le 5 août à 20 h à Montréal.
 * Le calendrier aurait surligné la VEILLE de la date filtrée, et un jour cliqué
 * serait reparti dans l'URL décalé d'un cran — dans le sens inverse, en prime,
 * ce qui rend le défaut illisible.
 *
 * C'est le même piège qui a déjà coûté une semaine de saisie d'heures à ce
 * projet. Les deux fonctions testées ici ne parlent qu'en année, mois et jour.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')
const FILTRES = lire('src/components/admin/filtres-journal.tsx')
/*
  Le choix de date a quitté les filtres du journal pour `shared/` : le CRM et le
  calculateur en ont besoin, et rien dans ce composant n'était propre au journal.
*/
const DATE = lire('src/components/shared/choix-date.tsx')

/**
 * Le fichier SANS ses commentaires.
 *
 * Il explique en toutes lettres pourquoi il n'emploie plus `type="date"`, et un
 * test qui punit sa propre documentation finit par la faire supprimer — alors
 * que c'est elle qui empêche la faute de revenir.
 */
const CODE = (FILTRES + DATE).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/*
  Recopiées du composant plutôt qu'importées : le fichier est `'use client'` et
  tire `next/navigation`, que ce test ne peut pas charger. C'est le motif déjà
  employé par les autres gardes du projet — et le test statique ci-dessous
  vérifie que les deux versions ne divergent pas.
*/
function versDate(iso: string): Date | undefined {
  const [a, m, j] = iso.split('-').map(Number)
  if (!a || !m || !j) return undefined
  return new Date(a, m - 1, j)
}

function versIso(d: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
}

describe('Une date ne se déplace pas', () => {
  it('le jour lu est le jour écrit', () => {
    const d = versDate('2026-08-06')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(7)
    expect(d?.getDate()).toBe(6)
  })

  it('l’aller-retour est un point fixe', () => {
    for (const iso of ['2026-01-01', '2026-08-06', '2026-12-31', '2024-02-29']) {
      expect(versIso(versDate(iso)!), iso).toBe(iso)
    }
  })

  it('le premier de l’an ne recule pas d’un an', () => {
    /*
      Le cas le plus coûteux : minuit UTC le 1er janvier est le 31 décembre à
      Montréal. Un filtre « depuis le 1er janvier 2026 » se serait affiché
      « 31 décembre 2025 ».
    */
    expect(versIso(versDate('2026-01-01')!)).toBe('2026-01-01')
  })

  it('le test peut échouer — la version naïve, elle, déplace la date', () => {
    /*
      `new Date(iso)` interprète la chaîne comme de l'UTC. À l'ouest de
      Greenwich, le jour local est donc le précédent. Ce test est écrit pour
      qu'un retour à cette forme se voie tout de suite.
    */
    const naif = new Date('2026-08-06')
    const decalage = naif.getTimezoneOffset()
    if (decalage > 0) {
      // Machine à l'ouest de Greenwich — celle du Québec, et celle du VPS s'il
      // reste en UTC ne déclenche simplement pas l'assertion.
      expect(naif.getDate()).toBe(5)
    }
    expect(versDate('2026-08-06')!.getDate()).toBe(6)
  })
})

describe('Le composant ne retombe pas dans le champ natif', () => {
  it('plus aucun `<input type="date">`', () => {
    // Il affichait `mm/dd/yyyy` : l'ordre américain, imposé par la locale du
    // navigateur et impossible à corriger en CSS.
    expect(CODE).not.toMatch(/type="date"/)
  })

  it('le calendrier est en français', () => {
    expect(DATE).toContain("from 'date-fns/locale'")
    expect(DATE).toContain('locale={fr}')
  })

  it('les deux conversions vivent dans le composant, sans fuseau', () => {
    // `getFullYear`/`getMonth`/`getDate` sont locaux ; `toISOString` ne l'est
    // pas et rendrait la date au fuseau du processus.
    expect(DATE).toContain('export function versDate(')
    expect(DATE).toContain('export function versIso(')
    expect(CODE).not.toContain('toISOString')
  })

  it('la copie de ce test suit toujours le composant', () => {
    /*
      Les deux fonctions sont recopiées ici parce que le composant ne s'importe
      pas. Une copie qui dérive teste autre chose que le produit.
    */
    for (const morceau of [
      "const [a, m, j] = iso.split('-').map(Number)",
      'return new Date(a, m - 1, j)',
      "String(n).padStart(2, '0')",
    ]) {
      expect(DATE, morceau).toContain(morceau)
    }
  })
})
