import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICONE_MODULE } from '@/components/layout/icones'
import { ICONE_MODULE_PLEINE } from '@/components/layout/icones-pleines'
import { MODULES } from '@/lib/permissions'

/**
 * Barre latérale — système de design, section 19.
 *
 * Deux choses se perdent seules ici : la cohérence des deux tables d'icônes, et
 * la règle « la barre n'a pas de bordure ». Toutes deux sautent aux yeux le jour
 * où elles cassent, mais aucune ne casse bruyamment.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const BARRE = lire('src/components/layout/barre-laterale.tsx')
const SHELL = lire('src/components/layout/shell.tsx')
const PALETTE = lire('src/components/layout/palette-commandes.tsx')

describe('Les deux tables d’icônes ne peuvent pas diverger', () => {
  it('chaque module a son icône au trait ET sa variante pleine', () => {
    /*
      Le SVG plein est écrit à la main faute d'équivalent dans lucide. Un module
      ajouté à la navigation sans sa variante pleine planterait à l'instant où
      l'utilisateur l'ouvre — et seulement à cet instant, puisque la variante
      pleine ne sert qu'à l'état actif.
    */
    expect(Object.keys(ICONE_MODULE_PLEINE).sort()).toEqual(Object.keys(ICONE_MODULE).sort())
  })

  it('les deux tables couvrent tous les modules', () => {
    expect(Object.keys(ICONE_MODULE).sort()).toEqual([...MODULES].sort())
  })

  it('les variantes pleines sont bien pleines', () => {
    // Une copie du tracé au trait passerait les deux tests ci-dessus.
    const source = lire('src/components/layout/icones-pleines.tsx')
    expect(source).not.toMatch(/stroke=/)
    expect(source.match(/fill="currentColor"/g)?.length).toBeGreaterThanOrEqual(
      Object.keys(ICONE_MODULE_PLEINE).length,
    )
  })
})

describe('La barre repose sur le fond, sans filet', () => {
  it('aucune bordure droite sur la barre', () => {
    /*
      La séparation VERTICALE vient du panneau de contenu, qui flotte à côté sur
      `--surface`. Un filet en plus ferait deux lignes pour une frontière.

      L'en-tête, lui, porte bien un filet inférieur : il sépare deux zones du
      MÊME panneau, là où rien ne flotte, et sans lui le contenu remontait
      jusque sous une barre collante dont on ne voyait plus le bord.
    */
    expect(BARRE).not.toMatch(/border-r/)
    expect(SHELL).not.toMatch(/border-r\b/)
  })

  it('le pied de barre n’a plus de filet supérieur', () => {
    expect(BARRE).not.toMatch(/border-t\b/)
  })

  it('le panneau de contenu n’est PAS rogné', () => {
    /*
      `overflow-hidden` sur le panneau en ferait un conteneur de défilement, et
      l'en-tête collant qu'il contient cesserait de coller — il se figerait sur
      un conteneur qui ne défile jamais.

      Les coins hauts sont peints par le panneau lui-même. Ils l'étaient par
      l'en-tête, qui ne subsiste plus qu'au téléphone — là où le panneau n'a
      justement pas d'arrondi.
    */
    const panneau = SHELL.slice(SHELL.indexOf('bg-surface @container flex min-w-0'))
    expect(panneau.slice(0, 300)).not.toContain('overflow-hidden')
    // Les valeurs littérales ont été ramenées à l'échelle : `--radius-md` vaut
    // 10 px, `w-13` 52 px, `w-53` 212 px, `w-65` 260 px. Mêmes mesures, un seul endroit où les
    // changer.
    expect(SHELL).toContain('md:rounded-md')
  })
})

describe('Le menu du compte reste dans la barre', () => {
  const MENU = lire('src/components/layout/menu-utilisateur.tsx')

  it('déployée, sa largeur épouse le déclencheur', () => {
    /*
      Une largeur fixe de 216 px pour une barre de 212 px débordait par la
      droite et flottait par-dessus le contenu. `--anchor-width`, le défaut du
      composant, le cale exactement sur le bouton qui l'ouvre.
    */
    expect(MENU).not.toMatch(/className="[^"]*w-\[216px\]/)
    expect(MENU).toContain("compacte && 'w-[216px]'")
  })

  it('en rail, il s’ouvre plus large — sinon il ne se lirait pas', () => {
    // Le déclencheur fait 32 px : lui faire épouser cette largeur donnerait un
    // menu de 32 px. La barre est alors plus étroite que son propre menu.
    expect(MENU).toMatch(/compacte && 'w-\[216px\]'/)
  })

  it('il s’ouvre vers le haut', () => {
    // Le déclencheur est en bas de la barre : vers le bas, le menu sortirait de
    // l'écran.
    expect(MENU).toContain('side="top"')
  })
})

