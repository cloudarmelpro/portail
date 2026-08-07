import 'server-only'
import { z } from 'zod'

/**
 * Validation des variables d'environnement au démarrage.
 *
 * Sans ce fichier, une variable oubliée dans Coolify se manifeste par une erreur
 * cryptique en pleine utilisation, plusieurs jours après le déploiement. Ici,
 * l'application refuse de démarrer et dit exactement ce qui manque.
 *
 * Ce module est `server-only` : les secrets ne doivent jamais atteindre le
 * navigateur. Les valeurs publiques vivent dans `envPublic`, plus bas.
 */

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Neon — deux chaînes distinctes. Les inverser casse les migrations.
  DATABASE_URL: z
    .string()
    .url()
    .refine((u) => u.includes('-pooler'), {
      message: 'DATABASE_URL doit être la chaîne AVEC POOL (elle contient « -pooler »).',
    }),
  DIRECT_URL: z
    .string()
    .url()
    .refine((u) => !u.includes('-pooler'), {
      message: 'DIRECT_URL doit être la chaîne DIRECTE (sans « -pooler »).',
    }),

  BETTER_AUTH_SECRET: z.string().min(32, 'Au moins 32 caractères.'),
  BETTER_AUTH_URL: z.string().url(),

  // Stockage objet compatible S3 — Cloudflare R2 en production, MinIO en local.
  STORAGE_ENDPOINT: z
    .string()
    .url()
    .refine((u) => !/\.com\/.+/.test(u), {
      message:
        "STORAGE_ENDPOINT ne doit pas contenir le nom du bucket : le client l'ajoute lui-même.",
    }),
  STORAGE_REGION: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_BUCKET_CV: z.string().min(1),

  /**
   * Sans clé Resend, `lib/email.ts` écrit le lien dans la console en
   * développement — mais échoue en production, où un courriel non parti signifie
   * un utilisateur incapable de définir son mot de passe.
   */
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('Portail <onboarding@resend.dev>'),

  SENTRY_DSN: z.string().optional(),

  /**
   * Jeton de la route d'entretien — purge de la corbeille (CV-9).
   *
   * Facultatif, et son absence a un sens : sans lui, `/api/entretien` répond 404
   * et la route n'existe pas. Un point d'entrée destructeur ne doit pas être
   * joignable par défaut sur une installation qui ne l'a pas configuré.
   *
   * En production, il est indispensable : sans planificateur pour l'appeler,
   * RIEN n'efface jamais les fichiers supprimés — ni de la base, ni du seau.
   */
  ENTRETIEN_SECRET: z.string().min(32, 'Au moins 32 caractères.').optional(),

  /**
   * Adresses ou plages CIDR des reverse proxys placés devant l'application,
   * séparées par des virgules.
   *
   * Elles décident quelle partie de `x-forwarded-for` est digne de foi : la
   * partie gauche de cet en-tête est écrite par le client, un proxy ne fait
   * qu'ajouter à droite. Sans cette liste, Better Auth refuse de trancher dès
   * que l'en-tête porte plus d'une entrée et retombe sur un compteur unique —
   * le plafond de cinq tentatives de TR-2 cesse alors d'être par personne et
   * devient celui de toute l'application.
   */
  PROXYS_DE_CONFIANCE: z.string().optional(),

  /**
   * En-têtes consultés pour l'adresse d'origine, dans l'ordre. Le jour où
   * Cloudflare passe devant, c'est `cf-connecting-ip` qu'il faut inscrire ici —
   * et seulement ce jour-là : un en-tête déclaré sans le proxy qui le pose est
   * un en-tête que n'importe qui peut écrire.
   */
  EN_TETES_IP: z.string().default('x-forwarded-for'),
})

/** Adresse seule ou plage CIDR — les deux notations acceptées par Better Auth. */
const ADRESSE_OU_PLAGE = z.union([z.cidrv4(), z.cidrv6(), z.ipv4(), z.ipv6()])

function liste(valeur: string | undefined): string[] {
  return (valeur ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * En développement, les plages privées suffisent et personne n'a à les écrire.
 * En production la variable est exigée : une topologie devinée par défaut est
 * précisément ce qui dégrade en silence.
 */
const PROXYS_DEVELOPPEMENT = [
  '127.0.0.1/32',
  '::1/128',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
]

/**
 * `next build` s'exécute avec `NODE_ENV=production`, et il évalue ce module en
 * collectant les données de page.
 *
 * Or cette variable ne décrit pas la compilation, elle décrit le RÉSEAU DEVANT
 * l'application au moment où elle sert des requêtes. L'exiger à la compilation
 * rendrait le dépôt inconstruisible sur toute machine qui n'est pas le serveur
 * de production — y compris l'intégration continue, qui n'a aucun proxy devant
 * elle et n'aurait qu'une valeur à inventer pour passer.
 *
 * L'exigence tient donc à l'exécution, où elle a un sens, et pas avant.
 */
const enCompilation = process.env.NEXT_PHASE === 'phase-production-build'

const schemaVerifie = schema.superRefine((valeurs, ctx) => {
  const proxys = liste(valeurs.PROXYS_DE_CONFIANCE)

  if (valeurs.NODE_ENV === 'production' && !enCompilation && proxys.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['PROXYS_DE_CONFIANCE'],
      message:
        'Obligatoire en production : sans elle, le journal enregistre une adresse fournie par le client et le plafond de tentatives de connexion devient commun à tous. Pour Coolify + Traefik : 10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32,::1/128',
    })
  }

  const invalides = proxys.filter((p) => !ADRESSE_OU_PLAGE.safeParse(p).success)
  if (invalides.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['PROXYS_DE_CONFIANCE'],
      message: `Adresses ou plages CIDR invalides : ${invalides.join(', ')}.`,
    })
  }

  if (liste(valeurs.EN_TETES_IP).length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['EN_TETES_IP'],
      message: 'Au moins un nom d’en-tête, ou laissez la variable absente.',
    })
  }
})

const resultat = schemaVerifie.safeParse(process.env)

if (!resultat.success) {
  const details = resultat.error.issues
    .map((i) => `  ${i.path.join('.')} — ${i.message}`)
    .join('\n')
  throw new Error(`Variables d'environnement invalides :\n${details}\n`)
}

export const env = resultat.data

/**
 * Résolution de l'adresse d'origine — partagée par Better Auth (`lib/auth.ts`,
 * qui plafonne les tentatives de connexion) et par le journal (`lib/audit.ts`).
 *
 * Un seul objet pour les deux : deux réglages distincts finiraient par diverger,
 * et le journal désignerait une adresse que le limiteur n'a jamais comptée.
 */
export const configurationIp = {
  trustedProxies:
    liste(env.PROXYS_DE_CONFIANCE).length > 0
      ? liste(env.PROXYS_DE_CONFIANCE)
      : PROXYS_DEVELOPPEMENT,
  ipAddressHeaders: liste(env.EN_TETES_IP),
} as const

/**
 * Les variables `NEXT_PUBLIC_*` sont lues directement plutôt que via le schéma :
 * Next les remplace à la compilation, et un accès dynamique casserait ce
 * remplacement — la valeur serait `undefined` côté navigateur.
 */
export const envPublic = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const
