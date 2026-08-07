import { expect, type Page } from '@playwright/test'

/**
 * Utilitaires partagés des parcours.
 *
 * Les comptes viennent de `scripts/amorcer-tests.mjs`. Le mot de passe est en
 * clair ici et c'est sans conséquence : il n'ouvre qu'une base de test.
 */

export const MOT_DE_PASSE = 'Portail-Test-2026'

export const COMPTES = {
  admin: 'admin@test.portail',
  recrutement: 'recrutement@test.portail',
  heures: 'heures@test.portail',
} as const

/**
 * Où sont déposés les cookies de session, un fichier par rôle.
 *
 * Ignorés par git : ils contiennent un jeton de session valide, et rien
 * n'oblige la base de test à rester sans importance.
 */
export const ETATS = {
  admin: 'tests/e2e/.auth/admin.json',
  recrutement: 'tests/e2e/.auth/recrutement.json',
  heures: 'tests/e2e/.auth/heures.json',
} as const

export async function seConnecter(page: Page, courriel: string): Promise<void> {
  await page.goto('/')

  // Libellés EXACTS : le bouton qui révèle le mot de passe porte un `aria-label`
  // contenant « mot de passe », et une correspondance approximative viserait les
  // deux éléments à la fois.
  await page.getByLabel('Courriel', { exact: true }).fill(courriel)
  await page.getByLabel('Mot de passe', { exact: true }).fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // La connexion mène à `/accueil`. Quitter la racine suffit à savoir qu'elle a
  // abouti — l'écran d'arrivée est vérifié ailleurs, pas dans une aide partagée.
  await expect(page).not.toHaveURL(/\/$/, { timeout: 15_000 })
}
