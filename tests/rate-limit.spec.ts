import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Limitation de débit sur les liens signés.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `architecture.MD` annonce `lib/rate-limit.ts` — « connexion, URL présignées ».
 * Le fichier n'existait pas. La connexion était bien plafonnée, par Better
 * Auth ; les liens signés ne l'étaient par personne.
 *
 * Ce que cela laissait passer : chaque appel à la route de téléchargement forge
 * un lien neuf. Une session compromise — ou simplement une recruteuse sur le
 * départ — boucle dessus et sort la banque de CV entière en quelques secondes.
 * Le journal en garde la trace, ce qui rend l'extraction constatable après coup
 * et jamais évitable.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

const { limiter, cleUtilisateur, PLAFONDS } = await import('@/lib/rate-limit')

describe('Fenêtre glissante', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'))
  })

  it('laisse passer jusqu’au plafond, puis refuse', () => {
    const cle = `essai-plafond-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(limiter(cle, 3, 60).autorise, `appel ${i + 1}`).toBe(true)
    }
    expect(limiter(cle, 3, 60).autorise).toBe(false)
  })

  it('dit dans combien de temps réessayer', () => {
    const cle = `essai-attente-${Math.random()}`
    limiter(cle, 1, 60)
    const refus = limiter(cle, 1, 60)

    expect(refus.autorise).toBe(false)
    if (!refus.autorise) {
      expect(refus.secondesAvantReprise).toBeGreaterThan(0)
      expect(refus.secondesAvantReprise).toBeLessThanOrEqual(60)
    }
  })

  it('rouvre quand la fenêtre a glissé', () => {
    const cle = `essai-glissement-${Math.random()}`
    limiter(cle, 1, 60)
    expect(limiter(cle, 1, 60).autorise).toBe(false)

    vi.advanceTimersByTime(61_000)
    expect(limiter(cle, 1, 60).autorise).toBe(true)
  })

  it('ne glisse pas d’un bloc : une place se libère à la fois', () => {
    /*
      Une fenêtre FIXE rouvrirait les trois places d'un coup à la remise à zéro,
      ce qui autorise une rafale de six appels à cheval sur deux fenêtres. Ici,
      seule la place la plus ancienne se libère.
    */
    const cle = `essai-rafale-${Math.random()}`
    limiter(cle, 3, 60)
    vi.advanceTimersByTime(30_000)
    limiter(cle, 3, 60)
    limiter(cle, 3, 60)
    expect(limiter(cle, 3, 60).autorise).toBe(false)

    // 31 s plus tard, le premier appel sort de la fenêtre — une place, pas trois.
    vi.advanceTimersByTime(31_000)
    expect(limiter(cle, 3, 60).autorise).toBe(true)
    expect(limiter(cle, 3, 60).autorise).toBe(false)
  })

  it('compte par utilisateur, pas globalement', () => {
    // Un compteur global punirait la recruteuse pour l'activité d'un autre.
    const a = cleUtilisateur('cv:telecharger', 'utilisateur-a')
    const b = cleUtilisateur('cv:telecharger', 'utilisateur-b')

    limiter(a, 1, 60)
    expect(limiter(a, 1, 60).autorise).toBe(false)
    expect(limiter(b, 1, 60).autorise).toBe(true)
  })

  it('sépare les actions d’un même utilisateur', () => {
    const lecture = cleUtilisateur('cv:telecharger', 'meme-personne')
    const depot = cleUtilisateur('cv:televerser', 'meme-personne')

    limiter(lecture, 1, 60)
    expect(limiter(lecture, 1, 60).autorise).toBe(false)
    expect(limiter(depot, 1, 60).autorise).toBe(true)
  })
})

describe('Plafonds retenus', () => {
  it('laisse la consultation attentive tranquille', () => {
    /*
      CV-5 existe pour qu'on puisse enchaîner vingt candidatures sans les
      télécharger une à une. Le plafond ne vise pas la lecture : il vise la
      boucle. Cent en cinq minutes n'est pas une lecture.
    */
    expect(PLAFONDS.telechargementCv.max).toBeGreaterThanOrEqual(60)
    expect(PLAFONDS.telechargementCv.fenetreSecondes).toBeGreaterThan(0)
    expect(PLAFONDS.televersementCv.max).toBeGreaterThanOrEqual(30)
  })
})

describe('Les deux chemins de lien signé sont plafonnés', () => {
  const route = readFileSync(
    join(process.cwd(), 'src', 'app', 'api', 'cv', '[id]', 'telecharger', 'route.ts'),
    'utf8',
  )
  const actions = readFileSync(join(process.cwd(), 'src', 'lib', 'actions', 'cv.ts'), 'utf8')

  it('la route de téléchargement appelle le limiteur', () => {
    expect(route).toContain('limiter(')
    expect(route).toContain('429')
  })

  it('le plafond vient APRÈS la vérification de permission', () => {
    // Sinon un utilisateur sans droit remplirait le compteur d'un ayant droit.
    const posPermission = route.indexOf('aPermission(')
    const posLimite = route.indexOf('limiter(')
    expect(posPermission).toBeGreaterThan(-1)
    expect(posLimite).toBeGreaterThan(posPermission)
  })

  it('la préparation de téléversement appelle aussi le limiteur', () => {
    // Ancré sur la DÉCLARATION : `indexOf('preparerTeleversement')` seul tombe
    // sur l'import du schéma, en tête de fichier, et l'extrait ne contient
    // jamais le traitement.
    const bloc = actions.slice(actions.indexOf('export const preparerTeleversement ='))
    expect(bloc.slice(0, 900)).toContain('limiter(')
  })
})

describe('Le test peut échouer', () => {
  it('un plafond de zéro refuse tout', () => {
    expect(limiter(`essai-zero-${Math.random()}`, 0, 60).autorise).toBe(false)
  })
})
