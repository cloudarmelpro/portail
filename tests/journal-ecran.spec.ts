import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Écran du journal d'audit — ADM-4, mise en page.
 *
 * Lecture des sources : la page importe `lib/data`, marqué `server-only`, et
 * l'importer ici échouerait au chargement. Les autres tests de garde du projet
 * procèdent de la même façon.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/admin/journal/page.tsx')
const FILTRES = lire('src/components/admin/filtres-journal.tsx')
const EXPORT_CSV = lire('src/app/(app)/admin/journal/export/route.ts')

/** Les libellés de colonne déclarés par la page, dans l'ordre. */
const colonnes = [...PAGE.matchAll(/<ColonneTableau libelle="([^"]+)"/g)].map((m) => m[1])

/** Les libellés de la bande de chiffres, page et squelette confondus. */

describe('Le gabarit d’administration', () => {
  it('pose l’en-tête sans actions : la bande ne porte que les sections', () => {
    /*
      L'export est descendu dans le contenu, avec les filtres qu'il reprend. Une
      action posée dans la bande des sections aurait suggéré qu'elle vaut pour
      l'ensemble de l'administration.
    */
    expect(PAGE).toContain('<EnTeteAdmin titre="Journal d’audit" />')
    expect(PAGE).not.toMatch(/<EnTeteAdmin[^/]*actions=/)
  })

  it('enchaîne les deux bandes, puis le contenu SUR LEUR AXE', () => {
    /*
      Seul écran d'administration qui ne se resserre pas. Huit filtres et six
      colonnes d'horodatages, d'adresses et de libellés : à 96 px de retrait de
      chaque côté, la rangée se repliait sur deux lignes et le tableau tronquait
      ses éléments. Le gabarit sert la lecture ; là où il la gêne, c'est lui qui
      cède.
    */
    expect(PAGE.indexOf('<EnTeteAdmin')).toBeLessThan(PAGE.indexOf('<BandeChiffres'))
    expect(PAGE.indexOf('<BandeChiffres')).toBeLessThan(PAGE.indexOf('className="mt-10"'))
    expect(PAGE).not.toContain('xl:mx-24')
  })

  it('place l’export à droite de la rangée de filtres', () => {
    const rangee = PAGE.slice(PAGE.indexOf('<FiltresJournal'), PAGE.indexOf('<CadreTableau'))
    expect(rangee).toContain('ml-auto')
    expect(rangee).toContain('/admin/journal/export')
  })
})

describe('Les chiffres portent sur TOUT le journal', () => {
  /*
    `total` est le compte du filtre courant : s'il entrait dans la bande, elle
    deviendrait un second résultat de recherche, et « 34 actions sensibles »
    cesserait d'être vrai dès qu'on ouvre un filtre.
  */
  const bloc = PAGE.slice(PAGE.indexOf('const chiffres'), PAGE.indexOf('const pages'))

  it('ne compte ni les lignes affichées ni le total filtré', () => {
    expect(bloc).not.toMatch(/\bentrees\b/)
    expect(bloc).not.toMatch(/[^.]\btotal\b/)
  })

  it('mesure les quatre axes du journal entier', () => {
    expect(bloc).toContain('journal.total')
    expect(bloc).toContain('surveillees.total')
    expect(bloc).toContain('auteurs.length')
  })

  it('laisse le compte filtré près de la liste qu’il compte', () => {
    // Section 19 : un compteur nomme son unité et décline le zéro et le singulier.
    expect(PAGE).toContain("'Aucune entrée'")
    expect(PAGE).toContain("'1 entrée'")
    expect(PAGE).toContain('entrées`')
  })
})

