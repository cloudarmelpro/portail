import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Adresse d'origine inscrite au journal d'audit — ADM-4.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce que ce fichier vérifie, et pourquoi il existe.
 *
 * `adresseIp` prenait l'entrée la plus À GAUCHE de `x-forwarded-for`. Cette
 * partie de l'en-tête est écrite par le client : un reverse proxy ajoute à
 * droite, il n'efface pas ce qui précède. La colonne « Adresse IP » d'un journal
 * dont l'objet est de dire qui a fait quoi était donc à la main de la personne
 * auditée — pire qu'une colonne vide, qui n'affirme rien.
 *
 * La résolution passe maintenant par `getIp` de Better Auth, avec la liste des
 * proxys de confiance : le parcours va de droite à gauche et s'arrête au premier
 * saut qui n'est pas un proxy connu.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

const creer = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { create: creer } } }))

/** Réglage de production type — Coolify + Traefik. */
const PROXYS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1/32', '::1/128']

vi.mock('@/lib/env', () => ({
  configurationIp: { trustedProxies: PROXYS, ipAddressHeaders: ['x-forwarded-for'] },
}))

let enTetes = new Headers()
vi.mock('next/headers', () => ({ headers: async () => enTetes }))

const { journaliser } = await import('@/lib/audit')

/** Écrit une entrée avec l'en-tête donné et rend l'adresse retenue. */
async function ipRetenue(xForwardedFor: string | null): Promise<string | null> {
  enTetes = new Headers()
  if (xForwardedFor !== null) enTetes.set('x-forwarded-for', xForwardedFor)

  await journaliser({
    userId: 'u1',
    utilisateurNom: 'Camille Roy',
    action: 'Connexion',
    module: 'admin',
  })

  const appel = creer.mock.calls.at(-1)?.[0] as { data: { ip: string | null } } | undefined
  return appel?.data.ip ?? null
}

/** L'implémentation corrigée. Elle sert de témoin, pas de spécification. */
function premiereEntree(valeur: string): string | null {
  return valeur.split(',')[0]?.trim() ?? null
}

describe('Résolution de l’adresse derrière un proxy', () => {
  beforeEach(() => {
    creer.mockClear()
    creer.mockResolvedValue({})
  })

  it('retient l’adresse du client, pas celle du proxy', async () => {
    // Traefik a ajouté sa vue du pair à droite ; le client est à gauche.
    expect(await ipRetenue('1.2.3.4, 172.18.0.5')).toBe('1.2.3.4')
  })

  it('ignore l’adresse que le client s’est attribuée', async () => {
    /*
      Le visiteur envoie « X-Forwarded-For: 8.8.8.8 ». Le proxy n'efface pas :
      il ajoute derrière l'adresse qu'il a réellement vue. C'est celle-là qui
      compte, et l'ancienne implémentation retenait exactement l'autre.
    */
    const entete = '8.8.8.8, 203.0.113.7'

    expect(await ipRetenue(entete)).toBe('203.0.113.7')
    expect(premiereEntree(entete)).toBe('8.8.8.8')
  })

  it('traverse plusieurs proxys de confiance d’affilée', async () => {
    expect(await ipRetenue('203.0.113.7, 10.0.0.9, 172.18.0.5')).toBe('203.0.113.7')
  })

  it('ne retient rien quand la chaîne n’est faite que de proxys', async () => {
    /*
      Aucune adresse de client n'y figure : il n'y a rien à inscrire. En
      développement et en test, `getIp` se rabat sur la boucle locale plutôt que
      sur `null` — ce qui compte ici est qu'aucune adresse publique n'en sorte.
    */
    expect(await ipRetenue('172.18.0.5, 10.0.0.9')).toBe('127.0.0.1')
  })

  it('n’invente rien en l’absence d’en-tête', async () => {
    expect(await ipRetenue(null)).toBe('127.0.0.1')
  })

  it('ne lit que les en-têtes configurés', async () => {
    // `x-real-ip` n'est plus consulté : un en-tête lu sans proxy qui le pose est
    // un en-tête que n'importe qui peut écrire.
    enTetes = new Headers({ 'x-real-ip': '8.8.8.8' })

    await journaliser({
      userId: 'u1',
      utilisateurNom: 'Camille Roy',
      action: 'Connexion',
      module: 'admin',
    })

    const appel = creer.mock.calls.at(-1)?.[0] as { data: { ip: string | null } }
    expect(appel.data.ip).not.toBe('8.8.8.8')
  })
})

describe('Une écriture impossible n’interrompt jamais l’appelant', () => {
  it('avale la panne de la table de journal', async () => {
    creer.mockReset()
    creer.mockRejectedValue(new Error('table indisponible'))
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      journaliser({
        userId: 'u1',
        utilisateurNom: 'Camille Roy',
        action: 'Connexion',
        module: 'admin',
      }),
    ).resolves.toBeUndefined()

    expect(console_).toHaveBeenCalled()
    console_.mockRestore()
  })
})
