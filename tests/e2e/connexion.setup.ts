import { test as setup } from '@playwright/test'
import { COMPTES, ETATS, seConnecter } from './aide'

/**
 * Une connexion par rôle, réutilisée par tous les parcours.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce n'est pas qu'une optimisation : sans cela, la suite se bloque elle-même.
 *
 * `lib/auth.ts` limite `/sign-in/email` à cinq tentatives par tranche de cinq
 * minutes — c'est TR-2, et c'est voulu. Huit parcours qui se connectent chacun
 * de leur côté franchissent ce plafond dès le sixième, et la suite échoue sur
 * un « courriel ou mot de passe incorrect » qui n'a rien à voir avec ce qu'elle
 * teste.
 *
 * Trois connexions au total, une par rôle. Le cookie de session est enregistré
 * puis rejoué : les parcours n'ont plus à s'authentifier, et ils démarrent sur
 * l'écran voulu au lieu de repasser par le formulaire.
 * ─────────────────────────────────────────────────────────────────────────
 */

for (const [role, courriel] of Object.entries(COMPTES) as [keyof typeof COMPTES, string][]) {
  setup(`authentifier ${role}`, async ({ page }) => {
    await seConnecter(page, courriel)
    await page.context().storageState({ path: ETATS[role] })
  })
}
