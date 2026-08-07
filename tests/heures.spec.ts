import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ANCRAGE_PERIODES,
  NOMS_JOURS,
  PARAMETRES_DEFAUT,
  ajouterJours,
  compilerPeriode,
  cumuler,
  depasseSeuil,
  enCentiemes,
  enIso,
  formaterDecimal,
  formaterHeures,
  formaterHeuresAvecUnite,
  formaterMontant,
  grouperParSemaine,
  jour,
  joursDeSemaine,
  libelleJourMois,
  libellePeriode,
  libelleSemaine,
  lireCellule,
  lundiDe,
  montantCents,
  periodeDe,
  repartirSemaine,
  semainesDe,
  totalSemaine,
} from '@/lib/domaine/heures'

/**
 * Domaine de calcul du suivi des heures.
 *
 * Fonctions pures : ni base, ni navigateur. C'est là que se concentre l'effort
 * de test, parce que c'est là que se jouent les montants d'un registre de paie
 * conservé six ans.
 */

const H = (heures: string | number) => enCentiemes(heures)

describe('Conversion décimale', () => {
  it('convertit sans passer par un flottant', () => {
    expect(enCentiemes('7.25')).toBe(725)
    expect(enCentiemes('7,25')).toBe(725)
    expect(enCentiemes(7.5)).toBe(750)
    expect(enCentiemes('0')).toBe(0)
    expect(enCentiemes('40')).toBe(4000)
    expect(enCentiemes('22.50')).toBe(2250)
  })

  it('arrondit une troisième décimale au plus proche', () => {
    expect(enCentiemes('7.254')).toBe(725)
    expect(enCentiemes('7.255')).toBe(726)
  })

  it('refuse ce qui n’est pas un nombre décimal', () => {
    expect(() => enCentiemes('sept')).toThrow()
    expect(() => enCentiemes('')).toThrow()
  })

  it('formate à la française, sans zéro inutile', () => {
    expect(formaterHeures(3725)).toBe('37,25')
    expect(formaterHeures(750)).toBe('7,5')
    expect(formaterHeures(800)).toBe('8')
    expect(formaterHeuresAvecUnite(4025)).toBe('40,25 h')
    expect(formaterDecimal(2250)).toBe('22,50')
  })

  it('formate un montant en dollars canadiens', () => {
    // L'espace avant le symbole est une espace insécable étroite : on compare
    // sur les chiffres plutôt que sur la ponctuation produite par Intl.
    expect(formaterMontant(96750)).toContain('967,50')
    expect(formaterMontant(96750)).toContain('$')
  })
})

describe('Lecture d’une cellule de grille', () => {
  it('distingue « vide » de « zéro »', () => {
    expect(lireCellule('')).toEqual({ etat: 'vide' })
    expect(lireCellule('   ')).toEqual({ etat: 'vide' })
    expect(lireCellule('0')).toEqual({ etat: 'valeur', centiemes: 0 })
  })

  it('accepte la virgule comme le point', () => {
    expect(lireCellule('7,25')).toEqual({ etat: 'valeur', centiemes: 725 })
    expect(lireCellule('7.25')).toEqual({ etat: 'valeur', centiemes: 725 })
  })

  it('rejette au-delà de vingt-quatre heures et les saisies illisibles', () => {
    expect(lireCellule('24').etat).toBe('valeur')
    expect(lireCellule('24,01').etat).toBe('invalide')
    expect(lireCellule('8h').etat).toBe('invalide')
    expect(lireCellule('-2').etat).toBe('invalide')
    expect(lireCellule('7,255').etat).toBe('invalide')
  })
})

