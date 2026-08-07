/**
 * Matrice des permissions — SOURCE UNIQUE du système de rôles.
 *
 * Elle alimente les gardes, la fabrique d'actions, le menu de navigation et les
 * tests. Aucun rôle n'est codé en dur ailleurs : pas de `if (role === 'admin')`
 * dispersé dans les composants.
 *
 * Un rôle modifié ici se propage partout — et toute incohérence fait tomber
 * `tests/permissions.spec.ts`, qui est généré à partir de ce fichier.
 */

export const ROLES = ['admin', 'recrutement', 'heures'] as const
export type Role = (typeof ROLES)[number]

export const MODULES = ['crm', 'cv', 'heures', 'calculateur', 'admin'] as const
export type Module = (typeof MODULES)[number]

/** Les permissions sont nommées `module:action`. Le préfixe donne le module. */
export const PERMISSIONS = [
  'crm:lire',
  'crm:ecrire',
  'crm:supprimer',

  'cv:lire',
  'cv:televerser',
  'cv:telecharger',
  'cv:supprimer',
  // Créer, renommer, réordonner et supprimer les catégories. Distincte de
  // `cv:supprimer` : une permission doit nommer ce qu'elle autorise.
  'cv:categories',

  'heures:lire',
  'heures:saisir',
  'heures:cloturer',
  'heures:corriger',
  // Créer et modifier les fiches d'employés, taux horaire compris (HEU-1). La
  // gérante embauche et fait la paie : lui refuser cela l'obligerait à passer
  // par l'administrateur pour chaque arrivée.
  'heures:employes',
  // Seuil d'heures supplémentaires, majoration, durée de la période (HEU-7,
  // HEU-9). Réservé à l'administrateur : ces valeurs suivent la norme du
  // travail, pas une préférence d'usage.
  'heures:parametres',

  'calculateur:lire',
  'calculateur:ecrire',

  'admin:utilisateurs',
  'admin:tarifs',
  'admin:journal',
  // Raison sociale, adresse et téléphone portés par le document remis au client
  // (EST-10). Une permission distincte de 'admin:tarifs' : ce ne sont pas des
  // prix, et une permission doit nommer ce qu'elle autorise.
  'admin:organisation',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Le cahier des charges fixe trois périmètres disjoints.
 *
 * La suppression de CV est réservée à l'administrateur (exigence CV-8) : une
 * fausse manœuvre un vendredi soir ne doit pas faire disparaître un dossier.
 */
const MATRICE: Readonly<Record<Role, readonly Permission[]>> = {
  admin: PERMISSIONS,
  recrutement: ['cv:lire', 'cv:televerser', 'cv:telecharger'],
  heures: ['heures:lire', 'heures:saisir', 'heures:cloturer', 'heures:corriger', 'heures:employes'],
}

/**
 * Le rôle est stocké en base dans une colonne texte : une valeur inconnue est
 * possible — migration bâclée, écriture manuelle, ancien rôle supprimé du code.
 *
 * On échoue bruyamment plutôt que de retourner `false` : un refus silencieux
 * ferait passer un compte cassé pour un compte sans droits, et personne ne
 * chercherait la cause.
 */
export function permissionsDe(role: Role): readonly Permission[] {
  const p = MATRICE[role]
  if (!p) throw new Error(`Rôle inconnu : « ${String(role)} ».`)
  return p
}

export function aPermission(role: Role, permission: Permission): boolean {
  return permissionsDe(role).includes(permission)
}

/** Le module d'une permission, déduit de son préfixe. */
export function moduleDe(permission: Permission): Module {
  return permission.split(':')[0] as Module
}

/**
 * Modules accessibles à un rôle — dérivés de la matrice, jamais listés à part.
 * C'est ce qui garantit que le menu ne peut pas diverger des gardes.
 */
export function modulesDe(role: Role): readonly Module[] {
  const vus = new Set<Module>()
  for (const p of permissionsDe(role)) vus.add(moduleDe(p))
  return MODULES.filter((m) => vus.has(m))
}

export function aAccesModule(role: Role, module: Module): boolean {
  return modulesDe(role).includes(module)
}

/** Module d'atterrissage après connexion — le premier auquel le rôle a droit. */
export function moduleAccueil(role: Role): Module {
  const m = modulesDe(role)[0]
  if (!m) throw new Error(`Le rôle « ${role} » n'a accès à aucun module.`)
  return m
}

export function estRole(valeur: unknown): valeur is Role {
  return typeof valeur === 'string' && (ROLES as readonly string[]).includes(valeur)
}

/** Libellés d'interface — architecture.MD, section 19. */
export const LIBELLE_ROLE: Readonly<Record<Role, string>> = {
  admin: 'Administrateur',
  recrutement: 'Recrutement',
  heures: 'Gestion des heures',
}

export const LIBELLE_MODULE: Readonly<Record<Module, string>> = {
  crm: 'CRM',
  cv: 'Banque de CV',
  heures: 'Suivi des heures',
  calculateur: 'Calculateur',
  admin: 'Administration',
}
