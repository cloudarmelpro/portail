import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AJUSTEMENTS_VIDES,
  type Ajustements,
  type LigneCalcul,
  analyserNombre,
  arrondirCent,
  calculer,
  composerReference,
  dateValidite,
} from '@/lib/domaine/estimation'
import { TAUX_TPS, TAUX_TVQ } from '@/config/taxes'

/**
 * Domaine de calcul — le seul endroit du projet qui se teste exhaustivement et
 * instantanément, sans base ni navigateur.
 *
 * Une erreur ici ne se voit pas : elle décale chaque estimation de quelques
 * dollars, et personne ne s'en aperçoit avant longtemps.
 */

function ligne(prixUnitaire: number, quantite: number): LigneCalcul {
  return { designation: 'Service', unite: 'unité', prixUnitaire, quantite }
}

function ajustements(partiel: Partial<Ajustements>): Ajustements {
  return { ...AJUSTEMENTS_VIDES, ...partiel }
}

describe('Arrondi au cent', () => {
  it('arrondit à la demi-unité supérieure malgré la représentation binaire', () => {
    // 1,005 × 100 vaut 100,49999999999999 en binaire : sans correction, on
    // obtiendrait 1,00.
    expect(arrondirCent(1.005)).toBe(1.01)
    expect(arrondirCent(2.675)).toBe(2.68)
  })

  it('laisse intacts les montants déjà au cent', () => {
    expect(arrondirCent(12.34)).toBe(12.34)
    expect(arrondirCent(0)).toBe(0)
  })

  it('traite les montants négatifs symétriquement', () => {
    expect(arrondirCent(-1.005)).toBe(-1.01)
  })
})

describe('Lignes et sous-totaux', () => {
  it('multiplie quantité par prix unitaire, ligne par ligne', () => {
    const t = calculer([ligne(45, 3), ligne(12.5, 2)])
    expect(t.lignes).toEqual([135, 25])
    expect(t.sousTotalLignes).toBe(160)
  })

  it('accepte les quantités à trois décimales — 0,125 hectare', () => {
    const t = calculer([ligne(2400, 0.125)])
    expect(t.lignes).toEqual([300])
  })

  it('arrondit CHAQUE ligne, pour que la colonne affichée s’additionne', () => {
    // 3 × 0,335 = 1,005 → 1,01 par ligne. Trois lignes donnent 3,03.
    // Sans arrondi par ligne, la somme brute vaudrait 3,015 → 3,02 affiché,
    // et le client trouverait un cent manquant en additionnant le papier.
    const t = calculer([ligne(0.335, 3), ligne(0.335, 3), ligne(0.335, 3)])
    expect(t.lignes).toEqual([1.01, 1.01, 1.01])
    expect(t.sousTotalLignes).toBe(3.03)
  })
})

describe('Frais de déplacement', () => {
  it('s’ajoutent au sous-total avant taxes', () => {
    const t = calculer([ligne(100, 1)], ajustements({ fraisDeplacement: 45.5 }))
    expect(t.fraisDeplacement).toBe(45.5)
    expect(t.sousTotal).toBe(145.5)
  })

  it('sont taxables comme le reste', () => {
    const t = calculer([], ajustements({ fraisDeplacement: 100 }))
    expect(t.tps).toBe(5)
  })
})

describe('Majoration en pourcentage', () => {
  it('porte sur le sous-total augmenté des frais de déplacement', () => {
    const t = calculer([ligne(100, 1)], ajustements({ fraisDeplacement: 50, majorationPct: 10 }))
    expect(t.majoration).toBe(15)
    expect(t.sousTotal).toBe(165)
  })

  it('accepte trois décimales de pourcentage', () => {
    const t = calculer([ligne(1000, 1)], ajustements({ majorationPct: 12.5 }))
    expect(t.majoration).toBe(125)
  })
})

describe('Rabais', () => {
  it('en montant, se soustrait tel quel', () => {
    const t = calculer([ligne(200, 1)], ajustements({ rabaisMontant: 35 }))
    expect(t.rabais).toBe(35)
    expect(t.sousTotal).toBe(165)
  })

  it('en pourcentage, porte sur le montant majoré', () => {
    const t = calculer([ligne(200, 1)], ajustements({ majorationPct: 10, rabaisPct: 10 }))
    // 200 + 20 = 220, rabais 10 % = 22.
    expect(t.rabais).toBe(22)
    expect(t.sousTotal).toBe(198)
  })

  it('cumule montant puis pourcentage, le pourcentage portant sur ce qui reste', () => {
    const t = calculer([ligne(200, 1)], ajustements({ rabaisMontant: 20, rabaisPct: 10 }))
    // 200 − 20 = 180, puis 10 % de 180 = 18. Rabais total 38.
    expect(t.rabais).toBe(38)
    expect(t.sousTotal).toBe(162)
  })

  it('ne dépasse jamais le montant : l’assiette ne devient pas négative', () => {
    const t = calculer([ligne(100, 1)], ajustements({ rabaisMontant: 500 }))
    expect(t.rabais).toBe(100)
    expect(t.sousTotal).toBe(0)
    expect(t.total).toBe(0)
  })
})

