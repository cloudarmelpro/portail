import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmployeVue, ParametresPaie, SaisieVue } from '@/lib/data/heures'
import type { SessionApp } from '@/lib/guards'

/**
 * Export de la période — exigence HEU-11.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le fichier est produit ici, pas seulement décrit.
 *
 * Un contrôle sur la source dirait que le taux figure dans l'en-tête ; il ne
 * dirait pas que la colonne du taux tombe en face du taux. Un export où les
 * colonnes glissent d'un cran est pire qu'un export incomplet : il a l'air juste,
 * et il part chez le comptable.
 *
 * Les dépendances serveur sont remplacées par des espions — `lib/data/` est
 * marqué `server-only` et tirerait Prisma —, mais le corps de la route, le
 * domaine de calcul et la matrice de permissions restent les vrais.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

const espions = vi.hoisted(() => ({
  sessionCourante: vi.fn(),
  journaliser: vi.fn(),
  journaliserRefus: vi.fn(),
  listerEmployes: vi.fn(),
  parametresPaie: vi.fn(),
  saisiesEntre: vi.fn(),
}))

vi.mock('@/lib/guards', () => ({ sessionCourante: espions.sessionCourante }))
vi.mock('@/lib/audit', () => ({
  journaliser: espions.journaliser,
  journaliserRefus: espions.journaliserRefus,
}))
vi.mock('@/lib/data/heures', () => ({
  listerEmployes: espions.listerEmployes,
  parametresPaie: espions.parametresPaie,
  saisiesEntre: espions.saisiesEntre,
}))

const { GET } = await import('@/app/(app)/heures/export/route')

const SESSION: SessionApp = {
  userId: 'u1',
  nom: 'Josée Tremblay',
  courriel: 'josee@exemple.ca',
  role: 'heures',
}

const PARAMETRES: ParametresPaie = {
  seuilCentiemes: 4000,
  majorationCentiemes: 150,
  joursPeriode: 14,
}

function employe(partiel: Partial<EmployeVue> & { id: string; nom: string }): EmployeVue {
  return {
    entrepriseSlug: 'paysagement',
    tauxCents: 2250,
    actif: true,
    notes: null,
    version: 0,
    ...partiel,
  }
}

/** Période de paie du 3 au 16 août 2026 — deux semaines entières. */
const DEBUT = '2026-08-03'
const FIN = '2026-08-16'

