import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SECTIONS_ADMIN, filAriane } from '@/config/fil-ariane'
import { LIBELLE_MODULE } from '@/lib/permissions'

/**
 * Fil d'Ariane de l'en-tête — section 19.
 *
 * Il se déduit de l'adresse, donc il se teste sans navigateur : c'est tout
 * l'intérêt d'avoir mis le raisonnement dans une fonction pure plutôt que dans
 * le composant qui l'affiche.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('Chaque écran se situe', () => {
  const CAS: [string, string | null, string][] = [
    ['/crm', null, 'CRM'],
    ['/crm/paysagement', 'CRM', 'Relances'],
    ['/crm/paysagement/clients', 'CRM', 'Clients'],
    ['/crm/paysagement/corbeille', 'CRM', 'Fiches supprimées'],
    ['/cv', null, 'Banque de CV'],
    ['/cv/tous', 'Banque de CV', 'Tous les CV'],
    ['/cv/non-classes', 'Banque de CV', 'Non classé'],
    ['/cv/echeance', 'Banque de CV', 'Plus de 24 mois'],
    ['/cv/corbeille', 'Banque de CV', 'Corbeille'],
    ['/heures', null, 'Suivi des heures'],
    ['/heures/employes', 'Suivi des heures', 'Employés'],
    ['/calculateur', null, 'Calculateur'],
    ['/calculateur/paysagement', 'Calculateur', 'Nouvelle estimation'],
    ['/calculateur/paysagement/estimations', 'Calculateur', 'Estimations'],
    ['/admin/utilisateurs', 'Administration', 'Utilisateurs'],
    ['/admin/tarifs', 'Administration', 'Grilles de tarifs'],
    ['/admin/journal', 'Administration', 'Journal d’audit'],
    ['/admin/paie', 'Administration', 'Paramètres de paie'],
    ['/admin/organisation', 'Administration', 'Organisation'],
  ]

  it.each(CAS)('%s → %s / %s', (chemin, parent, courant) => {
    expect(filAriane(chemin)).toEqual({ parent, courant })
  })
})

describe('Les écrans de fiche nomment la section', () => {
  /*
    Le nom du client ou de l'employé ne se lit pas dans l'adresse — seul
    l'identifiant y figure. Chacune de ces pages le porte déjà en titre de 30 px :
    le fil d'Ariane dit « où suis-je », le titre dit « qui est-ce ».
  */
  it('une fiche client reste sous Clients', () => {
    expect(filAriane('/crm/paysagement/clients/abc123')).toEqual({
      parent: 'CRM',
      courant: 'Clients',
    })
  })

  it('une fiche employé reste sous Employés', () => {
    expect(filAriane('/heures/employes/abc123')).toEqual({
      parent: 'Suivi des heures',
      courant: 'Employés',
    })
  })

  it('une estimation reste sous Estimations', () => {
    expect(filAriane('/calculateur/paysagement/estimations/abc123')).toEqual({
      parent: 'Calculateur',
      courant: 'Estimations',
    })
  })

  it('aucun identifiant ne fuite dans le fil', () => {
    // Afficher « cmg7x2k90000 » serait pire que de nommer la section.
    for (const chemin of [
      '/crm/paysagement/clients/cmg7x2k9000',
      '/heures/employes/cmg7x2k9000',
      '/calculateur/staff/estimations/cmg7x2k9000',
    ]) {
      const { parent, courant } = filAriane(chemin)
      expect(`${parent} ${courant}`).not.toMatch(/cmg7/)
    }
  })
})

describe('Rien ne casse sur une adresse inattendue', () => {
  it('la racine et l’inconnu se replient sur le nom du produit', () => {
    for (const chemin of ['/', '', '/inconnu', '/accueil']) {
      expect(filAriane(chemin)).toEqual({ parent: null, courant: 'Portail' })
    }
  })

  it('une catégorie de CV inconnue ne montre pas son identifiant', () => {
    // Les catégories créées par l'administrateur ont un identifiant opaque : le
    // dossier se nomme dans la page, pas dans l'adresse.
    expect(filAriane('/cv/cmg7x2k9000')).toEqual({
      parent: 'Banque de CV',
      courant: 'Catégorie',
    })
  })

  it('une section d’administration inconnue nomme le module', () => {
    expect(filAriane('/admin/inexistant')).toEqual({
      parent: 'Administration',
      courant: 'Administration',
    })
  })
})

describe('Une seule source pour les libellés', () => {
  it('les noms de module viennent de la matrice de permissions', () => {
    // Renommer un module dans `lib/permissions.ts` doit suffire.
    expect(filAriane('/cv').courant).toBe(LIBELLE_MODULE.cv)
    expect(filAriane('/heures').courant).toBe(LIBELLE_MODULE.heures)
    expect(filAriane('/admin/utilisateurs').parent).toBe(LIBELLE_MODULE.admin)
  })

  it('les sections d’administration ne sont écrites qu’une fois', () => {
    /*
      Les onglets et le fil d'Ariane lisent la même table. Écrites deux fois,
      elles auraient fini par se contredire — l'onglet disant « Journal d'audit »
      et la barre du haut « Journal ».
    */
    const ENTETE = lire('src/components/admin/en-tete-admin.tsx')
    expect(ENTETE).toContain("import { SECTIONS_ADMIN } from '@/config/fil-ariane'")
    expect(ENTETE).not.toMatch(/const SECTIONS[^_]/)

    for (const s of SECTIONS_ADMIN) {
      expect(filAriane(s.href).courant).toBe(s.libelle)
    }
  })
})

describe('Le composant ne décide de rien', () => {
  it('il lit l’adresse et place, le raisonnement est ailleurs', () => {
    const COMPOSANT = lire('src/components/layout/fil-ariane.tsx')
    expect(COMPOSANT).toContain('usePathname()')
    expect(COMPOSANT).toContain("from '@/config/fil-ariane'")
    // Aucun libellé en dur : ils viendraient forcément à diverger de la config.
    expect(COMPOSANT).not.toMatch(/'(CRM|Clients|Administration|Employés)'/)
  })

  it('la barre oblique n’est pas annoncée aux lecteurs d’écran', () => {
    // « CRM barre oblique Clients » n'aide personne.
    const COMPOSANT = lire('src/components/layout/fil-ariane.tsx')
    expect(COMPOSANT).toMatch(/aria-hidden[\s\S]*?>[\s\S]*?\/[\s\S]*?</)
  })
})
