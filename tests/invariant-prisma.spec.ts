import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Test de garde — INVARIANT N°2 DU PROJET.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Aucun appel Prisma n'est écrit hors de `src/lib/data/`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les invariants n°1 et n°3 avaient chacun leur garde ; celui-ci n'en avait
 * aucune. `tests/cloisonnement.spec.ts` vérifie la LISTE des modèles cloisonnés,
 * jamais le LIEU des appels. La règle a donc tenu par discipline — et cédé dans
 * la banque de CV, écrite avant que les gardes n'existent.
 *
 * L'intérêt de la règle est qu'il n'y ait **qu'un seul dossier à auditer** quand
 * on se demande qui peut lire quoi. Une requête posée dans une page ou dans une
 * action échappe à cet audit sans rien casser : elle fonctionne parfaitement.
 *
 * L'analyse est statique : `lib/data/`, `lib/prisma.ts` et les actions sont
 * marqués `server-only`, vitest ne peut pas les importer. Le test lit le texte
 * source, il ne l'exécute pas.
 */

const RACINE = join(process.cwd(), 'src')

/**
 * Fichiers dispensés, avec leur raison. Toute entrée ajoutée ici est un aveu :
 * la liste ne doit contenir que de l'infrastructure, jamais du code métier.
 */
const LISTE_BLANCHE = new Map<string, string>([
  [
    'src/lib/prisma.ts',
    'Définit le client et l’extension de cloisonnement : c’est la source, pas un appelant.',
  ],
  [
    'src/lib/audit.ts',
    'Écriture d’infrastructure appelée par la fabrique d’actions elle-même, jamais par un écran.',
  ],
  [
    'src/lib/auth.ts',
    'Better Auth reçoit le client en adaptateur et horodate la connexion dans son propre crochet.',
  ],
])

/** Retire commentaires et chaînes : évite les faux positifs sur un exemple en commentaire. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

/**
 * Opérations de requête du client Prisma. La liste est explicite : un simple
 * `\.\w+\(` attraperait la moitié du dépôt.
 */
const OPERATIONS = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
].join('|')

/**
 * `<quelque chose>.<modele>.<operation>(` — la forme de tout appel Prisma.
 *
 * Le nom du porteur n'est pas contraint à `prisma` : `db.client.findMany(` sur
 * un client cadré reçu en paramètre est exactement la même violation.
 */
const APPEL_MODELE = new RegExp(
  String.raw`\b[A-Za-z_$][\w$]*\.([a-z][\w$]*)\.(${OPERATIONS})\s*\(`,
  'g',
)

/** Méthodes de niveau client : elles n'ont pas de segment de modèle. */
const APPEL_CLIENT =
  /\.\$(transaction|queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe|connect|disconnect|extends)\b/g

function fichiersSource(racine: string, base = ''): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const relatif = base ? `${base}/${entree.name}` : entree.name
    // `src/generated/prisma` est produit par `prisma generate` — il EST le client.
    if (entree.isDirectory()) {
      if (relatif === 'generated') continue
      trouves.push(...fichiersSource(join(racine, entree.name), relatif))
    } else if (/\.tsx?$/.test(entree.name)) {
      trouves.push(`src/${relatif}`)
    }
  }
  return trouves.sort()
}

/**
 * Imports donnant accès au client, cherchés sur la source BRUTE.
 *
 * Piège déjà rencontré dans ce dépôt : `nettoyer` remplace les chaînes, donc un
 * chemin d'import cherché après nettoyage a purement disparu.
 *
 * `prismaCadre` n'est PAS signalé : les pages du CRM et du calculateur le
 * construisent pour le passer à `lib/data/`, c'est l'architecture prévue. Le
 * client qu'il renvoie reste couvert — toute requête écrite dessus tombe sous
 * `APPEL_MODELE`.
 */
function importsInterdits(brut: string): string[] {
  const trouves: string[] = []

  for (const decl of brut.matchAll(/import\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, motType, specificateurs = '', chemin = ''] = decl
    const typeSeul = Boolean(motType)

    const noms = (specificateurs.match(/\{([\s\S]*)\}/)?.[1] ?? specificateurs)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (chemin.startsWith('@/generated/prisma')) {
      // Un import de type est effacé à la compilation : il ne porte aucune
      // capacité de requête. Les enums de statut circulent ainsi partout.
      if (typeSeul) continue
      if (noms.length === 0 || noms.some((n) => !n.startsWith('type '))) trouves.push(chemin)
      continue
    }

    if (chemin === '@/lib/prisma' && !typeSeul) {
      if (noms.some((n) => n === 'prisma' || n === 'PrismaClient')) trouves.push(chemin)
    }
  }

  return trouves
}

function appelsPrisma(code: string): string[] {
  return [
    ...[...code.matchAll(APPEL_MODELE)].map((m) => `${m[1]}.${m[2]}()`),
    ...[...code.matchAll(APPEL_CLIENT)].map((m) => `$${m[1]}()`),
  ]
}

const fichiers = fichiersSource(RACINE)

