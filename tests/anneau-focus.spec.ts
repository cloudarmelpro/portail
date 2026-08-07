import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Anneau de focus — section 19, et la seule façon d'utiliser l'application au
 * clavier.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `outline-none` gagne toujours, quelle que soit la spécificité.
 *
 * `globals.css` pose l'anneau en couche `base` :
 *
 *     *:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px }
 *
 * `outline-none` est une utilitaire Tailwind, donc en couche `utilities`. Les
 * couches en cascade se départagent AVANT la spécificité : `utilities` passe
 * après `base`, et le contour disparaît. Aucun sélecteur plus précis dans
 * `globals.css` n'y changerait rien.
 *
 * Treize champs du produit l'avaient perdu de cette façon — CRM, banque de CV,
 * administration. Rien ne le signalait : le `focus:border-ink` qui les
 * accompagne fait bien changer le champ à la frappe, et l'œil s'en contente
 * tant qu'on ne navigue pas au clavier.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/**
 * `outline-none` NU. `focus:outline-none` reste permis : il va de pair avec un
 * `focus:ring-*` qui remplace le contour au lieu de le retirer — c'est le cas
 * du lien d'évitement, dont l'anneau doit épouser une forme précise.
 */
const NU = /(?<![:-])\boutline-none\b/

/**
 * Les deux seuls `outline-none` légitimes du produit.
 *
 * Ce ne sont pas des contrôles : ce sont des CIBLES DE FOCUS, posées pour
 * recevoir le curseur au clavier sans être manipulables. Un contour de 2 px
 * autour de tout le contenu d'une page, ou autour d'un voile plein écran,
 * n'apprendrait rien à personne et masquerait l'élément réellement visé juste
 * après.
 *
 * Table explicite plutôt que motif à deviner : une exception qui se justifie
 * s'écrit ; une exception qu'une expression régulière laisse passer se
 * multiplie.
 */
const TOLERES: Readonly<Record<string, string>> = {
  'src/components/layout/shell.tsx': 'cible du lien d’évitement — <main tabIndex={-1}>',
  'src/components/cv/apercu-cv.tsx': 'voile de l’aperçu, focalisé à l’ouverture',
}

describe('Aucun champ ne supprime son anneau', () => {
  it('rien dans src/components/ hors du préréglage shadcn', () => {
    const coupables: string[] = []

    for (const chemin of fichiersDe('src/components')) {
      // `components/ui/` vient de shadcn et ne se modifie pas à la main : ses
      // composants posent leurs propres anneaux. Les variantes se créent par
      // composition dans `shared/`.
      if (chemin.startsWith('src/components/ui/')) continue
      if (chemin in TOLERES) continue

      const contenu = sansCommentaires(lire(chemin))

      for (const ligne of contenu.split('\n')) {
        if (NU.test(ligne)) coupables.push(`${chemin} — ${ligne.trim().slice(0, 70)}`)
      }
    }

    expect(coupables).toEqual([])
  })

  it('les tolérances désignent des fichiers qui existent encore', () => {
    // Une exception dont le fichier a disparu masque le jour où elle revient
    // ailleurs sous le même nom.
    for (const chemin of Object.keys(TOLERES)) {
      expect(() => lire(chemin), chemin).not.toThrow()
    }
  })

  it('et personne n’en dessine un SECOND', () => {
    /*
      `focus:border-ink` accompagnait chaque `outline-none` : le contour ayant
      disparu, il fallait bien marquer le focus autrement. Les deux ensemble
      donnent deux traits concentriques autour du champ — le contour de `base` à
      2 px de distance, et le filet du champ juste en dedans.

      Vingt-trois champs le faisaient dès que l'anneau a été rétabli. Ce n'est
      pas une faute de goût : deux repères pour une seule chose apprennent à
      n'en croire aucun.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src/components')) {
      if (chemin.startsWith('src/components/ui/')) continue
      if (sansCommentaires(lire(chemin)).includes('focus:border-ink')) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })

  it('la règle de base est bien déclarée, et jamais désarmée', () => {
    // Le test ci-dessus ne vaut que si l'anneau existe quelque part.
    const CSS = lire('src/app/globals.css')
    expect(CSS).toMatch(/\*:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ink\)/)
  })

  it('la seule exception vise les champs de texte, et rien de plus', () => {
    /*
      Les champs de texte n'ont pas l'anneau : le curseur clignotant y dit déjà
      où l'on est, et plus précisément que lui. L'exception s'arrête là — un
      `<select>`, une case, un bouton ou un lien n'ont aucun curseur, et sans
      anneau on ne sait plus où l'on est en tabulant.

      Ce test existe pour que le sélecteur ne s'élargisse pas. Le remplacer par
      `*:focus-visible { outline: none }` supprimerait l'anneau partout et ne se
      verrait qu'en essayant de naviguer au clavier — c'est-à-dire jamais, pour
      qui ne le fait pas.
    */
    const CSS = lire('src/app/globals.css')

    expect(CSS).toContain("input:not([type='checkbox']):not([type='radio']):focus-visible")
    expect(CSS).toContain('textarea:focus-visible')

    // Aucune autre suppression d'anneau dans la feuille.
    const suppressions = CSS.match(/outline:\s*none/g) ?? []
    expect(suppressions).toHaveLength(1)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un `outline-none` nu', () => {
    expect(NU.test('className="h-10 rounded-[6px] border px-3 outline-none"')).toBe(true)
  })

  it('laisse passer `focus:outline-none` accompagné d’un anneau', () => {
    /*
      Le lien d'évitement remplace le contour par un `ring`, qui suit le rayon de
      la boîte. Retirer puis reposer est ici un choix, pas un oubli.
    */
    expect(NU.test('focus:ring-ink focus:ring-2 focus:outline-none')).toBe(false)
  })
})

/**
 * Retire les commentaires avant l'examen.
 *
 * Plusieurs fichiers expliquent en toutes lettres POURQUOI ils ne portent ni
 * `outline-none` ni `focus:border-ink`. Un test qui punit sa propre
 * documentation finit par la faire supprimer — et c'est elle qui empêche la
 * faute de revenir.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Liste récursive des fichiers de composants. */
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
