import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Deux responsabilités : la politique de sécurité du contenu, et une redirection
 * de confort.
 *
 * Ce fichier s'appelle `proxy.ts` et non `middleware.ts` : c'est la convention
 * de cette version de Next.js.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La redirection n'est PAS une mesure de sécurité.
 *
 * Elle ne consulte pas la base et ne connaît pas les rôles. Elle se contente de
 * regarder si un cookie de session existe — ce qui évite un aller-retour vers
 * Neon à chaque navigation.
 *
 * La vraie protection est ailleurs : le layout de `(app)` vérifie la session, le
 * layout de chaque module vérifie le rôle, et surtout chaque mutation passe par
 * `lib/safe-action.ts`. Ce proxy ne doit JAMAIS être le seul contrôle.
 * ─────────────────────────────────────────────────────────────────────────
 */

const PUBLIQUES = ['/', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe']

const estDev = process.env.NODE_ENV === 'development'

/** Origine du stockage objet — l'aperçu des CV s'y sert dans une iframe. */
const origineStockage = (() => {
  const brut = process.env.STORAGE_ENDPOINT
  if (!brut) return ''
  try {
    return new URL(brut).origin
  } catch {
    return ''
  }
})()

/**
 * Politique de sécurité du contenu, construite à chaque requête.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi ici et non dans `next.config.ts`.
 *
 * Un en-tête déclaré dans la configuration est identique pour tout le monde, il
 * ne peut donc pas porter de nonce. La politique y était `script-src 'self'
 * 'unsafe-inline'` — ce qui annule l'essentiel de sa raison d'être : toute
 * balise `<script>` injectée s'exécute. `architecture.MD` annonçait pourtant un
 * `script-src` strict comme contrepartie assumée de l'abandon de Google Tag
 * Manager. Le document promettait, le code ne livrait pas.
 *
 * Next.js lit le nonce dans l'en-tête de la REQUÊTE pendant le rendu serveur et
 * l'appose lui-même aux scripts du cadre, aux paquets de page et aux scripts en
 * ligne qu'il génère. D'où la double écriture ci-dessous : requête pour que le
 * rendu le voie, réponse pour que le navigateur l'applique.
 *
 * `style-src` garde `'unsafe-inline'`, délibérément. Les pastilles d'entreprise
 * et les tuiles portent un attribut `style` calculé — c'est la seule façon de
 * peindre depuis un jeton CSS dynamique. Un attribut de style ne s'exécute pas :
 * le risque n'a aucune commune mesure avec celui d'un script.
 * ─────────────────────────────────────────────────────────────────────────
 */
function politique(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    /*
      L'origine du stockage est indispensable ICI aussi, et elle manquait.

      `frame-src` et `connect-src` l'avaient — pour l'aperçu d'un CV et pour le
      téléversement direct — mais le logo d'entreprise est une simple balise
      `<img>` pointant sur une URL présignée. Le navigateur la bloquait
      silencieusement : l'écran affichait « aucun logo » après un dépôt réussi,
      et redéposer effaçait l'objet précédent sans jamais converger.
    */
    `img-src 'self' data: blob:${origineStockage ? ` ${origineStockage}` : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // `strict-dynamic` : un script porteur du nonce peut en charger d'autres,
    // ce dont Next a besoin. Les navigateurs qui le comprennent ignorent alors
    // `'self'`, qui reste pour les autres.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${estDev ? " 'unsafe-eval'" : ''}`,
    "font-src 'self' data:",
    `frame-src 'self'${origineStockage ? ` ${origineStockage}` : ''}`,
    `connect-src 'self'${origineStockage ? ` ${origineStockage}` : ''}${estDev ? ' ws: wss:' : ''}`,
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Avertissement d'origine — le piège qui coûte une mise en ligne.
 *
 * Better Auth compare l'origine de chaque requête à `BETTER_AUTH_URL`, sa
 * protection contre les requêtes intersites. Si les deux diffèrent, il refuse
 * TOUTES les connexions — et le message affiché reste « Courriel ou mot de passe
 * incorrect », parce que TR-4 impose qu'il soit identique quelle que soit la
 * cause. C'est le bon choix pour la sécurité, et une piste morte pour celui qui
 * cherche : l'application se déploie, s'affiche, la base répond, et personne
 * n'entre. On cherche alors du côté des comptes.
 *
 * Ce contrôle transforme ces vingt minutes en une ligne de journal. Il
 * n'interrompt rien : derrière un proxy inverse, une divergence peut être
 * légitime le temps d'un réglage.
 * ─────────────────────────────────────────────────────────────────────────
 */
let originePreveue = false

function verifierOrigine(request: NextRequest): void {
  if (originePreveue) return

  const attendue = process.env.BETTER_AUTH_URL
  if (!attendue) return

  try {
    const servie = request.nextUrl.origin
    if (new URL(attendue).origin === servie) return

    originePreveue = true
    console.error(
      `[auth] BETTER_AUTH_URL vaut « ${attendue} » mais une requête est arrivée sur « ${servie} ».\n` +
        `       Toute connexion tentée depuis cette origine sera refusée, en affichant\n` +
        `       « Courriel ou mot de passe incorrect » — le message ne dit jamais la vraie cause.\n` +
        `       « localhost » et « 127.0.0.1 » ne sont pas interchangeables : la comparaison\n` +
        `       porte sur la chaîne, pas sur la machine.\n` +
        `       Alignez BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL et les origines autorisées du bucket R2.\n` +
        `       (Averti une seule fois par démarrage.)`,
    )
  } catch {
    // `BETTER_AUTH_URL` mal formée : `lib/env.ts` la valide déjà au démarrage.
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookie = getSessionCookie(request)
  const estPublique = PUBLIQUES.includes(pathname)

  verifierOrigine(request)

  // Un utilisateur connecté n'a rien à faire sur l'écran de connexion.
  if (cookie && estPublique) {
    return NextResponse.redirect(new URL('/accueil', request.url))
  }

  // Sans cookie, tout le reste renvoie vers la racine — qui EST l'écran de connexion.
  if (!cookie && !estPublique) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Unique et imprévisible à chaque requête : un nonce réutilisé ne vaut rien.
  const nonce = crypto.randomUUID()
  const csp = politique(nonce)

  const enTetes = new Headers(request.headers)
  enTetes.set('x-nonce', nonce)
  enTetes.set('Content-Security-Policy', csp)

  const reponse = NextResponse.next({ request: { headers: enTetes } })
  reponse.headers.set('Content-Security-Policy', csp)
  return reponse
}

export const config = {
  /**
   * `api/auth` est exclu : c'est par là qu'on obtient la session.
   * Les fichiers statiques le sont aussi — les faire passer ici serait un coût
   * inutile sur chaque requête.
   *
   * Les préchargements de `next/link` sont écartés : ils ne rendent pas de HTML,
   * et leur faire produire un nonce serait du travail perdu à chaque survol de
   * lien.
   */
  matcher: [
    {
      source: '/((?!api/auth|_next/static|_next/image|favicon.ico|fonts).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
