import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTREPRISES } from '@/config/entreprises'

/**
 * Écran de choix d'entreprise — CRM-2.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'est le seul écran du produit où les trois teintes se voient ensemble.
 *
 * C'est donc celui où la règle de la section 19 se relâche en premier : un fond
 * de carte teinté « pour qu'on les distingue mieux » est la correction que tout
 * le monde propose, et le vert du paysagement mesure 2,74:1 — la carte devient
 * illisible pour qui la regarde de loin, et l'information passe à la couleur
 * seule pour qui ne la distingue pas.
 *
 * Le filet de 3 px et le nom écrit sont la seule forme autorisée.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), 'utf8')

/*
  La carte a cédé la place à une rangée en creux : elle portait un pavé
  d'illustration de 218 px pour dire une seule chose, le nom du dossier. Les
  règles vérifiées ici, elles, n'ont pas bougé — elles s'appliquent désormais à
  l'écran lui-même, qui compose la rangée sur place.
*/
const PAGE = lire('src', 'app', '(app)', 'crm', 'page.tsx')

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const CORPS = sansCommentaires(PAGE)

describe('La couleur d’entreprise n’est jamais une surface', () => {
  it('le jeton ne peint qu’une pastille de 8 px', () => {
    /*
      Filet de 3 px ou pastille de 8 px : la section 19 autorise les deux. La
      carte du calculateur a la même composition et emploie la pastille — deux
      grilles de trois cartes identiques en tout SAUF la marque d'identité,
      c'est précisément ce qu'il ne faut pas.
    */
    const usages = [...CORPS.matchAll(/var\(\$\{e\.jeton\}\)/g)]
    expect(usages.length, 'Le jeton n’est plus utilisé — le fichier est-il lu ?').toBe(1)

    // Le style porté par l'élément coloré, et lui seul.
    expect(CORPS).toMatch(
      /className="size-2 shrink-0 rounded-full"\s+style=\{\{ backgroundColor: `var\(\$\{e\.jeton\}\)` \}\}/,
    )
  })

  it('jamais en couleur de texte, jamais en fond de bloc', () => {
    expect(CORPS).not.toMatch(/color:\s*`var\(\$\{e\.jeton\}\)`/)
    expect(CORPS).not.toMatch(/bg-\[var\(\$\{e\.jeton\}\)\]/)

    // Une seule déclaration de style dans tout le fichier : celle du filet.
    const styles = CORPS.match(/style=\{\{/g) ?? []
    expect(styles).toHaveLength(1)
  })

  it('la pastille est décorative : elle n’annonce rien qu’un lecteur d’écran doive entendre', () => {
    expect(CORPS).toMatch(/<span\s+aria-hidden\s+className="size-2 shrink-0 rounded-full"/)
  })

  it('le nom est toujours écrit à côté', () => {
    expect(CORPS).toContain('principal={e.nom}')
  })
})

describe('Le compteur d’une rangée décline le zéro et le singulier', () => {
  /**
   * « 0 client actif » se lit comme une donnée manquante — section 19. Les trois
   * dossiers sont vides au jour un : c'est l'état que l'écran affichera le plus
   * longtemps avant la première saisie.
   */
  it('nomme le dossier vide plutôt que de compter zéro', () => {
    expect(CORPS).toContain("return 'Aucun client actif'")
    expect(CORPS).not.toMatch(/\$\{n\} client actif`/)
  })

  it('accorde le pluriel', () => {
    expect(CORPS).toContain("'1 client actif'")
    expect(CORPS).toContain('clients actifs')
  })
})

describe('L’écran de choix n’est pas un écran de gabarit administratif', () => {
  it('ni bande de sections, ni bande de chiffres', () => {
    // Il n'y a rien à segmenter : le choix EST le contenu.
    expect(PAGE).not.toContain('BandeChiffres')
    expect(PAGE).not.toContain('BANDE_PLEINE')
    expect(PAGE).not.toContain('EnTeteAdmin')
  })

  it('une rangée par entreprise connue, et rien qu’une', () => {
    expect(PAGE).toContain('ENTREPRISES.map')
    expect(ENTREPRISES).toHaveLength(3)
  })

  it('ne cadre que sur la liste des entreprises, jamais sur un slug d’URL', () => {
    // Le seul écran du module qui voit les trois dossiers ne voit que des
    // nombres : aucun paramètre à valider, donc aucun périmètre à choisir.
    expect(PAGE).toContain('prismaCadre(e.slug)')
    expect(PAGE).not.toContain('params')
  })
})

describe('Le test peut échouer', () => {
  it('détecte un fond teinté', () => {
    const faux = 'style={{ backgroundColor: `var(${jeton})` }} className="block p-6"'
    expect(
      /className="block h-\[3px\]"\s+style=\{\{ backgroundColor: `var\(\$\{jeton\}\)` \}\}/.test(
        faux,
      ),
    ).toBe(false)
  })

  it('détecte un compteur qui ne décline pas le zéro', () => {
    const faux = '{clientsActifs} client actif'
    expect(/\$\{clientsActifs\} client actif/.test(`\${clientsActifs} client actif`)).toBe(true)
    expect(faux.includes('Aucun client actif')).toBe(false)
  })
})
