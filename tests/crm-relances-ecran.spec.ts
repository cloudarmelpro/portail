import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Écran des relances — gabarit du produit, CRM-6.
 *
 * Les sources sont LUES plutôt qu'exécutées : la page tire `lib/data/crm.ts`,
 * marqué `server-only` — l'importer ici échouerait au chargement. Le classement
 * des relances, lui, est vérifié dans `crm-relances.spec.ts`.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/crm/[entreprise]/page.tsx')
const BANDE = lire('src/components/crm/tuiles-relances.tsx')
const BANDE_PARTAGEE = lire('src/components/shared/bande-chiffres.tsx')
const RELANCES = lire('src/components/crm/tableau-relances.tsx')
const SOUMISSIONS = lire('src/components/crm/liste-soumissions.tsx')

const CHIFFRES = [
  'À relancer aujourd’hui',
  'En retard',
  'Soumissions en attente',
  'Estimations expirant sous 7 jours',
]
const CREUX = lire('src/components/shared/liste-creux.tsx')

describe('La bande de chiffres remplace les tuiles', () => {
  it('c’est LA bande partagée, pas une seconde écrite à côté', () => {
    /*
      Les deux ont existé en parallèle, classes recopiées. Un ajustement de
      gouttière sur l'une laissait l'autre en arrière, et l'écart ne se voyait
      qu'en passant de l'administration au CRM.
    */
    expect(BANDE).toContain("from '@/components/shared/bande-chiffres'")
    expect(BANDE).toContain('<BandeChiffres')
    expect(BANDE).not.toContain('<dl')
  })

  it('traverse le panneau au même gabarit que celle de l’administration', () => {
    expect(BANDE_PARTAGEE).toContain('BANDE_PLEINE')
    expect(BANDE_PARTAGEE).toContain(
      "'border-border flex flex-wrap gap-x-10 gap-y-3 border-b py-6'",
    )
    // Plus de grille de cartes : c'est du chrome, pas du contenu.
    expect(BANDE_PARTAGEE).not.toContain('xl:grid-cols-4')
    expect(BANDE_PARTAGEE).not.toContain('rounded-[10px]')
  })

  it('porte les quatre regroupements de CRM-6', () => {
    for (const libelle of CHIFFRES) expect(BANDE).toContain(`libelle: '${libelle}'`)
  })

  it('libellé 13/18 en --ink3, valeur 17/24 semi-grasse et tabulaire', () => {
    expect(BANDE_PARTAGEE).toContain('text-ink3 text-[13px] leading-4.5')
    expect(BANDE_PARTAGEE).toContain('text-[17px] leading-6 font-semibold tabular-nums')
  })

  it('suit immédiatement la bande de navigation, avant tout contenu', () => {
    expect(PAGE.indexOf('<TuilesRelances')).toBeLessThan(PAGE.indexOf('className="mt-10 xl:mx-24"'))
  })
})

describe('Les deux chiffres d’alerte disent leur état sans la couleur', () => {
  it('prennent une icône ET un mot dès que la valeur dépasse zéro', () => {
    expect(BANDE).toContain(
      "enRetard > 0 ? { jeton: '--critical', icone: AlertTriangle, mot: 'En retard' } : null",
    )
    expect(BANDE).toContain(
      "expirantes > 0 ? { jeton: '--serious', icone: AlertCircle, mot: 'À relancer' } : null",
    )
  })

  it('ne peint que l’icône', () => {
    /*
      `--serious` mesure 2,55:1 sur ce fond. Peindre le chiffre ou le mot
      rendrait illisible l'information même que la règle « icône ET mot » sert à
      garantir.
    */
    const teintes = BANDE_PARTAGEE.match(/var\(\$\{c\.alerte\?\.jeton\}\)/g) ?? []
    expect(teintes).toHaveLength(1)

    const valeur = BANDE_PARTAGEE.slice(
      BANDE_PARTAGEE.indexOf('<dd'),
      BANDE_PARTAGEE.indexOf('</dd>'),
    )
    expect(valeur).toContain('<Icone')
    expect(valeur.slice(valeur.indexOf('{c.valeur}'))).not.toContain('jeton')
  })

  it('les deux mots sont ceux de la section 19, pas des synonymes', () => {
    expect(BANDE).toContain("mot: 'En retard'")
    expect(BANDE).toContain("mot: 'À relancer'")
  })
})

