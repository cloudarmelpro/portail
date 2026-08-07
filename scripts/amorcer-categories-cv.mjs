/**
 * Amorçage des six catégories de poste de la banque de CV — exigence CV-2.
 *
 * Lancer :  node --env-file=.env scripts/amorcer-categories-cv.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STRICTEMENT ADDITIF, et idempotent.
 *
 * La base de développement porte déjà des catégories créées à la main et des
 * CV réels qui y sont rattachés. Le script n'écrase rien, ne renomme rien, ne
 * réordonne rien : il n'ajoute que les noms absents, à la suite de l'ordre
 * existant. Le relancer ne produit aucun doublon.
 *
 * Un nom déjà porté par une catégorie MISE À LA CORBEILLE est laissé tel quel :
 * la recréer annulerait en silence une suppression décidée par
 * l'administrateur. Le script le signale, et c'est à lui de restaurer.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les catégories ne sont PAS cloisonnées par entreprise : `CategorieCv` ne
 * porte aucun `entrepriseSlug` — voir `prisma/schema/cv.prisma`. Le module sert
 * au recrutement offshore de la seule activité Staff augmentation
 * (cahier-des-charges.MD, section 4.2), et le classement se fait par poste.
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'

/** Section 19 d'architecture.MD, au caractère près. L'ordre est celui du CV-2. */
const CATEGORIES = [
  'Développeur',
  'Monteur vidéo',
  'Gérant',
  'Gestionnaire de résultat',
  'Designer',
  'Support client',
]

async function principal() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('\n  DIRECT_URL absente de l’environnement.\n')
    return 1
  }

  console.log(`\n  Base visée : ${new URL(url).host}\n`)

  const client = new pg.Client({ connectionString: url })
  await client.connect()

  const ajoutees = []
  const presentes = []
  const enCorbeille = []

  try {
    await client.query('begin')

    /*
      Les six noms sont insérés dans une seule transaction, mais l'ordre est
      calculé une fois puis incrémenté : relire le maximum à chaque tour
      donnerait le même rang à deux catégories, la lecture étant faite avant
      que la précédente ne soit visible.
    */
    const { rows } = await client.query(
      'select coalesce(max(ordre), -1)::int as n from categorie_cv',
    )
    let ordre = rows[0].n + 1
    const maintenant = new Date()

    for (const nom of CATEGORIES) {
      const existante = await client.query(
        'select id, "deletedAt" from categorie_cv where nom = $1 order by "deletedAt" nulls first limit 1',
        [nom],
      )

      if (existante.rowCount) {
        if (existante.rows[0].deletedAt) enCorbeille.push(nom)
        else presentes.push(nom)
        continue
      }

      await client.query(
        `insert into categorie_cv (id, nom, ordre, version, "createdAt", "updatedAt")
         values ($1, $2, $3, 0, $4, $4)`,
        [randomBytes(16).toString('hex'), nom, ordre, maintenant],
      )
      ajoutees.push(nom)
      ordre += 1
    }

    await client.query('commit')

    console.log(`  ✓ Catégories de CV amorcées.

     Ajoutées   ${ajoutees.length ? ajoutees.join(', ') : 'aucune'}
     Déjà là    ${presentes.length ? presentes.join(', ') : 'aucune'}
     Corbeille  ${enCorbeille.length ? `${enCorbeille.join(', ')} — à restaurer depuis « Catégories »` : 'aucune'}
`)
    return 0
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error('\n  ÉCHEC :', e.message, '\n')
    return 1
  } finally {
    await client.end()
  }
}

/**
 * `process.exitCode` plutôt que `process.exit()` : forcer la sortie avec une
 * connexion ouverte déclenche une assertion libuv sous Windows, et ferait passer
 * un amorçage réussi pour un plantage.
 */
process.exitCode = await principal()
