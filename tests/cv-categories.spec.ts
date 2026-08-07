import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Amorçage des catégories de poste — exigence CV-2.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le mode de panne redouté n'est pas l'absence de catégories : c'est l'écrasement.
 *
 * La base de développement porte des CV réels et des catégories créées à la
 * main. Un amorçage qui commencerait par « delete from categorie_cv » ferait
 * disparaître le classement de tout le fonds — les fichiers survivraient, leur
 * rangement non, et le reconstituer coûterait une demi-journée.
 *
 * Ce fichier tient donc deux choses : les six noms sont ceux du cahier des
 * charges, et le script n'écrit JAMAIS ailleurs que par insertion.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'analyse est statique. `lib/data/cv.ts` est marqué `server-only` et le
 * script d'amorçage ouvre une connexion Postgres : les importer ici échouerait
 * au chargement. Le test lit le texte source, il ne l'exécute pas.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Retire commentaires et chaînes : un exemple en commentaire n'est pas du code. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

/** Cahier des charges, CV-2 — et section 19 d'architecture.MD, au caractère près. */
const SIX = [
  'Développeur',
  'Monteur vidéo',
  'Gérant',
  'Gestionnaire de résultat',
  'Designer',
  'Support client',
]

const AMORCAGE = lire('scripts/amorcer-categories-cv.mjs')
const AMORCAGE_TESTS = lire('scripts/amorcer-tests.mjs')
const DATA_BRUT = lire('src/lib/data/cv.ts')
const DATA = nettoyer(DATA_BRUT)
const ACTIONS = lire('src/lib/actions/cv.ts')

/** Corps d'une action, borné par l'export suivant — les accolades ne suffisent pas. */
function corpsAction(nom: string): string {
  const debut = ACTIONS.indexOf(`export const ${nom}`)
  expect(debut, `Action introuvable : ${nom}`).toBeGreaterThan(-1)
  const suite = ACTIONS.indexOf('export const ', debut + 1)
  return ACTIONS.slice(debut, suite === -1 ? undefined : suite)
}

describe('Les six catégories du CV-2', () => {
  it('sont toutes nommées par le script d’amorçage', () => {
    for (const nom of SIX) expect(AMORCAGE, `Catégorie absente : ${nom}`).toContain(`'${nom}'`)
  })

  it('n’en amorce aucune autre', () => {
    const declarees = AMORCAGE.slice(
      AMORCAGE.indexOf('const CATEGORIES'),
      AMORCAGE.indexOf(']', AMORCAGE.indexOf('const CATEGORIES')),
    )
    expect([...declarees.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(SIX)
  })

  it('sont aussi celles de la base de test', () => {
    for (const nom of SIX)
      expect(AMORCAGE_TESTS, `Catégorie absente : ${nom}`).toContain(`'${nom}'`)
  })
})

describe('L’amorçage est strictement additif', () => {
  const code = nettoyer(AMORCAGE)

  it('n’efface rien', () => {
    expect(code).not.toMatch(/\bdelete\s+from\b/i)
    expect(code).not.toMatch(/\btruncate\b/i)
  })

  it('ne modifie aucune catégorie existante', () => {
    // Un `update` renommerait ou réordonnerait ce que l'administrateur a posé.
    expect(code).not.toMatch(/\bupdate\s+categorie_cv\b/i)
  })

  it('vérifie l’existence du nom avant d’insérer — donc se relance sans doublon', () => {
    const avantInsertion = AMORCAGE.slice(0, AMORCAGE.indexOf('insert into categorie_cv'))
    expect(avantInsertion).toContain('select id, "deletedAt" from categorie_cv where nom =')
    expect(avantInsertion).toContain('if (existante.rowCount)')
  })

  it('laisse en place un nom mis à la corbeille au lieu de le ressusciter', () => {
    // Recréer une catégorie supprimée annulerait en silence une décision
    // d'administrateur. Le script la signale et n'y touche pas.
    expect(AMORCAGE).toContain('enCorbeille')
    expect(AMORCAGE).toContain('deletedAt')
  })

  it('ajoute à la suite de l’ordre existant', () => {
    expect(AMORCAGE).toContain('select coalesce(max(ordre), -1)::int as n from categorie_cv')
  })

  it('l’amorçage de test n’insère plus « si la table est vide »', () => {
    /*
      Le contrôle portait sur la table entière : une seule catégorie créée à la
      main suffisait à empêcher l'arrivée des cinq autres.
    */
    expect(AMORCAGE_TESTS).not.toContain(`vide('categorie_cv')`)
    expect(AMORCAGE_TESTS).toContain('select 1 from categorie_cv where nom =')
  })
})

describe('Unicité des noms parmi les catégories vivantes', () => {
  /*
    `CategorieCv` ne porte pas de `@unique` sur le nom — une catégorie supprimée
    garde sa ligne, donc son nom. L'unicité est portée par le code, et c'est ce
    fichier que le commentaire de `prisma/schema/cv.prisma` désigne.
  */
  it('categorieParNom ne voit que les catégories vivantes', () => {
    const fonction = DATA.slice(DATA.indexOf('export async function categorieParNom'))
    expect(fonction.slice(0, 300)).toContain('...VIVANTS')
  })

  it('la création et le renommage la consultent tous les deux', () => {
    for (const action of ['creerCategorie', 'renommerCategorie']) {
      expect(corpsAction(action), `${action} n’appelle pas categorieParNom`).toContain(
        'categorieParNom(',
      )
    }
  })
})

describe('Catégories reçues du navigateur', () => {
  it('lib/data/cv.ts ne rend que les catégories vivantes', () => {
    const fonction = DATA.slice(DATA.indexOf('export async function categoriesVivantesParIds'))
    expect(fonction.slice(0, 400)).toContain('...VIVANTS')
  })

  it('le dépôt et le reclassement passent tous deux par le filtre', () => {
    // Sans lui, `connect` classerait un CV dans une catégorie mise à la
    // corbeille : le fichier existe, aucun écran ne le montre.
    for (const action of ['confirmerTeleversement', 'deplacerFichier']) {
      expect(corpsAction(action), `${action} ne filtre pas les catégories`).toContain(
        'categoriesRetenues(',
      )
    }
  })
})

describe('CV-10 — aucun curriculum vitæ n’est effacé par le système', () => {
  it('l’ancienneté ne sert qu’à compter et à lister', () => {
    /*
      Le client a confirmé en août 2026 que rien n'est purgé, quel que soit
      l'âge du dépôt. « Plus de 24 mois » est un repère d'écran.
    */
    const usages = [...DATA.matchAll(/seuilAnciennete\(\)/g)]
    expect(usages.length).toBeGreaterThan(0)

    for (const suppression of ['effacerFichier', 'mettreEnCorbeille']) {
      const debut = DATA.indexOf(`export async function ${suppression}`)
      const corps = DATA.slice(debut, debut + 400)
      expect(corps, `${suppression} regarde la date de dépôt`).not.toContain('deposeLe')
      expect(corps, `${suppression} regarde l’ancienneté`).not.toContain('seuilAnciennete')
    }
  })

  it('la purge ne connaît que la corbeille', () => {
    const debut = DATA.indexOf('export async function fichiersExpires')
    const corps = DATA.slice(debut, debut + 400)
    expect(corps).toContain('deletedAt')
    expect(corps).toContain('seuilCorbeille()')
    expect(corps).not.toContain('deposeLe')
  })
})
