import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enIso, jour } from '@/lib/domaine/heures'

/**
 * Copie de la semaine précédente — HEU-3, TR-9, TR-6.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le seul geste du produit qui détruit une semaine entière d'un coup.
 *
 * « Copier la semaine précédente » efface toute la semaine cible avant de la
 * réécrire. Ce chemin ne consignait rien : l'en-tête de `CorrectionHeures` citait
 * pourtant nommément la fausse manœuvre qu'il devait rattraper. Le schéma
 * décrivait une garantie que le code ne tenait pas — le pire cas, puisqu'on
 * croyait la donnée protégée.
 *
 * TR-9 interdit la disparition définitive ; TR-6 impose une conservation
 * minimale des registres. Une semaine de janvier écrasée en mars par une
 * mauvaise copie est une donnée du registre qui n'existe plus.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

type LigneSaisie = { employeId: string; date: Date; heures: string }
type LigneCorrection = {
  employeId: string
  date: Date
  ancienneValeur: string | null
  nouvelleValeur: string
  motif: string | null
  parId: string | null
  parNom: string
}

type Base = { saisies: LigneSaisie[]; corrections: LigneCorrection[] }

const base: Base = { saisies: [], corrections: [] }

/** Employés actifs de la base factice. */
let actifs: string[] = []

/** Compteur d'échec : la n-ième consignation lève, pour éprouver l'annulation. */
let consignationQuiEchoue: number | null = null
let consignations = 0

type FiltreSaisie = {
  employeId: { in: string[] }
  date: { gte: Date; lte: Date }
}

function correspond(l: LigneSaisie, f: FiltreSaisie): boolean {
  return (
    f.employeId.in.includes(l.employeId) &&
    l.date.getTime() >= f.date.gte.getTime() &&
    l.date.getTime() <= f.date.lte.getTime()
  )
}

/** Le type est écrit à la main : `$transaction` reçoit la base elle-même. */
type PrismaFactice = {
  employe: { findMany: () => Promise<{ id: string }[]> }
  saisieJour: {
    findMany: (a: { where: FiltreSaisie }) => Promise<LigneSaisie[]>
    deleteMany: (a: { where: FiltreSaisie }) => Promise<{ count: number }>
    createMany: (a: { data: LigneSaisie[] }) => Promise<{ count: number }>
  }
  correctionHeures: {
    create: (a: { data: LigneCorrection }) => Promise<LigneCorrection>
  }
  $transaction: <T>(fn: (tx: PrismaFactice) => Promise<T>) => Promise<T>
}

const faux: PrismaFactice = {
  employe: {
    findMany: async () => actifs.map((id) => ({ id })),
  },
  saisieJour: {
    findMany: async ({ where }: { where: FiltreSaisie }) =>
      base.saisies.filter((l) => correspond(l, where)),
    deleteMany: async ({ where }: { where: FiltreSaisie }) => {
      const restantes = base.saisies.filter((l) => !correspond(l, where))
      const count = base.saisies.length - restantes.length
      base.saisies = restantes
      return { count }
    },
    createMany: async ({ data }: { data: LigneSaisie[] }) => {
      base.saisies.push(...data.map((d) => ({ ...d })))
      return { count: data.length }
    },
  },
  correctionHeures: {
    create: async ({ data }: { data: LigneCorrection }) => {
      consignations += 1
      if (consignations === consignationQuiEchoue) {
        throw new Error('écriture du registre refusée')
      }
      base.corrections.push(data)
      return data
    },
  },
  /**
   * Transaction factice, mais qui annule pour de vrai : sans restauration, un
   * test « la semaine est intacte après échec » passerait quoi qu'il arrive.
   */
  $transaction: async <T>(fn: (tx: PrismaFactice) => Promise<T>): Promise<T> => {
    const copie: Base = {
      saisies: base.saisies.map((l) => ({ ...l })),
      corrections: base.corrections.map((c) => ({ ...c })),
    }
    try {
      return await fn(faux)
    } catch (e) {
      base.saisies = copie.saisies
      base.corrections = copie.corrections
      throw e
    }
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: faux }))

const { copierSemaine } = await import('@/lib/data/heures')

const AUTEUR = { id: 'u1', nom: 'Josée Tremblay' }

/** Semaine du 27 juillet 2026 vers celle du 3 août. */
const SOURCE = { debut: jour('2026-07-27'), fin: jour('2026-08-02') }
const CIBLE = { debut: jour('2026-08-03'), fin: jour('2026-08-09') }

const saisie = (employeId: string, date: string, heures: string): LigneSaisie => ({
  employeId,
  date: jour(date),
  heures,
})

const correctionDu = (date: string) => base.corrections.find((c) => enIso(c.date) === date)

beforeEach(() => {
  base.saisies = []
  base.corrections = []
  actifs = ['e1']
  consignations = 0
  consignationQuiEchoue = null
})

