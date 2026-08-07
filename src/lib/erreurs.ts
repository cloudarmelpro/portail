import type { Module, Permission } from '@/lib/permissions'

/**
 * Types d'erreur partagés entre serveur et navigateur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce fichier n'est volontairement PAS `server-only`.
 *
 * `app/(app)/error.tsx` est un composant client : il doit reconnaître un refus
 * d'accès pour afficher le bon écran. S'il importait `lib/guards.ts`, marqué
 * `server-only`, il tirerait Prisma, Better Auth et la validation de
 * l'environnement dans le paquet du navigateur.
 *
 * D'où la séparation : le TYPE d'erreur vit ici, les GARDES qui le lèvent
 * restent côté serveur.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Levée quand la session est valide mais les droits insuffisants. */
export class ErreurAcces extends Error {
  readonly code = 'ACCES_REFUSE' as const

  constructor(
    message = 'Vous n’avez pas accès à cette page.',
    readonly requis?: Permission | Module,
  ) {
    super(message)
    this.name = 'ErreurAcces'
  }
}

/**
 * Refus métier — la règle du domaine dit non, et l'utilisateur doit savoir
 * pourquoi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi une classe distincte plutôt qu'un `Error` ordinaire.
 *
 * La fabrique d'actions remplace le message de toute erreur inattendue par
 * « Une erreur est survenue. Réessayez. » — c'est volontaire : le message d'une
 * panne technique peut contenir un nom de table, une contrainte, un identifiant.
 *
 * Mais un conflit de version n'est pas une panne. Le message « Rechargez la page
 * avant de recommencer » est la seule chose qui empêche l'utilisateur de
 * réessayer à l'identique et d'échouer à nouveau. Avalé, le contrôle de
 * concurrence protège la donnée et abandonne la personne devant l'écran.
 *
 * Lever reste juste : c'est ce qui empêche le journal d'inscrire une
 * modification qui n'a pas eu lieu. Seul le message avait besoin d'un passage.
 * ─────────────────────────────────────────────────────────────────────────
 */
export class ErreurMetier extends Error {
  readonly code = 'REFUS_METIER' as const

  constructor(
    message: string,
    /** Champ de formulaire visé, quand le refus porte sur une valeur précise. */
    readonly champ?: string,
  ) {
    super(message)
    this.name = 'ErreurMetier'
  }
}

/**
 * Reconnaissance par le `code` plutôt que par `instanceof` : Next sérialise les
 * erreurs entre serveur et client, ce qui fait perdre la chaîne de prototypes.
 */
export function estErreurMetier(e: unknown): e is ErreurMetier {
  if (e instanceof ErreurMetier) return true
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === 'REFUS_METIER'
  )
}

export function estErreurAcces(e: unknown): e is ErreurAcces {
  if (e instanceof ErreurAcces) return true
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === 'ACCES_REFUSE'
  )
}
