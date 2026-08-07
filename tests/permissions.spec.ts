import { describe, expect, it } from 'vitest'
import {
  MODULES,
  PERMISSIONS,
  ROLES,
  type Module,
  type Permission,
  type Role,
  aAccesModule,
  aPermission,
  moduleAccueil,
  modulesDe,
} from '@/lib/permissions'

/**
 * Matrice de permissions — le test à plus haute valeur du projet.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le cœur de cette application est le contrôle d'accès. Vérifier qu'un
 * formulaire s'affiche n'a aucun intérêt à côté de vérifier que la recruteuse
 * ne peut pas atteindre les heures.
 *
 * ATTENTION — le tableau ci-dessous n'est PAS une copie de `lib/permissions.ts`.
 * Il énonce ce que le CAHIER DES CHARGES exige, écrit à la main, indépendamment
 * de l'implémentation. C'est ce qui lui donne sa valeur : si quelqu'un élargit
 * un rôle dans `permissions.ts`, ce test tombe et force une décision consciente
 * plutôt qu'un glissement silencieux.
 *
 * Le mettre à jour doit être un geste délibéré, jamais un réflexe pour faire
 * passer le vert.
 * ─────────────────────────────────────────────────────────────────────────
 */
const ATTENDU: Readonly<Record<Role, readonly Permission[]>> = {
  // Section 2 : « accès complet à l'ensemble des modules ».
  admin: [
    'crm:lire',
    'crm:ecrire',
    'crm:supprimer',
    'cv:lire',
    'cv:televerser',
    'cv:telecharger',
    'cv:supprimer',
    'cv:categories',
    'heures:lire',
    'heures:saisir',
    'heures:cloturer',
    'heures:corriger',
    'heures:employes',
    // HEU-7 et HEU-9 : seuil, majoration et durée de période suivent la norme
    // du travail. L'administrateur seul les touche.
    'heures:parametres',
    'calculateur:lire',
    'calculateur:ecrire',
    'admin:utilisateurs',
    'admin:tarifs',
    'admin:journal',
    // EST-10 — les coordonnées imprimées sur le document client.
    'admin:organisation',
  ],

  // « accès à la banque de CV uniquement ». CV-8 : la suppression est réservée
  // à l'administrateur.
  recrutement: ['cv:lire', 'cv:televerser', 'cv:telecharger'],

  // « accès au suivi des heures uniquement ». HEU-1 : la fiche d'employé, taux
  // horaire compris, relève de la paie — donc de ce rôle. Les PARAMÈTRES de
  // paie, eux, non : ils suivent la norme, pas l'usage.
  heures: ['heures:lire', 'heures:saisir', 'heures:cloturer', 'heures:corriger', 'heures:employes'],
}

describe('Matrice de permissions — rôle × permission', () => {
  /**
   * Trois rôles multipliés par quinze permissions donnent quarante-cinq
   * assertions, générées plutôt qu'écrites une à une.
   */
  for (const role of ROLES) {
    describe(role, () => {
      for (const permission of PERMISSIONS) {
        const autorise = ATTENDU[role].includes(permission)
        it(`${autorise ? 'peut' : 'ne peut PAS'} ${permission}`, () => {
          expect(aPermission(role, permission)).toBe(autorise)
        })
      }
    })
  }
})

describe('Cloisonnement des rôles', () => {
  it('le rôle recrutement n’atteint QUE la banque de CV', () => {
    expect(modulesDe('recrutement')).toEqual(['cv'])
  })

  it('le rôle heures n’atteint QUE le suivi des heures', () => {
    expect(modulesDe('heures')).toEqual(['heures'])
  })

  it('l’administrateur atteint tous les modules', () => {
    expect(modulesDe('admin')).toEqual([...MODULES])
  })

  it('aucun rôle non-admin n’atteint l’administration', () => {
    for (const role of ROLES.filter((r) => r !== 'admin')) {
      expect(aAccesModule(role, 'admin'), `${role} ne doit pas atteindre admin`).toBe(false)
    }
  })

  it('seul l’administrateur peut supprimer un CV', () => {
    // Exigence CV-8 : une fausse manœuvre un vendredi soir ne doit pas faire
    // disparaître un dossier.
    for (const role of ROLES) {
      expect(aPermission(role, 'cv:supprimer')).toBe(role === 'admin')
    }
  })

  it('seul l’administrateur gère les catégories de CV', () => {
    // CV-2 : « la liste est modifiable par l'administrateur ». La recruteuse
    // classe des fichiers, elle ne redéfinit pas la structure de classement.
    for (const role of ROLES) {
      expect(aPermission(role, 'cv:categories')).toBe(role === 'admin')
    }
  })

  it('seul l’administrateur touche aux grilles de tarifs', () => {
    for (const role of ROLES) {
      expect(aPermission(role, 'admin:tarifs')).toBe(role === 'admin')
    }
  })
})

describe('Cohérence interne de la matrice', () => {
  it('les modules d’un rôle découlent de ses permissions, sans écart', () => {
    for (const role of ROLES) {
      const deduits = new Set<Module>(ATTENDU[role].map((p) => p.split(':')[0] as Module))
      expect(new Set(modulesDe(role))).toEqual(deduits)
    }
  })

  it('chaque module est atteignable par au moins un rôle', () => {
    // `module` est un identifiant réservé dans le contexte de compilation Next.
    for (const mod of MODULES) {
      const porteurs = ROLES.filter((r) => aAccesModule(r, mod))
      expect(porteurs.length, `Aucun rôle n'atteint ${mod}`).toBeGreaterThan(0)
    }
  })

  it('chaque permission appartient à un module connu', () => {
    for (const permission of PERMISSIONS) {
      expect(MODULES).toContain(permission.split(':')[0])
    }
  })

  it('chaque rôle a un module d’accueil valide', () => {
    for (const role of ROLES) {
      const accueil = moduleAccueil(role)
      expect(aAccesModule(role, accueil), `${role} → ${accueil}`).toBe(true)
    }
  })

  it('un rôle inconnu n’obtient aucune permission', () => {
    // La garde de type empêche ce cas à la compilation ; on vérifie qu'il ne
    // dégénère pas non plus à l'exécution, par exemple depuis une valeur en base.
    const inconnu = 'super-admin' as Role
    expect(() => aPermission(inconnu, 'crm:lire')).toThrow()
  })
})
