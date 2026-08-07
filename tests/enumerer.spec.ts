import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enumerer } from '@/lib/enumerer'

/**
 * Énumération plafonnée — section 19.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le refus de concurrence de la grille des heures nommait TOUTES les cellules.
 *
 * Une semaine complète en compte soixante. Le message débordait de la
 * notification, et plus personne n'y lisait laquelle avait bougé — c'est-à-dire
 * exactement l'information pour laquelle on avait choisi de les nommer.
 *
 * La section 19 prend ce message précis comme exemple de la règle.
 * ─────────────────────────────────────────────────────────────────────────
 */

describe('La forme suit la section 19', () => {
  it('un, deux, trois, puis le reste compté', () => {
    expect(enumerer(['A'])).toBe('A')
    expect(enumerer(['A', 'B'])).toBe('A et B')
    expect(enumerer(['A', 'B', 'C'])).toBe('A, B et C')
    expect(enumerer(['A', 'B', 'C', 'D'])).toBe('A, B, C et 1 autre')
    expect(enumerer(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C et 2 autres')
  })

  it('`et N autres` n’a pas de virgule devant', () => {
    // « A, B, C, et 12 autres » se lit comme une quatrième entrée.
    expect(enumerer(['A', 'B', 'C', 'D', 'E'])).not.toContain(', et ')
  })

  it('le singulier existe', () => {
    // « et 1 autres » est le genre de faute qu'on ne voit qu'en production, le
    // jour où il y a exactement quatre éléments.
    expect(enumerer(['A', 'B', 'C', 'D'])).toContain('et 1 autre')
    expect(enumerer(['A', 'B', 'C', 'D'])).not.toContain('autres')
  })

  it('une liste vide ne produit rien', () => {
    expect(enumerer([])).toBe('')
  })

  it('les trois retenus sont les PREMIERS, jamais un échantillon', () => {
    // Quelqu'un qui cherche la cause commence par le haut de la liste.
    expect(enumerer(['A', 'B', 'C', 'D', 'E', 'F']).indexOf('A, B, C')).toBe(0)
  })
})

describe('Personne ne recopie la règle', () => {
  it('aucun `join(", ")` sur une liste de noms', () => {
    /*
      Le défaut d'origine tenait en un `join` : il fonctionne, il ne lève pas,
      et il ne se voit qu'avec assez de données pour que le message déborde —
      c'est-à-dire jamais en développement.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      if (chemin === 'src/lib/enumerer.ts') continue
      const source = lire(chemin)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

      // `join(', ')` sur des identifiants ou des chemins est légitime : seules
      // les listes destinées à une PHRASE lue par quelqu'un sont visées.
      if (/\.map\([^)]*\)\.join\(', '\)/.test(source)) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })
})

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.ts') || chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir(racine)
  return sortie
}