describe('Total hebdomadaire', () => {
  it('additionne les sept jours', () => {
    const semaine = [H(8), H(8), H(8), H(8), H(7.5), 0, 0]
    expect(totalSemaine(semaine)).toBe(H(39.5))
    expect(formaterHeuresAvecUnite(totalSemaine(semaine))).toBe('39,5 h')
  })

  it('ne dérive pas sur soixante quarts d’heure', () => {
    // 0,25 × 60 = 15 h exactement. En virgule flottante, la même somme
    // s'écarterait de la valeur juste, et l'écart se cumulerait sur l'année.
    const quarts = Array.from({ length: 60 }, () => H(0.25))
    expect(totalSemaine(quarts)).toBe(H(15))

    // La preuve par le contre-exemple : additionnées en virgule flottante, les
    // mêmes durées ne tombent pas juste.
    expect(0.1 + 0.2).not.toBe(0.3)
  })

  it('additionne des dixièmes sans reste', () => {
    expect(totalSemaine([H(0.1), H(0.2)])).toBe(H(0.3))
  })
})

describe('Heures supplémentaires — HEU-7', () => {
  it('ne déclenche rien à quarante heures pile', () => {
    const r = repartirSemaine(H(40), PARAMETRES_DEFAUT)
    expect(r.supplementaires).toBe(0)
    expect(r.normales).toBe(H(40))
    expect(depasseSeuil(H(40), PARAMETRES_DEFAUT)).toBe(false)
  })

  it('déclenche dès le quart d’heure au-delà', () => {
    const r = repartirSemaine(H(40.25), PARAMETRES_DEFAUT)
    expect(r.supplementaires).toBe(H(0.25))
    expect(r.normales).toBe(H(40))
    expect(depasseSeuil(H(40.25), PARAMETRES_DEFAUT)).toBe(true)
  })

  it('reste à zéro sous le seuil', () => {
    expect(repartirSemaine(H(39.75), PARAMETRES_DEFAUT).supplementaires).toBe(0)
  })

  it('suit un seuil paramétré et non une constante du code', () => {
    const trenteCinq = { seuilCentiemes: H(35), majorationCentiemes: 150 }
    expect(repartirSemaine(H(40), trenteCinq).supplementaires).toBe(H(5))
  })

  it('compte semaine par semaine, jamais sur le total de la période', () => {
    const p = compilerPeriode([[H(35)], [H(45)]], null, PARAMETRES_DEFAUT)
    expect(p.total).toBe(H(80))
    expect(p.supplementaires).toBe(H(5))
    expect(p.normales).toBe(H(75))
  })

  it('cumule des répartitions déjà calculées', () => {
    const a = repartirSemaine(H(42), PARAMETRES_DEFAUT)
    const b = repartirSemaine(H(38), PARAMETRES_DEFAUT)
    expect(cumuler([a, b])).toEqual({
      total: H(80),
      normales: H(78),
      supplementaires: H(2),
    })
  })
})

describe('Montant — HEU-8', () => {
  const taux = enCentiemes('22.50')

  it('majore les heures supplémentaires à une fois et demie', () => {
    const r = repartirSemaine(H(42), PARAMETRES_DEFAUT)
    // 40 × 22,50 = 900,00 · 2 × 22,50 × 1,5 = 67,50
    expect(montantCents(r, taux, PARAMETRES_DEFAUT)).toBe(96750)
    expect(formaterMontant(96750)).toContain('967,50')
  })

  it('applique la majoration paramétrée', () => {
    const doublee = { seuilCentiemes: H(40), majorationCentiemes: 200 }
    const r = repartirSemaine(H(42), doublee)
    // 900,00 + 2 × 22,50 × 2 = 990,00
    expect(montantCents(r, taux, doublee)).toBe(99000)
  })

  it('n’affiche aucun montant sans taux renseigné', () => {
    const r = repartirSemaine(H(42), PARAMETRES_DEFAUT)
    expect(montantCents(r, null, PARAMETRES_DEFAUT)).toBeNull()
    expect(compilerPeriode([[H(42)]], null, PARAMETRES_DEFAUT).montantCents).toBeNull()
  })

  it('distingue un taux inconnu d’un taux nul', () => {
    const r = repartirSemaine(H(10), PARAMETRES_DEFAUT)
    expect(montantCents(r, 0, PARAMETRES_DEFAUT)).toBe(0)
    expect(montantCents(r, null, PARAMETRES_DEFAUT)).toBeNull()
  })

  it('arrondit au cent, sans dérive du demi-cent', () => {
    // 7,25 h × 21,45 $ = 155,5125 $ → 155,51 $ arrondi au cent inférieur.
    const r = repartirSemaine(H(7.25), PARAMETRES_DEFAUT)
    expect(montantCents(r, enCentiemes('21.45'), PARAMETRES_DEFAUT)).toBe(15551)

    // 0,5 h × 21,45 $ = 10,725 $ → 10,73 $, le demi-cent monte.
    const demi = repartirSemaine(H(0.5), PARAMETRES_DEFAUT)
    expect(montantCents(demi, enCentiemes('21.45'), PARAMETRES_DEFAUT)).toBe(1073)
  })

  it('compile une période de deux semaines avec montant', () => {
    const p = compilerPeriode([[H(40)], [H(42)]], taux, PARAMETRES_DEFAUT)
    expect(p.total).toBe(H(82))
    expect(p.supplementaires).toBe(H(2))
    // 80 × 22,50 = 1 800,00 · 2 × 22,50 × 1,5 = 67,50
    expect(p.montantCents).toBe(186750)
  })
})

