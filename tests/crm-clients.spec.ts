import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Liste des clients — gabarit posé sur l'administration, CRM-8.
 *
 * Les sources sont LUES plutôt qu'exécutées : la page importe la couche de
 * données, marquée `server-only`, et le tableau tire la fabrique d'actions.
 * Les autres tests de mise en page du projet procèdent de même.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/**
 * Retire les commentaires avant l'examen : plusieurs fichiers expliquent en
 * toutes lettres ce qu'ils ont cessé d'employer, et un test qui punit sa propre
 * documentation finit par la faire supprimer.
 */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const PAGE = lire('src/app/(app)/crm/[entreprise]/clients/page.tsx')
const TABLEAU = lire('src/components/crm/tableau-clients.tsx')
const FILTRES = lire('src/components/crm/barre-filtres.tsx')
const PAGINATION = lire('src/components/shared/pagination.tsx')

/** En-têtes de la section 19, plus la colonne d'actions. */
const COLONNES = ['Client', 'Type', 'Statut', 'Dernière interaction', 'Prochaine relance']

describe('L’en-tête de l’écran', () => {
  it('le titre reste au document, sans s’afficher', () => {
    /*
      Le fil d'Ariane de l'en-tête nomme l'écran. Le `h1` reste : une page qui
      n'en a pas ne se parcourt pas par les titres, et c'est le premier moyen de
      navigation d'un lecteur d'écran.
    */
    expect(PAGE).toContain('<h1 className="sr-only">Clients</h1>')
    expect(PAGE).not.toContain('text-[30px]')
  })

  it('la rangée d’outils repousse le compte et l’action à droite', () => {
    expect(FILTRES).toContain('ml-auto')
    expect(PAGE).toContain('action={<DialogueClient entreprise={slug} />}')
  })
})

describe('La barre de filtres', () => {
  it('n’emploie plus aucun `select` natif', () => {
    /*
      Un `<select>` porte le style du SYSTÈME : sa flèche, sa liste et ses
      surbrillances viennent de Windows ou de macOS, pas du produit. Sur une
      rangée qui en alignait deux à côté d'un champ dessiné, la rupture se voyait
      plus que les valeurs.
    */
    expect(sansCommentaires(FILTRES)).not.toContain('<select')
    expect(FILTRES).toContain("from '@/components/shared/choix'")
    expect(FILTRES).toContain('parDefaut="Tous les statuts"')
    expect(FILTRES).toContain('parDefaut="Tous les types"')
    expect(FILTRES).toContain('annonce="Filtrer par statut"')
    expect(FILTRES).toContain('annonce="Filtrer par type"')
  })

  it('la recherche navigue seule, sans bouton', () => {
    /*
      C'est l'inverse de l'écran des comptes, et c'est délibéré : la liste est le
      lieu du tâtonnement — on tape trois lettres, on regarde, on en retire une.
      Les deux ensemble se marcheraient dessus, la temporisation partant pendant
      qu'on vise le bouton.
    */
    expect(FILTRES).toContain('}, 300)')
    expect(FILTRES).not.toContain('<form')
    expect(FILTRES).not.toContain('type="submit"')
  })

  it('le compteur décline le zéro et le singulier', () => {
    // « 0 clients » se lit comme une donnée manquante plutôt que comme une
    // liste vide — section 19.
    expect(FILTRES).toContain("'Aucun client'")
    expect(FILTRES).toContain("'1 client'")
  })

  it('aucun contrôle ne supprime son anneau de focus', () => {
    expect(FILTRES).not.toContain('outline-none')
    expect(FILTRES).not.toContain('focus:border-ink')
  })
})

