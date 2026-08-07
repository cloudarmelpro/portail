import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Test de garde — INVARIANT N°2 DU PROJET.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tout modèle déclarant `entrepriseSlug` est cloisonné, sauf exception écrite.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'extension de `prismaCadre` n'agit que sur les modèles inscrits dans
 * `MODELES_CLOISONNES`. Ajouter un modèle au schéma en oubliant cette liste ne
 * produit AUCUNE erreur : les requêtes fonctionnent, elles ne filtrent
 * simplement plus. Le symptôme n'apparaît que le jour où deux entreprises ont
 * des données — c'est-à-dire trop tard.
 *
 * Ce test lit le schéma et compare. L'oubli devient un échec de test.
 *
 * L'analyse est textuelle des deux côtés. `lib/prisma.ts` est marqué
 * `server-only` : l'importer ici échouerait au chargement. Le test lit donc la
 * liste dans le source, exactement comme il lit le schéma.
 */

const DOSSIER = join(process.cwd(), 'prisma', 'schema')

/** Contenu de `MODELES_CLOISONNES`, lu dans le source plutôt qu'importé. */
function modelesCloisonnes(): Set<string> {
  const source = readFileSync(join(process.cwd(), 'src', 'lib', 'prisma.ts'), 'utf8')
  const bloc = source.match(/MODELES_CLOISONNES\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/)

  if (!bloc?.[1]) {
    throw new Error(
      'MODELES_CLOISONNES introuvable dans src/lib/prisma.ts — le test ne peut rien garantir.',
    )
  }

  // Les entrées commentées ne comptent pas : elles ne protègent rien.
  const corps = bloc[1].replace(/\/\/.*$/gm, '')
  return new Set([...corps.matchAll(/['"](\w+)['"]/g)].map((m) => m[1] as string))
}

const MODELES_CLOISONNES = modelesCloisonnes()

/**
 * Modèles portant `entrepriseSlug` SANS être cloisonnés. Chaque entrée exige
 * une raison — la liste est courte par construction, et une exception ajoutée
 * sans justification se voit en relecture.
 */
const EXCEPTIONS = new Map<string, string>([
  [
    'Employe',
    'La grille hebdomadaire présente les employés des trois entreprises en une ' +
      'seule vue (HEU-2). L’entreprise y regroupe, elle ne cloisonne pas.',
  ],
  [
    'AuditLog',
    'Le journal est transverse : l’administrateur doit pouvoir lire les entrées ' +
      'des trois entreprises sur un même écran (ADM-4).',
  ],
])

/** Modèles du schéma déclarant une colonne `entrepriseSlug`. */
function modelesAvecEntreprise(): string[] {
  const trouves: string[] = []

  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.prisma'))) {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
      // Les commentaires mentionnent souvent `entrepriseSlug` : sans ce
      // nettoyage, un modèle serait détecté pour une phrase le concernant.
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/^\s*\/\/\/.*$/gm, '')

    for (const bloc of source.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
      const [, nom, corps] = bloc
      if (!nom || !corps) continue
      if (/^\s*entrepriseSlug\s+String/m.test(corps)) trouves.push(nom)
    }
  }

  return trouves.sort()
}

describe('Cloisonnement par entreprise — invariant n°2', () => {
  const modeles = modelesAvecEntreprise()

  it('le schéma est lisible', () => {
    expect(
      modeles.length,
      'Aucun modèle avec entrepriseSlug — le schéma est-il lu ?',
    ).toBeGreaterThan(0)
  })

  it('tout modèle avec entrepriseSlug est cloisonné ou explicitement excepté', () => {
    const oublies = modeles.filter((m) => !MODELES_CLOISONNES.has(m) && !EXCEPTIONS.has(m))

    expect(
      oublies,
      `Ces modèles portent entrepriseSlug sans être dans MODELES_CLOISONNES — ${oublies.join(', ')}`,
    ).toEqual([])
  })

  it('aucun modèle cloisonné n’est absent du schéma', () => {
    // L'inverse compte autant : un nom mal orthographié dans la liste ne
    // protège rien, et rien ne le signale — `Set.has` renvoie simplement false.
    const fantomes = [...MODELES_CLOISONNES].filter((m) => !modeles.includes(m))

    expect(
      fantomes,
      `Ces modèles sont déclarés cloisonnés mais ne portent pas entrepriseSlug — ${fantomes.join(', ')}`,
    ).toEqual([])
  })

  it('aucune exception ne fait doublon avec la liste des cloisonnés', () => {
    const ambigus = [...EXCEPTIONS.keys()].filter((m) => MODELES_CLOISONNES.has(m))
    expect(ambigus, `Modèles à la fois exceptés et cloisonnés — ${ambigus.join(', ')}`).toEqual([])
  })
})

describe('Le test de cloisonnement peut échouer', () => {
  it('détecte un modèle portant entrepriseSlug', () => {
    const faux = `model Facture {
      id String @id
      entrepriseSlug String
    }`
    const noms = [...faux.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)]
      .filter(([, , corps]) => /^\s*entrepriseSlug\s+String/m.test(corps ?? ''))
      .map(([, nom]) => nom)

    expect(noms).toEqual(['Facture'])
  })

  it('lit réellement la liste du source', () => {
    // Si l'extraction renvoyait un ensemble vide, tous les contrôles ci-dessus
    // passeraient sans rien vérifier.
    expect(MODELES_CLOISONNES.size).toBeGreaterThan(0)
    expect(MODELES_CLOISONNES.has('Client')).toBe(true)
  })

  it('ignore un modèle qui ne fait que la mentionner en commentaire', () => {
    const faux = `model Note {
      id String @id
      // entrepriseSlug String — retiré, ce modèle n'est pas cloisonné
    }`.replace(/^\s*\/\/.*$/gm, '')

    const noms = [...faux.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)]
      .filter(([, , corps]) => /^\s*entrepriseSlug\s+String/m.test(corps ?? ''))
      .map(([, nom]) => nom)

    expect(noms).toEqual([])
  })
})
