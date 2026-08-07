import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La surface HTTP de Better Auth reste fermée sur l'administration.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le plugin `admin()` publie une quinzaine de points d'entrée sous
 * `/api/auth/admin/*`. Ils ne traversent NI la fabrique d'actions, NI les
 * gardes de `lib/actions/admin.ts`, NI le journal d'audit.
 *
 * Concrètement : `remove-user` supprime réellement un compte, alors que le
 * projet garantit qu'un compte n'est jamais que suspendu — une suppression
 * ferait disparaître l'auteur des entrées du journal. `set-role` retire le rôle
 * du dernier administrateur sans que `refuserSiDernierAdministrateur` soit
 * consulté. `set-user-password` fixe le mot de passe d'autrui.
 *
 * Le coût de la fermeture est nul : nos actions appellent `auth.api.*` en
 * direct côté serveur. Aucun appel du navigateur ne vise cet espace de noms.
 *
 * Ce test empêche la réouverture — par un `export const { GET, POST }` remis
 * tel quel, ou par un plugin ajouté sans y penser.
 * ─────────────────────────────────────────────────────────────────────────
 */

const ROUTE = join(process.cwd(), 'src', 'app', 'api', 'auth', '[...all]', 'route.ts')
const source = readFileSync(ROUTE, 'utf8')

describe('Surface HTTP de Better Auth', () => {
  it('la route est lue', () => {
    expect(source.length, 'Route introuvable — le chemin a-t-il changé ?').toBeGreaterThan(0)
  })

  it('n’expose pas le gestionnaire brut', () => {
    /*
      `export const { GET, POST } = toNextJsHandler(auth)` republie l'intégralité
      des points d'entrée du plugin. C'est la forme d'origine, et celle vers
      laquelle on revient sans y penser en suivant la documentation.
    */
    const brut = /export\s+const\s*\{[^}]*\}\s*=\s*toNextJsHandler\s*\(/.test(source)
    expect(
      brut,
      'Le gestionnaire est réexporté tel quel : /api/auth/admin/* redevient joignable',
    ).toBe(false)
  })

  it('filtre l’espace de noms d’administration', () => {
    expect(source).toContain('/api/auth/admin/')
  })

  it('applique le filtre aux DEUX verbes', () => {
    // Les points d'entrée du plugin sont en POST, mais laisser GET ouvert
    // renseignerait déjà sur ce qui existe derrière.
    for (const verbe of ['GET', 'POST']) {
      const bloc = source.slice(source.indexOf(`export async function ${verbe}(`))
      expect(bloc.slice(0, 220), `${verbe} ne filtre pas`).toMatch(/administrationParHttp/)
    }
  })

  it('répond 404 et non 403', () => {
    // Un refus explicite confirmerait l'existence de la surface.
    expect(source).toContain('status: 404')
    expect(source).not.toContain('status: 403')
  })
})

describe('Les opérations d’administration passent par nos actions', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'lib', 'actions', 'admin.ts'), 'utf8')

  it('appelle Better Auth côté serveur, jamais par HTTP', () => {
    // C'est ce qui rend la fermeture indolore : si ces appels disparaissaient au
    // profit de requêtes vers /api/auth/admin/*, le filtre les bloquerait — et
    // ce test rappellerait pourquoi.
    for (const methode of ['setRole', 'banUser', 'unbanUser', 'createUser']) {
      expect(actions, `auth.api.${methode} attendu dans lib/actions/admin.ts`).toContain(
        `auth.api.${methode}`,
      )
    }
  })
})

describe('Le test peut échouer', () => {
  it('détecte un gestionnaire réexporté tel quel', () => {
    const faux = `export const { GET, POST } = toNextJsHandler(auth)`
    expect(/export\s+const\s*\{[^}]*\}\s*=\s*toNextJsHandler\s*\(/.test(faux)).toBe(true)
  })

  it('accepte la forme filtrée', () => {
    const bon = `const handlers = toNextJsHandler(auth)\nexport async function POST(r: Request) {}`
    expect(/export\s+const\s*\{[^}]*\}\s*=\s*toNextJsHandler\s*\(/.test(bon)).toBe(false)
  })
})
