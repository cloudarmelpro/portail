import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Grilles de tarifs — gabarit d'administration, ADM-2 et ADM-3.
 *
 * Les sources sont LUES plutôt qu'exécutées : `editeur-grille.tsx` importe la
 * fabrique d'actions, qui tire Prisma et Better Auth — l'importer ici échouerait
 * au chargement. Les autres tests de mise en page du projet procèdent de même.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/admin/tarifs/page.tsx')
const EDITEUR = lire('src/components/admin/editeur-grille.tsx')

const CHIFFRES = ['Version en vigueur', 'Services', 'Actifs', 'Publiée le']
const COLONNES = ['Service', 'Unité', 'Prix unitaire', 'État']

describe('Les deux bandes pleine largeur', () => {
  it('l’en-tête ne porte aucune action : il ne porte que les sections', () => {
    /*
      Le titre y est en `sr-only`, et la bande est réservée au contrôle segmenté.
      Une action posée là ferait diverger cet écran des quatre autres, dont la
      rangée d'outils est le seul endroit où l'on agit.
    */
    const balise = PAGE.slice(PAGE.indexOf('<EnTeteAdmin'), PAGE.indexOf('<BandeChiffres'))
    expect(balise).toContain('titre="Grilles de tarifs"')
    expect(balise).not.toContain('actions')
  })

  it('la bande de chiffres suit l’en-tête', () => {
    expect(PAGE.indexOf('<EnTeteAdmin')).toBeLessThan(PAGE.indexOf('<BandeChiffres'))
    for (const libelle of CHIFFRES) expect(PAGE).toContain(`libelle: '${libelle}'`)
  })

  it('les chiffres décrivent la version en vigueur, pas un résultat filtré', () => {
    /*
      Ils répondent à « qu'est-ce que le calculateur applique en ce moment ».
      Les faire porter sur la liste filtrée, ou pire sur la saisie en cours, les
      transformerait en second résultat de filtre — et la réponse changerait
      pendant qu'on prépare la version suivante.
    */
    const bloc = PAGE.slice(PAGE.indexOf('const chiffres'), PAGE.indexOf('const mention'))
    expect(bloc).toContain('produits.length')
    expect(bloc).toContain('produits.filter((p) => p.actif).length')
    expect(PAGE).toMatch(/const produits = courante\?\.produits \?\? \[\]/)
    // Le filtre vit dans l'éditeur ; la page reste un composant serveur.
    expect(PAGE).not.toContain("'use client'")
    expect(PAGE).not.toContain('useState')
  })
})

describe('La rangée d’outils', () => {
  it('la rangée d’outils repousse l’action principale à droite', () => {
    const rangee = EDITEUR.slice(
      EDITEUR.indexOf('{selecteurEntreprise}'),
      EDITEUR.indexOf('{mention}'),
    )
    // Le filtre passe par le `Choix` partagé : on vise sa propriété d'annonce,
    // plus une balise `select` qui n'existe plus.
    expect(rangee).toContain('annonce="Filtrer par état"')
    expect(rangee).toContain('ml-auto')
    /*
      On vise le bouton de publication par sa STRUCTURE — un `Bouton` sans
      variante, donc noir — et non par son libellé : celui-ci se raccourcit au
      fil des relectures, et un test qui l'épingle transforme chaque retouche de
      vocabulaire en échec sans rapport.
    */
    expect(rangee).toMatch(/<Bouton(?![^>]*variante)/)
  })

  it('le sélecteur d’entreprise et l’historique restent rendus au serveur', () => {
    // Passés en propriétés depuis la page : rien dans ces deux-là n'a besoin du
    // navigateur, et les faire basculer dans le module client les y entraînerait.
    expect(PAGE).toContain('selecteurEntreprise={<ChoixEntreprise')
    expect(PAGE).toContain('historique={<HistoriqueGrilles')
    expect(EDITEUR).not.toContain("from '@/components/admin/choix-entreprise'")
    expect(EDITEUR).not.toContain("from '@/components/admin/historique-grilles'")
  })

  it('un seul bouton noir sur l’écran', () => {
    /*
      `Bouton` sans variante EST le bouton noir. Les gestes secondaires — ajouter
      un service, consulter l'historique, annuler — portent un filet ou rien.
      Le dialogue de saisie ne compte pas : il recouvre l'écran.
    */
    const ecran = EDITEUR.slice(0, EDITEUR.indexOf('function DialogueService'))
    const noirs = ecran.match(/<Bouton(?![^>]*variante)/g) ?? []
    expect(noirs).toHaveLength(1)
  })
})

