import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `PROXYS_DE_CONFIANCE` — la variable dont l'absence ne se voyait pas.
 *
 * Sans elle, Better Auth renonce à lire `x-forwarded-for` dès qu'il porte plus
 * d'une entrée, et son limiteur retombe sur un seul seau par chemin : le plafond
 * de cinq tentatives de TR-2 devient celui de toute l'application. La seule trace
 * était un avertissement dans le journal du serveur. En production, l'application
 * doit refuser de démarrer — c'est déjà la règle du fichier pour tout le reste.
 */

vi.mock('server-only', () => ({}))

const BASE: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@ep-x-pooler.neon.tech/db?sslmode=verify-full',
  DIRECT_URL: 'postgresql://u:p@ep-x.neon.tech/db?sslmode=verify-full',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_REGION: 'auto',
  STORAGE_ACCESS_KEY_ID: 'cle',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
  STORAGE_BUCKET_CV: 'cv',
}

/** Recharge `lib/env.ts` avec un environnement donné. */
async function charger(surcharges: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [cle, valeur] of Object.entries({ ...BASE, ...surcharges })) {
    vi.stubEnv(cle, valeur as string)
  }
  return import('@/lib/env')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('En production, l’absence est bruyante', () => {
  it('refuse de démarrer sans proxys déclarés', async () => {
    await expect(
      charger({ NODE_ENV: 'production', PROXYS_DE_CONFIANCE: undefined }),
    ).rejects.toThrow(/PROXYS_DE_CONFIANCE/)
  })

  it('démarre quand la liste est fournie', async () => {
    const { configurationIp } = await charger({
      NODE_ENV: 'production',
      PROXYS_DE_CONFIANCE: '172.16.0.0/12, 127.0.0.1/32',
    })

    expect(configurationIp.trustedProxies).toEqual(['172.16.0.0/12', '127.0.0.1/32'])
  })
})

describe('En développement, elle reste facultative', () => {
  it('retombe sur les plages privées plutôt que sur rien', async () => {
    const { configurationIp } = await charger({
      NODE_ENV: 'development',
      PROXYS_DE_CONFIANCE: undefined,
    })

    // Une liste vide ne serait pas un défaut prudent : c'est exactement l'état
    // qui fait retomber Better Auth sur un compteur commun.
    expect(configurationIp.trustedProxies.length).toBeGreaterThan(0)
    expect(configurationIp.trustedProxies).toContain('172.16.0.0/12')
  })
})

describe('Une liste mal formée ne passe pas', () => {
  it('nomme les entrées invalides', async () => {
    await expect(
      charger({ NODE_ENV: 'production', PROXYS_DE_CONFIANCE: '172.16.0.0/12,traefik,999.1.1.1' }),
    ).rejects.toThrow(/traefik.*999\.1\.1\.1|999\.1\.1\.1/)
  })

  it('accepte adresses seules, CIDR, IPv4 et IPv6', async () => {
    const { configurationIp } = await charger({
      NODE_ENV: 'production',
      PROXYS_DE_CONFIANCE: '10.0.0.0/8,127.0.0.1,::1/128,2001:db8::1',
    })

    expect(configurationIp.trustedProxies).toHaveLength(4)
  })
})

describe('En-têtes consultés', () => {
  it('s’en tient à x-forwarded-for par défaut', async () => {
    const { configurationIp } = await charger({ NODE_ENV: 'development', EN_TETES_IP: undefined })
    expect(configurationIp.ipAddressHeaders).toEqual(['x-forwarded-for'])
  })

  it('prépare le passage derrière Cloudflare sans le présumer', async () => {
    const { configurationIp } = await charger({
      NODE_ENV: 'production',
      PROXYS_DE_CONFIANCE: '172.16.0.0/12',
      EN_TETES_IP: 'cf-connecting-ip, x-forwarded-for',
    })

    expect(configurationIp.ipAddressHeaders).toEqual(['cf-connecting-ip', 'x-forwarded-for'])
  })
})
