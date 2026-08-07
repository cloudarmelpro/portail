import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * L'écran d'attente du produit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il y en a UN, et il est le même partout.
 *
 * Les squelettes qui l'ont précédé promettaient une forme — autant de cartes,
 * autant de lignes, des colonnes à telle largeur. Quand le contenu arrivait et
 * ne correspondait pas, la page sautait : l'attente avait coûté un mouvement au
 * lieu d'en épargner un. Et chacun devait être tenu à jour en même temps que
 * son écran, ce que rien ne garantissait.
 *
 * Un `loading.tsx` qui recommencerait à dessiner ne casserait rien et ne se
 * verrait qu'en production, sur une connexion lente.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const COMPOSANT = lire('src/components/shared/barre-chargement.tsx')
const CSS = lire('src/app/globals.css')

describe('Tous les écrans d’attente sont la même barre', () => {
  const chargements = fichiersDe('src/app').filter((c) => c.endsWith('/loading.tsx'))

  it('il y en a au moins un par module', () => {
    // Une liste vide ferait passer tout ce qui suit sans rien vérifier.
    expect(chargements.length).toBeGreaterThanOrEqual(8)
  })

  it('chacun rend `BarreChargement`, et rien d’autre', () => {
    const ecarts: string[] = []

    for (const chemin of chargements) {
      const contenu = lire(chemin)
      if (!contenu.includes('<BarreChargement />')) ecarts.push(`${chemin} : pas la barre`)
      if (/Squelette|animate-pulse/.test(contenu)) ecarts.push(`${chemin} : squelette résiduel`)
    }

    expect(ecarts).toEqual([])
  })
})

describe('La barre ne ment pas sur l’avancement', () => {
  it('elle s’arrête avant 100 %', () => {
    /*
      La durée réelle n'est pas connue. Une barre qui atteint le bout avant
      l'arrivée du contenu annonce une fin qui ne vient pas, et la seconde
      d'après paraît deux fois plus longue.
    */
    expect(CSS).toContain('@keyframes barre-chargement')
    expect(CSS).toMatch(/100% \{\s*transform: scaleX\(0\.94\);/)
    expect(CSS).not.toMatch(/100% \{\s*transform: scaleX\(1\);/)
  })

  it('`forwards` : elle reste visible même sans animation', () => {
    // Sous `prefers-reduced-motion`, la durée retombe à 0,01 ms et l'animation
    // saute à sa dernière image. Sans `forwards`, elle repartirait à zéro —
    // c'est-à-dire à un trait invisible.
    expect(COMPOSANT).toContain('_forwards]')
  })

  it('l’attente est annoncée aux lecteurs d’écran', () => {
    expect(COMPOSANT).toContain('role="status"')
    expect(COMPOSANT).toContain('aria-label="Chargement"')
  })

  it('elle ne prend la place de rien', () => {
    // Dans le flux, elle décalerait le contenu de trois pixels à chaque
    // navigation — un saut, pour un trait.
    expect(COMPOSANT).toContain('fixed inset-x-0 top-0')
    expect(COMPOSANT).toContain('pointer-events-none')
  })

  it('la couleur vient du jeton d’encre, pas d’un noir écrit à la main', () => {
    // `--ink` bascule avec le thème : un noir en dur serait invisible en sombre.
    expect(COMPOSANT).toContain('bg-ink')
    expect(COMPOSANT).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir(racine)
  return sortie
}
