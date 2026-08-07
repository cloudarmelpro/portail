import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La troncature — une règle qui ne s'applique qu'à moitié ne s'applique pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `truncate` est trois déclarations : `overflow: hidden`, `white-space: nowrap`
 * et `text-overflow: ellipsis`. Les deux premières produisent toujours quelque
 * chose ; la troisième exige une largeur DÉFINIE, et sans elle le texte est
 * simplement coupé net, sans les points de suspension qui disent qu'il continue.
 *
 * Deux situations le provoquent, et ce sont les deux plus fréquentes du produit.
 *
 * Un `<td>` en disposition automatique : le navigateur mesure le contenu et
 * élargit la colonne pour l'y faire tenir. La cellule ne déborde jamais, donc
 * rien n'est tronqué — c'est le tableau qui pousse, jusqu'au défilement.
 *
 * Un élément flexible sans `min-w-0` : il refuse par défaut de passer sous sa
 * taille de contenu minimale. Le plafond est écrit, il est simplement ignoré.
 *
 * Dans les deux cas le code paraît juste à la relecture. C'est pourquoi ces
 * contrôles lisent la source plutôt que de faire confiance à l'intention.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const TRONQUE = lire('src/components/shared/tronque.tsx')
const TABLEAU = lire('src/components/shared/tableau.tsx')

describe('Le composant de troncature', () => {
  it('porte un plafond par défaut', () => {
    // Sans lui, `<Tronque>{nom}</Tronque>` — l'appel le plus naturel — ne
    // tronquerait rien, et l'absence d'effet passerait pour un texte court.
    expect(sansCommentaires(TRONQUE)).toContain('block max-w-72 truncate')
  })

  it('expose la valeur entière', () => {
    /*
      L'infobulle native n'atteint ni le clavier ni le tactile : ce n'est pas
      une consultation, c'est un recours. Il reste qu'entre un recours partiel
      et rien, la valeur coupée sans aucun moyen de la lire est le pire état.
    */
    expect(TRONQUE).toContain('title={titre ??')
  })
})

describe('La cellule de tableau tronque par le mécanisme partagé', () => {
  it('elle délègue au composant plutôt que de redéclarer les classes', () => {
    expect(TABLEAU).toContain("import { Tronque } from '@/components/shared/tronque'")
    expect(TABLEAU).toContain('tronque ? (')
  })

  it('elle ne reverse au bloc intérieur que le plafond', () => {
    /*
      Le `className` d'une cellule porte aussi son alignement, sa taille de
      texte et parfois sa largeur. Reversé tel quel au bloc, `text-right`
      alignerait le texte dans un bloc déjà plafonné — donc au même endroit —
      et `w-40` figerait la largeur au lieu de la plafonner.
    */
    expect(TABLEAU).toContain("c.includes('max-w-')")
  })
})