describe('Aucun appel Prisma hors de lib/data — invariant n°2', () => {
  it('le balayage voit réellement des fichiers', () => {
    // Sans ce contrôle, un chemin de racine erroné ferait passer tout le reste
    // en ne parcourant rien.
    expect(fichiers.length, 'Aucun fichier .ts/.tsx sous src/').toBeGreaterThan(50)
    expect(fichiers).toContain('src/lib/actions/cv.ts')
  })

  it('aucun fichier hors de lib/data n’écrit de requête Prisma', () => {
    const fautifs = fichiers
      .filter((f) => !f.startsWith('src/lib/data/') && !LISTE_BLANCHE.has(f))
      .map((f) => ({
        f,
        appels: appelsPrisma(nettoyer(readFileSync(join(process.cwd(), f), 'utf8'))),
      }))
      .filter(({ appels }) => appels.length > 0)
      .map(({ f, appels }) => `${f} → ${appels.join(', ')}`)

    expect(
      fautifs,
      `Ces fichiers appellent Prisma hors de lib/data/ — déplacez la requête dans lib/data/ :\n${fautifs.join('\n')}`,
    ).toEqual([])
  })

  it('aucun fichier hors de lib/data n’importe le client Prisma', () => {
    const fautifs = fichiers
      .filter((f) => !f.startsWith('src/lib/data/') && !LISTE_BLANCHE.has(f))
      .map((f) => ({ f, imports: importsInterdits(readFileSync(join(process.cwd(), f), 'utf8')) }))
      .filter(({ imports }) => imports.length > 0)
      .map(({ f, imports }) => `${f} → ${imports.join(', ')}`)

    expect(
      fautifs,
      `Ces fichiers importent le client Prisma hors de lib/data/ :\n${fautifs.join('\n')}`,
    ).toEqual([])
  })

  it('chaque exception existe encore et sert encore', () => {
    // Une exception devenue inutile doit disparaître : la laisser rouvrirait la
    // porte le jour où quelqu'un remettrait une requête dans ce fichier.
    const inutiles = [...LISTE_BLANCHE.keys()].filter((f) => {
      if (!fichiers.includes(f)) return true
      const brut = readFileSync(join(process.cwd(), f), 'utf8')
      return appelsPrisma(nettoyer(brut)).length === 0 && importsInterdits(brut).length === 0
    })

    expect(
      inutiles,
      `Ces exceptions n’ont plus lieu d’être — retirez-les de la liste blanche : ${inutiles.join(', ')}`,
    ).toEqual([])
  })

  it('chaque exception porte une raison écrite', () => {
    const muettes = [...LISTE_BLANCHE]
      .filter(([, raison]) => raison.trim().length < 20)
      .map(([f]) => f)
    expect(muettes, `Exceptions sans justification — ${muettes.join(', ')}`).toEqual([])
  })

  it('la liste blanche ne contient que de l’infrastructure', () => {
    // `lib/actions/`, `app/` et `components/` ne peuvent jamais y figurer : ce
    // sont précisément les endroits que l'invariant protège.
    const interdits = [...LISTE_BLANCHE.keys()].filter(
      (f) =>
        f.startsWith('src/lib/actions/') ||
        f.startsWith('src/app/') ||
        f.startsWith('src/components/'),
    )
    expect(interdits, `Exceptions inacceptables — ${interdits.join(', ')}`).toEqual([])
  })
})

describe('Le test de garde peut échouer', () => {
  /**
   * Un test qui ne peut pas échouer ne sert à rien. Ce volet vérifie la
   * détection sur des extraits fabriqués, sans toucher aux vrais fichiers.
   */
  it('détecte une requête posée dans une page', () => {
    const faux = nettoyer(`
      const c = await prisma.categorieCv.findUnique({ where: { id } })
    `)
    expect(appelsPrisma(faux)).toEqual(['categorieCv.findUnique()'])
  })

  it('détecte une requête sur un client cadré reçu en paramètre', () => {
    const faux = nettoyer(`const clients = await db.client.findMany({})`)
    expect(appelsPrisma(faux)).toEqual(['client.findMany()'])
  })

  it('détecte une transaction et une requête brute', () => {
    const faux = nettoyer(`
      await prisma.$transaction([])
      await prisma.$executeRawUnsafe(requete)
    `)
    expect(appelsPrisma(faux)).toEqual(['$transaction()', '$executeRawUnsafe()'])
  })

  it('détecte l’import du client', () => {
    expect(importsInterdits(`import { prisma } from '@/lib/prisma'`)).toEqual(['@/lib/prisma'])
    expect(importsInterdits(`import { PrismaClient } from '@/generated/prisma/client'`)).toEqual([
      '@/generated/prisma/client',
    ])
  })

  it('laisse passer la fabrique cadrée et les imports de type', () => {
    // Les pages du CRM construisent `prismaCadre(slug)` pour le passer à
    // `lib/data/` : c'est l'architecture, pas une entorse.
    expect(importsInterdits(`import { prismaCadre, cadre } from '@/lib/prisma'`)).toEqual([])
    expect(importsInterdits(`import type { PrismaCadre } from '@/lib/prisma'`)).toEqual([])
    expect(
      importsInterdits(`import type { StatutClient } from '@/generated/prisma/client'`),
    ).toEqual([])
  })

  it('ignore une requête citée en commentaire ou en chaîne', () => {
    const faux = nettoyer(`
      // await prisma.fichierCv.deleteMany({})
      const exemple = "prisma.fichierCv.deleteMany({})"
    `)
    expect(appelsPrisma(faux)).toEqual([])
  })

  it('ne confond pas un appel ordinaire avec une requête', () => {
    const faux = nettoyer(`
      const d = new Intl.DateTimeFormat('fr-CA').format(new Date())
      form.handleSubmit(onSubmit)
      donnees.categories.map((c) => c.nom)
    `)
    expect(appelsPrisma(faux)).toEqual([])
  })

  it('justifie de chercher les imports sur la source brute', () => {
    // `nettoyer` remplace les chaînes : après nettoyage, le chemin d'import
    // n'existe plus. Chercher là serait un test qui ne détecte jamais rien.
    const source = `import { prisma } from '@/lib/prisma'`
    expect(nettoyer(source)).not.toContain('@/lib/prisma')
    expect(importsInterdits(source)).toEqual(['@/lib/prisma'])
  })
})
