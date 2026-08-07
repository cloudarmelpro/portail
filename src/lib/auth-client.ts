'use client'

import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Client Better Auth, côté navigateur.
 *
 * Il ne fait qu'appeler `/api/auth/*` : aucune décision d'autorisation ne se
 * prend ici. Les rôles sont vérifiés côté serveur, par `lib/guards.ts` et la
 * fabrique d'actions.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
})

export const { signIn, signOut, useSession, requestPasswordReset, resetPassword } = authClient
