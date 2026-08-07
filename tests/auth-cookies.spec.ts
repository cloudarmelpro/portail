import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La déconnexion ferme vraiment la porte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un défaut resté invisible jusqu'à ce qu'un cache le rende praticable.
 *
 * `auth.api.*` appelé dans un Server Action produit ses `Set-Cookie` dans une
 * réponse interne à Better Auth. Rien ne les recopie vers la réponse que Next
 * renvoie au navigateur : `nextCookies()` est ce pont, et il manquait.
 *
 * Tant qu'aucun cache de session n'existait, le trou ne se voyait pas : le
 * cookie survivait à la déconnexion, mais la session avait été révoquée en base,
 * donc la requête suivante ne trouvait rien. Avec `cookieCache`, ce cookie signé
 * est cru sur parole pendant sa durée SANS lecture en base — on restait connecté
 * après actualisation, sur un serveur qui n'avait plus rien à vérifier.
 *
 * Les contrôles portent donc sur les DEUX bouts : le pont doit exister, et la
 * révocation doit atteindre le navigateur.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const AUTH = lire('src/lib/auth.ts')
const DECONNEXION = lire('src/lib/session-actions.ts')

describe('Le pont vers les cookies de Next', () => {
  it('le plugin est déclaré', () => {
    expect(AUTH).toContain("import { nextCookies } from 'better-auth/next-js'")
    expect(AUTH).toContain('nextCookies(),')
  })

  it('il est le DERNIER de la liste', () => {
    /*
      Better Auth avertit lui-même si un plugin placé après déclare un
      `hooks.after` : ses cookies ne seraient pas transmis. L'avertissement
      passe en console, où personne ne le lit — d'où ce contrôle.
    */
    const bloc = AUTH.slice(AUTH.indexOf('plugins: ['), AUTH.lastIndexOf('  ],'))

    // Les appels de plugin, dans leur ordre d'écriture. `nextCookies` doit
    // fermer la liste : tout plugin placé après lui pourrait poser des cookies
    // qu'il ne verrait pas passer.
    const appels = [...bloc.matchAll(/\n {4}(\w+)\(/g)].map((m) => m[1])

    expect(appels.length).toBeGreaterThan(1)
    expect(appels.at(-1)).toBe('nextCookies')
  })
})

describe('La déconnexion', () => {
  it('révoque la session côté serveur', () => {
    expect(DECONNEXION).toContain('auth.api.signOut')
  })

  it('vide le cache du routeur client, après la révocation', () => {
    /*
      Révoquer ne suffit pas : le navigateur garde les charges utiles des écrans
      déjà visités, rendues par un serveur qui avait la session. Revenir sur
      l'accueil les affichait telles quelles.

      La portée `layout` sur `/` est le seul geste qui atteigne les écrans qu'on
      ne visite pas en sortant.
    */
    expect(DECONNEXION).toContain("revalidatePath('/', 'layout')")
    expect(DECONNEXION.indexOf('auth.api.signOut')).toBeLessThan(
      DECONNEXION.indexOf("revalidatePath('/', 'layout')"),
    )
  })

  it('journalise avant de révoquer', () => {
    // Après, il n'y a plus d'utilisateur à nommer dans l'entrée.
    expect(DECONNEXION.indexOf('journaliser(')).toBeLessThan(
      DECONNEXION.indexOf('auth.api.signOut'),
    )
  })
})

describe('Le cache de session est borné et assumé', () => {
  it('sa durée est déclarée, courte, et commentée', () => {
    /*
      C'est un ARBITRAGE : une session révoquée ou un compte suspendu restent
      valides pendant la fenêtre. Trente secondes plutôt que les cinq minutes
      usuelles — suspendre un compte doit rester un geste dont l'effet se
      vérifie dans la minute.
    */
    expect(AUTH).toContain('cookieCache: {')
    expect(AUTH).toMatch(/maxAge: \d+,/)
  })

  it('il ne dépasse pas une minute', () => {
    const duree = Number(AUTH.match(/maxAge: (\d+),/)?.[1])
    expect(duree).toBeGreaterThan(0)
    expect(duree).toBeLessThanOrEqual(60)
  })

  it('la version ferme la fenêtre sur le rôle et la suspension', () => {
    /*
      Sans elle, rétrograder quelqu'un ne lui retirait ses droits qu'au bout de la
      fenêtre — y compris pour une mutation, la fabrique d'actions lisant la même
      session. Un administrateur écarté, l'onglet encore ouvert, pouvait se
      re-promouvoir avant que le retrait ne prenne effet.

      Better Auth compare cette chaîne à celle inscrite dans le cookie : dès
      qu'elles diffèrent, la session est relue en base.
    */
    expect(AUTH).toContain('version: (_session, user) =>')
    expect(AUTH).toContain('.role}')
    expect(AUTH).toContain('.banned ?? false}')
  })
})

describe('Ce que le cache de session retarde, le commentaire le dit', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    Un commentaire faux sur un point de sécurité est pire que pas de commentaire.

    La première rédaction affirmait que « la permission n'est PAS affaiblie ».
    C'était faux : `sessionCourante` lit le rôle sur l'objet utilisateur servi
    par ce cache. Rétrograder quelqu'un ne lui retire donc ses permissions qu'au
    bout de la fenêtre — y compris pour une mutation, la fabrique d'actions
    lisant la même session.
    ─────────────────────────────────────────────────────────────────────────
  */
  it('les trois gestes différés sont nommés', () => {
    const bloc = AUTH.slice(AUTH.indexOf('cookieCache') - 2000, AUTH.indexOf('cookieCache'))
    for (const geste of ['r\u00e9voqu', 'suspend', 'r\u00e9trograd']) {
      expect(bloc, geste).toContain(geste)
    }
  })

  it('le rôle est bien lu sur la session, ce qui justifie l’avertissement', () => {
    // Si un jour le rôle venait d'ailleurs — une lecture en base à chaque garde
    // — l'avertissement deviendrait faux dans l'autre sens. Ce contrôle lie les
    // deux fichiers, que rien ne relie à la lecture.
    expect(lire('src/lib/guards.ts')).toContain('(s.user as { role?: unknown }).role')
  })
})