describe('Rien ne disparaît sous une copie de semaine', () => {
  beforeEach(() => {
    base.saisies = [
      // Source : lundi 8 h, mardi 7,50 h.
      saisie('e1', '2026-07-27', '8.00'),
      saisie('e1', '2026-07-28', '7.50'),
      // Cible, déjà remplie : lundi 6 h, mercredi 4 h.
      saisie('e1', '2026-08-03', '6.00'),
      saisie('e1', '2026-08-05', '4.00'),
    ]
  })

  it('la copie écrase bien la semaine cible', async () => {
    await copierSemaine(SOURCE, CIBLE, AUTEUR)

    const cible = base.saisies
      .filter((l) => l.date >= CIBLE.debut && l.date <= CIBLE.fin)
      .map((l) => [enIso(l.date), l.heures])
      .sort()

    expect(cible).toEqual([
      ['2026-08-03', '8.00'],
      ['2026-08-04', '7.50'],
    ])
  })

  it('chaque valeur écrasée est retrouvable dans le registre des corrections', async () => {
    await copierSemaine(SOURCE, CIBLE, AUTEUR)

    // Le lundi valait 6 h, il vaut 8 h.
    expect(correctionDu('2026-08-03')).toMatchObject({
      employeId: 'e1',
      ancienneValeur: '6.00',
      nouvelleValeur: '8.00',
    })

    /*
      Le mercredi est le cas qui manquait complètement : la source n'a rien ce
      jour-là, ses 4 h ont donc été EFFACÉES, pas remplacées. Sans consignation,
      elles n'existaient plus nulle part.
    */
    expect(correctionDu('2026-08-05')).toMatchObject({
      ancienneValeur: '4.00',
      nouvelleValeur: '0.00',
    })
  })

  it('une cellule que rien n’occupait ne produit pas de fausse correction', async () => {
    await copierSemaine(SOURCE, CIBLE, AUTEUR)
    // Le mardi cible était vide : il y a création, pas écrasement.
    expect(correctionDu('2026-08-04')).toBeUndefined()
  })

  it('une valeur identique ne produit pas d’entrée non plus', async () => {
    base.saisies = [saisie('e1', '2026-07-27', '8.00'), saisie('e1', '2026-08-03', '8.00')]
    await copierSemaine(SOURCE, CIBLE, AUTEUR)
    // Recopier 8 h sur 8 h ne change rien : le registre n'a rien à dire.
    expect(base.corrections).toEqual([])
  })

  it('la trace est nominative, et sans motif', async () => {
    await copierSemaine(SOURCE, CIBLE, AUTEUR)

    for (const c of base.corrections) {
      expect(c.parNom).toBe('Josée Tremblay')
      expect(c.parId).toBe('u1')
      /*
        Motif nul : ce n'est pas une correction justifiée d'après clôture. C'est
        ce qui garde l'écran des corrections (HEU-10) lisible — il répond à « qui
        a réécrit un registre clos », pas « qui a cliqué sur Copier ».
      */
      expect(c.motif).toBeNull()
    }
    expect(base.corrections.length).toBeGreaterThan(0)
  })

  it('un employé désactivé n’est ni recopié ni effacé', async () => {
    base.saisies.push(saisie('e2', '2026-07-27', '9.00'), saisie('e2', '2026-08-03', '3.00'))
    await copierSemaine(SOURCE, CIBLE, AUTEUR)

    // Ses heures passées appartiennent au registre de paie (TR-6).
    const siennes = base.saisies.filter((l) => l.employeId === 'e2').map((l) => l.heures)
    expect(siennes.sort()).toEqual(['3.00', '9.00'])
    expect(base.corrections.some((c) => c.employeId === 'e2')).toBe(false)
  })
})

describe('La consignation est dans la transaction qui efface', () => {
  it('une consignation qui échoue laisse la semaine cible intacte', async () => {
    /*
      C'est le point qui distingue une correction d'une rustine. Hors
      transaction, l'échec laisserait la semaine détruite et l'historique muet —
      précisément l'état qu'on corrige.
    */
    base.saisies = [
      saisie('e1', '2026-07-27', '8.00'),
      saisie('e1', '2026-08-03', '6.00'),
      saisie('e1', '2026-08-05', '4.00'),
    ]
    consignationQuiEchoue = 1

    await expect(copierSemaine(SOURCE, CIBLE, AUTEUR)).rejects.toThrow()

    const cible = base.saisies
      .filter((l) => l.date >= CIBLE.debut && l.date <= CIBLE.fin)
      .map((l) => [enIso(l.date), l.heures])
      .sort()

    expect(cible).toEqual([
      ['2026-08-03', '6.00'],
      ['2026-08-05', '4.00'],
    ])
    expect(base.corrections).toEqual([])
  })
})

