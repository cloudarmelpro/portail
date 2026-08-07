import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La banque de CV se parcourt SANS changer d'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Chaque catégorie avait sa page. Passer de l'une à l'autre demandait donc de
 * revenir en arrière, puis de redescendre — deux navigations pour un mouvement
 * latéral, sur l'écran où l'on cherche précisément dans quel dossier se trouve
 * un nom.
 *
 * Le dossier ouvert vit maintenant dans `?dossier=`, la liste se recompose à
 * gauche, et la colonne de droite reste en place pour le suivant.
 *
 * Deux choses peuvent casser sans bruit et méritent leur garde : l'identifiant
 * du dossier vient de l'URL et n'a aucune valeur de preuve ; et l'ancienne
 * route par catégorie doit continuer à mener quelque part, sous peine de casser
 * les liens déjà partagés et les signets.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/cv/page.tsx')
const ROUTE = lire('src/app/(app)/cv/[categorie]/page.tsx')
const TABLEAU = lire('src/components/cv/tableau-fichiers.tsx')
const VUES = lire('src/config/cv.ts')

describe('Le dossier ouvert vient de l’URL, et il est relu', () => {
  it('l’identifiant est confronté à la base avant d’être cru', () => {
    /*
      `categorieParId` filtre les catégories supprimées. Sans cette relecture,
      une adresse forgée afficherait un dossier vide sous un nom qui n'existe
      plus — ou pire, sous aucun nom.
    */
    expect(PAGE).toContain('await categorieParId(demande)')
    expect(PAGE).toContain("typeof vue === 'string'")
  })

  it('une vue inconnue retombe sur « Tous les CV », sans erreur', () => {
    // Une adresse erronée n'est pas une panne, et une vue réservée demandée
    // sans le droit ne doit ni lever ni confirmer qu'elle existe.
    expect(PAGE).not.toContain('notFound()')
    expect(PAGE).toContain("estVueCv(demande) && (!reservee || admin) ? demande : 'tous'")
  })

  it('sans dossier, le tableau montre TOUT le fonds', () => {
    expect(PAGE).toContain("({ type: 'tous' } as const)")
  })

  it('avec un dossier, il ne montre que lui', () => {
    expect(PAGE).toContain("({ type: 'categorie', categorieId: dossier.id } as const)")
  })
})

describe('Les dossiers pilotent le tableau, ils n’ouvrent pas d’écran', () => {
  it('chaque catégorie pose `?vue=`', () => {
    expect(PAGE).toContain('href={`/cv?vue=${c.id}`}')
  })

  it('le dossier ouvert se signale autrement que par la couleur', () => {
    // Fond, graisse et `aria-current` ensemble — section 19.
    expect(PAGE).toContain("aria-current={actif ? 'page' : undefined}")
    expect(PAGE).toContain("actif ? 'bg-hover2 text-ink font-medium'")
  })

  it('la corbeille est une vue du même tableau', () => {
    // Elle avait son écran. Le client a tranché : plus aucune navigation.
    expect(PAGE).toContain('href="/cv?vue=corbeille"')
    expect(PAGE).toContain('<TableauCorbeille')
  })

  it('le chemin nomme TOUTES les vues, dossier compris', () => {
    /*
      Il n'a d'abord existé que pour les dossiers, puis cohabité avec une rangée
      d'onglets : dans les deux cas quelque chose apparaissait ou disparaissait,
      et le haut de l'écran bougeait d'une vue à l'autre.
    */
    expect(PAGE).toContain('aria-label="Chemin"')
    expect(PAGE).toContain('{ouvert ? ouvert.nom : LIBELLE_VUE_CV[active]}')
  })
})

describe('Les anciennes routes ne cassent aucun lien', () => {
  it('elles reconduisent vers l’écran unique', () => {
    expect(ROUTE).toContain('redirect(`/cv?vue=${encodeURIComponent(categorie)}`)')
    expect(lire('src/app/(app)/cv/corbeille/page.tsx')).toContain("redirect('/cv?vue=corbeille')")
  })

  it('elles ne revalident rien elles-mêmes', () => {
    // `/cv` résout la vue et retombe sur « Tous les CV » si elle ne désigne
    // rien. La refaire ici serait une seconde règle à tenir à jour.
    expect(ROUTE).not.toContain('categorieParId')
    expect(ROUTE).not.toContain('notFound')
  })
})

describe('Les quatre vues sont déclarées une fois', () => {
  it('la liste et les libellés vivent dans `config/cv.ts`', () => {
    /*
      Écrits des deux côtés, ils auraient divergé : personne ne compare un
      chemin au libellé d'une carte, et l'écart ne se verrait donc jamais.
    */
    expect(VUES).toContain(
      "export const VUES_CV = ['tous', 'non-classes', 'echeance', 'corbeille']",
    )
    expect(VUES).toContain('export const LIBELLE_VUE_CV')
    expect(PAGE).toContain("from '@/config/cv'")
  })

  it('« Tous les CV » n’écrit rien dans l’adresse', () => {
    // C'est le défaut : deux URL pour un même écran feraient passer deux fois
    // au même en revenant en arrière.
    expect(PAGE).not.toContain('/cv?vue=tous')
  })
})

describe('Le tableau ne liste que des CV', () => {
  it('aucune ligne de dossier ne s’y est glissée', () => {
    /*
      Elles y ont vécu, à l'image de l'explorateur du repère. Le client a
      tranché : la liste reste une liste, et les dossiers restent à droite.
    */
    expect(TABLEAU).not.toContain('LigneDossier')
    expect(TABLEAU).not.toContain('dossiers')
  })

  it('la colonne « Type » dit le format du fichier', () => {
    expect(TABLEAU).toContain('<ColonneTableau libelle="Type" />')
    expect(TABLEAU).toContain("formatLisible(f.typeMime) ?? '—'")
  })
})

describe('L’emblème de l’écran vient du client', () => {
  const ICONE = lire('src/components/shared/icone-classeurs.tsx')

  it('l’en-tête ne prend pas l’icône du menu', () => {
    /*
      Celle de la barre latérale nomme le module dans une liste ; celle-ci titre
      l'écran. Les deux coexistent, elles ne se remplacent pas.
    */
    expect(PAGE).toContain('<IconeClasseurs')
    expect(PAGE).not.toContain('ICONE_MODULE')
  })

  it('elle suit la couleur du texte', () => {
    // Servie par une balise `<img>` depuis `public/`, elle resterait noire en
    // thème sombre et demanderait une requête réseau pour vingt-quatre pixels.
    expect(ICONE).toContain('fill="currentColor"')
    expect(ICONE).not.toContain('.png')
  })

  it('la fenêtre et la pastille sont des TROUS, pas du blanc peint', () => {
    // Du blanc peint se verrait sur un fond sombre.
    expect(ICONE).toContain('fillRule="evenodd"')
    expect(ICONE).not.toMatch(/fill="(#fff|white)/i)
  })
})