describe('L’en-tête de l’écran', () => {
  it('garde le titre de l’écran en sr-only', () => {
    // Le fil d'Ariane de l'en-tête nomme déjà l'écran ; une page sans `h1` ne se
    // parcourt pourtant pas par les titres.
    expect(PAGE).toContain('<h1 className="sr-only">Relances</h1>')
    expect(PAGE).not.toContain('text-[30px]')
  })

  it('n’ouvre aucun bouton noir : cet écran ne porte aucune action', () => {
    expect(PAGE).not.toContain('<Bouton')
  })
})

describe('Les deux listes battent la mesure du produit', () => {
  it('sont des listes en creux, pas des tableaux', () => {
    /*
      Un tableau sert à COMPARER des lignes entre elles ; ici on n'en compare
      aucune, on prend la plus urgente et on la traite. Les quatre colonnes
      faisaient lire quatre valeurs de front là où une seule décide.

      La forme vient d'un composant partagé : deux écrans qui la recopieraient
      chacun de leur côté finiraient par en avoir deux versions — c'est
      exactement ce que l'audit de design avait trouvé.
    */
    for (const [nom, source] of [
      ['relances', RELANCES],
      ['soumissions', SOUMISSIONS],
    ] as const) {
      expect(source, nom).toContain("from '@/components/shared/liste-creux'")
      expect(source, nom).toContain('<RangeeCreux')
      expect(source, nom).not.toContain('ColonneTableau')
      expect(source, nom).not.toContain('CelluleTableau')
    }
  })

  it('chaque rangée mène à la fiche du client', () => {
    /*
      C'était le NOM qui portait le lien ; c'est désormais la rangée entière,
      qui porte aussi une flèche. Une cible haute d'une rangée plutôt que la
      largeur d'un mot.
    */
    expect(RELANCES).toContain('href={`/crm/${entreprise}/clients/${r.clientId}`}')
    expect(SOUMISSIONS).toContain('s.clientId ? `/crm/${entreprise}/clients/${s.clientId}`')
  })

  it('une soumission sans client mène quand même quelque part', () => {
    // Elle n'a pas de fiche où aller : la rangée retombe sur le dossier, ce qui
    // reste vrai. Une flèche sans destination serait une promesse non tenue.
    expect(SOUMISSIONS).toContain('`/crm/${entreprise}`')
  })

  it('écrivent l’état au lieu de le mettre en pastille', () => {
    for (const source of [RELANCES, SOUMISSIONS]) {
      expect(source).not.toContain('badge-statut')
      expect(source).not.toContain('BadgeStatut')
      expect(source).not.toContain('rounded-full')
    }
    expect(SOUMISSIONS).toContain('Expiré · ')
    expect(SOUMISSIONS).toContain('Expire bientôt · ')
  })

  it('n’ouvrent pas de colonne d’actions : il n’y a aucun geste de ligne', () => {
    /*
      Le nom du client EST déjà le lien vers sa fiche. Un menu qui ne
      contiendrait que « Consulter » doublerait ce lien sans rien ajouter.
    */
    for (const source of [RELANCES, SOUMISSIONS]) {
      expect(source).not.toContain('libelle="Actions"')
      expect(source).not.toContain('MoreHorizontal')
    }
  })

  it('réservent la couleur d’état à ce qui passe le seuil de contraste', () => {
    /*
      `--critical` pur mesure 4,02:1 sur `--raised` EN SOMBRE — sous le seuil de
      4,5:1 d'un texte. Le mot prend donc `--critical-texte`, le mélange à 55 %
      vers l'encre déjà employé par `badge-statut`. L'icône garde la teinte pure,
      où le seuil n'est que de 3:1.
    */
    expect(RELANCES).toContain('text-critical-texte inline-flex')
    expect(SOUMISSIONS).toContain('text-critical-texte inline-flex')
    expect(SOUMISSIONS).toContain('text-serious-texte size-3.5')
    expect(SOUMISSIONS).not.toMatch(/text-serious(?![^\n]*(size-|-texte))/)
  })

  it('les chiffres restent en chasse tabulaire', () => {
    // Porté par la rangée partagée : montants et échéances s'alignent d'une
    // rangée à l'autre sans que chaque liste ait à le redemander.
    expect(CREUX).toContain('tabular-nums')
  })
})
