import { expect, test } from '@playwright/test'
import { COMPTES, ETATS } from './aide'

/**
 * Le parcours qui ne peut pas être remplacé par de l'analyse statique.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Plus de 700 tests unitaires vérifient les maillons un par un : la matrice de
 * permissions, la permission exigée par chaque action, la garde de chaque
 * layout, la garde de chaque route. Aucun ne vérifie la CHAÎNE.
 *
 * Or c'est la chaîne qui protège : proxy, puis layout de `(app)`, puis layout de
 * module, puis garde de page. Un maillon juste dans un test et mal branché en
 * vrai passerait inaperçu — et le symptôme serait qu'une recruteuse atteint le
 * suivi des heures en tapant l'adresse.
 *
 * C'est ce parcours qui a trouvé que, EN PRODUCTION SEULEMENT, un refus d'accès
 * s'affichait comme une panne générique : Next assainit les erreurs levées
 * pendant le rendu, et le code que `estErreurAcces` cherchait ne survivait pas.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Exige une base de test amorcée — voir `playwright.config.ts`.
 */

/** Modules autorisés par rôle — recopiés du cahier des charges, section 2. */
const AUTORISES: Record<keyof typeof COMPTES, string[]> = {
  admin: ['/crm', '/cv', '/heures', '/calculateur', '/admin/utilisateurs'],
  recrutement: ['/cv'],
  heures: ['/heures'],
}

const TOUS = ['/crm', '/cv', '/heures', '/calculateur', '/admin/utilisateurs']

for (const role of Object.keys(COMPTES) as (keyof typeof COMPTES)[]) {
  test.describe(`Rôle « ${role} »`, () => {
    test.use({ storageState: ETATS[role] })

    test('n’atteint que ses modules par saisie directe de l’adresse', async ({ page }) => {
      for (const chemin of TOUS) {
        await page.goto(chemin)
        const permis = AUTORISES[role].some((a) => chemin.startsWith(a))

        if (permis) {
          await expect(page, `${role} devrait atteindre ${chemin}`).toHaveURL(
            new RegExp(chemin.replace(/\//g, '\\/')),
          )
          continue
        }

        /*
          Refus attendu.

          `toContainText` et non `innerText()` : la première réessaie jusqu'au
          délai imparti, la seconde lit une fois. Le contenu arrive par flux
          après le chargement du document — la lecture unique tombait sur un
          `<main>` encore vide et faisait échouer le test pour une course, pas
          pour un défaut.

          On accepte les deux formulations de refus : les modules répondent
          « cette page n'existe pas » (GEN-3 — un module inaccessible n'existe
          pas pour ce rôle), mais figer cette seule forme rendrait le test
          fragile si un écran choisissait un jour de refuser explicitement.
        */
        await expect(page.locator('main'), `${role} ne doit pas atteindre ${chemin}`).toContainText(
          /n’existe pas|n'existe pas|accès refusé/i,
          { timeout: 10_000 },
        )
      }
    })
  })
}

test.describe('Sans session', () => {
  // Contexte vierge : ce parcours doit précisément ne PAS être authentifié.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('tout renvoie à l’écran de connexion', async ({ page }) => {
    for (const chemin of TOUS) {
      await page.goto(chemin)
      await expect(page, `${chemin} devrait renvoyer à la connexion`).toHaveURL(/\/$/)
    }
  })
})
