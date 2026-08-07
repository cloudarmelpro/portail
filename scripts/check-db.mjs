/**
 * Vérification de la base — les DEUX chaînes Neon, séparément.
 *
 * Lancer :  node --env-file=.env scripts/check-db.mjs
 *
 * DATABASE_URL passe par PgBouncer en mode transaction : l'application y ouvre
 * beaucoup de connexions courtes.
 * DIRECT_URL contourne le pool : Prisma Migrate a besoin de verrous consultatifs
 * et de DDL au niveau de la session, que le mode transaction ne supporte pas.
 *
 * Les tester ensemble ne prouverait rien — c'est justement leur inversion qui est
 * l'erreur classique, et elle ne se manifeste qu'à la première migration.
 */
import pg from 'pg'

const attendus = [
  ['DATABASE_URL', 'avec pool', true],
  ['DIRECT_URL', 'directe', false],
]

const manquantes = attendus.filter(([k]) => !process.env[k]?.trim()).map(([k]) => k)
if (manquantes.length) {
  console.error('\n  ÉCHEC — absentes de .env :', manquantes.join(', '), '\n')
  process.exit(1)
}

console.log('\n  Forme des chaînes')
let formeOk = true
for (const [cle, libelle, doitAvoirPooler] of attendus) {
  const url = process.env[cle].trim()
  const aPooler = url.includes('-pooler')
  const ok = aPooler === doitAvoirPooler
  if (!ok) formeOk = false
  const hote = url.match(/@([^/]+)\//)?.[1] ?? '?'
  console.log(`     ${ok ? '✓' : '✗'} ${cle.padEnd(13)} ${libelle.padEnd(11)} ${hote}`)
}
if (!formeOk) {
  console.error('\n  Les deux chaînes semblent inversées.')
  console.error('  DATABASE_URL doit contenir « -pooler », DIRECT_URL non.\n')
  process.exit(1)
}

const etapes = []
async function tester(cle, actions) {
  const client = new pg.Client({ connectionString: process.env[cle].trim() })
  console.log(`\n  ${cle}`)
  try {
    await client.connect()
    for (const [nom, fn] of actions) {
      try {
        await fn(client)
        console.log(`     ✓ ${nom}`)
      } catch (e) {
        console.log(`     ✗ ${nom} — ${e.message}`)
        etapes.push([cle, nom, e])
      }
    }
  } catch (e) {
    console.log(`     ✗ connexion — ${e.message}`)
    etapes.push([cle, 'connexion', e])
  } finally {
    await client.end().catch(() => {})
  }
}

const table = `_verif_${Date.now()}`

await tester('DATABASE_URL', [
  ['requête simple', (c) => c.query('SELECT 1')],
  [
    'version PostgreSQL',
    async (c) => {
      const r = await c.query('SHOW server_version')
      console.log(`        PostgreSQL ${r.rows[0].server_version}`)
    },
  ],
])

await tester('DIRECT_URL', [
  // Le DDL est ce que le mode transaction de PgBouncer ne supporte pas :
  // c'est donc le seul test qui distingue vraiment les deux chaînes.
  ['création de table (DDL)', (c) => c.query(`CREATE TABLE "${table}" (id int)`)],
  ['écriture', (c) => c.query(`INSERT INTO "${table}" VALUES (1)`)],
  [
    'lecture',
    async (c) => {
      const r = await c.query(`SELECT id FROM "${table}"`)
      if (r.rows[0]?.id !== 1) throw new Error('valeur relue inattendue')
    },
  ],
  ['verrou consultatif', (c) => c.query('SELECT pg_advisory_lock(42)')],
  ['libération du verrou', (c) => c.query('SELECT pg_advisory_unlock(42)')],
  ['suppression de table', (c) => c.query(`DROP TABLE "${table}"`)],
])

if (!etapes.length) {
  console.log('\n  ✓ La base est opérationnelle — les deux chaînes sont correctes.\n')
  process.exit(0)
}

console.error('\n  ÉCHEC. Pistes selon l’erreur :')
console.error('     password authentication failed        → mot de passe erroné dans la chaîne')
console.error('     ENOTFOUND / EAI_AGAIN                 → nom d’hôte incorrect')
console.error('     prepared statement … already exists   → chaîne AVEC pool utilisée pour du DDL')
console.error('     cannot insert multiple commands       → chaînes inversées')
console.error('     SSL / certificate                     → « sslmode=require » manquant\n')
process.exit(1)