describe('Le tableau — six colonnes, section 19', () => {
  it('déclare exactement les colonnes de l’écran, sans le module', () => {
    /*
      Le module n'est pas une colonne : le libellé de l'action le nomme déjà.
      Il reste dans l'export CSV, où la largeur ne coûte rien.
    */
    expect(colonnes).toEqual([
      'Horodatage',
      'Utilisateur',
      'Action',
      'Élément',
      'Entreprise',
      'Adresse IP',
    ])
    expect(EXPORT_CSV).toContain("'Module'")
  })

  it('est en LECTURE SEULE : aucune colonne d’actions, aucun menu de ligne', () => {
    expect(colonnes).not.toContain('Actions')
    expect(PAGE).not.toContain('DropdownMenu')
    expect(PAGE).not.toContain('MoreHorizontal')
    expect(PAGE).not.toContain('@/lib/actions/')
  })

  it('écrit les mots plutôt que de les mettre en pastille', () => {
    // Ni pilule, ni point coloré : l'entreprise s'écrit, le module a disparu.
    expect(PAGE).not.toContain('rounded-full')
    expect(PAGE).not.toContain('backgroundColor')
    expect(PAGE).not.toContain('style={{')
  })

  it('donne une seule taille et une seule encre à toutes les cellules', () => {
    expect(PAGE).toContain("const CELLULE = 'text-[13px]'")
    expect(PAGE.match(/className=\{CELLULE\}/g)?.length).toBe(6)
  })

  it('l’action surveillée ne tient ni à la couleur ni à l’icône seules', () => {
    /*
      `--serious` ne va qu'à l'icône, jamais au texte : 2,55:1 sur `--surface`.
      Le demi-gras et le mot en `sr-only` portent l'information partout ailleurs.
    */
    expect(PAGE).toContain('text-serious')
    expect(PAGE).toContain('font-semibold')
    expect(PAGE).toContain('Action sensible&nbsp;:')
  })

  it('met la chasse tabulaire sur l’horodatage et l’adresse IP', () => {
    expect(PAGE.match(/discret chiffres|discret aDroite chiffres/g)?.length).toBe(2)
  })
})

describe('Les deux vides ne se confondent pas', () => {
  it('répond dans le cadre du tableau quand les filtres ne trouvent rien', () => {
    expect(PAGE).toContain('<TableauVide>')
    expect(PAGE).toContain('journal.total > 0')
  })

  it('réserve l’état vide complet au journal réellement vide', () => {
    const bloc = PAGE.slice(PAGE.indexOf('<EtatVide'))
    expect(bloc).toContain('titre="Aucune action sur cette période"')
    expect(bloc).toContain('message="Élargissez la période ou retirez un filtre."')
  })
})

describe('La rangée de filtres', () => {
  it('transmet les six axes d’ADM-4 à la couche de données', () => {
    /*
      Quatre des huit filtres étaient écrits dans l'URL, validés par le schéma,
      puis oubliés avant l'appel : l'écran ne bougeait pas.
    */
    const bloc = PAGE.slice(PAGE.indexOf('const criteres'), PAGE.indexOf('await Promise.all'))
    for (const axe of [
      'utilisateur',
      'module',
      'entreprise',
      'action',
      'entite',
      'ip',
      'du',
      'au',
    ]) {
      expect(bloc, axe).toContain(`${axe}: filtres.${axe}`)
    }
  })

  it('l’export reprend EXACTEMENT les mêmes axes que l’écran', () => {
    /*
      Le même oubli était dans la route d'export, où il se voit encore moins :
      un fichier plus large que la vue qui l'a demandé ne se remarque qu'en le
      relisant ligne à ligne. La section 19 dit que l'export reprend les filtres
      de l'écran ; les deux listes doivent donc rester identiques, et elles
      vivent dans deux fichiers que rien ne relie.
    */
    const ROUTE = lire('src/app/(app)/admin/journal/export/route.ts')
    const bloc = ROUTE.slice(ROUTE.indexOf('journalPourExport({'))

    for (const axe of [
      'utilisateur',
      'module',
      'entreprise',
      'action',
      'entite',
      'ip',
      'du',
      'au',
    ]) {
      expect(bloc, axe).toContain(`${axe}: filtres.${axe}`)
    }
    // `page` n'en est pas : un export porte sur tout le résultat.
    expect(bloc.slice(0, bloc.indexOf('})'))).not.toContain('page')
  })

  it('vit dans l’URL, pour que la vue filtrée se partage et s’exporte', () => {
    expect(FILTRES).toContain('router.replace')
    expect(PAGE).toContain('await searchParams')
  })

  it('bat la mesure du produit, une seule hauteur pour toute la rangée', () => {
    /*
      Neuf contrôles, le compte et l'export sur une même ligne : une hauteur de
      plus et la rangée ondule au repli. `bouton.tsx` fixe les 36 px ; ici on ne
      les recopie que pour les champs, qui ne sont pas des boutons.
    */
    /*
      `max-h-*` est exclu : il borne la liste déroulante d'un menu, ce n'est pas
      la hauteur d'un contrôle de la rangée.
    */
    const hauteurs = new Set(FILTRES.match(/(?<!max-)\bh-\d+(\.\d+)?\b/g))
    expect([...hauteurs]).toEqual(['h-9'])
    expect(PAGE).not.toMatch(/classesBouton\(\{[^}]*className/)
  })

  it('ne supprime jamais l’anneau de focus', () => {
    // `outline-none` est en couche `utilities` : elle passe après l'anneau de
    // `base`, quelle que soit la spécificité.
    expect(FILTRES).not.toContain('outline-none')
  })
})
