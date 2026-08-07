import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Refus d'accès journalisés — ADM-4.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Seules les actions réussies laissaient une trace. C'est l'inverse de ce
 * qu'un audit cherche : quelqu'un qui pousse la porte d'un module qui n'est pas
 * le sien est le signal, pas le bruit.
 *
 * Deux choses doivent tenir ENSEMBLE, et c'est là que le test compte :
 * le refus est consigné, et la réponse rendue ne change pas d'un iota.
 * Un `notFound()` reste un `notFound()`. Le distinguer d'une page absente
 * offrirait un oracle : on devinerait par tâtonnement ce qui existe derrière.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

const getSession = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

class InterruptionNotFound extends Error {}
class InterruptionRedirect extends Error {}

const notFound = vi.fn(() => {
  throw new InterruptionNotFound('NEXT_HTTP_ERROR_FALLBACK;404')
})
const redirect = vi.fn(() => {
  throw new InterruptionRedirect('NEXT_REDIRECT')
})
vi.mock('next/navigation', () => ({ notFound, redirect }))

const journaliserRefus = vi.fn()
vi.mock('@/lib/audit', () => ({ journaliserRefus }))

const { requireEntreprise, requireModule, requirePermissionEcran } = await import('@/lib/guards')

function connecte(role: string, id = 'u1', nom = 'Camille Roy') {
  getSession.mockResolvedValue({ user: { id, name: nom, email: 'c@r.ca', role } })
}

/** Exécute une garde et rend la façon dont elle a refusé — ou `null`. */
async function refus(garde: () => Promise<unknown>): Promise<'notFound' | 'redirect' | null> {
  try {
    await garde()
    return null
  } catch (e) {
    if (e instanceof InterruptionNotFound) return 'notFound'
    if (e instanceof InterruptionRedirect) return 'redirect'
    throw e
  }
}

beforeEach(() => {
  journaliserRefus.mockReset()
  notFound.mockClear()
  redirect.mockClear()
})

describe('requireModule', () => {
  it('consigne le module poussé, puis refuse comme avant', async () => {
    connecte('heures')

    expect(await refus(() => requireModule('cv'))).toBe('notFound')
    expect(journaliserRefus).toHaveBeenCalledExactlyOnceWith({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      module: 'cv',
    })
  })

  it('ne consigne rien quand l’accès est légitime', async () => {
    connecte('heures')

    await requireModule('heures')
    expect(journaliserRefus).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('journalise avant de lever — sinon rien ne s’écrirait', async () => {
    connecte('recrutement')
    await refus(() => requireModule('admin'))

    // `notFound()` lève : un appel placé après ne serait jamais atteint.
    expect(journaliserRefus).toHaveBeenCalled()
  })
})

describe('requirePermissionEcran', () => {
  it('consigne la permission refusée, dans son module', async () => {
    connecte('recrutement')

    expect(await refus(() => requirePermissionEcran('admin:journal'))).toBe('notFound')
    expect(journaliserRefus).toHaveBeenCalledExactlyOnceWith({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      module: 'admin',
      entite: 'admin:journal',
    })
  })

  it('laisse passer sans écrire quand la permission est accordée', async () => {
    connecte('admin')

    await requirePermissionEcran('admin:journal')
    expect(journaliserRefus).not.toHaveBeenCalled()
  })
})

describe('requireEntreprise', () => {
  it('consigne le slug inconnu et refuse de la même façon', async () => {
    connecte('admin')

    expect(await refus(() => requireEntreprise('paysagment'))).toBe('notFound')
    expect(journaliserRefus).toHaveBeenCalledExactlyOnceWith({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      module: 'admin',
      entite: 'paysagment',
    })
  })

  it('tronque un slug démesuré', async () => {
    connecte('admin')
    await refus(() => requireEntreprise('x'.repeat(5000)))

    const entite = journaliserRefus.mock.calls[0]?.[0].entite as string
    // La longueur d'une entrée de journal ne doit pas être à la main de l'appelant.
    expect(entite).toHaveLength(80)
  })

  it('n’écrit rien pour un slug connu', async () => {
    connecte('admin')

    await expect(requireEntreprise('paysagement')).resolves.toBe('paysagement')
    expect(journaliserRefus).not.toHaveBeenCalled()
  })

  it('sans session, refuse sans nommer personne', async () => {
    getSession.mockResolvedValue(null)

    expect(await refus(() => requireEntreprise('inconnue'))).toBe('notFound')
    expect(journaliserRefus).not.toHaveBeenCalled()
  })
})

describe('Le refus reste indiscernable d’une page absente', () => {
  it('aucune garde d’écran ne distingue son refus', async () => {
    connecte('recrutement')

    const rendus = [
      await refus(() => requireModule('heures')),
      await refus(() => requirePermissionEcran('heures:parametres')),
      await refus(() => requireEntreprise('inconnue')),
    ]

    // Trois causes différentes, une seule réponse observable.
    expect(new Set(rendus)).toEqual(new Set(['notFound']))
  })
})
