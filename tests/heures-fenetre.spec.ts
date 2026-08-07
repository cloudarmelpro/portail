import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { corrigerSemaineSchema, enregistrerSemaineSchema } from '@/lib/validations/heures'

/**
 * Le verrou de clôture porte sur ce qui est ÉCRIT, pas sur ce qui est annoncé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'était une faille exploitable par une session authentifiée.
 *
 * `debut` et `saisies[].date` sont deux champs indépendants du même corps de
 * requête. Le handler déduisait la période de `debut`, vérifiait qu'elle n'était
 * pas clôturée, puis écrivait chaque cellule à SA propre date. Annoncer une
 * semaine ouverte et viser des dates d'une période close réécrivait donc un
 * registre déjà parti chez le comptable.
 *
 * Trois dégâts se cumulaient : le registre clos était modifié, l'entrée d'audit
 * nommait la mauvaise semaine, et la ligne de correction partait sans motif —
 * donc absente de l'écran des corrections, celui-là même qu'exige HEU-10.
 *
 * La règle vit dans le SCHÉMA. La fabrique valide avant d'appeler le handler :
 * aucune action ne peut l'oublier, et un Server Action appelé directement,
 * sans jamais charger l'écran, s'y heurte de la même façon.
 * ─────────────────────────────────────────────────────────────────────────
 */

const CELLULE = { employeId: 'emp_1', centiemes: 800, avant: null }

/** Lundi 3 août 2026 — la semaine court jusqu'au dimanche 9. */
const LUNDI = '2026-08-03'

describe('Une cellule hors de la semaine annoncée est refusée', () => {
  it('l’enregistrement refuse une date d’une autre période', () => {
    const r = enregistrerSemaineSchema.safeParse({
      debut: LUNDI,
      saisies: [{ ...CELLULE, date: '2026-01-08' }],
    })

    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toContain('n’appartient pas à la semaine')
    // Le chemin désigne la cellule fautive : à soixante saisies, « une date est
    // invalide » n'aide personne.
    expect(r.error?.issues[0]?.path).toEqual(['saisies', 0, 'date'])
  })

  it('la correction porte le même verrou', () => {
    /*
      Moins grave — le motif y est obligatoire — mais le journal nommait quand
      même la mauvaise semaine, et c'est le journal qui répond à HEU-10.
    */
    const r = corrigerSemaineSchema.safeParse({
      debut: LUNDI,
      motif: 'Erreur de saisie constatée par le comptable.',
      saisies: [{ ...CELLULE, date: '2026-01-08' }],
    })

    expect(r.success).toBe(false)
  })

  it('la veille et le lendemain de la semaine sont refusés', () => {
    // Les bornes sont l'endroit où ce genre de contrôle se trompe.
    for (const date of ['2026-08-02', '2026-08-10']) {
      const r = enregistrerSemaineSchema.safeParse({
        debut: LUNDI,
        saisies: [{ ...CELLULE, date }],
      })
      expect(r.success, date).toBe(false)
    }
  })

  it('les sept jours de la semaine passent', () => {
    for (const date of [
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]) {
      const r = enregistrerSemaineSchema.safeParse({
        debut: LUNDI,
        saisies: [{ ...CELLULE, date }],
      })
      expect(r.success, date).toBe(true)
    }
  })

  it('une seule cellule fautive suffit à tout refuser', () => {
    // Accepter les autres écrirait une partie de la requête : l'écran croirait
    // avoir échoué alors que la moitié serait enregistrée.
    const r = enregistrerSemaineSchema.safeParse({
      debut: LUNDI,
      saisies: [
        { ...CELLULE, date: '2026-08-04' },
        { ...CELLULE, date: '2026-01-08' },
      ],
    })

    expect(r.success).toBe(false)
  })

  it('un `debut` en milieu de semaine est ramené à son lundi', () => {
    // L'écran envoie toujours un lundi, mais rien ne l'y oblige côté serveur.
    const r = enregistrerSemaineSchema.safeParse({
      debut: '2026-08-06',
      saisies: [{ ...CELLULE, date: '2026-08-03' }],
    })

    expect(r.success).toBe(true)
  })
})

describe('La règle est dans le schéma, pas dans un handler', () => {
  it('les deux schémas portent le raffinement', () => {
    /*
      Placée dans un handler, elle serait à réécrire à chaque nouvelle action
      touchant des cellules — et la prochaine l'oublierait. La fabrique valide
      avant d'appeler : ici, personne ne peut passer à côté.
    */
    const source = readFileSync(join(process.cwd(), 'src/lib/validations/heures.ts'), 'utf8')
    expect((source.match(/superRefine\(memeSemaine\)/g) ?? []).length).toBe(2)
  })
})
