import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Connexions, échecs de connexion et refus d'action — ADM-4.
 *
 * Lecture des sources plutôt qu'exécution : `lib/auth.ts` construit une instance
 * Better Auth au chargement, avec Prisma, Resend et la validation de
 * l'environnement derrière. Les autres tests de garde du projet procèdent ainsi.
 * Le comportement, lui, est couvert par `audit-refus.spec.ts` et
 * `journal-refus.spec.ts`, qui exécutent les gardes et le journal pour de bon.
 */

const lire = (chemin: string) =>
  readFileSync(join(process.cwd(), chemin.split('/').join(sep)), 'utf8')

const AUTH = lire('src/lib/auth.ts')
const FABRIQUE = lire('src/lib/safe-action.ts')
const AUDIT = lire('src/lib/audit.ts')

describe('Connexion — la trace existe aux deux bouts', () => {
  it('l’ouverture de session est consignée', () => {
    // Une déconnexion sans connexion correspondante rend le journal illisible.
    expect(AUTH).toContain('ACTION_CONNEXION')
    expect(AUTH).toMatch(/databaseHooks[\s\S]*session[\s\S]*create[\s\S]*journaliser\(/)
  })

  it('l’horodatage du compte ne peut pas empêcher d’entrer', () => {
    // Une date manquante est un désagrément ; une connexion refusée est un arrêt
    // de travail. L'écriture reste donc enveloppée.
    expect(AUTH).toMatch(/try\s*\{[\s\S]*prisma\.user\.update[\s\S]*\}\s*catch/)
  })
})

describe('Échec de connexion', () => {
  it('s’accroche au seul point d’où l’on voit un refus', () => {
    /*
      Better Auth n'a pas de crochet dédié à l'échec. Quand le point d'entrée
      lève une `APIError`, le répartiteur la range dans `ctx.context.returned`
      et exécute quand même les crochets d'après : c'est de là qu'on la voit.
    */
    expect(AUTH).toContain('createAuthMiddleware')
    expect(AUTH).toContain("ctx.path !== '/sign-in/email'")
    expect(AUTH).toContain('isAPIError(ctx.context.returned)')
    expect(AUTH).toContain('ACTION_ECHEC_CONNEXION')
  })

  it('ne renvoie aucune réponse — TR-4 tient', () => {
    /*
      Le message d'authentification doit rester identique que le compte existe
      ou non. Un crochet qui écrirait une réponse le trahirait.
    */
    const crochet = AUTH.slice(AUTH.indexOf('createAuthMiddleware'))
    expect(crochet).not.toMatch(/ctx\.json\(/)
    expect(crochet).not.toMatch(/return\s+ctx\./)
  })

  it('une panne du crochet ne casse pas la page de connexion', () => {
    // Une exception remonterait au répartiteur : un journal muet vaut mieux.
    const crochet = AUTH.slice(AUTH.indexOf('createAuthMiddleware'))
    expect(crochet).toMatch(/try\s*\{[\s\S]*journaliser\(/)
  })
})

describe('Rien de ce qui sert à s’authentifier n’entre au journal', () => {
  it('seule l’adresse est extraite du corps de la requête', () => {
    // Ce corps porte AUSSI le mot de passe : on n'y prend que `email`.
    expect(AUTH).toContain('courrielTente')
    expect(AUTH).toMatch(/\{\s*email\?:\s*unknown\s*\}/)
  })

  it('aucun mot de passe, jeton ni en-tête d’autorisation journalisé', () => {
    for (const source of [AUTH, AUDIT, FABRIQUE]) {
      const entrees = [...source.matchAll(/journaliser(?:Refus)?\(\{[\s\S]*?\n\s*\}\)/g)].map(
        (m) => m[0],
      )
      for (const entree of entrees) {
        expect(entree).not.toMatch(/password|motDePasse|token|jeton|authorization/i)
      }
    }
  })

  it('l’adresse tentée est bornée en longueur', () => {
    // Elle est écrite par un anonyme : sa longueur ne doit pas être à sa main.
    expect(AUTH).toMatch(/slice\(0,\s*120\)/)
  })
})

describe('Refus d’action — la fabrique', () => {
  it('les deux fabriques consignent le refus de permission', () => {
    // Une seule occurrence signifierait qu'une des deux laisse passer sans trace.
    expect([...FABRIQUE.matchAll(/journaliserActionRefusee\(config\.permission\)/g)]).toHaveLength(
      2,
    )
  })

  it('la réponse rendue à l’appelant n’a pas changé', () => {
    expect([
      ...FABRIQUE.matchAll(
        /await journaliserActionRefusee\(config\.permission\)\s*\n\s*return \{ ok: false, erreur: e\.message \}/g,
      ),
    ]).toHaveLength(2)
  })

  it('la session est relue plutôt que devinée', () => {
    // `requirePermission` lève sans rendre la session ; l'appel n'a lieu que sur
    // le chemin déjà refusé.
    expect(FABRIQUE).toMatch(/journaliserActionRefusee[\s\S]{0,400}sessionCourante\(\)/)
  })
})

describe('Adresse d’origine', () => {
  it('la résolution est celle de Better Auth, pas une seconde', () => {
    expect(AUDIT).toContain("from 'better-auth/api'")
    expect(AUDIT).toContain('getIp(')
    expect(AUTH).toContain('ipAddress: configurationIp')
  })

  it('la première entrée de x-forwarded-for n’est plus retenue', () => {
    // Elle est écrite par le client : la retenir met la colonne « Adresse IP »
    // du journal à la main de la personne auditée.
    expect(AUDIT).not.toMatch(/split\(','\)\[0\]/)
    expect(AUDIT).not.toContain('x-real-ip')
  })
})