describe('Aucun tableau ne tronque à la main', () => {
  it('les cellules passent par `tronque`, jamais par `truncate`', () => {
    /*
      Une classe `truncate` écrite directement sur un `<td>` ou dans une
      `CelluleTableau` est inerte : rien ne borne la cellule. Le défaut ne se
      voit pas — le texte s'affiche en entier, simplement la colonne s'élargit.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      const contenu = sansCommentaires(lire(chemin))

      for (const cellule of contenu.matchAll(/<(td|CelluleTableau)\b[^>]*>/g)) {
        if (/\btruncate\b/.test(cellule[0])) {
          coupables.push(`${chemin} — ${cellule[0].slice(0, 70)}`)
        }
      }
    }

    expect(coupables).toEqual([])
  })

  it('toute cellule tronquée déclare son plafond', () => {
    // `tronque` sans `max-w-*` retombe sur le plafond par défaut du composant.
    // C'est un filet, pas une intention : la largeur d'une colonne se décide.
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      const contenu = sansCommentaires(lire(chemin))

      for (const cellule of contenu.matchAll(/<CelluleTableau\b[^>]*>/g)) {
        if (!/\btronque\b/.test(cellule[0])) continue
        if (!/max-w-/.test(cellule[0])) coupables.push(`${chemin} — ${cellule[0].slice(0, 70)}`)
      }
    }

    expect(coupables).toEqual([])
  })
})

describe('Un texte tronqué dans une boîte flexible peut rétrécir', () => {
  it('`flex-1 truncate` s’accompagne toujours de `min-w-0`', () => {
    /*
      C'est l'oubli le plus fréquent, et le plus invisible : un élément flexible
      a `min-width: auto`, donc il refuse de passer sous la largeur de son
      contenu. Le texte pousse alors son conteneur au lieu d'être coupé — un
      courriel long dans la barre latérale la déforme, ailleurs il déborde.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      for (const ligne of sansCommentaires(lire(chemin)).split('\n')) {
        if (!/\btruncate\b/.test(ligne)) continue
        if (!/\bflex-1\b|\bflex-auto\b/.test(ligne)) continue
        if (!/\bmin-w-0\b/.test(ligne)) coupables.push(`${chemin} — ${ligne.trim().slice(0, 70)}`)
      }
    }

    expect(coupables).toEqual([])
  })
})

describe('La liste déroulante ne s’étire pas sur ses valeurs', () => {
  const CHOIX = lire('src/components/shared/choix.tsx')

  it('le déclencheur d’un filtre est plafonné', () => {
    /*
      En filtre, le déclencheur épouse sa valeur — c'est ce qui lui permet de
      tenir dans une rangée d'outils. Mais les entrées viennent parfois des
      données : un auteur du journal, un service de la calculette. Sans
      plafond, une seule valeur longue écarte tout ce qui partage la rangée.

      En champ, la colonne de saisie donne déjà la limite : le plafond y serait
      une seconde mesure, donc une occasion de diverger.
    */
    expect(CHOIX).toContain("champ ? 'max-w-none min-w-0 flex-1' : 'max-w-48'")
  })

  it('la valeur retenue reste alignée à gauche', () => {
    // Un `<button>` centre son texte. Tant que la valeur était un nœud de texte
    // placé par `justify-between`, cela ne se voyait pas ; dans un bloc qui
    // occupe la place restante, elle se centrerait.
    expect(CHOIX).toContain("'text-left'")
  })

  it('le menu d’un filtre s’étend au lieu de couper d’office', () => {
    // `w-56` était une mesure FIXE : elle coupait toutes les entrées dès qu'une
    // seule dépassait 224 px. C'est un plancher désormais.
    expect(CHOIX).toContain("'max-w-80 min-w-56'")
    // `\b` s'arrête au tiret : il matcherait `min-w-56`, que l'on veut garder.
    expect(sansCommentaires(CHOIX)).not.toMatch(/(?<![\w-])w-56\b/)
  })
})

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    // `components/ui/` vient de shadcn et n'est pas modifié à la main.
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

describe('La bande pleine largeur ne porte que du chrome', () => {
  const BANDE = lire('src/components/shared/bande-pleine.ts')

  it('son contenu se pose au bord du panneau', () => {
    /*
      Fil d'Ariane, onglets de module, bande de chiffres : ce qui répond à « où
      suis-je » fait suite à la barre latérale, et sa place est au bord. Aligné
      sur le contenu, il partait à 250 px du bord sur grand écran — le module
      paraissait commencer au milieu de l'écran.
    */
    expect(BANDE).toContain("export const BANDE_PLEINE = 'ml-[calc(50%_-_50cqw)] w-[100cqw] px-4")
  })

  it('la forme alignée sur le contenu a disparu avec son seul appelant', () => {
    // Le suivi des heures l'employait pour sa bande de commandes ; cette bande
    // est devenue un en-tête ordinaire. Une forme sans appelant finit par
    // resservir à autre chose qu'à ce pour quoi elle avait été pensée.
    const porteurs = fichiersDe('src').filter((c) => lire(c).includes('BANDE_ALIGNEE'))
    expect(porteurs).toEqual([])
  })
})

describe('La liste en creux est déclarée une fois', () => {
  it('aucun écran ne recopie sa forme', () => {
    /*
      Le creux gris et la rangée blanche sont un GABARIT, comme le champ ou le
      tableau. Deux écrans les portent déjà — l'accueil et le tableau de bord du
      CRM — et c'est exactement le nombre à partir duquel les six modules du
      produit avaient chacun inventé le sien.
    */
    const copies: string[] = []

    for (const chemin of fichiersDe('src')) {
      if (chemin === 'src/components/shared/liste-creux.tsx') continue
      const contenu = sansCommentaires(lire(chemin))

      // La signature du creux : le fond du gabarit et son rayon, d'un coup. Le
      // rail des onglets porte le même fond à un autre rayon — c'est pourquoi
      // le rayon compte ici autant que la couleur.
      if (/bg-rail[^'"]*rounded-\[12px\]|rounded-\[12px\][^'"]*bg-rail/.test(contenu)) {
        copies.push(chemin)
      }
    }

    expect(copies).toEqual([])
  })

  it('la rangée impose une destination', () => {
    // `href` n'est pas facultatif : la rangée porte une flèche, et une flèche
    // sans destination est une promesse non tenue.
    const source = lire('src/components/shared/liste-creux.tsx')
    expect(source).toMatch(/^ {2}href: string$/m)
  })
})