describe('Calendrier', () => {
  it('ramène au lundi de la semaine', () => {
    // 2026-08-05 est un mercredi.
    expect(enIso(lundiDe(jour('2026-08-05')))).toBe('2026-08-03')
    expect(enIso(lundiDe(jour('2026-08-03')))).toBe('2026-08-03')
    // Dimanche appartient à la semaine qui commence le lundi précédent.
    expect(enIso(lundiDe(jour('2026-08-09')))).toBe('2026-08-03')
  })

  it('donne sept jours consécutifs', () => {
    const jours = joursDeSemaine(jour('2026-08-03')).map(enIso)
    expect(jours).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ])
  })

  it('n’est pas déporté par l’heure d’été', () => {
    // Passage à l'heure avancée au Québec, deuxième dimanche de mars 2026.
    expect(enIso(ajouterJours(jour('2026-03-07'), 1))).toBe('2026-03-08')
    expect(enIso(ajouterJours(jour('2026-03-08'), 1))).toBe('2026-03-09')
  })

  it('découpe des périodes de paie stables, ancrées sur un lundi', () => {
    expect(jour(ANCRAGE_PERIODES).getUTCDay()).toBe(1)

    const p = periodeDe(jour('2026-08-05'), 14)
    expect(enIso(p.debut)).toBe('2026-08-03')
    expect(enIso(p.fin)).toBe('2026-08-16')

    // Un autre jour de la même période retombe sur les mêmes bornes : le
    // découpage ne glisse pas avec la semaine consultée.
    expect(enIso(periodeDe(jour('2026-08-16'), 14).debut)).toBe('2026-08-03')
    expect(enIso(periodeDe(jour('2026-08-17'), 14).debut)).toBe('2026-08-17')
  })

  it('découpe aussi avant l’ancrage', () => {
    const p = periodeDe(jour('2025-12-30'), 14)
    expect(enIso(p.debut)).toBe('2025-12-22')
    expect(enIso(p.fin)).toBe('2026-01-04')
  })

  it('donne les lundis couverts par une période', () => {
    const p = periodeDe(jour('2026-08-05'), 14)
    expect(semainesDe(p).map(enIso)).toEqual(['2026-08-03', '2026-08-10'])
  })

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Une période qui n'est pas un multiple de sept fait compter les mêmes heures
   * sur deux paies.
   *
   * Les heures supplémentaires se calculent PAR SEMAINE (HEU-7), pas par
   * période. `semainesDe` part donc du lundi précédant le début. Si la période
   * ne contient pas des semaines entières, ce lundi tombe AVANT son début — et
   * il appartient aussi à la période précédente. Les heures du lundi à cheval
   * sont alors payées deux fois, et rien ne le signale : les deux totaux sont
   * cohérents pris séparément.
   * ─────────────────────────────────────────────────────────────────────────
   */
  it('refuse une durée qui ne compte pas des semaines entières', () => {
    expect(() => periodeDe(jour('2026-08-05'), 10)).toThrow(/semaines entières/)
    expect(() => periodeDe(jour('2026-08-05'), 1)).toThrow()
    expect(() => periodeDe(jour('2026-08-05'), 15)).toThrow()

    // Les quatre durées utiles restent permises — HEU-9 dit « paramétrable ».
    for (const jours of [7, 14, 21, 28]) {
      expect(() => periodeDe(jour('2026-08-05'), jours)).not.toThrow()
    }
  })

  it('ne partage jamais une semaine entre deux périodes consécutives', () => {
    // La propriété que la contrainte protège, énoncée directement : aucun lundi
    // ne doit appartenir à deux périodes qui se suivent.
    for (const jours of [7, 14, 21, 28]) {
      const courante = periodeDe(jour('2026-08-05'), jours)
      const suivante = periodeDe(ajouterJours(courante.fin, 1), jours)

      const a = new Set(semainesDe(courante).map(enIso))
      const b = semainesDe(suivante).map(enIso)
      const communs = b.filter((lundi) => a.has(lundi))

      expect(communs, `Période de ${jours} jours — semaines comptées deux fois`).toEqual([])
    }
  })

  it('libelle la semaine et la période', () => {
    expect(libelleSemaine(jour('2026-08-03'))).toBe('Semaine du 3 au 9 août 2026')
    expect(libelleSemaine(jour('2026-07-27'))).toBe('Semaine du 27 juillet au 2 août 2026')
    expect(libellePeriode(periodeDe(jour('2026-08-05'), 14))).toBe('Période du 3 au 16 août 2026')
  })
})

