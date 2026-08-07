import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aujourdHui } from '@/lib/domaine/dates'
import {
  dateFichier,
  dateValidite,
  formaterDate,
  formaterDateSeule,
} from '@/lib/domaine/estimation'

/**
 * Le jour civil des estimations — EST-13.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le serveur tourne en UTC, l'utilisateur est au Québec. Entre 19 h et minuit
 * heure locale — 20 h l'hiver —, le processus est déjà au lendemain.
 *
 * `expirerEstimationsEchues` ÉCRIT en base : une estimation encore valide
 * jusqu'au lendemain passait « Expirée » chaque soir, et le statut faux ne se
 * corrigeait pas au matin. Ce n'était donc pas un défaut d'affichage.
 *
 * Tous les instants de ce fichier sont écrits en UTC : le test doit donner le
 * même résultat sur le poste de Montréal et sur le conteneur du VPS.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** 15 juillet 2026, 23 h 30 à Montréal (UTC−4 en heure avancée) → 16 juillet 3 h 30 UTC. */
const SOIR_ETE = new Date('2026-07-16T03:30:00.000Z')

/** 15 janvier 2026, 23 h 30 à Montréal (UTC−5 en heure normale) → 16 janvier 4 h 30 UTC. */
const SOIR_HIVER = new Date('2026-01-16T04:30:00.000Z')

/**
 * Échéances : la colonne `@db.Date` est rendue à minuit UTC.
 *
 * Deux formes, et la seconde est celle qui compte : une estimation valide
 * jusqu'au LENDEMAIN survit même à la règle fautive, tandis qu'une estimation
 * valide jusqu'au JOUR MÊME — le cas le plus courant, l'avant-dernier soir — est
 * exactement celle que l'horloge du processus faisait expirer trop tôt.
 */
const ECHEANCE_ETE = new Date('2026-07-16T00:00:00.000Z')
const ECHEANCE_HIVER = new Date('2026-01-16T00:00:00.000Z')
const ECHEANCE_JOUR_ETE = new Date('2026-07-15T00:00:00.000Z')
const ECHEANCE_JOUR_HIVER = new Date('2026-01-15T00:00:00.000Z')

describe('Le jour de référence est celui du Québec', () => {
  it('à 23 h 30 le 15 juillet, le jour courant est encore le 15', () => {
    expect(aujourdHui(SOIR_ETE).toISOString()).toBe('2026-07-15T00:00:00.000Z')
  })

  it('à 23 h 30 le 15 janvier, le décalage est d’une heure de plus et le jour tient', () => {
    // Cinq heures l'hiver, quatre l'été : soustraire un nombre fixe d'heures
    // corrigerait une saison et casserait l'autre.
    expect(aujourdHui(SOIR_HIVER).toISOString()).toBe('2026-01-15T00:00:00.000Z')
  })
})

describe('Une estimation valide jusqu’au lendemain n’expire pas le soir', () => {
  /*
    C'est la condition exacte de `expirerEstimationsEchues` :
    `valideJusquau < aujourdHui()`. Le test la rejoue sur les deux bornes.
  */
  const echue = (echeance: Date, maintenant: Date) => echeance < aujourdHui(maintenant)

  it('en juillet — 23 h 30 le 15, valide jusqu’au 16', () => {
    expect(echue(ECHEANCE_ETE, SOIR_ETE)).toBe(false)
  })

  it('en janvier — 23 h 30 le 15, valide jusqu’au 16', () => {
    expect(echue(ECHEANCE_HIVER, SOIR_HIVER)).toBe(false)
  })

  it('en juillet — 23 h 30 le 15, valide jusqu’au 15 : le jour même tient', () => {
    expect(echue(ECHEANCE_JOUR_ETE, SOIR_ETE)).toBe(false)
  })

  it('en janvier — 23 h 30 le 15, valide jusqu’au 15 : le jour même tient', () => {
    expect(echue(ECHEANCE_JOUR_HIVER, SOIR_HIVER)).toBe(false)
  })

  it('elle expire bien le lendemain', () => {
    // Midi le 16 juillet au Québec : la validité au 15 est passée.
    expect(echue(ECHEANCE_JOUR_ETE, new Date('2026-07-16T16:00:00.000Z'))).toBe(true)
  })

  it('le test peut échouer — l’ancienne règle expirait dès le soir', () => {
    /*
      `jourSeul` composait le jour avec `getFullYear`/`getMonth`/`getDate`, donc
      au fuseau du PROCESSUS. Rejoué ici sur une horloge en UTC — celle du VPS —,
      il donne le 16 et fait expirer une estimation encore valide tout le 15.
    */
    const jourSeulUtc = (d: Date) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    expect(ECHEANCE_JOUR_ETE < jourSeulUtc(SOIR_ETE)).toBe(true)
    expect(ECHEANCE_JOUR_HIVER < jourSeulUtc(SOIR_HIVER)).toBe(true)
  })
})

describe('La validité de trente jours part du jour québécois', () => {
  it('une estimation enregistrée à 23 h 30 le 15 juillet vaut jusqu’au 14 août', () => {
    // 15 juillet + 30 jours. Avec l'horloge du processus en UTC, on obtenait le
    // 15 août : un jour de validité offert, et une échéance qui ne correspondait
    // pas à celle annoncée à l'écran au moment de l'appel.
    expect(dateValidite(SOIR_ETE).toISOString()).toBe('2026-08-14T00:00:00.000Z')
  })

  it('même règle en janvier', () => {
    expect(dateValidite(SOIR_HIVER).toISOString()).toBe('2026-02-14T00:00:00.000Z')
  })
})

describe('Les dates écrites sur le document', () => {
  it('un horodatage de soirée s’imprime au bon jour', () => {
    // Le devis porte « Date : … ». Lu au fuseau du processus, il annonçait le
    // lendemain de l'appel.
    expect(formaterDate(SOIR_ETE)).toBe('15 juillet 2026')
  })

  it('une date seule reste lue en UTC, où elle est écrite', () => {
    expect(formaterDateSeule(ECHEANCE_ETE)).toBe('16 juillet 2026')
  })

  it('le nom d’un fichier d’export porte le jour québécois', () => {
    expect(dateFichier(SOIR_ETE)).toBe('2026-07-15')
    expect(dateFichier(SOIR_HIVER)).toBe('2026-01-15')
  })
})

describe('Plus aucune version locale de la règle', () => {
  const DOMAINE = readFileSync(
    join(process.cwd(), 'src', 'lib', 'domaine', 'estimation.ts'),
    'utf8',
  )
  const DATA = readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'estimations.ts'), 'utf8')

  it('`jourSeul` a disparu du calculateur', () => {
    // Une troisième version de la même règle finirait par diverger des deux
    // autres, et le défaut ne se verrait qu'à une heure précise de la soirée.
    expect(DOMAINE).not.toContain('jourSeul')
    expect(DATA).not.toContain('jourSeul')
  })

  it('aucune composante de date n’est lue au fuseau du processus', () => {
    for (const source of [DOMAINE, DATA]) {
      expect(source).not.toMatch(/\.getFullYear\(\)/)
      expect(source).not.toMatch(/\.getMonth\(\)/)
      expect(source).not.toMatch(/\.getDate\(\)/)
    }
  })

  it('le jour de la fenêtre et de l’expiration vient de `aujourdHui`', () => {
    expect(DATA).toContain("from '@/lib/domaine/dates'")
    expect(DATA).toContain('valideJusquau: { lt: aujourdHui() }')
    expect(DATA).toContain('const debut = aujourdHui()')
  })
})