describe('Largeurs de la section 19', () => {
  it('212 px déployée, 52 px en rail, 260 px en tiroir', () => {
    expect(SHELL).toContain('md:w-13')
    expect(SHELL).toContain('xl:w-53')
    expect(SHELL).toContain('w-65')
  })
})

describe('La recherche a quitté l’en-tête', () => {
  it('la palette n’a plus de déclencheur à elle', () => {
    // Deux composants détenant chacun un état d'ouverture afficheraient deux vérités.
    expect(PALETTE).not.toMatch(/aria-label="Rechercher"/)
    expect(PALETTE).toMatch(/onOuverteChange/)
  })

  it('le raccourci est écrit à côté du champ, et il n’existe qu’une fois', () => {
    // Un raccourci qu'on ne voit nulle part n'est utilisé par personne.
    expect(BARRE).toContain('⌘K')
    expect(SHELL.match(/metaKey/g)?.length).toBe(1)
    expect(PALETTE).not.toContain('metaKey')
  })

  it('l’en-tête entier ne subsiste que sous 768 px', () => {
    /*
      Au-delà, la barre latérale est à l'écran : le fil d'Ariane y redisait le
      nom du module, et l'onglet actif redisait déjà celui de l'écran. En
      dessous elle reste indispensable — c'est le seul endroit d'où ouvrir le
      menu et la recherche.
    */
    const entete = SHELL.slice(SHELL.indexOf('<header'), SHELL.indexOf('</header>'))
    expect(entete.slice(0, 200)).toContain('md:hidden')
    expect(entete).toContain('aria-label="Rechercher"')
    expect(entete).toContain('aria-label="Ouvrir le menu"')
  })
})

describe('L’état actif ne repose pas sur la couleur', () => {
  it('fond, ombre, graisse, icône pleine et aria-current à la fois', () => {
    expect(BARRE).toContain("aria-current={actif ? 'page' : undefined}")
    expect(BARRE).toContain('bg-hover2')
    expect(BARRE).toContain('shadow-menu')
    expect(BARRE).toContain('font-medium')
    expect(BARRE).toContain('ICONE_MODULE_PLEINE')
  })
})

describe('Le repli manuel ne casse pas l’hydratation', () => {
  it('il part replié à faux — le premier rendu client égale celui du serveur', () => {
    /*
      Le relire depuis `localStorage` ferait clignoter la barre : déployée au
      premier rendu, repliée au second. Le choix se perd au rechargement, et
      c'est le compromis assumé.
    */
    expect(SHELL).toContain('useState(false)')
    expect(SHELL).not.toContain('localStorage')
  })

  it('aucune mesure de fenêtre : les bascules automatiques restent en CSS', () => {
    expect(SHELL).not.toMatch(/matchMedia|innerWidth|useMediaQuery/)
  })

  it('le déploiement n’est proposé que là où l’écran peut le tenir', () => {
    // Entre 768 et 1280 px le rail est imposé par la largeur : offrir de le
    // déployer promettrait ce que l'écran ne peut pas rendre.
    expect(SHELL).toContain('onReplier={replie ? () => setReplie(false) : undefined}')
  })
})

describe('La marque démarre sur la ligne du panneau', () => {
  /*
    Une seule valeur partagée entre deux fichiers, désormais : la marge haute.
    La rangée reprenait aussi la HAUTEUR de l'en-tête, pour que le nom s'aligne
    sur le fil d'Ariane — cet en-tête ne subsiste plus qu'au téléphone, où la
    barre est repliée dans un tiroir.
  */
  it('la même marge haute que le panneau de contenu', () => {
    expect(SHELL).toContain('md:mt-2')
    expect(BARRE).toContain("'mt-2 flex h-[54px] items-center'")
  })

  it('le bloc de recherche n’ajoute aucune marge haute', () => {
    // La bande de marque a déjà posé la hauteur ; une marge de plus décalerait
    // la recherche sans que rien ne le demande.
    expect(BARRE).toMatch(/<div className="px-2\.5 pb-2\.5">/)
  })
})
