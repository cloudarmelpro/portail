import { defineConfig, devices } from '@playwright/test'

/**
 * Parcours de bout en bout.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ils exigent une base JETABLE, jamais celle de développement.
 *
 * Un parcours crée des clients, dépose des CV et saisit des heures. Contre la
 * base de développement, il écrirait dans les données réelles et dépendrait de
 * leur contenu — donc échouerait un jour sur deux, pour de mauvaises raisons.
 *
 * Marche à suivre :
 *   1. Créer une branche de test chez Neon (ou lancer un PostgreSQL local).
 *   2. Copier `.env` en `.env.test`, y pointer DATABASE_URL et DIRECT_URL.
 *   3. node --env-file=.env.test scripts/amorcer-tests.mjs --confirmer
 *   4. npm run e2e
 *
 * Le script d'amorçage REFUSE de s'exécuter s'il trouve un compte qui n'est pas
 * l'un des siens : pointer par mégarde sur la base de développement échoue au
 * lieu de l'effacer.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le serveur lancé est un build de PRODUCTION. En développement, Next compile
 * chaque route à la première visite : les délais d'attente seraient à régler au
 * jugé, ce qui est la recette d'un test intermittent.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,

  // Aucune reprise, même en intégration continue. Un test qui passe au second
  // essai ne prouve rien, et masque exactement le genre de défaut qu'on cherche.
  retries: 0,

  /*
    ─────────────────────────────────────────────────────────────────────────
    Soixante secondes, et trois ouvriers au plus.

    Chaque parcours enchaîne des navigations qui touchent toutes une base
    DISTANTE. Depuis ADM-4, un écran refusé écrit en plus une entrée au journal
    — et `acces-modules` visite exprès tous les écrans refusés de trois rôles.
    Le travail par requête a donc augmenté, délibérément.

    À huit ouvriers en parallèle sur une base distante, trois parcours
    dépassaient trente secondes ; lancés seuls, les mêmes passaient. C'est la
    concurrence vers la base qui plafonne, pas le code.

    Élargir le délai plutôt qu'ajouter des reprises : une reprise ferait passer
    un test qui échoue, ce que la ligne au-dessus refuse pour de bonnes raisons.
    Ici on donne le temps réel qu'il faut, sans rien masquer.
    ─────────────────────────────────────────────────────────────────────────
  */
  timeout: 60_000,
  workers: 3,

  reporter: [['list']],

  use: {
    baseURL: process.env.E2E_URL ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
  },

  projects: [
    // Trois connexions, une par rôle, avant tout le reste — voir
    // `tests/e2e/connexion.setup.ts` pour la raison, qui n'est pas la vitesse.
    { name: 'connexion', testMatch: /connexion\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['connexion'],
      testIgnore: /connexion\.setup\.ts/,
    },
  ],

  webServer: {
    command: 'npm run build && npx next start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,

    /*
      ─────────────────────────────────────────────────────────────────────
      `BETTER_AUTH_URL` doit désigner l'origine RÉELLEMENT servie.

      Better Auth compare l'origine de chaque requête à sa `baseURL` — c'est sa
      protection contre les requêtes intersites. Servi sur `127.0.0.1:3100`
      pendant que `BETTER_AUTH_URL` annonce `localhost:3000`, il refuse toute
      connexion.

      Le symptôme est trompeur, et pour une bonne raison : TR-4 impose que le
      message d'échec soit identique quelle que soit la cause, pour ne pas
      révéler quelles adresses possèdent un accès. « Courriel ou mot de passe
      incorrect » couvrait donc un rejet d'origine — le test échouait sans dire
      pourquoi, et c'est le comportement voulu en production.

      La même variable devra être ajustée au déploiement, pour la même raison.
      ─────────────────────────────────────────────────────────────────────
    */
    env: {
      NODE_ENV: 'production',
      PORT: '3100',
      BETTER_AUTH_URL: 'http://127.0.0.1:3100',
      // Inlinée à la COMPILATION : elle doit être posée avant `npm run build`,
      // que cette commande enchaîne justement.
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',

      /*
        ─────────────────────────────────────────────────────────────────────
        Exigée dès que `NODE_ENV` vaut `production`, et c'est le cas ici.

        Sans elle, `lib/env.ts` refuse de démarrer et Playwright n'obtient
        jamais son serveur — l'échec se lit « timeout en attendant
        127.0.0.1:3100 », qui ne désigne rien de ce qui cloche.

        La boucle locale suffit : rien ne s'interpose entre le navigateur de
        test et le serveur. En production, c'est la liste des reverse proxys de
        Coolify qu'il faut inscrire — voir la section 15 d'architecture.MD.
        ─────────────────────────────────────────────────────────────────────
      */
      PROXYS_DE_CONFIANCE: '127.0.0.1/32,::1/128',
    },
  },
})