describe('Ordre d’application des ajustements', () => {
  it('lignes, frais, majoration, rabais — puis taxes', () => {
    const t = calculer(
      [ligne(500, 2)],
      ajustements({
        fraisDeplacement: 100,
        majorationPct: 10,
        rabaisMontant: 50,
        rabaisPct: 5,
      }),
    )

    // 1000 lignes + 100 frais = 1100
    expect(t.sousTotalLignes).toBe(1000)
    // + 10 % = 110
    expect(t.majoration).toBe(110)
    // 1210 − 50 = 1160, puis 5 % de 1160 = 58 → rabais total 108
    expect(t.rabais).toBe(108)
    expect(t.sousTotal).toBe(1102)
  })

  it('l’ordre compte : appliquer la majoration après le rabais donnerait autre chose', () => {
    const dansLOrdre = calculer([ligne(1000, 1)], ajustements({ majorationPct: 20, rabaisPct: 20 }))
    // 1000 + 200 = 1200, − 20 % = 960.
    expect(dansLOrdre.sousTotal).toBe(960)
    // L'ordre inverse donnerait 1000 − 200 = 800, + 20 % = 960 également ici,
    // mais avec un rabais en MONTANT la différence apparaît.
    const avecMontant = calculer(
      [ligne(1000, 1)],
      ajustements({ majorationPct: 20, rabaisMontant: 200 }),
    )
    expect(avecMontant.sousTotal).toBe(1000)
    expect(avecMontant.majoration).toBe(200)
  })
})

describe('TPS et TVQ', () => {
  it('portent sur la MÊME assiette : la TVQ ignore la TPS', () => {
    const t = calculer([ligne(1000, 1)])
    expect(t.sousTotal).toBe(1000)
    expect(t.tps).toBe(50)
    expect(t.tvq).toBe(99.75)
    expect(t.total).toBe(1149.75)
  })

  it('ne se cumulent pas — la TVQ sur TPS incluse donnerait un total plus élevé', () => {
    const t = calculer([ligne(1000, 1)])
    const tvqCumulee = arrondirCent((t.sousTotal + t.tps) * TAUX_TVQ)
    expect(tvqCumulee).toBeGreaterThan(t.tvq)
    expect(t.tvq).toBe(arrondirCent(t.sousTotal * TAUX_TVQ))
  })

  it('utilise les taux fournis plutôt que les taux courants — estimation figée (EST-12)', () => {
    // Taux de la TVQ en vigueur avant 2013.
    const t = calculer([ligne(1000, 1)], AJUSTEMENTS_VIDES, {
      tps: 0.05,
      tvq: 0.095,
    })
    expect(t.tvq).toBe(95)
    expect(t.total).toBe(1145)
  })

  it('par défaut, reprend les taux de config/taxes.ts', () => {
    const t = calculer([ligne(100, 1)])
    expect(t.tps).toBe(arrondirCent(100 * TAUX_TPS))
    expect(t.tvq).toBe(arrondirCent(100 * TAUX_TVQ))
  })

  it('arrondit chaque taxe au cent', () => {
    const t = calculer([ligne(33.33, 1)])
    expect(t.tps).toBe(1.67)
    expect(t.tvq).toBe(3.32)
    expect(t.total).toBe(38.32)
  })
})

describe('Estimation vide', () => {
  it('sans ligne ni ajustement, tout vaut zéro', () => {
    const t = calculer([])
    expect(t).toEqual({
      lignes: [],
      sousTotalLignes: 0,
      fraisDeplacement: 0,
      majoration: 0,
      rabais: 0,
      sousTotal: 0,
      tps: 0,
      tvq: 0,
      total: 0,
    })
  })

  it('une ligne à quantité nulle ne fait pas apparaître de montant', () => {
    const t = calculer([ligne(120, 0)])
    expect(t.lignes).toEqual([0])
    expect(t.total).toBe(0)
  })

  it('un pourcentage appliqué à rien reste à zéro', () => {
    const t = calculer([], ajustements({ majorationPct: 25, rabaisPct: 10 }))
    expect(t.total).toBe(0)
  })
})

