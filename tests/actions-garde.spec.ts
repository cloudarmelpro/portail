import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Test de garde — INVARIANT N°1 DU PROJET.
 *
 * Il parcourt `src/lib/actions/` et échoue si une fonction exportée ne passe pas
 * par `createAction`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi ce test existe.
 *
 * Un Server Action ne traverse pas les layouts : il est exposé comme un point
 * d'entrée HTTP autonome, appelable par quiconque connaît son identifiant. Un
 * layout qui vérifie le rôle ne protège que l'affichage.
 *
 * La fabrique impose permission, validation et journal. La règle « toute action
 * passe par la fabrique » est donc la seule chose à garantir — et une règle qui
 * dépend de la mémoire du développeur n'est pas une architecture.
 *
 * Ce test la transforme en contrainte tenue par l'intégration continue.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'analyse est statique : importer ces modules déclencherait `server-only`,
 * la connexion Prisma et la validation de l'environnement. Le compromis est
 * assumé — le test lit le texte source, il ne l'exécute pas.
 */

const DOSSIER = join(process.cwd(), 'src', 'lib', 'actions')

function fichiersActions(): string[] {
  try {
    return readdirSync(DOSSIER)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
      .sort()
  } catch {
    return []
  }
}

/** Retire commentaires et chaînes : évite les faux positifs sur un exemple en commentaire. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

/**
 * Les deux seules fabriques. `createActionCloisonnee` ajoute le cadrage par
 * entreprise ; elle impose les mêmes garanties, plus une.
 *
 * L'ancrage `^` et la parenthèse fermante comptent : sans eux, une fonction
 * maison nommée `createActionMaison(` passerait le contrôle.
 */
const FABRIQUE = /^createAction(?:Cloisonnee)?\(/

const fichiers = fichiersActions()

describe('Fabrique d’actions — invariant n°1', () => {
  it('le dossier lib/actions existe', () => {
    expect(fichiers.length, 'Aucun fichier dans src/lib/actions/').toBeGreaterThan(0)
  })

  describe.each(fichiers)('%s', (fichier) => {
    const brut = readFileSync(join(DOSSIER, fichier), 'utf8')
    const code = nettoyer(brut)

    it('déclare "use server" en tête', () => {
      expect(
        brut.trimStart().startsWith(`'use server'`) || brut.trimStart().startsWith(`"use server"`),
      ).toBe(true)
    })

    it('n’exporte aucune fonction écrite à la main', () => {
      const interdits = [
        ...code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g),
        ...code.matchAll(/export\s+default\s/g),
        // `export const x = async (…)` contourne aussi la fabrique.
        ...code.matchAll(/export\s+const\s+(\w+)\s*(?::[^=]*)?=\s*async\s*\(/g),
      ].map((m) => m[1] ?? 'export default')

      expect(
        interdits,
        `${fichier} : ces exports contournent createAction — ${interdits.join(', ')}`,
      ).toEqual([])
    })

    it('n’exporte que des actions issues de createAction', () => {
      const exports_ = [...code.matchAll(/export\s+const\s+(\w+)\s*=\s*([\s\S]{0,40})/g)]
      const horsFabrique = exports_
        .filter(([, , suite]) => !FABRIQUE.test(suite.trimStart()))
        .map(([, nom]) => nom)

      expect(
        horsFabrique,
        `${fichier} : exports ne passant pas par createAction — ${horsFabrique.join(', ')}`,
      ).toEqual([])
    })

    it('importe createAction', () => {
      // Sur la source BRUTE : `nettoyer` remplace les chaînes, donc le chemin
      // d'import disparaîtrait avant d'être cherché.
      expect(brut).toContain('@/lib/safe-action')
    })
  })
})

/**
 * Second volet : aucun fichier `'use server'` ne doit exister hors de
 * `lib/actions/`, sauf exception justifiée.
 *
 * Sans ce contrôle, la garde précédente serait contournable en posant une
 * mutation n'importe où ailleurs dans `src/`.
 */
const LISTE_BLANCHE = new Set([
  // Déconnexion : aucune permission associée — l'exiger créerait un compte
  // incapable de partir. Justification complète en tête du fichier.
  'src/lib/session-actions.ts',
])

function fichiersUseServer(racine: string, base = ''): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const relatif = base ? `${base}/${entree.name}` : entree.name
    const complet = join(racine, entree.name)
    if (entree.isDirectory()) {
      trouves.push(...fichiersUseServer(complet, relatif))
    } else if (/\.tsx?$/.test(entree.name)) {
      const source = readFileSync(complet, 'utf8').trimStart()
      if (source.startsWith(`'use server'`) || source.startsWith(`"use server"`)) {
        trouves.push(`src/${relatif}`)
      }
    }
  }
  return trouves
}

describe('Aucune action hors de lib/actions', () => {
  it('tout fichier "use server" est dans lib/actions ou explicitement justifié', () => {
    const fichiersServeur = fichiersUseServer(join(process.cwd(), 'src'))
    const horsCadre = fichiersServeur.filter(
      (f) => !f.startsWith('src/lib/actions/') && !LISTE_BLANCHE.has(f),
    )

    expect(
      horsCadre,
      `Ces fichiers déclarent "use server" hors de lib/actions/ sans justification — ${horsCadre.join(', ')}`,
    ).toEqual([])
  })
})

describe('Le test de garde peut échouer', () => {
  /**
   * Un test qui ne peut pas échouer ne sert à rien. Celui-ci vérifie que la
   * détection fonctionne, sur un extrait fabriqué — sans toucher aux vrais
   * fichiers.
   */
  it('détecte une fonction exportée à la main', () => {
    const faux = nettoyer(`'use server'
      export async function supprimerTout() { return null }
    `)
    const trouves = [...faux.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1])
    expect(trouves).toEqual(['supprimerTout'])
  })

  it('détecte un export qui ne passe pas par la fabrique', () => {
    const faux = nettoyer(`'use server'
      export const contournement = async (x) => x
    `)
    const trouves = [...faux.matchAll(/export\s+const\s+(\w+)\s*(?::[^=]*)?=\s*async\s*\(/g)].map(
      (m) => m[1],
    )
    expect(trouves).toEqual(['contournement'])
  })

  it('accepte les deux fabriques et rien d’autre', () => {
    expect(FABRIQUE.test('createAction({')).toBe(true)
    expect(FABRIQUE.test('createActionCloisonnee({')).toBe(true)
    // Une fabrique maison au nom voisin ne doit pas passer.
    expect(FABRIQUE.test('createActionMaison({')).toBe(false)
    expect(FABRIQUE.test('monCreateAction({')).toBe(false)
  })
})
