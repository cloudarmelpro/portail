import { expect, test } from '@playwright/test'
import { ETATS } from './aide'

/**
 * L'invariant n°2, éprouvé contre une VRAIE base.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `tests/cloisonnement-extension.spec.ts` fait tourner l'extension Prisma contre
 * un faux moteur : il prouve que la condition d'entreprise est bien ajoutée aux
 * arguments transmis. C'est déjà beaucoup, et cela ne prouve pas que PostgreSQL
 * en fasse quelque chose.
 *
 * Entre les deux subsistent des façons d'échouer qu'aucun test statique ne voit :
 * une transaction interactive dont le client perdrait l'extension, une jointure
 * qui ramènerait une ligne voisine, une page qui contournerait `lib/data/`.
 *
 * Le mode de panne est SILENCIEUX — c'est ce qui le rend redoutable. Charger un
 * client par son seul identifiant aboutit : l'identifiant est unique, la requête
 * réussit, et un dossier de Paysagement s'affiche sous Développement web. Rien
 * ne lève, rien n'alerte.
 *
 * Ce parcours prend un identifiant RÉEL dans un dossier et le présente sous un
 * autre. C'est la seule vérification qui ferme la question.
 * ─────────────────────────────────────────────────────────────────────────
 */

test.describe('Cloisonnement par entreprise', () => {
  // Le CRM et le calculateur sont réservés à l'administrateur (CRM-1).
  test.use({ storageState: ETATS.admin })

  test('un identifiant de client ne traverse pas les dossiers', async ({ page }) => {
    // 1. Un client réel de Paysagement, atteint par l'interface.
    await page.goto('/crm/paysagement/clients')
    const premier = page.locator('a[href^="/crm/paysagement/clients/"]').first()
    await expect(
      premier,
      'La base de test doit contenir au moins un client Paysagement',
    ).toBeVisible({ timeout: 10_000 })

    await premier.click()
    await expect(page).toHaveURL(/\/crm\/paysagement\/clients\/[^/]+$/, { timeout: 10_000 })

    const identifiant = page.url().split('/').pop()
    expect(identifiant, 'Identifiant de client introuvable dans l’URL').toBeTruthy()

    // La fiche s'ouvre bien dans SON dossier — sinon le reste ne prouverait rien.
    await expect(page.locator('main')).not.toContainText(/n’existe pas|n'existe pas/i)

    // 2. Le même identifiant, présenté sous une autre entreprise.
    for (const autre of ['developpement', 'staff']) {
      await page.goto(`/crm/${autre}/clients/${identifiant}`)

      await expect(
        page.locator('main'),
        `Le client de Paysagement est visible sous « ${autre} » — le cloisonnement ne tient pas.`,
      ).toContainText(/n’existe pas|n'existe pas/i, { timeout: 10_000 })
    }
  })

  test('un slug d’entreprise inventé ne donne rien', async ({ page }) => {
    for (const chemin of [
      '/crm/concurrent',
      '/crm/concurrent/clients',
      '/calculateur/concurrent',
    ]) {
      await page.goto(chemin)
      await expect(page.locator('main'), `${chemin} ne doit rien afficher`).toContainText(
        /n’existe pas|n'existe pas/i,
        { timeout: 10_000 },
      )
    }
  })

  test('chaque dossier ne montre que ses propres clients', async ({ page }) => {
    /*
      Les noms viennent de `scripts/amorcer-tests.mjs`. Le test ne vérifie pas
      seulement que le bon client est là : il vérifie surtout que celui de
      l'autre entreprise n'y est PAS. Une extension qui cesserait de filtrer
      afficherait les deux, et un test qui ne regarde que la présence passerait.
    */
    await page.goto('/crm/paysagement/clients')
    await expect(page.locator('main')).toContainText('Luc Bédard', { timeout: 10_000 })
    await expect(page.locator('main')).not.toContainText('Clinique dentaire Ste-Foy')

    await page.goto('/crm/developpement/clients')
    await expect(page.locator('main')).toContainText('Clinique dentaire Ste-Foy', {
      timeout: 10_000,
    })
    await expect(page.locator('main')).not.toContainText('Luc Bédard')
  })

  test('les grilles de tarifs suivent la même frontière', async ({ page }) => {
    /*
      Le calculateur propose les produits de l'entreprise ouverte, et rien
      d'autre.

      Le sélecteur de service est un menu DESSINÉ : ses entrées n'existent dans
      le document qu'une fois ouvert. Chercher un nom de produit dans `main` sans
      l'ouvrir ne trouvait plus rien — et la moitié de ce test, celle qui vérifie
      l'ABSENCE des produits de l'autre entreprise, passait alors à vide.
    */
    const ouvrirServices = async () => {
      await page.getByLabel('Service de la ligne 1').click()
      return page.getByRole('menu')
    }

    await page.goto('/calculateur/paysagement')
    const paysagement = await ouvrirServices()
    await expect(paysagement).toContainText('Pose de tourbe', { timeout: 10_000 })
    await expect(paysagement).not.toContainText('Développement front-end')

    await page.goto('/calculateur/developpement')
    const developpement = await ouvrirServices()
    await expect(developpement).toContainText('Développement front-end', { timeout: 10_000 })
    await expect(developpement).not.toContainText('Pose de tourbe')
  })
})
