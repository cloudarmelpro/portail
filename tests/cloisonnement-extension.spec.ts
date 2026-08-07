import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ENTREPRISES, type EntrepriseSlug } from '@/config/entreprises'

/**
 * L'extension de cloisonnement, EXÉCUTÉE — et non plus seulement relue.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce que `tests/cloisonnement.spec.ts` prouve, et ce qu'il ne prouve pas.
 *
 * Il compare le schéma à `MODELES_CLOISONNES` par analyse textuelle : il
 * garantit que la LISTE est complète. Il ne garantit rien sur ce que
 * l'extension FAIT de cette liste. Si quelqu'un remplaçait le corps de
 * `$allOperations` par `return query(args)`, la liste resterait exacte, le test
 * resterait vert, et le cloisonnement aurait disparu.
 *
 * Le mode de panne est silencieux : l'identifiant est unique, la requête
 * aboutit, et un client de Paysagement s'affiche dans le dossier Développement
 * web. Rien ne lève.
 *
 * Ce fichier ferme ce trou. `lib/prisma.ts` est `server-only` et ouvre un pool
 * PostgreSQL au chargement : on neutralise ces deux obstacles par `vi.mock`, et
 * on branche un FAUX client Prisma dont le seul rôle est d'enregistrer les
 * arguments que l'extension transmet au moteur.
 *
 * Le code testé est le vrai : `prismaCadre` est importé de `src/lib/prisma.ts`.
 * Seule la couche qui parlerait au réseau est remplacée.
 * ─────────────────────────────────────────────────────────────────────────
 */

type Args = Record<string, unknown>

type Extension = {
  query: {
    $allModels: {
      $allOperations: (parametres: {
        model: string
        operation: string
        args: Args
        query: (args: Args) => Promise<unknown>
      }) => Promise<unknown>
    }
  }
}

/**
 * `vi.hoisted` : la fabrique de `vi.mock` est remontée au-dessus des imports,
 * elle ne peut donc pas fermer sur une constante déclarée plus bas.
 */
const espion = vi.hoisted(() => ({
  appels: [] as { model: string; operation: string; args: Record<string, unknown> }[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/env', () => ({
  env: { DATABASE_URL: 'postgres://faux/base', NODE_ENV: 'test' },
}))

vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class PrismaPgFactice {} }))

/**
 * Faux client Prisma.
 *
 * `$extends` reproduit le contrat documenté de `$allOperations` : le nom du
 * modèle en PascalCase, le nom de l'opération, les arguments, et un `query` qui
 * représente le moteur. On enregistre ce que `query` reçoit — c'est-à-dire ce
 * que la base verrait réellement.
 */
vi.mock('@/generated/prisma/client', () => {
  class PrismaClient {
    $extends(extension: Extension) {
      return new Proxy(
        {},
        {
          get(_cible, accesseur: string) {
            const model = accesseur.charAt(0).toUpperCase() + accesseur.slice(1)
            return new Proxy(
              {},
              {
                get(_modele, operation: string) {
                  return (args: Args = {}) =>
                    extension.query.$allModels.$allOperations({
                      model,
                      operation,
                      args,
                      query: (finaux: Args) => {
                        espion.appels.push({ model, operation, args: finaux })
                        return Promise.resolve(null)
                      },
                    })
                },
              },
            )
          },
        },
      )
    }
  }
  return { PrismaClient }
})

const { MODELES_CLOISONNES, prismaCadre } = await import('@/lib/prisma')

/** Le client cadré, vu comme une table d'opérations — le typage Prisma réel n'admettrait pas un appel générique. */
type ClientFactice = Record<string, Record<string, (args?: Args) => Promise<unknown>>>

function cadre(slug: EntrepriseSlug): ClientFactice {
  return prismaCadre(slug) as unknown as ClientFactice
}

/** Nom d'accès Prisma d'un modèle : `LigneEstimation` → `ligneEstimation`. */
function accesseurDe(modele: string): string {
  return modele.charAt(0).toLowerCase() + modele.slice(1)
}

async function executer(
  slug: EntrepriseSlug,
  modele: string,
  operation: string,
  args: Args = {},
): Promise<Args> {
  espion.appels.length = 0
  await cadre(slug)[accesseurDe(modele)][operation](args)
  const appel = espion.appels.at(-1)
  if (!appel) throw new Error(`Le faux moteur n'a reçu aucun appel pour ${modele}.${operation}.`)
  return appel.args
}

/** Tous les modèles du schéma, pour éprouver aussi ceux qui NE sont PAS cloisonnés. */
function modelesDuSchema(): string[] {
  const dossier = join(process.cwd(), 'prisma', 'schema')
  const noms: string[] = []
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.prisma'))) {
    const source = readFileSync(join(dossier, fichier), 'utf8').replace(/^\s*\/\/.*$/gm, '')
    for (const bloc of source.matchAll(/model\s+(\w+)\s*\{/g)) noms.push(bloc[1] as string)
  }
  return noms.sort()
}

