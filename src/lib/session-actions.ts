'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { journaliser } from '@/lib/audit'
import { sessionCourante } from '@/lib/guards'

/**
 * Actions du plan d'authentification — DÉLIBÉRÉMENT hors de `lib/actions/`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi ce fichier n'est pas dans `lib/actions/`.
 *
 * `lib/actions/` contient les mutations soumises à permission, et le test de
 * garde exige que chacune passe par `createAction`. La déconnexion ne peut pas :
 * elle n'a pas de permission associée, et exiger une permission créerait un
 * compte incapable de partir.
 *
 * Plutôt que d'ajouter une exception au test — qui affaiblirait l'invariant pour
 * tout le monde —, ce fichier vit ailleurs et figure dans la liste blanche
 * explicite de `tests/actions-garde.spec.ts`.
 *
 * Toute nouvelle entrée dans cette liste doit être justifiée ici.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function seDeconnecter(): Promise<never> {
  const session = await sessionCourante()

  // Journalisé avant la révocation : après, il n'y a plus d'utilisateur à nommer.
  if (session) {
    await journaliser({
      userId: session.userId,
      utilisateurNom: session.nom,
      action: 'Déconnexion',
      module: 'admin',
    })
  }

  await auth.api.signOut({ headers: await headers() })

  /*
    ────────────────────────────────────────────────────────────────────────────
    Révoquer la session ne suffit PAS à fermer la porte.

    Le navigateur garde en mémoire les charges utiles des écrans déjà visités —
    trente secondes, réglées dans `next.config.ts`. Ces charges ont été rendues
    par un serveur qui avait la session : revenir sur l'accueil après la
    déconnexion les affichait telles quelles, sans jamais redemander au serveur.
    L'utilisateur se voyait toujours connecté, avec ses données à l'écran.

    `revalidatePath('/', 'layout')` porte sur l'arborescence entière : Next vide
    alors tout le cache du routeur client et re-rend depuis la racine. C'est le
    seul geste qui atteigne les écrans qu'on ne visite pas en sortant.

    Il vient AVANT `redirect`, qui interrompt la fonction en levant.
    ────────────────────────────────────────────────────────────────────────────
  */
  revalidatePath('/', 'layout')

  redirect('/')
}