describe('Regroupement par semaine', () => {
  const semaines = [jour('2026-08-03'), jour('2026-08-10')]

  it('répartit les saisies dans la bonne semaine', () => {
    const groupes = grouperParSemaine(
      [
        { date: '2026-08-03', centiemes: H(8) },
        { date: '2026-08-09', centiemes: H(4) },
        { date: '2026-08-10', centiemes: H(7.5) },
      ],
      semaines,
    )

    expect(totalSemaine(groupes[0])).toBe(H(12))
    expect(totalSemaine(groupes[1])).toBe(H(7.5))
  })

  it('ignore ce qui tombe hors des semaines demandées', () => {
    const groupes = grouperParSemaine([{ date: '2026-07-31', centiemes: H(8) }], semaines)
    expect(groupes.flat()).toEqual([])
  })

  it('sert directement la compilation d’une période', () => {
    const groupes = grouperParSemaine(
      [
        { date: '2026-08-03', centiemes: H(24) },
        { date: '2026-08-04', centiemes: H(18) },
        { date: '2026-08-10', centiemes: H(20) },
      ],
      semaines,
    )
    const p = compilerPeriode(groupes, enCentiemes('20'), PARAMETRES_DEFAUT)
    expect(p.total).toBe(H(62))
    expect(p.supplementaires).toBe(H(2))
    // 60 × 20,00 = 1 200,00 · 2 × 20,00 × 1,5 = 60,00
    expect(p.montantCents).toBe(126000)
  })
})

