/**
 * Contrôle du schéma appliqué en base, et vérification que `directUrl` est bien
 * honoré par Prisma Migrate.
 *
 * Lancer :  node --env-file=.env scripts/check-schema.mjs
 */
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DIRECT_URL })
await c.connect()

const tables = await c.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
)
console.log('\n  Tables présentes')
tables.rows.forEach((r) => console.log(`     ${r.table_name}`))

const attendues = ['user', 'session', 'account', 'verification', 'audit_log', '_prisma_migrations']
const absentes = attendues.filter((t) => !tables.rows.some((r) => r.table_name === t))

const migrations = await c.query(
  `select migration_name, finished_at, applied_steps_count
   from _prisma_migrations order by started_at`,
)
console.log('\n  Migrations appliquées')
migrations.rows.forEach((r) =>
  console.log(`     ${r.migration_name}  ${r.finished_at ? 'terminée' : 'INCOMPLÈTE'}`),
)

// Contrôle ciblé : les colonnes du module d'administration de Better Auth.
const colonnes = await c.query(
  `select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'user' order by column_name`,
)
const admin = ['role', 'banned', 'banReason', 'banExpires']
const manquantes = admin.filter((k) => !colonnes.rows.some((r) => r.column_name === k))
console.log('\n  Colonnes du module admin sur « user »')
console.log(
  manquantes.length ? `     ✗ absentes : ${manquantes.join(', ')}` : '     ✓ toutes présentes',
)

await c.end()

if (absentes.length || manquantes.length) {
  console.error(`\n  ÉCHEC — tables absentes : ${absentes.join(', ') || 'aucune'}\n`)
  process.exit(1)
}
console.log('\n  ✓ Schéma conforme.\n')
