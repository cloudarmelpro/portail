import { LIBELLE_MODULE, type Module, type Role, modulesDe } from '@/lib/permissions'

/**
 * Entrées de navigation — **dérivées** de `lib/permissions.ts`, jamais listées à
 * part.
 *
 * C'est ce qui garantit que le menu ne peut pas diverger des gardes : un module
 * retiré de la matrice disparaît du menu sans qu'on y pense.
 *
 * On ne montre JAMAIS une entrée grisée. Un module inaccessible n'existe pas
 * pour cet utilisateur — l'afficher barré révélerait ce qui se trouve derrière.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce type ne contient QUE des données sérialisables.
 *
 * Il est produit dans un composant serveur et transmis au shell, qui est un
 * composant client. Un composant React — une icône Lucide, par exemple — ne
 * franchit pas cette frontière. L'icône se résout côté client à partir du
 * champ `module`, dans `components/layout/icones.ts`.
 * ─────────────────────────────────────────────────────────────────────────
 */
export type EntreeNav = {
  module: Module
  libelle: string
  /** Une phrase, pour l'écran d'accueil. Le menu, lui, n'affiche que le libellé. */
  description: string
  href: string
}

/**
 * Ce que fait chaque module, en une phrase.
 *
 * Elles ne servent qu'à l'écran d'accueil, où l'on arrive au premier jour sans
 * savoir ce que « Calculateur » recouvre. Le menu latéral, lui, s'adresse à
 * quelqu'un qui le sait déjà : il n'affiche que le libellé.
 *
 * Posées ICI et non dans `lib/permissions.ts` : celui-ci décide de l'accès, pas
 * de ce qu'on en dit. Ajoutées à la section 19 d'architecture.MD en même temps
 * que ce fichier.
 */
const DESCRIPTIONS: Readonly<Record<Module, string>> = {
  crm: 'Clients, relances et soumissions, un dossier par entreprise.',
  cv: 'Dépôt, classement et recherche des curriculum vitæ.',
  heures: 'Saisie de la semaine, périodes de paie et exports.',
  calculateur: 'Estimations composées pendant l’appel, au tarif en vigueur.',
  admin: 'Comptes, grilles de tarifs, journal d’audit et coordonnées.',
}

const CHEMINS: Readonly<Record<Module, string>> = {
  crm: '/crm',
  cv: '/cv',
  heures: '/heures',
  calculateur: '/calculateur',
  admin: '/admin/utilisateurs',
}

export function navigationDe(role: Role): EntreeNav[] {
  return modulesDe(role).map((module) => ({
    module,
    libelle: LIBELLE_MODULE[module],
    description: DESCRIPTIONS[module],
    href: CHEMINS[module],
  }))
}
