import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Configuration de l'OUTIL Prisma — migrations, génération, Studio.
 * Elle n'est jamais lue par l'application : le client d'exécution est construit
 * dans `lib/prisma.ts`, avec l'adaptateur `pg`.
 *
 * D'où la répartition, qui n'est pas une erreur de copie :
 *
 *   ici               → DIRECT_URL   (l'outil : DDL, verrous consultatifs)
 *   lib/prisma.ts     → DATABASE_URL (l'application : connexions courtes, pool)
 *
 * Prisma Migrate a besoin d'opérations au niveau de la session que PgBouncer en
 * mode transaction ne supporte pas. Pointer l'outil vers la chaîne avec pool
 * fonctionne parfois — jusqu'à la migration qui échoue sans raison apparente.
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
