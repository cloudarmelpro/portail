import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ce que `journaliserRefus` écrit, et ce qu'elle refuse d'écrire — ADM-4.
 *
 * L'anti-rafale vit ici plutôt que chez les appelants : un écran interdit
 * produit DEUX refus par rendu — le layout du module, puis la page —, et rien
 * n'empêche de recharger en boucle. Sans plafond, la table du journal se
 * remplit à la vitesse d'un doigt sur F5.
 */

vi.mock('server-only', () => ({}))

const creer = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { create: creer } } }))
vi.mock('@/lib/env', () => ({
  configurationIp: { trustedProxies: ['127.0.0.1/32'], ipAddressHeaders: ['x-forwarded-for'] },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const { ACTION_REFUS, journaliserRefus } = await import('@/lib/audit')

type Ecrit = { data: Record<string, unknown> }
const derniere = () => (creer.mock.calls.at(-1)?.[0] as Ecrit).data

/** Chaque cas prend une cible distincte : le plafond est compté par cible. */
let compteur = 0
function cible(): string {
  compteur += 1
  return `cv:cible${compteur}`
}

beforeEach(() => {
  creer.mockReset()
  creer.mockResolvedValue({})
})

describe('L’entrée écrite', () => {
  it('porte le libellé de refus et le marque comme surveillé', async () => {
    await journaliserRefus({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      module: 'cv',
      entite: cible(),
    })

    expect(derniere()).toMatchObject({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      action: ACTION_REFUS,
      module: 'cv',
      // Le filtre « actions sensibles » sert la revue de sécurité : une
      // tentative refusée y a plus sa place qu'une suppression réussie.
      sensible: true,
    })
  })

  it('accepte l’absence d’élément — un module refusé se suffit', async () => {
    await journaliserRefus({ userId: 'u2', utilisateurNom: 'Jean Roy', module: 'heures' })
    expect(derniere().entite).toBeNull()
  })
})

describe('Anti-rafale', () => {
  it('plafonne les refus répétés sur une même cible', async () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = cible()

    for (let i = 0; i < 40; i += 1) {
      await journaliserRefus({
        userId: 'u1',
        utilisateurNom: 'Camille Roy',
        module: 'cv',
        entite: c,
      })
    }

    expect(creer).toHaveBeenCalledTimes(10)
    // Écarté n'est pas silencieux : la rafale est elle-même le signal.
    expect(avertir).toHaveBeenCalled()
    avertir.mockRestore()
  })

  it('compte séparément deux utilisateurs', async () => {
    const c = cible()
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (let i = 0; i < 12; i += 1) {
      await journaliserRefus({
        userId: 'u1',
        utilisateurNom: 'Camille Roy',
        module: 'cv',
        entite: c,
      })
    }
    creer.mockClear()
    for (let i = 0; i < 3; i += 1) {
      await journaliserRefus({ userId: 'u2', utilisateurNom: 'Jean Roy', module: 'cv', entite: c })
    }

    // Un plafond commun punirait la seconde personne pour la première.
    expect(creer).toHaveBeenCalledTimes(3)
    avertir.mockRestore()
  })

  it('laisse passer la première tentative sur chaque cible', async () => {
    await journaliserRefus({
      userId: 'u3',
      utilisateurNom: 'Léa Côté',
      module: 'crm',
      entite: cible(),
    })
    await journaliserRefus({
      userId: 'u3',
      utilisateurNom: 'Léa Côté',
      module: 'crm',
      entite: cible(),
    })

    expect(creer).toHaveBeenCalledTimes(2)
  })
})

describe('Une panne du journal ne remonte pas', () => {
  it('rend la main même si l’écriture échoue', async () => {
    creer.mockRejectedValue(new Error('table indisponible'))
    const tracer = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      journaliserRefus({
        userId: 'u9',
        utilisateurNom: 'Camille Roy',
        module: 'cv',
        entite: cible(),
      }),
    ).resolves.toBeUndefined()

    tracer.mockRestore()
  })
})