/* ══════════════════════════════════════════════════════════════════
   Concurrence sur une même cellule
   ══════════════════════════════════════════════════════════════════ */

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Le défaut que ces tests surveillent.
 *
 * Deux onglets qui modifient des jours DIFFÉRENTS ne se marchent pas dessus :
 * la grille ne transmet que les cellules dont la valeur affichée diffère de la
 * valeur enregistrée. Deux onglets sur la MÊME cellule, si. L'onglet A passe
 * lundi à 8 h ; l'onglet B, ouvert avant, affiche encore 7 h, on y met 7,5, et
 * la valeur de A disparaît sans un mot.
 *
 * `SaisieJour` ne porte pas de colonne `version` — délibérément : ici la valeur
 * de la cellule EST sa version. L'écran envoie `avant`, la valeur qu'il croit
 * enregistrée, et chaque écriture ne s'applique que si la base la porte encore.
 *
 * L'invariant est réparti sur quatre fichiers — le champ `avant` du composant,
 * le schéma, la condition en base, le message de l'action. Aucun ne suffit seul,
 * d'où ces contrôles.
 *
 * L'analyse est statique : `lib/data/` est marqué `server-only` et tirerait
 * Prisma et la validation de l'environnement s'il était importé. Même convention
 * que `tests/actions-garde.spec.ts` et `tests/cloisonnement.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (...chemin: string[]) => readFileSync(join(process.cwd(), ...chemin), 'utf8')

const SOURCE_DATA = lire('src', 'lib', 'data', 'heures.ts')
const SOURCE_ACTIONS = lire('src', 'lib', 'actions', 'heures.ts')
const SOURCE_VALIDATIONS = lire('src', 'lib', 'validations', 'heures.ts')
const SOURCE_GRILLE = lire('src', 'components', 'heures', 'grille-heures.tsx')
const SOURCE_SCHEMA = lire('prisma', 'schema', 'heures.prisma')

/** Retire commentaires et chaînes : un exemple en commentaire n'est pas du code. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

/**
 * Corps d'une fonction de premier niveau — jusqu'à l'accolade en début de ligne.
 * Reçoit la source déjà nettoyée, sauf quand c'est un message qui est vérifié :
 * `nettoyer` vide les chaînes.
 */
function corpsDe(source: string, nom: string): string {
  const corps = new RegExp(`function ${nom}\\([\\s\\S]*?\\n\\}`).exec(source)?.[0]
  if (!corps) throw new Error(`Fonction « ${nom} » introuvable — le test ne garantit rien.`)
  return corps
}

const CODE_DATA = nettoyer(SOURCE_DATA)
const APPLIQUER = corpsDe(CODE_DATA, 'appliquerCellule')

describe('Écriture conditionnelle des saisies — TR-10', () => {
  it('n’écrase plus rien par un upsert inconditionnel', () => {
    expect(CODE_DATA).not.toMatch(/saisieJour\.upsert\(/)
    // Les upserts restants ne portent pas sur une saisie : ligne unique des
    // paramètres, marque de clôture d'une période.
    expect(CODE_DATA).not.toMatch(/employeId_date/)
  })

  it('la valeur attendue est la condition, faute de colonne version', () => {
    expect(APPLIQUER).toMatch(/heures: decimalDe\(c\.avant\)/)

    // L'absence de `version` sur `SaisieJour` est délibérée : le schéma est
    // migré, et la valeur de la cellule suffit à tenir lieu de version. Le jour
    // où la colonne apparaîtrait, c'est ce contrôle-ci qu'il faudrait revoir.
    const modele = /model SaisieJour \{([\s\S]*?)\n\}/.exec(SOURCE_SCHEMA)?.[1] ?? ''
    expect(modele, 'model SaisieJour introuvable dans le schéma').toContain('heures')
    expect(modele).not.toMatch(/^\s*version\s+Int/m)
  })

  it('création : la contrainte d’unicité refuse la ligne apparue entre-temps', () => {
    expect(APPLIQUER).toMatch(/createMany\(\{[\s\S]*?skipDuplicates: true/)
    expect(APPLIQUER).toMatch(/creees\.count > 0/)
  })

  it('modification : la mise à jour ne s’applique qu’à la valeur attendue', () => {
    expect(APPLIQUER).toMatch(/updateMany\(\{\s*where: attendue/)
    /*
      La forme a changé — sortie anticipée plutôt que `return count > 0` — pour
      laisser place à la consignation de la valeur antérieure. Ce qui compte
      reste le même : un compte à zéro doit faire échouer l'écriture.
    */
    expect(APPLIQUER).toMatch(/modifiees\.count === 0/)
  })

  it('effacement : la suppression ne s’applique qu’à la valeur attendue', () => {
    expect(APPLIQUER).toMatch(/deleteMany\(\{\s*where: attendue/)
    expect(APPLIQUER).toMatch(/supprimees\.count === 0/)
  })

  it('aucune écriture de saisie ne contourne cette condition', () => {
    // Hors `appliquerCellule`, une seule écriture touche `saisieJour` sans
    // condition de valeur : la copie de semaine, qui remplace la cible entière.
    const ailleurs = CODE_DATA.replace(APPLIQUER, '')
    const ecritures = [...ailleurs.matchAll(/saisieJour\.(create|update|upsert|delete)\w*\(/g)].map(
      (m) => m[0],
    )
    expect(ecritures.sort()).toEqual(['saisieJour.createMany(', 'saisieJour.deleteMany('])
  })

  it('les deux chemins d’écriture passent par la même vérification', () => {
    for (const nom of ['ecrireSaisies', 'enregistrerCorrections']) {
      const corps = corpsDe(CODE_DATA, nom)
      expect(corps, `${nom} n’applique pas la condition`).toMatch(/appliquerCellule\(tx,/)
      expect(corps, `${nom} ne signale pas les cellules refusées`).toMatch(/ConflitEcriture\(/)
      // Une grille à demi écrite donnerait un total de semaine faux : la
      // sentinelle défait la transaction entière.
      expect(corps, `${nom} n’est pas transactionnel`).toMatch(/\$transaction\(/)
    }
  })

  it('la correction relit la valeur antérieure en base, jamais du navigateur', () => {
    const corps = corpsDe(CODE_DATA, 'enregistrerCorrections')
    expect(corps).toMatch(/ancienne = await tx\.saisieJour\.findFirst/)
    expect(corps).toMatch(/ancienneValeur: ancienne/)
    expect(corps).not.toMatch(/ancienneValeur: c\./)
  })
})

describe('Refus adressé à la personne devant l’écran', () => {
  const CODE_ACTIONS = nettoyer(SOURCE_ACTIONS)

  it('le refus est un ErreurMetier, seul canal dont le message survit', () => {
    // Un `Error` nu verrait son message remplacé par « Une erreur est
    // survenue » — voir `tests/erreurs.spec.ts`.
    expect(corpsDe(CODE_ACTIONS, 'refuserConflits')).toMatch(/throw new ErreurMetier\(/)
  })

  it('les deux actions d’écriture le lèvent', () => {
    expect([...CODE_ACTIONS.matchAll(/refuserConflits\(conflits\)/g)]).toHaveLength(2)
  })

  it('le message dit quoi faire et nomme les cellules refusées', () => {
    expect(SOURCE_ACTIONS).toContain('Ces heures ont été modifiées ailleurs entre-temps')
    expect(SOURCE_ACTIONS).toContain('Rechargez la page avant de recommencer.')
    // Sans le nom ni le jour, la gérante ne sait pas laquelle de ses soixante
    // saisies a été refusée, et elle refait tout.
    expect(corpsDe(SOURCE_ACTIONS, 'refuserConflits')).toMatch(/c\.nom[\s\S]*jourNomme\(c\.date\)/)
  })

  it('nomme la cellule « lundi 3 août »', () => {
    const d = jour('2026-08-03')
    expect(`${NOMS_JOURS[(d.getUTCDay() + 6) % 7]} ${libelleJourMois(d)}`).toBe('lundi 3 août')
  })
})

describe('La valeur attendue part bien de l’écran', () => {
  it('la grille joint « avant » à chaque modification transmise', () => {
    expect(nettoyer(SOURCE_GRILLE)).toMatch(/liste\.push\(\{[^}]*avant:/)
  })

  it('le schéma l’exige — une entrée sans « avant » est refusée', () => {
    expect(nettoyer(SOURCE_VALIDATIONS)).toMatch(
      /celluleSchema = z\.object\(\{[\s\S]*?avant: centiemesJour\.nullable\(\)/,
    )
  })
})

describe('Le test de concurrence peut échouer', () => {
  /**
   * Un test qui ne peut pas échouer ne sert à rien. Ceux-ci reposent sur
   * `corpsDe` : s'il renvoyait du vide, tous les contrôles ci-dessus passeraient
   * sans rien vérifier.
   */
  it('lit réellement le corps des fonctions', () => {
    expect(APPLIQUER.length).toBeGreaterThan(200)
    expect(APPLIQUER).toContain('saisieJour')
    expect(() => corpsDe(CODE_DATA, 'fonctionQuiNExistePas')).toThrow(/introuvable/)
  })

  it('détecte un upsert inconditionnel', () => {
    const faux = nettoyer(`
      await prisma.saisieJour.upsert({
        where: { employeId_date: { employeId, date } },
        update: { heures },
        create: { employeId, date, heures },
      })
    `)
    expect(faux).toMatch(/saisieJour\.upsert\(/)
  })

  it('détecte une mise à jour sans condition sur la valeur', () => {
    const faux = nettoyer(`
      const attendue = { employeId: c.employeId, date }
      await tx.saisieJour.updateMany({ where: attendue, data: { heures } })
    `)
    expect(faux).not.toMatch(/heures: decimalDe\(c\.avant\)/)
  })

  it('détecte une modification transmise sans sa valeur attendue', () => {
    const faux = nettoyer(`liste.push({ employeId, date, centiemes: apres })`)
    expect(faux).not.toMatch(/liste\.push\(\{[^}]*avant:/)
  })
})

/* ══════════════════════════════════════════════════════════════════
   Rien ne disparaît sans trace — TR-9
   ══════════════════════════════════════════════════════════════════ */

describe('Historique des saisies — TR-9', () => {
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * Vider une cellule SUPPRIMAIT la ligne, et la valeur antérieure n'existait
   * plus nulle part.
   *
   * `CorrectionHeures` ne consignait que les corrections d'après clôture. Avant
   * clôture — c'est-à-dire pendant tout le travail courant — une fausse manœuvre
   * sur « Copier la semaine précédente » effaçait une semaine entière sans
   * retour possible. Le journal d'audit, lui, n'inscrit que « Saisie d'heures »
   * et le libellé de la semaine : jamais les valeurs.
   *
   * C'était le seul module du produit où TR-9 n'était pas tenue.
   * ─────────────────────────────────────────────────────────────────────────
   */
  const DATA = readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'heures.ts'), 'utf8')
  const ACTIONS = readFileSync(join(process.cwd(), 'src', 'lib', 'actions', 'heures.ts'), 'utf8')

  it('toute suppression de saisie est consignée', () => {
    const bloc = DATA.slice(DATA.indexOf('async function appliquerCellule'))
    const suppression = bloc.slice(bloc.indexOf('deleteMany'), bloc.indexOf('updateMany'))
    expect(suppression, 'La valeur effacée doit être consignée').toContain('consigner(')
  })

  it('toute modification de valeur est consignée', () => {
    const bloc = DATA.slice(DATA.indexOf('async function appliquerCellule'))
    expect(bloc.slice(0, 2000)).toMatch(/c\.centiemes !== c\.avant\) await consigner\(/)
  })

  it('la consignation porte la valeur ANTÉRIEURE', () => {
    const bloc = DATA.slice(DATA.indexOf('async function consigner'))
    expect(bloc.slice(0, 900)).toContain('ancienneValeur')
    expect(bloc.slice(0, 900)).toContain('c.avant')
  })

  it('une saisie courante n’a pas de motif, une correction en a un', () => {
    /*
      C'est ce qui distingue les deux dans la même table : l'écran des
      corrections répond à « qui a réécrit un registre clos », il ne doit pas se
      remplir des saisies ordinaires.
    */
    const consigner = DATA.slice(DATA.indexOf('async function consigner'))
    expect(consigner.slice(0, 900)).toContain('motif: null')
    expect(DATA).toMatch(/where: \{ employeId, motif: \{ not: null \} \}/)
  })

  it('l’auteur du changement est transmis depuis l’action', () => {
    // Une trace anonyme ne répond pas à « qui a effacé ces heures ».
    expect(ACTIONS).toMatch(/ecrireSaisies\(entree\.saisies, \{/)
    expect(ACTIONS).toContain('nom: session.nom')
  })
})