describe('Saisie au clavier', () => {
  it('accepte la virgule décimale', () => {
    expect(analyserNombre('12,5')).toBe(12.5)
  })

  it('accepte le point et les espaces de milliers', () => {
    expect(analyserNombre('1 234.56')).toBe(1234.56)
    expect(analyserNombre('1 234,56')).toBe(1234.56)
  })

  it('rend zéro sur une saisie vide ou incomplète, jamais NaN', () => {
    expect(analyserNombre('')).toBe(0)
    expect(analyserNombre('12,')).toBe(12)
    expect(analyserNombre(',')).toBe(0)
    expect(analyserNombre('abc')).toBe(0)
    expect(analyserNombre(null)).toBe(0)
  })
})

describe('Référence et validité', () => {
  it('compose la forme PAY-2026-014', () => {
    expect(composerReference('PAY', 2026, 14)).toBe('PAY-2026-014')
    expect(composerReference('DEV', 2026, 7)).toBe('DEV-2026-007')
  })

  it('ne tronque pas au-delà de mille estimations', () => {
    expect(composerReference('STA', 2026, 1042)).toBe('STA-2026-1042')
  })

  it('fixe la validité à trente jours', () => {
    /*
      Les instants sont écrits en UTC, et la date rendue se lit en UTC : le test
      ne doit rien devoir au fuseau de la machine qui l'exécute.
      12 h UTC le 3 août, c'est bien le 3 août au Québec.
    */
    const d = dateValidite(new Date('2026-08-03T12:00:00.000Z'))
    expect(d.toISOString()).toBe('2026-09-02T00:00:00.000Z')
  })

  it('donne la même échéance le matin et le soir du même jour', () => {
    // Deux estimations produites le même jour au Québec doivent expirer le même
    // jour — 8 h 30 et 22 h 45 heure de Montréal, soit 12 h 30 et 2 h 45 UTC.
    const matin = dateValidite(new Date('2026-08-03T12:30:00.000Z'))
    const soir = dateValidite(new Date('2026-08-04T02:45:00.000Z'))
    expect(matin.toISOString()).toBe('2026-09-02T00:00:00.000Z')
    expect(soir.getTime()).toBe(matin.getTime())
  })
})

/* ══════════════════════════════════════════════════════════════════
   Effets de bord sur le CRM — analyse statique
   ══════════════════════════════════════════════════════════════════ */

describe('Enregistrer une estimation ne détruit pas la relance en cours', () => {
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Le CRM déduit la relance courante de la DERNIÈRE interaction du client.
   *
   * La règle vaut pour des entrées saisies à la main : consigner un nouvel appel
   * remplace délibérément le plan précédent. Elle ne survit pas à une entrée
   * créée par une AUTRE partie du système — l'estimation enregistrée au dossier
   * insère une interaction « soumission » qui devient la dernière.
   *
   * Sans report explicite, la relance planifiée disparaissait de TOUS les écrans
   * de suivi : tableau de bord, colonne « Prochaine relance », carte de la
   * fiche. La ligne d'origine gardait sa date, plus personne ne la lisait, et
   * rien ne le signalait à l'utilisateur.
   *
   * Le défaut n'est visible qu'en croisant trois fichiers. Ce test le fige.
   * ─────────────────────────────────────────────────────────────────────────
   */
  const DATA = readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'estimations.ts'), 'utf8')

  const bloc = DATA.slice(
    DATA.indexOf('tx.interaction.create'),
    DATA.indexOf('tx.interaction.create') + 900,
  )

  it('l’interaction créée porte la relance de la précédente', () => {
    expect(bloc, 'La soumission doit reprendre `prochaineAction`').toContain('prochaineAction:')
    expect(bloc, 'La soumission doit reprendre `prochaineActionLe`').toContain('prochaineActionLe:')
  })

  it('la relance reportée est lue en base, jamais reçue du navigateur', () => {
    // Elle doit venir d'une lecture dans la transaction : la reprendre de
    // l'entrée laisserait un appelant forgé réécrire le plan de relance.
    const avant = DATA.slice(0, DATA.indexOf('tx.interaction.create'))
    expect(avant.slice(-700)).toContain('tx.interaction.findFirst')
  })

  it('le report ne s’applique qu’à la dernière interaction vivante', () => {
    const avant = DATA.slice(0, DATA.indexOf('tx.interaction.create'))
    expect(avant.slice(-700)).toContain('deletedAt: null')
    // Sans le drapeau `s` — il exige une cible es2018, que ce projet ne vise pas.
    expect(avant.slice(-700).replace(/\s+/g, ' ')).toMatch(/orderBy:.*date.*desc/)
  })
})