const CLOISONNES = [...MODELES_CLOISONNES].sort()
const LIBRES = modelesDuSchema().filter((m) => !MODELES_CLOISONNES.has(m))

/** Opérations dont la condition passe par `where`. */
const OPERATIONS_WHERE = [
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
] as const

beforeEach(() => {
  espion.appels.length = 0
})

describe('Le faux moteur observe bien ce que la base verrait', () => {
  it('reçoit un appel par opération, avec ses arguments finaux', async () => {
    // Sans cette garantie, tous les contrôles ci-dessous passeraient à vide.
    const args = await executer('paysagement', 'Client', 'findMany', { take: 5 })
    expect(args.take).toBe(5)
    expect(espion.appels).toHaveLength(1)
  })

  it('le schéma est lu : il y a des modèles des deux côtés', async () => {
    expect(CLOISONNES.length).toBeGreaterThan(0)
    expect(LIBRES.length).toBeGreaterThan(0)
  })
})

describe('Modèles cloisonnés — la condition est injectée, sans exception', () => {
  for (const modele of CLOISONNES) {
    describe(modele, () => {
      for (const operation of OPERATIONS_WHERE) {
        it(`${operation} porte la condition d'entreprise`, async () => {
          const args = await executer('paysagement', modele, operation, {})
          expect(args.where).toEqual({ entrepriseSlug: 'paysagement' })
        })
      }

      it('la condition accompagne l’identifiant, elle ne le remplace pas', async () => {
        const args = await executer('developpement', modele, 'findFirst', {
          where: { id: 'x1', deletedAt: null },
        })
        expect(args.where).toEqual({
          id: 'x1',
          deletedAt: null,
          entrepriseSlug: 'developpement',
        })
      })

      it('create impose le slug dans les données', async () => {
        const args = await executer('staff', modele, 'create', { data: { nom: 'Essai' } })
        expect(args.data).toEqual({ nom: 'Essai', entrepriseSlug: 'staff' })
      })

      it('createMany impose le slug sur chaque ligne', async () => {
        const args = await executer('staff', modele, 'createMany', {
          data: [{ ordre: 0 }, { ordre: 1 }],
        })
        expect(args.data).toEqual([
          { ordre: 0, entrepriseSlug: 'staff' },
          { ordre: 1, entrepriseSlug: 'staff' },
        ])
      })

      it('upsert cadre à la fois la recherche et la création', async () => {
        const args = await executer('paysagement', modele, 'upsert', {
          where: { id: 'x1' },
          create: { nom: 'Essai' },
          update: { nom: 'Essai' },
        })
        expect(args.where).toEqual({ id: 'x1', entrepriseSlug: 'paysagement' })
        expect(args.create).toEqual({ nom: 'Essai', entrepriseSlug: 'paysagement' })
        // `update` n'a pas à porter le slug : la ligne visée est déjà cadrée par `where`.
        expect(args.update).toEqual({ nom: 'Essai' })
      })
    })
  }

  it('createManyAndReturn est cadré comme createMany', async () => {
    const args = await executer('staff', 'Client', 'createManyAndReturn', {
      data: [{ nom: 'A' }],
    })
    expect(args.data).toEqual([{ nom: 'A', entrepriseSlug: 'staff' }])
  })

  it('createMany accepte aussi une donnée unique', async () => {
    const args = await executer('staff', 'Client', 'createMany', { data: { nom: 'A' } })
    expect(args.data).toEqual({ nom: 'A', entrepriseSlug: 'staff' })
  })
})

describe('Le périmètre demandé par l’appelant ne fait jamais loi', () => {
  /**
   * Le cas qui compte vraiment. Le slug vient de l'URL ; un appelant — ou un
   * `where` recopié d'un autre module — peut désigner une autre entreprise.
   * L'extension doit écraser, pas fusionner.
   */
  it('un entrepriseSlug écrit dans le where est écrasé par celui du cadre', async () => {
    const args = await executer('paysagement', 'Client', 'findFirst', {
      where: { id: 'c1', entrepriseSlug: 'developpement' },
    })
    expect(args.where).toEqual({ id: 'c1', entrepriseSlug: 'paysagement' })
  })

  it('un entrepriseSlug écrit dans les données d’un create est écrasé', async () => {
    const args = await executer('paysagement', 'Estimation', 'create', {
      data: { reference: 'PAY-2026-001', entrepriseSlug: 'staff' },
    })
    expect(args.data).toEqual({ reference: 'PAY-2026-001', entrepriseSlug: 'paysagement' })
  })

  it('une suppression de masse sans where reste cadrée', async () => {
    // `deleteMany({})` sur un modèle cloisonné viderait les trois entreprises.
    const args = await executer('staff', 'Interaction', 'deleteMany', {})
    expect(args.where).toEqual({ entrepriseSlug: 'staff' })
  })

  it('deux cadres coexistent sans se contaminer', async () => {
    const pays = cadre('paysagement')
    const dev = cadre('developpement')

    espion.appels.length = 0
    await pays.client.findMany({ where: { statut: 'prospect' } })
    await dev.client.findMany({ where: { statut: 'prospect' } })
    await pays.client.findMany({ where: { statut: 'prospect' } })

    expect(espion.appels.map((a) => (a.args.where as Args).entrepriseSlug)).toEqual([
      'paysagement',
      'developpement',
      'paysagement',
    ])
  })

  it('chaque entreprise du fichier de configuration produit son propre cadre', async () => {
    for (const e of ENTREPRISES) {
      const args = await executer(e.slug, 'Client', 'findMany', {})
      expect(args.where).toEqual({ entrepriseSlug: e.slug })
    }
  })

  it('un slug inconnu ne produit aucun client', () => {
    // Dernière ligne de défense : le slug vient de l'URL.
    expect(() => prismaCadre('concurrent' as EntrepriseSlug)).toThrow()
    expect(() => prismaCadre('' as EntrepriseSlug)).toThrow()
  })
})

