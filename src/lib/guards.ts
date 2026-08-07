import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { journaliserRefus } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { ErreurAcces } from '@/lib/erreurs'
import { type EntrepriseSlug, estEntreprise } from '@/config/entreprises'
import {
  type Module,
  type Permission,
  type Role,
  aAccesModule,
  aPermission,
  estRole,
  moduleDe,
} from '@/lib/permissions'

/**
 * Gardes d'accès — à appeler en PREMIÈRE ligne, jamais après un traitement.
 *
 * Rappel de l'invariant : un Server Action ne traverse pas les layouts. Il est
 * exposé comme un point d'entrée HTTP autonome, appelable par quiconque connaît
 * son identifiant. Un layout qui vérifie le rôle ne protège que l'affichage.
 *
 * C'est pourquoi les mutations passent par `lib/safe-action.ts`, qui appelle ces
 * gardes pour vous — plutôt que de compter sur la mémoire du développeur.
 */

export type SessionApp = {
  userId: string
  nom: string
  courriel: string
  role: Role
}

/**
 * `ErreurAcces` vit dans `lib/erreurs.ts`, sans `server-only` : l'écran d'erreur
 * est un composant client et doit pouvoir la reconnaître sans tirer Prisma dans
 * le paquet du navigateur.
 */
export { ErreurAcces, estErreurAcces } from '@/lib/erreurs'

/**
 * Session courante, ou `null`. Ne redirige pas — à utiliser pour l'affichage
 * conditionnel.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Mémorisée POUR LA DURÉE D'UNE REQUÊTE.
 *
 * Un layout la lit, la page qu'il contient la relit, et chaque garde la relit
 * encore : sur un écran du CRM, cela faisait quatre lectures de session pour
 * une seule navigation, chacune allant jusqu'à la base.
 *
 * `cache` de React dédoublonne à l'intérieur d'une requête et rien au-delà :
 * deux visiteurs ne partagent jamais le résultat, et une session révoquée n'est
 * pas retenue d'une requête à l'autre. C'est ce qui rend le partage sûr ici,
 * là où un cache de module ne le serait pas.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const sessionCourante = cache(async function sessionCourante(): Promise<SessionApp | null> {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s?.user) return null

  const role = (s.user as { role?: unknown }).role
  if (!estRole(role)) {
    // Un compte sans rôle valide n'est pas une session utilisable : on préfère
    // le traiter comme absent plutôt que de deviner un rôle par défaut.
    return null
  }

  return {
    userId: s.user.id,
    nom: s.user.name,
    courriel: s.user.email,
    role,
  }
})

/** Exige une session. Renvoie vers l'écran de connexion — qui EST la racine. */
export async function requireSession(): Promise<SessionApp> {
  const s = await sessionCourante()
  if (!s) redirect('/')
  return s
}

/** Exige une permission précise. */
export async function requirePermission(permission: Permission): Promise<SessionApp> {
  const s = await requireSession()
  if (!aPermission(s.role, permission)) {
    throw new ErreurAcces(undefined, permission)
  }
  return s
}

/**
 * Exige l'accès à un module — pour les layouts et pages de module.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `notFound()` et non une erreur, pour DEUX raisons.
 *
 * La première tient à Next. En production, une erreur levée pendant le rendu
 * serveur est assainie : le message et les propriétés personnalisées ne
 * franchissent pas la frontière, seul un `digest` subsiste. `estErreurAcces`
 * cherche alors un `code` qui n'existe plus, et le filet affiche « Une erreur
 * est survenue. Réessayez. » Un refus d'accès se présentait donc comme une
 * panne — en production seulement, l'erreur passant intacte en développement.
 * Le défaut était invisible là où l'on travaille et présent là où ça compte ;
 * c'est un parcours de bout en bout qui l'a trouvé.
 *
 * La seconde tient au cahier des charges. GEN-3 : « un module inaccessible
 * n'apparaît nulle part dans l'interface — jamais grisé, jamais mentionné ». Du
 * point de vue de la recruteuse, le suivi des heures n'existe pas. C'est déjà le
 * choix retenu pour la corbeille des CV et pour la fiche d'un client d'une autre
 * entreprise : un message distinct confirmerait ce qui se trouve derrière.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function requireModule(module: Module): Promise<SessionApp> {
  const s = await requireSession()
  if (!aAccesModule(s.role, module)) {
    // Journalisé AVANT `notFound()`, qui lève : rien après ne s'exécuterait.
    await journaliserRefus({ userId: s.userId, utilisateurNom: s.nom, module })
    notFound()
  }
  return s
}

/**
 * Exige une permission précise, DEPUIS UN ÉCRAN.
 *
 * Jumelle de `requirePermission`, qui reste réservée à la fabrique d'actions :
 * celle-ci lève `ErreurAcces` parce qu'elle doit la convertir en réponse
 * `{ ok: false }`, et son erreur ne traverse jamais le rendu. Deux chemins, deux
 * façons de refuser — les confondre casserait l'un ou l'autre.
 */
export async function requirePermissionEcran(permission: Permission): Promise<SessionApp> {
  const s = await requireSession()
  if (!aPermission(s.role, permission)) {
    await journaliserRefus({
      userId: s.userId,
      utilisateurNom: s.nom,
      module: moduleDe(permission),
      entite: permission,
    })
    notFound()
  }
  return s
}

/**
 * Valide un slug d'entreprise venu de l'URL.
 *
 * Le slug est saisi par l'utilisateur : il n'a aucune valeur de preuve. Cette
 * fonction est le seul point d'entrée autorisé pour le convertir en valeur
 * utilisable côté données.
 */
export async function requireEntreprise(slug: string): Promise<EntrepriseSlug> {
  // `notFound()` plutôt qu'une erreur : un slug inconnu N'EST pas une page, et
  // une erreur levée au rendu perd son message en production — voir la note de
  // `requireModule`.
  if (!estEntreprise(slug)) {
    await journaliserRefusEntreprise(slug)
    notFound()
  }
  return slug
}

/**
 * Le slug refusé est le seul de ces refus qui n'ait pas de module : cette garde
 * reçoit une chaîne d'URL et rien d'autre. `admin` sert de rangement, comme pour
 * la connexion et la déconnexion — les événements qui ne relèvent d'aucun module.
 *
 * La session est relue ici parce que l'appelant ne la transmet pas ; le coût
 * n'existe que sur le chemin déjà refusé.
 */
async function journaliserRefusEntreprise(slug: string): Promise<void> {
  const s = await sessionCourante()
  if (!s) return

  await journaliserRefus({
    userId: s.userId,
    utilisateurNom: s.nom,
    module: 'admin',
    // Le slug vient de l'URL : tronqué, sinon une entrée de journal peut peser
    // ce que l'appelant décide.
    entite: slug.slice(0, 80),
  })
}

/** Utilitaire : le module concerné par une permission, pour le journal d'audit. */
export function moduleDePermission(permission: Permission): Module {
  return moduleDe(permission)
}
