import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Fiches supprimées — gabarit posé sur l'administration, CRM-7.
 *
 * Les sources sont LUES plutôt qu'exécutées : la page importe la couche de
 * données, marquée `server-only`, et le tableau tire la fabrique d'actions.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/crm/[entreprise]/corbeille/page.tsx')
const TABLEAU = lire('src/components/crm/tableau-corbeille.tsx')

const COLONNES = ['Nom', 'Type', 'Statut', 'Supprimée le', 'Historique']

describe('L’en-tête de l’écran', () => {
  it('le titre reste au document, sans s’afficher', () => {
    expect(PAGE).toContain('<h1 className="sr-only">Fiches supprimées</h1>')
    expect(PAGE).not.toContain('text-[30px]')
  })

  it('la mention de conservation reste au-dessus du tableau', () => {
    // Sans elle, « supprimée » se lit comme « perdue », et personne n'ose la
    // restauration de peur d'en réveiller une autre.
    expect(PAGE).toContain('Restaurer la remet exactement où elle était.')
    expect(PAGE.indexOf('Restaurer la remet')).toBeLessThan(PAGE.indexOf('<TableauCorbeilleCrm'))
  })
})

describe('L’écran n’existe que pour qui peut supprimer', () => {
  it('la permission est revérifiée dans la page, pas seulement dans l’onglet', () => {
    // Masquer l'onglet ne suffirait pas : l'écran resterait atteignable en
    // tapant l'adresse.
    expect(PAGE).toContain("aPermission(session.role, 'crm:supprimer')")
    expect(PAGE).toContain('notFound()')
  })

  it('le slug d’entreprise est validé avant toute lecture', () => {
    expect(PAGE.indexOf('requireEntreprise(')).toBeLessThan(PAGE.indexOf('prismaCadre('))
  })
})

describe('Le tableau des fiches supprimées', () => {
  it('porte ses colonnes, plus les actions à droite', () => {
    for (const colonne of COLONNES) expect(TABLEAU).toContain(`libelle="${colonne}"`)
    expect(TABLEAU).toContain('<ColonneTableau libelle="Actions" aDroite />')
  })

  it('une seule taille et une seule encre pour toutes les cellules', () => {
    expect(TABLEAU).toContain("const CELLULE = 'text-[13px]'")

    const corps = TABLEAU.slice(
      TABLEAU.indexOf('<CorpsTableau>'),
      TABLEAU.indexOf('</CorpsTableau>'),
    )
    const cellules = corps.match(/<CelluleTableau[^>]*>/g) ?? []
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

  it('replie le geste de ligne dans un menu, habillé comme les autres', () => {
    expect(TABLEAU).toContain('MoreHorizontal')
    expect(TABLEAU).toContain('bg-raised shadow-menu w-56 rounded-[9px] px-1 py-1.5')
    expect(TABLEAU).toContain('FILET_FLOTTANT')
    expect(TABLEAU).toContain('aria-label={`Actions pour ${l.nom}`}')
    expect(TABLEAU).toContain('Restaurer')
  })

  it('dit ce que la restauration ramène', () => {
    // Sans ce compte, on ne sait pas si l'on récupère une fiche vide ou deux ans
    // de suivi.
    expect(TABLEAU).toContain('interaction${l.interactions > 1')
    expect(TABLEAU).toContain('estimation${l.estimations > 1')
  })
})

/**
 * CRM-7 — « les enregistrements ne sont jamais supprimés définitivement ».
 *
 * C'est l'exigence entière du module, et cet écran en est la seule preuve
 * visible. Un bouton « vider la corbeille » la contredirait sans qu'aucun autre
 * test ne tombe.
 */
describe('Rien ne s’efface définitivement', () => {
  it('la seule action offerte est le retour en arrière', () => {
    expect(TABLEAU).toContain('restaurerClient')
    expect(TABLEAU).not.toContain('supprimerDefinitivement')
    expect(TABLEAU).not.toContain('Vider la corbeille')
    expect(TABLEAU).not.toContain('Supprimer définitivement')
  })

  it('l’état vide promet la restauration plutôt qu’un délai', () => {
    expect(PAGE).toContain('titre="Aucune fiche supprimée"')
    expect(PAGE).toContain('prêtes à être restaurées')
  })
})
