import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BORDURE_FLOTTANTE, FILET_FLOTTANT } from '@/components/shared/surface-flottante'

/**
 * Filet des surfaces flottantes — section 19.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce qui se reperd ici, c'est la SOURCE, pas la valeur.
 *
 * Le préréglage shadcn pose un filet à 10 % dans les deux thèmes. Il est allégé
 * en clair par composition, depuis `components/shared/`. Rien n'empêche le
 * prochain dialogue d'être écrit sans passer par l'enveloppe, ou de recopier la
 * classe à la main — et l'écart ne se verrait pas, puisque c'est un cheveu.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const SOURCE = lire('src/components/shared/surface-flottante.ts')
const DIALOGUE = lire('src/components/shared/contenu-dialogue.tsx')
const TIROIR = lire('src/components/shared/contenu-tiroir.tsx')
const MENU = lire('src/components/layout/menu-utilisateur.tsx')
const PALETTE = lire('src/components/layout/palette-commandes.tsx')

describe('Deux valeurs, une par thème', () => {
  it('5 % en clair, 10 % en sombre', () => {
    /*
      En clair, un panneau blanc sur un fond presque blanc : le filet se lit
      comme un trait dessiné, et l'ombre suffit à détacher la surface. En sombre,
      le même filet est du blanc sur du noir — il ne dessine rien, il empêche le
      panneau de se fondre dans le fond, ce qu'une ombre noire ne peut pas faire.
    */
    expect(FILET_FLOTTANT).toBe('ring-ink/5 dark:ring-ink/10')
    expect(BORDURE_FLOTTANTE).toBe('border-ink/5 dark:border-ink/10')
  })

  it('la couleur vient du jeton, pas d’un hex', () => {
    // `--ink` bascule déjà avec le thème : seule l'opacité a besoin de varier.
    expect(SOURCE).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})

describe('Les quatre surfaces la lisent', () => {
  it('dialogue, tiroir, menu et palette', () => {
    for (const [nom, source] of [
      ['contenu-dialogue', DIALOGUE],
      ['contenu-tiroir', TIROIR],
      ['menu-utilisateur', MENU],
      ['palette-commandes', PALETTE],
    ] as const) {
      expect(source, nom).toMatch(/from '@\/components\/shared\/surface-flottante'/)
    }
  })

  it('le filet est posé AVANT la classe de l’appelant', () => {
    /*
      Dans l'autre ordre, `tailwind-merge` ferait gagner le filet sur la classe
      de l'écran, et un écran qui a une raison de trancher autrement ne pourrait
      plus le faire.
    */
    // L'ombre du produit s'ajoute devant : ce qui compte est que `className`
    // reste EN DERNIER, pour qu'un écran puisse encore trancher autrement.
    /*
      La modale ajoute un anneau plus appuyé en sombre : `--voile` à 60 % de noir
      donne presque du noir pur, et elle ne s'en détachait que de 1,27:1. Ce qui
      compte reste que `className` ferme la liste.
    */
    expect(DIALOGUE).toContain("cn('shadow-modal', FILET_FLOTTANT, 'dark:ring-ink/20', className)")
    expect(TIROIR).toContain("cn('shadow-modal', BORDURE_FLOTTANTE, className)")
  })

  it('l’enveloppe extrait `className` au lieu de l’étaler', () => {
    // Laissé dans `...props`, il écraserait le filet posé juste avant lui.
    for (const source of [DIALOGUE, TIROIR]) {
      expect(source).toMatch(/boutonFermer = true,\s*className,/)
    }
  })
})

describe('Personne ne contourne l’enveloppe', () => {
  it('aucun écran n’importe DialogContent ou SheetContent en direct', () => {
    /*
      Les deux enveloppes de `shared/` ne servent pas qu'au filet : elles portent
      aussi le bouton de fermeture en français, celui de shadcn s'appelant
      « Close ». Un dialogue écrit à côté d'elles perdrait les deux d'un coup.
    */
    const coupables: string[] = []
    for (const chemin of fichiersDe('src')) {
      if (chemin.startsWith('src/components/ui/')) continue
      if (chemin.startsWith('src/components/shared/')) continue

      const contenu = lire(chemin)
      if (/from '@\/components\/ui\/(dialog|sheet)'/.test(contenu)) {
        // Importer `Dialog`, `DialogTitle` ou `SheetTrigger` est normal : seuls
        // les contenus ont une enveloppe.
        if (/\b(DialogContent|SheetContent)\b/.test(contenu)) coupables.push(chemin)
      }
    }
    expect(coupables).toEqual([])
  })

  it('aucune recopie de la classe à la main', () => {
    // Une valeur recopiée dérive dès qu'on ajuste l'autre.
    const copies: string[] = []
    for (const chemin of fichiersDe('src')) {
      if (chemin === 'src/components/shared/surface-flottante.ts') continue
      if (/ring-ink\/5|border-ink\/5/.test(lire(chemin))) copies.push(chemin)
    }
    expect(copies).toEqual([])
  })
})

describe('Le test peut échouer', () => {
  it('détecte un dialogue écrit hors de l’enveloppe', () => {
    const faux = "import { DialogContent } from '@/components/ui/dialog'"
    expect(/from '@\/components\/ui\/(dialog|sheet)'/.test(faux)).toBe(true)
    expect(/\b(DialogContent|SheetContent)\b/.test(faux)).toBe(true)
  })

  it('détecte un filet posé après la classe de l’appelant', () => {
    const faux = 'className={cn(className, FILET_FLOTTANT)}'
    expect(faux.includes('cn(FILET_FLOTTANT, className)')).toBe(false)
  })
})

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
