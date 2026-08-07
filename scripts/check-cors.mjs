/**
 * Diagnostic du téléversement direct navigateur → stockage.
 *
 *   node --env-file=.env scripts/check-cors.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le fichier ne transite pas par le serveur : le navigateur écrit DIRECTEMENT
 * dans le bucket via une URL présignée. C'est une requête vers une autre
 * origine, que le navigateur bloque tant que le bucket ne l'autorise pas.
 *
 * Ce script REJOUE la requête préalable du navigateur plutôt que de lire la
 * configuration du bucket. C'est volontaire : le jeton de l'application est
 * limité aux objets — il ne peut pas lire la configuration, et confondre
 * « illisible » avec « absente » donnerait un diagnostic faux dans les deux
 * sens.
 *
 * Le contrôle préalable, lui, ne demande aucun droit : c'est exactement ce que
 * fait le navigateur.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

async function principal() {
  const requis = [
    'STORAGE_ENDPOINT',
    'STORAGE_REGION',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
    'STORAGE_BUCKET_CV',
  ]
  const manquantes = requis.filter((k) => !process.env[k]?.trim())
  if (manquantes.length) {
    console.error('\n  ÉCHEC — absentes de .env :', manquantes.join(', '), '\n')
    return 1
  }

  const bucket = process.env.STORAGE_BUCKET_CV.trim()
  const origine = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').trim()

  const s3 = new S3Client({
    region: process.env.STORAGE_REGION.trim(),
    endpoint: process.env.STORAGE_ENDPOINT.trim(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY.trim(),
    },
  })

  console.log('\n  Configuration')
  console.log(`     bucket    ${bucket}`)
  console.log(`     origine   ${origine}`)

  const cle = `cv/_diagnostic-${Date.now()}.pdf`
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: cle, ContentType: 'application/pdf' }),
    { expiresIn: 300 },
  )

  // 1. Le lien présigné est-il valide ? Aucun contrôle CORS depuis Node.
  console.log('\n  Lien présigné')
  const envoi = await fetch(url, {
    method: 'PUT',
    body: 'diagnostic',
    headers: { 'Content-Type': 'application/pdf' },
  })

  if (!envoi.ok) {
    console.error(`     ✗ refusé (${envoi.status}) — le problème n'est PAS CORS`)
    console.error(`       ${(await envoi.text()).slice(0, 200)}\n`)
    return 1
  }
  console.log('     ✓ valide — signature, point de terminaison et bucket corrects')
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle })).catch(() => {})

  // 2. Contrôle préalable — la requête exacte que fait le navigateur.
  console.log('\n  Contrôle préalable du navigateur (OPTIONS)')
  const prealable = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: origine,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  const origineAutorisee = prealable.headers.get('access-control-allow-origin')
  const methodes = prealable.headers.get('access-control-allow-methods') ?? ''
  const enTetes = (prealable.headers.get('access-control-allow-headers') ?? '').toLowerCase()

  console.log(`     statut              ${prealable.status}`)
  console.log(`     origine autorisée   ${origineAutorisee ?? '— aucune'}`)
  console.log(`     méthodes            ${methodes || '—'}`)
  console.log(`     en-têtes            ${enTetes || '—'}`)

  const origineOk = origineAutorisee === origine || origineAutorisee === '*'
  const putOk = methodes.toUpperCase().includes('PUT')
  const contentTypeOk = enTetes.includes('content-type') || enTetes.includes('*')

  if (origineOk && putOk && contentTypeOk) {
    console.log('\n  ✓ Le navigateur est autorisé — le téléversement fonctionnera.\n')
    return 0
  }

  console.error('\n  ✗ Le navigateur sera bloqué.')
  if (!origineOk) console.error(`     — l'origine « ${origine} » n'est pas autorisée`)
  if (!putOk) console.error('     — la méthode PUT n’est pas autorisée')
  if (!contentTypeOk) console.error('     — l’en-tête « content-type » n’est pas autorisé')
  console.error(`
  À poser dans Cloudflare : R2 → ${bucket} → Settings → CORS Policy

[
  {
    "AllowedOrigins": ["${origine}"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]

  Le jeton de l'application est limité aux objets — il ne peut pas écrire cette
  règle, et c'est le bon réglage.
`)
  return 1
}

/**
 * `process.exitCode` plutôt que `process.exit()` : forcer la sortie alors qu'une
 * connexion réseau reste ouverte déclenche une assertion libuv sur Windows, et
 * ferait passer un diagnostic réussi pour un plantage.
 */
process.exitCode = await principal()
