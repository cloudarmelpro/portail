import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from '@/lib/env'
import { type EntrepriseSlug, estEntreprise } from '@/config/entreprises'

/**
 * Instance unique du client Prisma.
 *
 * En développement, le rechargement à chaud recrée le module à chaque
 * modification : sans ce cache global, on épuiserait le pool de connexions Neon
 * en quelques minutes.
 */
const global_ = globalThis as unknown as { prisma?: PrismaClient }

function creerClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      /*
        ──────────────────────────────────────────────────────────────────
        Sans ces options, `node-postgres` ferme toute connexion inutilisée depuis
        DIX SECONDES.

        Mesuré : après cinq secondes d'inactivité, la requête suivante coûte
        270 ms ; après dix, elle coûte 1 976 ms. La différence est la poignée de
        main complète — TCP, TLS, démarrage Postgres, puis SCRAM avec liaison de
        canal, que `channel_binding=require` rend plus bavard encore.

        Trois personnes sur un outil interne laissent presque toujours passer
        plus de dix secondes entre deux clics. C'est ce qui faisait paraître
        l'application lente PAR MOMENTS, sans qu'aucune requête ne soit en cause.

        Trente minutes : plus long qu'une pause de réflexion, plus court que la
        mise en veille d'un point d'entrée Neon. `max` reste à dix — le monter
        n'accélère rien tant que les écrans envoient leurs requêtes par vagues.
        ──────────────────────────────────────────────────────────────────
      */
      idleTimeoutMillis: 30 * 60 * 1000,
      max: 10,
    }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = global_.prisma ?? creerClient()
if (env.NODE_ENV !== 'production') global_.prisma = prisma

/* ══════════════════════════════════════════════════════════════════
   Cloisonnement par entreprise
   ══════════════════════════════════════════════════════════════════ */

/**
 * Modèles portant une colonne `entrepriseSlug`, donc soumis au cloisonnement.
 *
 * Un modèle qui rejoint cette liste voit sa condition d'entreprise injectée
 * dans toutes ses requêtes, sans exception et sans que l'appelant ait à y
 * penser.
 *
 * `Employe` et les modèles du suivi des heures n'y figurent PAS, délibérément :
 * la grille hebdomadaire présente tous les employés des trois entreprises en une
 * seule vue (exigence HEU-2). L'entreprise y est un attribut de regroupement,
 * pas une frontière d'accès.
 *
 * `tests/cloisonnement.spec.ts` vérifie que cette liste couvre exactement les
 * modèles déclarant `entrepriseSlug` dans le schéma — un modèle ajouté au
 * schéma et oublié ici ferait tomber le test.
 */
export const MODELES_CLOISONNES = new Set<string>([
  'Client',
  'Interaction',
  'Estimation',
  'LigneEstimation',
  'GrilleTarifs',
  'ProduitTarif',
  'SequenceEstimation',
  'Organisation',
])

/**
 * Client cadré sur une entreprise.
 *
 * L'extension injecte la condition dans **toutes** les opérations touchant un
 * modèle cloisonné : lectures, écritures, comptages, suppressions.
 *
 * Écrire « la condition d'entreprise figure dans toutes les requêtes » revient à
 * l'écrire cinquante fois sans jamais se tromper. Ça finirait par arriver — et le
 * symptôme serait silencieux : l'identifiant est unique, la requête aboutit, et
 * un client de Paysagement s'affiche dans le dossier Développement web.
 *
 * Les fonctions de `lib/data/` touchant le CRM ou le calculateur ne reçoivent que
 * ce client. Elles ne peuvent alors physiquement pas sortir du périmètre.
 */
export function prismaCadre(slug: EntrepriseSlug) {
  if (!estEntreprise(slug)) {
    // Le slug vient de l'URL : il est saisi par l'utilisateur, donc sans valeur
    // de preuve. Cette vérification est la dernière ligne de défense.
    throw new Error(`Entreprise inconnue : ${String(slug)}`)
  }

  return prisma.$extends({
    name: 'cloisonnement-entreprise',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELES_CLOISONNES.has(model)) return query(args)

          const a = args as Record<string, unknown>

          // Écritures : on impose le slug plutôt que de faire confiance à l'appelant.
          if (operation === 'create') {
            a.data = { ...(a.data as object), entrepriseSlug: slug }
            return query(a)
          }
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const d = a.data
            a.data = Array.isArray(d)
              ? d.map((x) => ({ ...(x as object), entrepriseSlug: slug }))
              : { ...(d as object), entrepriseSlug: slug }
            return query(a)
          }
          if (operation === 'upsert') {
            a.create = { ...(a.create as object), entrepriseSlug: slug }
            a.where = { ...(a.where as object), entrepriseSlug: slug }
            return query(a)
          }

          // Lectures et mutations ciblées : la condition accompagne l'identifiant,
          // elle ne le remplace jamais.
          a.where = { ...((a.where as object) ?? {}), entrepriseSlug: slug }
          return query(a)
        },
      },
    },
  })
}

export type PrismaCadre = ReturnType<typeof prismaCadre>

/**
 * Déclare `entrepriseSlug` comme fourni, à la création d'un modèle cloisonné.
 *
 * Une extension `query` agit à l'exécution ; les types générés par Prisma, eux,
 * exigent la colonne à la compilation puisqu'elle est obligatoire. Sans ce pont,
 * aucun `create` sur un modèle cloisonné ne compile.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il déclare la colonne fournie SANS jamais l'écrire, et c'est la seule forme
 * acceptable.
 *
 * Écrire le slug à la main compilerait tout aussi bien — et ferait passer une
 * écriture hors cadre pour une écriture cadrée le jour où l'extension cesserait
 * d'agir. Ici, ce jour-là, la base refuse l'insertion : la colonne est NOT NULL
 * et personne ne l'a remplie. L'échec est bruyant, donc réparable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les trois modules cloisonnés en avaient chacun écrit leur copie.
 */
export function cadre<T>(donnees: T): T & { entrepriseSlug: string } {
  return donnees as T & { entrepriseSlug: string }
}
