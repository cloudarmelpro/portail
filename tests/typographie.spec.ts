import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Typographie française — section 19.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'espace insécable devant le point d'interrogation.
 *
 * Sans elle, « Supprimer ce CV ? » se coupe entre le mot et le signe quand la
 * modale rétrécit : le point d'interrogation part seul à la ligne suivante. Sur
 * un produit québécois destiné à un client qui lit en français toute la journée,
 * c'est le genre de détail qui donne l'impression d'un outil bâclé.
 *
 * Cinq titres de confirmation la manquaient, sur cinq modules — uniformément,
 * ce qui est la seule raison pour laquelle personne ne l'avait relevé.
 *
 * En JSX, l'entité `&nbsp;`. Dans une chaîne TypeScript, le caractère U+00A0 :
 * `&nbsp;` s'y afficherait littéralement.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Les commentaires citent la règle : les scanner reviendrait à la punir. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const LETTRE = 'a-zA-Zéèêàùçûôî'

describe('Le point d’interrogation ne se détache jamais de son mot', () => {
  it('aucune espace ordinaire avant un « ? » dans du JSX', () => {
    const coupables: string[] = []

    for (const chemin of fichiersJsx()) {
      const source = sansCommentaires(lire(chemin))
      // Un « ? » qui ferme un texte JSX, juste avant une balise fermante.
      if (new RegExp(`[${LETTRE}] \\?\\s*</`).test(source)) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })

  it('aucune espace ordinaire avant un « ? » en fin de chaîne', () => {
    const coupables: string[] = []

    for (const chemin of fichiersJsx()) {
      const source = sansCommentaires(lire(chemin))
      if (new RegExp(`[${LETTRE}] \\?'`).test(source)) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })

  it('la bonne forme est employée selon le contexte', () => {
    /*
      Dans une chaîne, `&nbsp;` s'afficherait tel quel — c'est une entité HTML,
      pas un caractère. Le titre de confirmation de la grille des heures est
      passé par un objet TypeScript avant d'atteindre le rendu.
    */
    expect(lire('src/components/heures/grille-heures.tsx')).toContain('Clôturer la période ?')
    expect(lire('src/components/cv/tableau-fichiers.tsx')).toContain('Supprimer ce CV&nbsp;?')
  })
})

describe('Le test peut échouer', () => {
  it('distingue une faute d’une explication', () => {
    const motif = new RegExp(`[${LETTRE}] \\?\\s*</`)
    expect(motif.test('<DialogTitle>Supprimer ce CV ?</DialogTitle>')).toBe(true)
    expect(motif.test('<DialogTitle>Supprimer ce CV&nbsp;?</DialogTitle>')).toBe(false)
    expect(motif.test(sansCommentaires('/* jamais « ce CV ? » ici */'))).toBe(false)
  })

  it('ne confond pas un opérateur ternaire avec une phrase', () => {
    // `actif ? 'a' : 'b'` n'est pas du texte français.
    const motif = new RegExp(`[${LETTRE}] \\?'`)
    expect(motif.test("valeur ? 'oui' : 'non'")).toBe(false)
  })
})

/** Fichiers susceptibles de porter du texte visible. */
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
