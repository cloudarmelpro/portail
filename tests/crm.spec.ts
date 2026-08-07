import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ajouterInteractionSchema, changerStatutSchema } from '@/lib/validations/crm'

/**
 * Garde du CRM — premier usage réel du cloisonnement par entreprise.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le mode de panne redouté est SILENCIEUX.
 *
 * Charger un client par son seul `id` aboutit : l'identifiant est unique, la
 * requête réussit, et un client de Paysagement s'affiche dans le dossier
 * Développement web. Rien ne lève d'erreur, aucun test fonctionnel ne tombe.
 * Le symptôme n'apparaît que le jour où quelqu'un le remarque — c'est-à-dire
 * trop tard.
 *
 * Ce test vérifie que `lib/data/crm.ts` ne peut PHYSIQUEMENT pas sortir du
 * périmètre, faute d'avoir accès à un client Prisma non cadré.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'analyse est statique. `lib/data/crm.ts` est marqué `server-only` :
 * l'importer ici échouerait au chargement, comme dans `actions-garde.spec.ts`.
 * Le test lit le texte source, il ne l'exécute pas.
 */

function lire(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8')
}

/** Retire commentaires et chaînes : un exemple en commentaire n'est pas du code. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

const DATA_BRUT = lire('src', 'lib', 'data', 'crm.ts')
const DATA = nettoyer(DATA_BRUT)
const ACTIONS_BRUT = lire('src', 'lib', 'actions', 'crm.ts')
const ACTIONS = nettoyer(ACTIONS_BRUT)

describe('lib/data/crm.ts — le cadrage est structurel', () => {
  it('est marqué server-only', () => {
    expect(DATA_BRUT.trimStart().startsWith(`import 'server-only'`)).toBe(true)
  })

  it('n’importe jamais le client Prisma non cadré', () => {
    /**
     * Le seul import autorisé depuis `lib/prisma` est le TYPE `PrismaCadre`.
     * Importer `prisma` ou `prismaCadre` ici rendrait possible une requête hors
     * périmètre — exactement ce que le module doit interdire.
     */
    const imports = [...DATA.matchAll(/import\s+([\s\S]*?)\s+from\s+""/g)].map((m) => m[1] ?? '')
    const depuisPrisma = imports.filter((i) => i.includes('Prisma'))

    expect(
      depuisPrisma.length,
      'Aucun import de PrismaCadre — le fichier est-il lu ?',
    ).toBeGreaterThan(0)

    /*
      `cadre` est la seule valeur admise : c'est une conversion de type, sans
      accès à quoi que ce soit à l'exécution. Tout le reste doit être un `type` —
      un import de valeur depuis `lib/prisma` rendrait un client atteignable.
    */
    const AUTORISES = new Set(['cadre'])
    for (const bloc of depuisPrisma) {
      const valeurs = (bloc.match(/\{([^}]*)\}/)?.[1] ?? bloc)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('type '))

      const interdits = valeurs.filter((v) => !AUTORISES.has(v))
      expect(interdits, `Valeurs importées de lib/prisma : ${interdits.join(', ')}`).toEqual([])
    }

    expect(/\bimport\b[^\n]*\{[^}]*\bprisma\b[^}]*\}/.test(DATA)).toBe(false)
    expect(/\bimport\b[^\n]*\{[^}]*\bprismaCadre\b[^}]*\}/.test(DATA)).toBe(false)
  })

  it('toute fonction exportée reçoit le client cadré en premier argument', () => {
    const fonctions = [
      ...DATA.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g),
    ].map((m) => ({ nom: m[1] ?? '', args: (m[2] ?? '').trim() }))

    expect(
      fonctions.length,
      'Aucune fonction exportée trouvée — le fichier est-il lu ?',
    ).toBeGreaterThan(0)

    /**
     * Plus aucune exception : le jour civil, seule fonction du fichier qui ne
     * touchait pas la base, vit désormais dans `lib/domaine/dates.ts`.
     */
    const fautives = fonctions
      .filter((f) => !/^db\s*:\s*PrismaCadre\b/.test(f.args))
      .map((f) => f.nom)

    expect(
      fautives,
      `Ces fonctions n’exigent pas un client cadré — ${fautives.join(', ')}`,
    ).toEqual([])
  })

  it('n’écrit jamais entrepriseSlug dans une requête', () => {
    /**
     * L'extension l'injecte. Le doubler ici masquerait le jour où elle
     * cesserait d'agir : la requête continuerait de filtrer, et personne ne
     * verrait que la garde structurelle est morte.
     *
     * Aucune mention n'est tolérée. Le pont de typage `cadre` — qui promet la
     * colonne au compilateur sans jamais l'écrire — vit désormais dans
     * `lib/prisma.ts`, à côté de l'extension qui la remplit. Les trois modules
     * cloisonnés en avaient chacun leur copie.
     */
    const mentions = DATA.split('\n').filter((l) => l.includes('entrepriseSlug'))

    expect(mentions.length, `Mentions de entrepriseSlug — ${mentions.join(' | ')}`).toBe(0)
  })

  it('n’utilise jamais findUnique', () => {
    /**
     * L'extension ajoute `entrepriseSlug` au `where`, que `findUnique` refuse —
     * il n'accepte que des champs uniques. Un `findUnique` ici échouerait à
     * l'exécution, ou pire, serait « corrigé » en retirant le cadrage.
     */
    expect(DATA).not.toContain('findUnique')
  })
})

