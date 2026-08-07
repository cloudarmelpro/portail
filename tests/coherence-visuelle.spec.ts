import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les règles que six modules ont enfreintes chacun dans son coin.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un audit complet les a toutes trouvées d'un coup. C'est le signe qu'aucune
 * n'était tenue par autre chose que l'attention.
 *
 * Chaque module avait résolu, seul, un problème que la section 19 ne nommait
 * pas encore : quelle forme prend un champ de recherche, quelle ombre porte un
 * menu, quelle couleur peut toucher du texte. Six réponses raisonnables et
 * différentes — et un produit où le même contrôle change trois fois d'aspect
 * entre trois écrans.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Les commentaires citent les anciennes valeurs pour expliquer le changement. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const GABARITS = lire('src/components/shared/gabarits.ts')
const CSS = lire('src/app/globals.css')

describe('Un seul gabarit de champ par emploi', () => {
  it('les deux formes sont déclarées une fois', () => {
    expect(GABARITS).toContain('export const CHAMP =')
    expect(GABARITS).toContain('export const CHAMP_FILTRE =')
    expect(GABARITS).toContain('export const CHAMP_OUTIL =')
    expect(GABARITS).toContain('export const ZONE_TEXTE =')
  })

  it('aucun écran ne recopie la forme d’un champ', () => {
    /*
      Six fichiers portaient la chaîne complète, à six variantes près. Entre
      `/admin/paie` et `/admin/organisation` — deux onglets de la même bande —
      le rayon passait de 9 à 6 px et le fond de `--raised` à `--surface`.
    */
    const copies: string[] = []

    for (const chemin of fichiersDe('src')) {
      if (chemin === 'src/components/shared/gabarits.ts') continue
      const contenu = sansCommentaires(lire(chemin))

      // La signature d'un gabarit recopié : filet, fond et rayon d'un coup.
      if (/border-border bg-(surface|raised)[^'"]*rounded-\[\d+px\][^'"]*h-1[01]/.test(contenu)) {
        copies.push(chemin)
      }
    }

    expect(copies).toEqual([])
  })
})

describe('Les deux ombres ne sont pas interverties', () => {
  it('ce qui recouvre porte l’ombre de modale', () => {
    for (const chemin of [
      'src/components/shared/contenu-dialogue.tsx',
      'src/components/shared/contenu-tiroir.tsx',
    ]) {
      expect(lire(chemin), chemin).toContain('shadow-modal')
    }
  })

  it('ce qui se pose à côté porte l’ombre de menu', () => {
    // Un menu de fin de ligne paraissait flotter plus haut que le dialogue qui
    // s'ouvrait par-dessus lui.
    for (const chemin of [
      'src/components/shared/choix.tsx',
      'src/components/shared/choix-date.tsx',
      'src/components/layout/menu-utilisateur.tsx',
    ]) {
      const contenu = sansCommentaires(lire(chemin))
      expect(contenu, chemin).toContain('shadow-menu')
      expect(contenu, chemin).not.toContain('shadow-modal')
    }
  })
})

describe('La teinte d’état ne touche pas de texte', () => {
  it('les deux jetons dérivés existent', () => {
    expect(CSS).toContain('--critical-texte: color-mix(in srgb, var(--critical) 55%, var(--ink))')
    expect(CSS).toContain('--warning-texte: color-mix(in srgb, var(--warning) 55%, var(--ink))')
  })

  it('aucun texte de 13 px ne porte la teinte pure', () => {
    /*
      `--critical` mesure 4,02:1 sur `--raised` en sombre, sous le seuil AA de
      4,5:1. Il portait « Suspendu », « En retard » et tous les messages de
      validation — dont celui de l'écran de connexion, le seul atteignable sans
      session.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      for (const ligne of sansCommentaires(lire(chemin)).split('\n')) {
        // `\b` s'arrête au tiret : `text-critical-texte` matcherait aussi.
        if (!/\btext-critical(?!-)/.test(ligne)) continue
        // Sur une icône, le seuil n'est que de 3:1 : la teinte pure y reste.
        if (/size-\d|<[A-Z]/.test(ligne)) continue
        coupables.push(`${chemin} — ${ligne.trim().slice(0, 60)}`)
      }
    }

    expect(coupables).toEqual([])
  })

  it('le surlignage de recherche est neutre', () => {
    // La section 19 interdit nommément de faire d'une couleur d'état un accent
    // décoratif ; le fichier admettait lui-même que la couleur ne portait rien.
    const contenu = sansCommentaires(lire('src/components/cv/surligner.tsx'))
    expect(contenu).not.toMatch(/bg-(warning|serious|good|critical)/)
  })
})

describe('Les liens répétés ont un nom distinct', () => {
  it('les trois dossiers nomment leur cible', () => {
    /*
      Sans cela, la liste des liens d'un lecteur d'écran ne montre que
      « Ouvrir », « Ouvrir », « Ouvrir ». Un seul des trois écrans l'appliquait.

      Les cartes ont cédé la place aux rangées en creux, dont le texte visible
      EST le nom du dossier. Le nom serait donc distinct de lui-même — mais il
      ne dit pas ce qu'on ouvre, et « Paysagement » sans verbe se lit comme une
      étiquette, pas comme une destination.
    */
    for (const chemin of ['src/app/(app)/crm/page.tsx', 'src/app/(app)/calculateur/page.tsx']) {
      expect(lire(chemin), chemin).toMatch(/(aria-label|annonce)=\{`Ouvrir/)
    }
  })
})

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    if (dossier === 'src/components/ui') return
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.ts') || chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir(racine)
  return sortie
}

describe('La croix native de `type="search"` est masquée', () => {
  /*
    Le navigateur en dessine une — bleue sur Chromium — dès qu'un terme est
    saisi. Elle vide le champ SANS relancer la recherche : un champ vierge
    au-dessus d'une liste toujours filtrée, deux affirmations contradictoires à
    l'écran. Et là où le produit dessine déjà la sienne, il y en avait deux côte
    à côte.

    Deux écrans sur quatre la masquaient, chacun dans son coin.
  */
  it('la règle est portée par le gabarit, pas par chaque écran', () => {
    expect(GABARITS).toContain('[&::-webkit-search-cancel-button]:hidden')
  })

  it('tout champ `type="search"` passe par un gabarit qui la masque', () => {
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      const contenu = sansCommentaires(lire(chemin))
      if (!contenu.includes('type="search"')) continue

      const couvert =
        contenu.includes('CHAMP_FILTRE') ||
        contenu.includes('[&::-webkit-search-cancel-button]:hidden')

      if (!couvert) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })
})

describe('Un remplissage de champ se surcharge vraiment', () => {
  /*
    `px` produit `padding-inline`, `pl` produit `padding-left` : deux familles
    différentes, que `tailwind-merge` ne voit pas en conflit. Il les laisse donc
    toutes deux passer, et c'est l'ordre dans la feuille de style qui tranche —
    pas le dernier écrit.

    Un `cn(CHAMP_OUTIL, 'pl-10')` était sans effet : la loupe de la recherche
    passait par-dessus le texte. Rien ne levait, rien ne s'écrivait en rouge, et
    le défaut ne se voyait qu'à l'écran.
  */
  it('les gabarits emploient le remplissage logique', () => {
    // Le commentaire du fichier CITE `px-3` pour expliquer pourquoi il a
    // disparu : le scanner tel quel reviendrait à punir sa documentation.
    const gabarits = sansCommentaires(GABARITS)
    expect(gabarits).not.toMatch(/\bpx-\d/)

    // Les quatre gabarits : champ, filtre, outil, zone de texte.
    expect((gabarits.match(/ps-3 pe-3/g) ?? []).length).toBe(4)
  })

  it('aucun appelant ne surcharge un côté avec `pl` ou `pr`', () => {
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      const contenu = sansCommentaires(lire(chemin))

      for (const appel of contenu.matchAll(/cn\(\s*CHAMP[_A-Z]*[^)]*\)/g)) {
        if (/\bp[lr]-\d/.test(appel[0])) coupables.push(`${chemin} — ${appel[0].slice(0, 60)}`)
      }
    }

    expect(coupables).toEqual([])
  })
})

describe('Une seule mesure de lecture pour tout le produit', () => {
  /*
    La banque de CV avait été resserrée seule, à 1250 px, pendant que `main`
    restait à 1400. Deux mesures dans le même produit se voient au passage d'un
    module à l'autre : le contenu s'élargit puis se rétracte, et les bandes
    pleine largeur — dont le rembourrage se déduit de `main` — se recalaient sur
    une largeur que l'écran ne montrait plus.

    La mesure est désormais portée par `main`, une fois. Un écran qui la
    reposerait chez lui la redéclarerait, donc pourrait la faire diverger.
  */
  const SHELL = lire('src/components/layout/shell.tsx')

  it('`main` la déclare', () => {
    const principal = SHELL.slice(SHELL.indexOf('<main'), SHELL.indexOf('{children}'))
    expect(principal).toContain('mx-auto w-full max-w-312.5')
  })

  it('aucun écran ne repose un plafond de largeur sur son contenu', () => {
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      if (chemin === 'src/components/layout/shell.tsx') continue
      for (const ligne of sansCommentaires(lire(chemin)).split('\n')) {
        /*
          Les plafonds PLUS ÉTROITS restent permis : ils resserrent sous la
          mesure de lecture au lieu de la refaire. Les grilles de cartes de
          `/accueil` et `/crm` s'arrêtent à 1060 px, où trois colonnes cessent
          de s'étirer. Seule une seconde déclaration de la mesure elle-même —
          312.5, ou un équivalent en pixels — la ferait diverger.
        */
        if (/max-w-(312\.5|\[1[2-9][0-9]{2}px\])/.test(ligne)) {
          coupables.push(`${chemin} — ${ligne.trim().slice(0, 60)}`)
        }
      }
    }

    expect(coupables).toEqual([])
  })
})