describe('La règle vaut pour tout chemin d’effacement — garantie structurelle', () => {
  const SOURCE_DATA = readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'heures.ts'), 'utf8')
  const SOURCE_ACTIONS = readFileSync(
    join(process.cwd(), 'src', 'lib', 'actions', 'heures.ts'),
    'utf8',
  )

  /** Corps des fonctions de premier niveau — jusqu'à l'accolade en début de ligne. */
  function corps(source: string): { nom: string; texte: string }[] {
    const noms = [...source.matchAll(/\bfunction (\w+)\(/g)].map((m) => m[1])
    return [...new Set(noms)].map((nom) => ({
      nom,
      texte: new RegExp(`function ${nom}\\([\\s\\S]*?\\n\\}`).exec(source)?.[0] ?? '',
    }))
  }

  it('le balayage lit réellement des fonctions', () => {
    // Sans quoi les contrôles suivants seraient vacuement vrais.
    const fonctions = corps(SOURCE_DATA)
    expect(fonctions.length).toBeGreaterThan(5)
    expect(fonctions.every((f) => f.texte.length > 20)).toBe(true)
  })

  it('toute suppression de saisie est accompagnée d’une consignation', () => {
    /*
      C'est le genre de règle qui se reperd au troisième chemin d'écriture qu'on
      ajoutera : on écrit le `deleteMany`, il marche, et personne ne repense au
      registre avant le jour où une semaine manque.
    */
    const muettes = corps(SOURCE_DATA)
      .filter((f) => /saisieJour\.delete\w*\(/.test(f.texte))
      .filter((f) => !/consigner\(|correctionHeures\.create\(/.test(f.texte))
      .map((f) => f.nom)

    expect(muettes, `Effacement sans trace dans : ${muettes.join(', ')}`).toEqual([])
  })

  it('les chemins d’effacement connus sont bien ceux qu’on croit', () => {
    // Une fonction de moins ici signale un renommage ; une de plus, un chemin
    // neuf qu'il faut relire.
    const effacent = corps(SOURCE_DATA)
      .filter((f) => /saisieJour\.delete\w*\(/.test(f.texte))
      .map((f) => f.nom)
      .sort()

    expect(effacent).toEqual(['appliquerCellule', 'copierSemaine'])
  })

  it('la copie ne peut pas être appelée sans auteur', () => {
    // La signature l'exige : une trace anonyme ne répond pas à « qui a effacé ».
    expect(SOURCE_DATA).toMatch(/export async function copierSemaine\([\s\S]*?auteur: Auteur,/)
    expect(SOURCE_DATA).not.toMatch(/copierSemaine\([^)]*auteur: Auteur \| null/)
  })

  it('l’action transmet l’auteur de la session, jamais une valeur du navigateur', () => {
    expect(SOURCE_ACTIONS).toMatch(
      /copierSemaine\(precedente, semaine, \{\s*id: session\.userId,\s*nom: session\.nom,/,
    )
  })

  it('une copie vers une période clôturée est refusée — HEU-10', () => {
    /*
      La grille grisée n'empêche rien : un Server Action ne traverse pas les
      layouts. Le refus doit précéder l'appel, sinon la période clôturée est
      écrasée avant que quiconque ait vérifié quoi que ce soit.
    */
    const handler =
      /copierSemainePrecedente = createAction\(\{[\s\S]*?\n\}\)/.exec(SOURCE_ACTIONS)?.[0] ?? ''
    expect(handler).toContain('refuserSiCloturee(periode)')
    expect(handler.indexOf('refuserSiCloturee')).toBeLessThan(
      handler.indexOf('await copierSemaine'),
    )
  })

  it('la fenêtre effacée reste bornée des deux côtés', () => {
    // Une borne haute seule serait une purge, et emporterait les archives que
    // TR-6 oblige à garder.
    const copie = corps(SOURCE_DATA).find((f) => f.nom === 'copierSemaine')?.texte ?? ''
    expect(copie).toMatch(/date: \{ gte: cible\.debut, lte: cible\.fin \}/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un effacement muet', () => {
    const faussaire = `
      async function purgerSemaine(cible) {
        await prisma.saisieJour.deleteMany({ where: { date: { gte: a, lte: b } } })
      }
    `
    expect(/saisieJour\.delete\w*\(/.test(faussaire)).toBe(true)
    expect(/consigner\(|correctionHeures\.create\(/.test(faussaire)).toBe(false)
  })

  it('la transaction factice annule pour de vrai', async () => {
    base.saisies = [saisie('e1', '2026-08-03', '5.00')]
    await expect(
      faux.$transaction(async (tx) => {
        await tx.saisieJour.deleteMany({
          where: { employeId: { in: ['e1'] }, date: { gte: CIBLE.debut, lte: CIBLE.fin } },
        })
        throw new Error('échec')
      }),
    ).rejects.toThrow('échec')
    expect(base.saisies).toHaveLength(1)
  })
})