describe('Modèles non cloisonnés — l’extension ne touche à rien', () => {
  /**
   * Le sur-cloisonnement est un défaut symétrique : `Employe` doit rester visible
   * des trois entreprises dans la grille hebdomadaire (HEU-2), et le journal
   * d'audit doit rester transverse (ADM-4). Une injection ici viderait ces écrans
   * sans message d'erreur.
   */
  for (const modele of LIBRES) {
    it(`${modele} traverse l’extension inchangé`, async () => {
      const args = await executer('paysagement', modele, 'findMany', {
        where: { actif: true },
      })
      expect(args).toEqual({ where: { actif: true } })
    })
  }

  it('un create sur un modèle libre ne reçoit pas de slug', async () => {
    const args = await executer('paysagement', 'Employe', 'create', {
      data: { nom: 'Camille' },
    })
    expect(args.data).toEqual({ nom: 'Camille' })
  })
})

describe('Le test peut échouer', () => {
  /**
   * Un test qui ne peut pas échouer ne prouve rien. On rejoue ici la même
   * observation sur une extension VIDE — celle qu'obtiendrait quelqu'un qui
   * remplacerait le corps de `$allOperations` par `return query(args)`.
   */
  it('détecte une extension qui laisse passer les requêtes sans cadrer', async () => {
    const recu: Args[] = []
    const extensionInerte: Extension = {
      query: { $allModels: { $allOperations: ({ args, query }) => query(args) } },
    }

    await extensionInerte.query.$allModels.$allOperations({
      model: 'Client',
      operation: 'findFirst',
      args: { where: { id: 'c1' } },
      query: (a) => {
        recu.push(a)
        return Promise.resolve(null)
      },
    })

    expect(recu[0]?.where).toEqual({ id: 'c1' })
    expect((recu[0]?.where as Args).entrepriseSlug).toBeUndefined()
  })

  it('l’assertion utilisée plus haut refuserait ce résultat', async () => {
    const reel = await executer('paysagement', 'Client', 'findFirst', { where: { id: 'c1' } })
    expect(reel.where).not.toEqual({ id: 'c1' })
  })
})

/**
 * Deux chemins échappent structurellement à l'extension. Aucun n'est utilisé
 * aujourd'hui ; ces contrôles empêchent qu'ils le deviennent sans décision.
 */
describe('Les chemins qui contourneraient l’extension restent fermés', () => {
  const SOURCES = ['crm.ts', 'estimations.ts', 'admin.ts', 'cv.ts', 'heures.ts']

  function lireData(fichier: string): string {
    return readFileSync(join(process.cwd(), 'src', 'lib', 'data', fichier), 'utf8')
  }

  it.each(SOURCES)('lib/data/%s n’exécute aucune requête brute', (fichier) => {
    /**
     * `$queryRaw` et `$executeRaw` ne passent par aucun modèle : `$allOperations`
     * ne les voit jamais. Une requête brute sur une table cloisonnée sortirait du
     * périmètre sans que rien ne le signale.
     */
    const source = lireData(fichier)
    expect(source).not.toContain('$queryRaw')
    expect(source).not.toContain('$executeRaw')
  })

  it.each(['crm.ts', 'estimations.ts'])(
    'lib/data/%s n’écrit aucune relation imbriquée',
    (fichier) => {
      /**
       * Une écriture imbriquée — `data: { lignes: { create: [...] } }` — crée des
       * lignes filles que l'extension ne voit pas : elle n'intercepte que
       * l'opération de premier niveau. Sur un modèle cloisonné, ces filles
       * naîtraient sans entreprise.
       */
      const source = lireData(fichier)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source).not.toContain('connectOrCreate')
      expect(source).not.toMatch(/\bcreate:\s*[[{]/)
    },
  )
})