describe('lib/actions/crm.ts — toutes les actions sont cloisonnées', () => {
  it('n’importe aucun client Prisma', () => {
    // Les écritures passent par `lib/data/crm.ts`, qui reçoit `db` du contexte
    // de la fabrique. L'action n'a aucun client à elle.
    expect(ACTIONS_BRUT).not.toContain('@/lib/prisma')
  })

  it('chaque export passe par createActionCloisonnee', () => {
    const exports_ = [...ACTIONS.matchAll(/export\s+const\s+(\w+)\s*=\s*(\w+)/g)]
    expect(exports_.length, 'Aucune action exportée trouvée.').toBeGreaterThan(0)

    const horsFabrique = exports_.filter((m) => m[2] !== 'createActionCloisonnee').map((m) => m[1])

    expect(
      horsFabrique,
      `Ces actions du CRM ne sont pas cloisonnées — ${horsFabrique.join(', ')}`,
    ).toEqual([])
  })

  it('chaque action déclare d’où vient le slug d’entreprise', () => {
    const actions = [...ACTIONS.matchAll(/createActionCloisonnee\(/g)].length
    const declarations = [...ACTIONS.matchAll(/entrepriseDe\s*:/g)].length

    expect(declarations).toBe(actions)
  })
})

/**
 * Le slug vient de l'URL : il est saisi par l'utilisateur. Le passer
 * directement à `prismaCadre` reviendrait à laisser le visiteur choisir le
 * périmètre — `prismaCadre` lève sur un slug inconnu, mais l'écran serait alors
 * une panne, pas un refus.
 */
describe('Les pages du CRM valident le slug avant d’interroger la base', () => {
  const PAGES = [
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'layout.tsx'],
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'page.tsx'],
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'clients', 'page.tsx'],
    ['src', 'app', '(app)', 'crm', '[entreprise]', 'clients', '[client]', 'page.tsx'],
  ]

  for (const chemin of PAGES) {
    it(chemin.join('/'), () => {
      const source = lire(...chemin)
      expect(source).toContain('requireEntreprise')

      const indexGarde = source.indexOf('requireEntreprise(')
      const indexCadre = source.indexOf('prismaCadre(')
      if (indexCadre !== -1) expect(indexGarde).toBeLessThan(indexCadre)
    })
  }
})

/**
 * CRM-5 — le motif de clôture n'est pas une politesse d'interface.
 *
 * La boîte de dialogue peut être contournée : un Server Action est un point
 * d'entrée HTTP autonome. Le schéma est le seul endroit où l'exigence tienne
 * pour tout le monde, y compris pour un appel direct.
 */
describe('Le motif de clôture est exigé par le schéma, pas par l’écran', () => {
  const base = { entreprise: 'paysagement', clientId: 'c1', version: 0 }

  it('refuse le passage à Gagné sans motif', () => {
    const r = changerStatutSchema.safeParse({ ...base, statut: 'gagne', motifCloture: '' })
    expect(r.success).toBe(false)
  })

  it('refuse le passage à Perdu sans motif', () => {
    const r = changerStatutSchema.safeParse({ ...base, statut: 'perdu' })
    expect(r.success).toBe(false)
  })

  it('accepte un statut fermé accompagné de son motif', () => {
    const r = changerStatutSchema.safeParse({
      ...base,
      statut: 'perdu',
      motifCloture: 'Prix trop élevé',
    })
    expect(r.success).toBe(true)
  })

  it('n’exige aucun motif pour un statut ouvert', () => {
    const r = changerStatutSchema.safeParse({ ...base, statut: 'contacte' })
    expect(r.success).toBe(true)
  })

  it('refuse une entreprise inconnue avant même d’atteindre la fabrique', () => {
    const r = changerStatutSchema.safeParse({
      ...base,
      entreprise: 'concurrent',
      statut: 'contacte',
    })
    expect(r.success).toBe(false)
  })
})

describe('Les dates de relance sont des jours, pas des instants', () => {
  it('convertit une date de formulaire en minuit UTC', () => {
    const r = ajouterInteractionSchema.safeParse({
      entreprise: 'staff',
      clientId: 'c1',
      type: 'appel',
      date: '2026-08-03',
      resume: 'Appel de qualification.',
      prochaineAction: 'Relance téléphonique',
      prochaineActionLe: '2026-08-10',
    })

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.date.toISOString()).toBe('2026-08-03T00:00:00.000Z')
    expect(r.data.prochaineActionLe?.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('refuse une prochaine action sans date — elle ne remonterait dans aucun tableau', () => {
    const r = ajouterInteractionSchema.safeParse({
      entreprise: 'staff',
      clientId: 'c1',
      type: 'appel',
      date: '2026-08-03',
      resume: 'Appel de qualification.',
      prochaineAction: 'Relance téléphonique',
      prochaineActionLe: '',
    })
    expect(r.success).toBe(false)
  })
})

describe('Le test de cloisonnement peut échouer', () => {
  it('détecte une fonction sans client cadré', () => {
    const faux = nettoyer(`
      export async function listerTout(recherche: string) { return null }
    `)
    const trouvees = [...faux.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)]
      .filter((m) => !/^db\s*:\s*PrismaCadre\b/.test((m[2] ?? '').trim()))
      .map((m) => m[1])

    expect(trouvees).toEqual(['listerTout'])
  })

  it('détecte un import du client Prisma non cadré', () => {
    const faux = nettoyer(`import { prisma } from '@/lib/prisma'`)
    expect(/\bimport\b[^\n]*\{[^}]*\bprisma\b[^}]*\}/.test(faux)).toBe(true)
  })

  it('détecte un entrepriseSlug écrit à la main', () => {
    const faux = nettoyer(`db.client.findFirst({ where: { id, entrepriseSlug: slug } })`)
    expect(faux.split('\n').filter((l) => l.includes('entrepriseSlug')).length).toBe(1)
  })

  it('lit réellement les sources', () => {
    expect(DATA).toContain('listerClients')
    expect(ACTIONS).toContain('creerClient')
  })
})