describe('Le tableau des produits', () => {
  it('porte les colonnes de la section 19, plus les actions à droite', () => {
    for (const colonne of COLONNES) expect(EDITEUR).toContain(`libelle="${colonne}"`)
    expect(EDITEUR).toContain('<ColonneTableau libelle="Actions" aDroite />')
  })

  it('une seule taille et une seule encre pour toutes les cellules', () => {
    expect(EDITEUR).toContain("const CELLULE = 'text-[13px]'")

    const corps = EDITEUR.slice(
      EDITEUR.indexOf('<CorpsTableau>'),
      EDITEUR.indexOf('</CorpsTableau>'),
    )
    const cellules = corps.match(/<CelluleTableau[^>]*>/g) ?? []
    // Toutes sauf la dernière, qui ne porte que le menu.
    const donnees = cellules.filter((c) => !c.includes('aDroite>'))
    expect(donnees.length).toBeGreaterThan(0)
    for (const cellule of donnees) {
      expect(cellule, cellule).toContain('discret')
      expect(cellule, cellule).toContain('CELLULE')
    }
  })

  it('écrit l’état au lieu de le mettre en pastille', () => {
    /*
      « Retiré » écrit dit ce qu'une pastille grise ne disait qu'à ceux qui en
      connaissaient le code. Aucun état de cette grille n'est critique : la
      couleur d'état n'a donc rien à y faire.
    */
    expect(EDITEUR).toContain("{l.actif ? 'Actif' : 'Retiré'}")
    expect(EDITEUR).not.toContain('badge-statut')
    expect(EDITEUR).not.toContain('BadgeStatutProduit')
  })

  it('replie les gestes de ligne dans un menu, habillé comme les autres', () => {
    expect(EDITEUR).toContain('MoreHorizontal')
    expect(EDITEUR).toContain('bg-raised shadow-menu w-56 rounded-[9px] px-1 py-1.5')
    expect(EDITEUR).toContain('FILET_FLOTTANT')
    expect(EDITEUR).toContain('aria-label={`Actions pour ${l.nom}`}')
  })

  it('n’offre la suppression que sur une ligne jamais publiée', () => {
    /*
      Un service publié figure dans des estimations passées : il se retire du
      catalogue, il ne s'efface pas. La règle n'est visible nulle part à
      l'écran — d'où ce test.
    */
    const menu = EDITEUR.slice(EDITEUR.indexOf('const MenuActions'), EDITEUR.indexOf('const etat'))
    expect(menu).toContain('Retirer du catalogue')
    expect(menu).toContain('Remettre au catalogue')
    expect(menu).toMatch(/\{!l\.id && \(/)
    expect(menu.indexOf('{!l.id && (')).toBeLessThan(menu.indexOf('Supprimer'))
  })

  it('distingue le filtre sans résultat de la grille jamais remplie', () => {
    /*
      `EtatVide` explique et propose ; `TableauVide` répond dans le cadre du
      tableau. Les intervertir fait disparaître la liste sous une recherche
      infructueuse, ou prive le premier usage de ce qu'il faut faire ensuite.
    */
    const bloc = EDITEUR.slice(
      EDITEUR.indexOf('{lignes.length === 0 ?'),
      EDITEUR.indexOf('<CadreTableau'),
    )
    expect(bloc.indexOf('<EtatVide')).toBeGreaterThan(-1)
    expect(bloc.indexOf('<EtatVide')).toBeLessThan(bloc.indexOf('<TableauVide>'))
    expect(bloc).toContain('visibles.length === 0')
  })
})
