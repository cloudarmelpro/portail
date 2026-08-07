import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La politique de sécurité du contenu reste stricte sur les scripts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `architecture.MD` annonce un `script-src 'self'` strict, présenté comme la
 * contrepartie assumée de l'abandon de Google Tag Manager. Le code livrait
 * `script-src 'self' 'unsafe-inline'`, ce qui annule l'essentiel du bénéfice :
 * toute balise `<script>` injectée s'exécute.
 *
 * La cause était structurelle. Un en-tête déclaré dans `next.config.ts` est le
 * même pour toutes les requêtes ; il ne peut pas porter de nonce, donc il
 * n'avait pas d'autre choix que d'autoriser l'inline.
 *
 * Ce test surveille les deux moitiés de la correction : la politique vit dans
 * le proxy, et elle n'autorise pas l'inline sur les scripts.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Commentaires retirés avant analyse — les deux fichiers CITENT l'ancienne
 * politique pour expliquer pourquoi elle a changé. Sans ce nettoyage, le test
 * lirait l'explication du défaut et croirait au défaut lui-même.
 */
function nettoyer(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const PROXY = nettoyer(readFileSync(join(process.cwd(), 'src', 'proxy.ts'), 'utf8'))
const CONFIG = nettoyer(readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8'))

describe('Politique de sécurité du contenu', () => {
  it('est construite dans le proxy, pas dans la configuration', () => {
    expect(PROXY).toContain('Content-Security-Policy')
    expect(
      CONFIG.includes('Content-Security-Policy'),
      'La CSP est revenue dans next.config.ts : elle y est identique pour toutes les requêtes, donc sans nonce.',
    ).toBe(false)
  })

  it('n’autorise jamais les scripts en ligne', () => {
    const scriptSrc = PROXY.match(/`script-src[^`]*`/)?.[0] ?? ''
    expect(scriptSrc, 'Directive script-src introuvable').not.toBe('')
    expect(
      scriptSrc.includes("'unsafe-inline'"),
      "script-src autorise 'unsafe-inline' : toute injection de balise script s'exécute.",
    ).toBe(false)
  })

  it('emploie un nonce et strict-dynamic', () => {
    expect(PROXY).toContain("'nonce-")
    expect(PROXY).toContain("'strict-dynamic'")
  })

  it('pose le nonce sur la requête ET sur la réponse', () => {
    // Requête : Next le lit pendant le rendu serveur pour l'apposer aux scripts.
    // Réponse : le navigateur l'applique. L'un sans l'autre ne sert à rien.
    expect(PROXY).toMatch(/enTetes\.set\('Content-Security-Policy'/)
    expect(PROXY).toMatch(/reponse\.headers\.set\('Content-Security-Policy'/)
    expect(PROXY).toContain("'x-nonce'")
  })

  it('le nonce est imprévisible et refait à chaque requête', () => {
    // Une constante, ou une valeur calculée hors du gestionnaire, se réutiliserait
    // d'une requête à l'autre — un nonce réutilisé ne vaut rien.
    const corps = PROXY.slice(PROXY.indexOf('export function proxy('))
    expect(corps).toContain('crypto.randomUUID()')
  })

  it('`unsafe-eval` reste cantonné au développement', () => {
    const scriptSrc = PROXY.match(/`script-src[^`]*`/)?.[0] ?? ''
    if (scriptSrc.includes("'unsafe-eval'")) {
      expect(scriptSrc, "'unsafe-eval' doit être conditionné par estDev").toContain('estDev')
    }
  })
})

describe('Les trois directives qui touchent le stockage citent la même origine', () => {
  /*
    `img-src` avait été oublié. `frame-src` l'avait — pour l'aperçu d'un CV — et
    `connect-src` aussi — pour le téléversement direct — mais le logo
    d'entreprise est une simple balise `<img>` sur une URL présignée.

    Le navigateur la bloquait sans bruit : l'écran affichait « aucun logo » après
    un dépôt réussi, et redéposer effaçait l'objet précédent. La boucle ne
    convergeait jamais, et rien à l'écran ne disait pourquoi.
  */
  it('img-src, frame-src et connect-src, toutes trois', () => {
    const source = PROXY

    for (const directive of ['img-src', 'frame-src', 'connect-src']) {
      const ligne = source
        .split(/\r?\n/)
        .find((l) => l.includes(`${directive} `) && !l.trimStart().startsWith('*'))

      expect(ligne, directive).toBeDefined()
      expect(ligne, directive).toContain('origineStockage')
    }
  })

  it('l’origine reste conditionnelle : sans stockage configuré, rien n’est ajouté', () => {
    // Une directive terminée par un espace serait invalide, et le navigateur
    // rejetterait la politique entière.
    expect(PROXY).toContain("origineStockage ? ` ${origineStockage}` : ''")
  })
})

describe('Aucune page ne peut être servie sans nonce', () => {
  /*
    Le nonce est apposé au rendu SERVEUR. Une page pré-rendue au build n'a vu ni
    requête ni en-tête : son HTML n'en porte aucun, et `strict-dynamic` bloque
    alors tous ses scripts. Les deux pages autrefois statiques doivent donc
    déclarer leur dépendance à la requête.
  */
  const pages = [
    join('src', 'app', '(auth)', 'mot-de-passe-oublie', 'page.tsx'),
    join('src', 'app', 'not-found.tsx'),
  ]

  it.each(pages)('%s est rendue à la demande', (chemin) => {
    const source = readFileSync(join(process.cwd(), chemin), 'utf8')
    expect(
      source,
      `${chemin} : sans connexion(), la page reste pré-rendue et ses scripts sont bloqués`,
    ).toContain('await connection()')
  })
})

describe('Avertissement d’origine', () => {
  /*
    Une adresse `BETTER_AUTH_URL` qui ne correspond pas à l'origine servie fait
    refuser TOUTES les connexions, sans que le message le dise — TR-4 impose
    qu'il reste identique quelle que soit la cause. Le contrôle du proxy est la
    seule chose qui rende ce défaut trouvable ; il ne doit pas disparaître au
    prochain nettoyage.
  */
  it('le proxy compare l’origine servie à BETTER_AUTH_URL', () => {
    expect(PROXY).toContain('BETTER_AUTH_URL')
    expect(PROXY).toContain('request.nextUrl.origin')
  })

  it('il avertit sans interrompre', () => {
    // Derrière un proxy inverse, une divergence peut être légitime le temps
    // d'un réglage : bloquer rendrait l'application inaccessible pour un doute.
    const bloc = PROXY.slice(PROXY.indexOf('function verifierOrigine'))
    expect(bloc.slice(0, 900)).toContain('console.error')
    expect(bloc.slice(0, 900)).not.toContain('throw ')
  })

  it('il nomme les trois valeurs à aligner', () => {
    expect(PROXY).toContain('NEXT_PUBLIC_APP_URL')
    expect(PROXY).toMatch(/R2|bucket/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un script-src permissif', () => {
    const faux = "`script-src 'self' 'unsafe-inline'`"
    expect(faux.includes("'unsafe-inline'")).toBe(true)
  })

  it('ne se laisse pas piéger par un commentaire qui cite l’ancienne politique', () => {
    // Le cas s'est produit à l'écriture de ce fichier : la première version
    // lisait la ligne d'explication et déclarait la faute présente.
    const faux = nettoyer(`
      /** La politique était \`script-src 'self' 'unsafe-inline'\`, ce qui ne valait rien. */
      const csp = \`script-src 'self' 'nonce-x' 'strict-dynamic'\`
    `)
    const scriptSrc = faux.match(/`script-src[^`]*`/)?.[0] ?? ''
    expect(scriptSrc).toContain("'nonce-x'")
    expect(scriptSrc.includes("'unsafe-inline'")).toBe(false)
  })
})
