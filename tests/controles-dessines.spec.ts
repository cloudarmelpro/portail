import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Aucun contrôle natif dans le produit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un `<select>` et un `<input type="date">` portent le style du SYSTÈME.
 *
 * La flèche, la liste, les surbrillances et le calendrier viennent de Windows
 * ou de macOS, pas d'ici. Sur une rangée qui alignait trois menus à côté de
 * champs dessinés, la rupture se voyait plus que les valeurs.
 *
 * Le champ de date est pire : il affiche `mm/dd/yyyy`, l'ordre AMÉRICAIN,
 * imposé par la locale du navigateur et impossible à corriger en CSS. Sur un
 * produit québécois, c'est une invitation à lire le 6 août comme un 8 juin.
 *
 * Ils ont été convertis un par un, module par module. Le prochain formulaire
 * écrit sans y penser en réintroduirait un, et rien ne le signalerait : un
 * `<select>` fonctionne parfaitement.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/**
 * Les commentaires expliquent précisément pourquoi ces balises sont proscrites.
 * Les scanner reviendrait à punir leur propre documentation — ce piège a déjà
 * fait échouer deux gardes de ce dossier.
 */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('Les menus sont dessinés', () => {
  it('aucun `<select>` natif hors de `components/ui`', () => {
    const coupables = fichiersJsx().filter((c) => /<select[\s>]/.test(sansCommentaires(lire(c))))
    expect(coupables).toEqual([])
  })

  it('`Choix` existe et sert de remplacement', () => {
    expect(lire('src/components/shared/choix.tsx')).toContain('export function Choix')
  })
})

describe('Les dates passent par le calendrier', () => {
  it('aucun `type="date"` hors de `components/ui`', () => {
    const coupables = fichiersJsx().filter((c) =>
      /type=["']date["']/.test(sansCommentaires(lire(c))),
    )
    expect(coupables).toEqual([])
  })

  it('le calendrier est en français et sans fuseau', () => {
    const source = lire('src/components/shared/choix-date.tsx')
    expect(source).toContain("from 'date-fns/locale'")
    expect(source).toContain('locale={fr}')
    // `new Date('2026-08-06')` est minuit UTC, donc la veille à Montréal.
    expect(source).not.toMatch(/new Date\(iso\)/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte une balise, pas une explication', () => {
    expect(/<select[\s>]/.test(sansCommentaires('<select name="x">'))).toBe(true)
    expect(/<select[\s>]/.test(sansCommentaires('/* jamais de <select> ici */'))).toBe(false)
    expect(/type=["']date["']/.test(sansCommentaires('// pas de type="date"'))).toBe(false)
  })
})

/** Fichiers susceptibles de porter du JSX, hors primitives shadcn. */
function fichiersJsx(): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    if (dossier === 'src/components/ui') return
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir('src')
  return sortie
}