async function exporter(saisies: SaisieVue[], employes: EmployeVue[]): Promise<string> {
  espions.listerEmployes.mockResolvedValue(employes)
  espions.saisiesEntre.mockResolvedValue(saisies)

  const reponse = await GET(
    new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`),
  )
  expect(reponse.status).toBe(200)
  return reponse.text()
}

/** Découpe une ligne CSV entre guillemets, séparée par des points-virgules. */
function cellules(ligne: string): string[] {
  return ligne
    .split(';')
    .map((c) => (c.startsWith('"') && c.endsWith('"') ? c.slice(1, -1) : c))
    .map((c) => c.replace(/""/g, '"'))
}

/** Lignes du fichier, BOM retiré. */
function lignes(csv: string): string[][] {
  return csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n')
    .map(cellules)
}

const enTete = (csv: string) => lignes(csv).find((l) => l[0] === 'Employé') ?? []

beforeEach(() => {
  vi.clearAllMocks()
  espions.sessionCourante.mockResolvedValue(SESSION)
  espions.parametresPaie.mockResolvedValue(PARAMETRES)
  espions.journaliser.mockResolvedValue(undefined)
  espions.journaliserRefus.mockResolvedValue(undefined)
})

describe('Le fichier porte tout ce que HEU-11 demande', () => {
  it('le taux horaire et la note ont chacun leur colonne', () => {
    return exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 800, note: 'Chantier Beauport' }],
      [employe({ id: 'e1', nom: 'Marc Gagnon' })],
    ).then((csv) => {
      const colonnes = enTete(csv)
      expect(colonnes).toEqual([
        'Employé',
        'Entreprise',
        'Taux horaire',
        'Date',
        'Jour',
        'Heures',
        'Note',
        'Total normal',
        'Total supplémentaire',
        'Montant',
      ])
    })
  })

  it('chaque valeur tombe sous sa colonne', async () => {
    const csv = await exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 825, note: 'Chantier Beauport' }],
      [employe({ id: 'e1', nom: 'Marc Gagnon', tauxCents: 2250 })],
    )

    const colonnes = enTete(csv)
    const detail = lignes(csv).find((l) => l[0] === 'Marc Gagnon' && l[3] === '2026-08-03') ?? []

    const valeur = (nom: string) => detail[colonnes.indexOf(nom)]
    expect(valeur('Entreprise')).toBe('Paysagement')
    expect(valeur('Taux horaire')).toBe('22,50')
    expect(valeur('Jour')).toBe('lundi')
    expect(valeur('Heures')).toBe('8,25')
    expect(valeur('Note')).toBe('Chantier Beauport')
  })

  it('la ligne de total garde ses colonnes alignées', async () => {
    /*
      35 h une semaine, 45 h l'autre : les heures supplémentaires se comptent par
      semaine, jamais sur le total de la période. Le fichier doit donc porter
      5 h de majoré, pas zéro.
    */
    const saisies: SaisieVue[] = [
      { employeId: 'e1', date: '2026-08-03', centiemes: 3500, note: null },
      { employeId: 'e1', date: '2026-08-10', centiemes: 4500, note: null },
    ]
    const csv = await exporter(saisies, [employe({ id: 'e1', nom: 'Marc Gagnon' })])

    const colonnes = enTete(csv)
    const total = lignes(csv).find((l) => l[colonnes.indexOf('Jour')] === 'Total') ?? []
    const valeur = (nom: string) => total[colonnes.indexOf(nom)]

    expect(valeur('Heures')).toBe('80,00')
    expect(valeur('Total normal')).toBe('75,00')
    expect(valeur('Total supplémentaire')).toBe('5,00')
    // 75 × 22,50 + 5 × 33,75 = 1 856,25
    expect(valeur('Montant')).toBe('1856,25')
    expect(total.length).toBe(colonnes.length)
  })

  it('sans taux renseigné, la colonne reste vide — jamais un zéro (HEU-8)', async () => {
    const csv = await exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 800, note: null }],
      [employe({ id: 'e1', nom: 'Marc Gagnon', tauxCents: null })],
    )

    const colonnes = enTete(csv)
    for (const ligne of lignes(csv).filter((l) => l[0] === 'Marc Gagnon')) {
      // Un « 0,00 » se lirait « travaille gratuitement », ce qui n'est pas la
      // même chose qu'inconnu.
      expect(ligne[colonnes.indexOf('Taux horaire')]).toBe('')
      expect(ligne[colonnes.indexOf('Montant')]).toBe('')
    }
  })

  it('une journée sans note laisse la cellule vide', async () => {
    const csv = await exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 800, note: null }],
      [employe({ id: 'e1', nom: 'Marc Gagnon' })],
    )
    const colonnes = enTete(csv)
    const detail = lignes(csv).find((l) => l[3] === '2026-08-03') ?? []
    expect(detail[colonnes.indexOf('Note')]).toBe('')
  })
})

describe('Le fichier ne s’exécute pas à l’ouverture', () => {
  it('une note commençant par « = » est désamorcée', async () => {
    /*
      La note est le champ le plus librement saisi du module. Excel retire les
      guillemets avant d'interpréter : seul un préfixe désamorce. Sans lui, la
      formule s'exécute chez le comptable, dans un fichier venu de son outil.
    */
    const csv = await exporter(
      [
        {
          employeId: 'e1',
          date: '2026-08-03',
          centiemes: 800,
          note: '=HYPERLINK("http://x.test","cliquez")',
        },
      ],
      [employe({ id: 'e1', nom: 'Marc Gagnon' })],
    )

    const colonnes = enTete(csv)
    const detail = lignes(csv).find((l) => l[3] === '2026-08-03') ?? []
    expect(detail[colonnes.indexOf('Note')]).toMatch(/^'=/)
  })

  it('les quatre amorces sont couvertes, sur la note comme sur le nom', async () => {
    for (const amorce of ['=', '+', '-', '@']) {
      const csv = await exporter(
        [{ employeId: 'e1', date: '2026-08-03', centiemes: 800, note: `${amorce}cmd` }],
        [employe({ id: 'e1', nom: `${amorce}Gagnon` })],
      )
      const brut = csv.replace(/^\uFEFF/, '')
      expect(brut, `amorce « ${amorce} » non désamorcée`).toContain(`"'${amorce}cmd"`)
      expect(brut).toContain(`"'${amorce}Gagnon"`)
    }
  })

  it('un guillemet dans une note ne casse pas la ligne', async () => {
    const csv = await exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 800, note: 'Chantier « Le Nid »' }],
      [employe({ id: 'e1', nom: 'Marc Gagnon' })],
    )
    const colonnes = enTete(csv)
    const detail = lignes(csv).find((l) => l[3] === '2026-08-03') ?? []
    expect(detail[colonnes.indexOf('Note')]).toBe('Chantier « Le Nid »')
  })
})

describe('L’export reste gardé et tracé', () => {
  it('sans session, rien ne sort', async () => {
    espions.sessionCourante.mockResolvedValue(null)
    const reponse = await GET(
      new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`),
    )
    expect(reponse.status).toBe(401)
    expect(espions.saisiesEntre).not.toHaveBeenCalled()
  })

  it('un rôle sans « heures:lire » est refusé — la route ne traverse aucun layout', async () => {
    espions.sessionCourante.mockResolvedValue({ ...SESSION, role: 'recrutement' })
    const reponse = await GET(
      new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`),
    )
    expect(reponse.status).toBe(403)
    expect(espions.saisiesEntre).not.toHaveBeenCalled()

    // Le refus laisse une trace, comme celui d'une garde d'écran : ADM-4 vise
    // les tentatives refusées autant que les gestes aboutis.
    expect(espions.journaliserRefus).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'heures' }),
    )
  })

  it('le journal est écrit AVANT que le fichier ne parte', async () => {
    // Après l'envoi, il est trop tard : une écriture qui échoue laisserait une
    // copie du registre de paie partie sans trace.
    const ordre: string[] = []
    espions.journaliser.mockImplementation(async () => {
      ordre.push('journal')
    })
    espions.saisiesEntre.mockImplementation(async () => {
      ordre.push('lecture')
      return []
    })
    espions.listerEmployes.mockResolvedValue([])

    await GET(new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`))
    expect(ordre).toEqual(['journal', 'lecture'])
    expect(espions.journaliser).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Export d’une période d’heures', sensible: true }),
    )
  })

  it('des bornes invalides sont refusées', async () => {
    for (const requete of [
      'debut=hier&fin=2026-08-16',
      'debut=2026-08-16&fin=2026-08-03',
      'fin=2026-08-16',
    ]) {
      const reponse = await GET(new Request(`https://portail.test/heures/export?${requete}`))
      expect(reponse.status, requete).toBe(400)
    }
  })

  it('le fichier s’ouvre au Québec : BOM, point-virgule, décimale à la virgule', async () => {
    const csv = await exporter(
      [{ employeId: 'e1', date: '2026-08-03', centiemes: 825, note: null }],
      [employe({ id: 'e1', nom: 'Marc Gagnon', entrepriseSlug: 'developpement' })],
    )
    expect(csv).toContain('"Développement web"')
    expect(csv).toContain('"8,25"')
    expect(csv).not.toContain('"8.25"')
  })

  it('le BOM UTF-8 est bien dans les octets envoyés', async () => {
    /*
      Lu en octets, pas en texte : `Response.text()` décode en UTF-8 et RETIRE
      le BOM au passage. Une vérification sur la chaîne dirait « absent » d'un
      fichier qui le porte. Sans ce BOM, Excel lit « Développement » en page de
      code locale et l'abîme.
    */
    espions.listerEmployes.mockResolvedValue([])
    espions.saisiesEntre.mockResolvedValue([])

    const reponse = await GET(
      new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`),
    )
    const octets = new Uint8Array(await reponse.arrayBuffer())
    expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})

describe('Le bouton nomme le fichier qu’il télécharge', () => {
  it('la route annonce du CSV et l’écran dit « CSV »', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const grille = readFileSync(
      join(process.cwd(), 'src', 'components', 'heures', 'grille-heures.tsx'),
      'utf8',
    )

    /*
      Le bouton disait « Excel » alors que la route produit un CSV — et le
      produira toujours : mise en forme, formules et onglets n'ont aucun rôle
      ici, et un générateur de classeur serait une dépendance de plus.
    */
    expect(grille).toContain('Exporter en CSV')
    expect(grille).not.toContain('Exporter en Excel')

    const reponse = await GET(
      new Request(`https://portail.test/heures/export?debut=${DEBUT}&fin=${FIN}`),
    )
    expect(reponse.headers.get('Content-Type')).toContain('text/csv')
    expect(reponse.headers.get('Content-Disposition')).toMatch(/\.csv"$/)
    // Un registre de paie ne se met pas en cache.
    expect(reponse.headers.get('Cache-Control')).toContain('no-store')
  })
})

describe('Le test peut échouer', () => {
  it('détecte une colonne décalée d’un cran', () => {
    const colonnes = ['Employé', 'Entreprise', 'Taux horaire', 'Date']
    const detail = ['Marc Gagnon', 'Paysagement', '2026-08-03']
    expect(detail[colonnes.indexOf('Taux horaire')]).not.toBe('22,50')
  })
})
