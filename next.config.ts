import type { NextConfig } from 'next'

/**
 * La politique de sécurité du contenu N'EST PAS ici — elle vit dans `proxy.ts`.
 *
 * Un en-tête déclaré dans cette configuration est identique pour toutes les
 * requêtes ; il ne peut donc pas porter de nonce, et la politique était forcée
 * d'autoriser `script-src 'unsafe-inline'`, ce qui la vidait de son sens.
 * Construite par requête dans le proxy, elle porte un nonce que Next appose
 * lui-même aux scripts qu'il génère.
 *
 * Les en-têtes ci-dessous restent ici : ils ne dépendent pas de la requête.
 */
const enTetesSecurite = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  /**
   * L'application est derrière un login : elle ne doit jamais être indexée.
   * Le nom de domaine, lui, devient public dès l'émission du certificat SSL —
   * ce qui protège est l'authentification, pas la discrétion de l'adresse.
   */
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  reactCompiler: true,

  experimental: {
    /**
     * Ce que le NAVIGATEUR garde d'une page déjà vue.
     *
     * ──────────────────────────────────────────────────────────────────
     * Toutes les routes de `(app)` lisent la session dans leur layout : elles
     * sont donc DYNAMIQUES, et la valeur par défaut de `dynamic` est zéro. Quitter
     * un écran et y revenir refaisait donc le rendu serveur complet — quinze à
     * trente allers-retours vers une base distante pour un écran qu'on venait de
     * voir.
     *
     * Ce délai est bien moins risqué qu'il n'y paraît : toutes les actions du
     * produit appellent `revalidatePath`, et Next vide alors l'intégralité de ce
     * cache. Il ne peut donc JAMAIS montrer à quelqu'un ses propres données
     * périmées — seulement celles qu'un AUTRE utilisateur, ou un autre onglet, a
     * modifiées pendant la fenêtre.
     *
     * Trente secondes : plus court qu'un aller-retour entre deux écrans, assez
     * long pour couvrir le va-et-vient qui motivait la plainte.
     *
     * Le suivi des heures s'en exclut, dans sa page : c'est le seul écran où
     * deux personnes travaillent en même temps sur les mêmes lignes.
     *
     * Aucune page ne devient statique : le rendu serveur reste dynamique à
     * chaque fois qu'il a lieu, et le nonce de `proxy.ts` n'est pas concerné.
     * ──────────────────────────────────────────────────────────────────
     */
    staleTimes: { dynamic: 30 },
  },

  // Ne pas divulguer le framework via l'en-tête `X-Powered-By`.
  poweredByHeader: false,

  /**
   * Auto-hébergement sur VPS : `standalone` produit un serveur Node minimal dans
   * `.next/standalone` avec ses seules dépendances tracées.
   * Rappel de déploiement : copier `.next/static` et `public/` DANS le dossier
   * standalone — Next ne les y place pas.
   */
  /*
    ────────────────────────────────────────────────────────────────────────────
    `standalone` SAUF sur Vercel, où il fait échouer la construction.

    Vercel trace les dépendances lui-même et attend `.next/next-server.js.nft.json`
    à la fin du build. `standalone` produit à la place un serveur autonome dans
    `.next/standalone` et n'émet pas ce fichier : l'étape `onBuildComplete` de
    Vercel s'arrête sur un ENOENT.

    Les deux cibles restent donc servies sans qu'on ait à choisir. La cible du
    projet est un VPS Hostinger avec Coolify, qui a besoin de `standalone` ; un
    déploiement d'essai sur Vercel n'a pas à le payer.

    `VERCEL` vaut « 1 » dans leurs conteneurs de construction, jamais ailleurs.
    ────────────────────────────────────────────────────────────────────────────
  */
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),

  /**
   * `@react-pdf/pdfkit` lit un profil ICC par un chemin construit à l'exécution
   * (`readFileSync(`${__dirname}/data/…`)`). Un chemin dynamique n'est pas
   * traçable par l'empaqueteur : le fichier ne serait pas copié dans
   * `.next/standalone`, et la panne n'apparaîtrait qu'en production, à la
   * première génération de devis. Laisser le paquet externe le charge depuis
   * `node_modules`, où il est entier.
   */
  serverExternalPackages: ['@react-pdf/renderer'],

  async headers() {
    return [{ source: '/:path*', headers: enTetesSecurite }]
  },
}

export default nextConfig
