import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les écrans d'état gardent leur sortie, et une seule.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Deux défauts réels, tous deux invisibles en développement.
 *
 * Le premier : `(auth)` n'avait aucune frontière d'erreur. Une panne sur
 * l'écran de connexion tombait sur la page brute de Next — anglaise, sans
 * thème, sans chemin de retour — et c'est le seul écran qu'un visiteur non
 * authentifié puisse atteindre. En développement, la surcouche du cadre masque
 * exactement ce cas.
 *
 * Le second : `EtatSysteme` rendait `action` ET `onAction`, tous deux noirs. Un
 * écran d'erreur offrant « Réessayer » et « Retour à l'accueil » posait donc
 * deux boutons noirs côte à côte, ce que la section 19 interdit. La signature
 * porte désormais la règle : une action principale, une issue de repli à filet,
 * et rien d'autre.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const ECRANS = [join('src', 'app', 'not-found.tsx'), join('src', 'app', 'error.tsx')]

describe('Les écrans d’état globaux existent', () => {
  it.each(ECRANS)('%s est en place', (chemin) => {
    expect(() => lire(chemin), `${chemin} manque`).not.toThrow()
  })

  it.each(ECRANS)('%s ramène à l’accueil', (chemin) => {
    // Rendus hors du gabarit de l'application, ils n'ont ni barre latérale ni
    // fil d'Ariane : sans ce bouton, la seule issue est la barre d'adresse.
    const source = lire(chemin)
    expect(source).toContain('Retour à l’accueil')
    expect(source).toContain("href: '/accueil'")
  })

  it('le filet racine est un composant client et n’utilise pas `reset`', () => {
    /*
      Une frontière d'erreur DOIT être un composant client. Et depuis Next 16.3,
      `retry` est la propriété stable : `reset` rejoue le même rendu sans refaire
      la requête, donc réaffiche l'erreur telle quelle.
    */
    const source = lire(join('src', 'app', 'error.tsx'))
    expect(source.trimStart().startsWith("'use client'")).toBe(true)
    expect(source).not.toContain('reset')
  })
})

describe('Un seul bouton noir sur un écran d’état', () => {
  it('`onAction` n’existe plus : le second bouton est forcément secondaire', () => {
    /*
      Commentaires retirés d'abord : celui du composant EXPLIQUE pourquoi
      `onAction` a disparu. Le scanner tel quel reviendrait à punir sa propre
      documentation — le piège a déjà fait échouer deux gardes de ce dossier.
    */
    const composant = lire(join('src', 'components', 'shared', 'etat-systeme.tsx'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(composant).not.toContain('onAction')
    // L'issue de repli est un lien, rendu par `classesBouton` en `secondaire`.
    expect(composant).toContain("variante: 'secondaire'")
  })

  it('aucun appel d’EtatSysteme ne passe deux actions noires', () => {
    const coupables: string[] = []

    for (const chemin of fichiersDe('src/app')) {
      const source = lire(chemin)

      for (const bloc of source.split('<EtatSysteme').slice(1)) {
        const attributs = bloc.slice(0, bloc.indexOf('/>'))
        if (attributs.includes('action={') && attributs.includes('onAction={')) {
          coupables.push(chemin)
        }
      }
    }

    expect(coupables).toEqual([])
  })
})

describe('Le test peut échouer', () => {
  it('repère les deux actions posées ensemble', () => {
    const faux = `<EtatSysteme action={{}} onAction={{}} />`
    const attributs = faux.split('<EtatSysteme')[1]!
    expect(attributs.includes('action={') && attributs.includes('onAction={')).toBe(true)
  })
})

/** Liste récursive des fichiers `.tsx` d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.tsx') && statSync(join(process.cwd(), chemin)).isFile()) {
        sortie.push(chemin)
      }
    }
  }

  parcourir(racine)
  return sortie
}