describe('Le tableau des clients', () => {
  it('porte les colonnes de la section 19, plus les actions à droite', () => {
    for (const colonne of COLONNES) expect(TABLEAU).toContain(`libelle: '${colonne}'`)
    expect(TABLEAU).toContain('<ColonneTableau libelle="Actions" aDroite />')
  })

  it('une seule taille et une seule encre pour toutes les cellules, le nom compris', () => {
    expect(TABLEAU).toContain("const CELLULE = 'text-[13px]'")

    const corps = TABLEAU.slice(
      TABLEAU.indexOf('<CorpsTableau>'),
      TABLEAU.indexOf('</CorpsTableau>'),
    )
    const cellules = corps.match(/<CelluleTableau[^>]*>/g) ?? []
    // Toutes sauf la dernière, qui ne porte que le menu.
    const donnees = cellules.filter((c) => !c.includes('aDroite>'))

    expect(donnees.length).toBe(5)
    for (const cellule of donnees) {
      expect(cellule, cellule).toContain('discret')
      expect(cellule, cellule).toContain('CELLULE')
    }
  })

  it('écrit le statut au lieu de le mettre en pastille', () => {
    expect(TABLEAU).not.toContain('badge-statut')
    expect(TABLEAU).not.toContain('BadgeStatutClient')
    expect(TABLEAU).toContain('LIBELLE_STATUT_CLIENT[l.statut]')
  })

  it('le retard garde sa couleur, mais jamais seule', () => {
    // La couleur ne fait qu'attirer l'œil sur un mot qui porte déjà
    // l'information — aucune règle de la section 19 n'y échappe.
    expect(TABLEAU).toContain("' · En retard'")
    expect(TABLEAU).toContain('text-critical')
  })

  it('replie les gestes de ligne dans un menu, habillé comme les autres', () => {
    expect(TABLEAU).toContain('MoreHorizontal')
    expect(TABLEAU).toContain('bg-raised shadow-menu w-56 rounded-[9px] px-1 py-1.5')
    expect(TABLEAU).toContain('FILET_FLOTTANT')
    expect(TABLEAU).toContain('aria-label={`Actions pour ${l.nom}`}')
    // Une icône lucide par entrée : `gap-2.5` suppose qu'aucune n'en manque.
    expect(TABLEAU).toContain('Consulter')
    expect(TABLEAU).toContain('Nouvelle estimation')
  })

  it('le tri reste dans l’URL', () => {
    // Une vue triée se partage et survit au rechargement ; le clic droit
    // « ouvrir dans un nouvel onglet » fonctionne.
    expect(TABLEAU).toContain('function lienTri')
    expect(TABLEAU).toContain("p.set('tri', cle)")
  })
})

describe('Les deux façons de n’avoir rien à montrer', () => {
  it('le filtre sans résultat répond dans le cadre du tableau', () => {
    /*
      `EtatVide` explique et propose ; `TableauVide` répond dans le cadre.
      Les intervertir fait disparaître la liste sous une recherche
      infructueuse, ou prive le premier usage de ce qu'il faut faire ensuite.
    */
    const bloc = PAGE.slice(PAGE.indexOf('{resultat.lignes.length > 0 ?'))
    expect(bloc.indexOf('<TableauVide>')).toBeGreaterThan(-1)
    expect(bloc.indexOf('<TableauVide>')).toBeLessThan(bloc.indexOf('<EtatVide'))
    expect(bloc).toContain('filtresActifs')
  })

  it('le premier usage garde l’état vide de la section 19', () => {
    expect(PAGE).toContain('titre="Aucun client pour cette entreprise"')
    expect(PAGE).toContain('message="Ajoutez le premier."')
  })

  it('le terme cherché est dans le titre de la réponse, entre insécables', () => {
    expect(PAGE).toContain('Aucun résultat pour «&nbsp;{recherche}&nbsp;»')
  })
})

describe('La pagination', () => {
  it('nomme ses deux sens, et le libellé reste écrit au bout de la liste', () => {
    expect(PAGINATION).toContain('libelle="Page précédente"')
    expect(PAGINATION).toContain('libelle="Page suivante"')
    // Inerte, le libellé cesse d'être un lien : un `<a>` mort se tabule encore.
    expect(PAGINATION).toMatch(/if \(!actif\) \{[\s\S]*?<span/)
  })

  it('reconduit les filtres d’une page à l’autre', () => {
    /*
      La construction de l'adresse reste sur l'ÉCRAN, pas dans le composant :
      le CRM compose un chemin par entreprise et omet `page` quand elle vaut 1,
      là où le journal empile une chaîne de requête. C'était la seule vraie
      différence entre les deux paginations, qui n'en font plus qu'une.
    */
    expect(PAGE).toContain('new URLSearchParams(filtres)')
    expect(PAGE).toContain("p.delete('page')")
  })
})

describe('Aucune surcharge de gabarit', () => {
  it('aucun bouton ne se voit imposer une hauteur', () => {
    for (const source of [FILTRES, TABLEAU, PAGINATION]) {
      expect(source).not.toMatch(/<Bouton[^>]*taille=/)
    }
  })

  it('un seul bouton noir sur l’écran', () => {
    // `DialogueClient` porte le seul geste principal : ajouter un client.
    expect((PAGE.match(/<DialogueClient/g) ?? []).length).toBe(1)
  })
})
