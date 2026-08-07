/**
 * Vérification du stockage objet — aller-retour complet sur le bucket.
 *
 * Lancer :  node --env-file=.env scripts/check-storage.mjs
 *
 * Le script lit les identifiants depuis l'environnement et ne les affiche jamais.
 * Il écrit un objet de test, le relit, le supprime, puis rend un verdict.
 * Un simple listage ne prouverait pas le droit d'écriture — or c'est celui-là
 * qui manque le plus souvent quand un jeton a été créé en lecture seule.
 */
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'

const REQUIS = [
  'STORAGE_ENDPOINT',
  'STORAGE_REGION',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_BUCKET_CV',
]

const manquantes = REQUIS.filter((k) => !process.env[k]?.trim())
if (manquantes.length) {
  console.error('\n  ÉCHEC — variables absentes de .env :')
  manquantes.forEach((k) => console.error(`     ${k}`))
  process.exit(1)
}

const endpoint = process.env.STORAGE_ENDPOINT.trim()
const bucket = process.env.STORAGE_BUCKET_CV.trim()

// Masquage : on confirme la forme des valeurs sans jamais les révéler.
const masque = (v) => (v.length <= 8 ? '•'.repeat(v.length) : v.slice(0, 4) + '…' + v.slice(-4))

console.log('\n  Configuration lue')
console.log(`     point de terminaison  ${endpoint}`)
console.log(`     bucket                ${bucket}`)
console.log(`     région                ${process.env.STORAGE_REGION}`)
console.log(`     clé d'accès           ${masque(process.env.STORAGE_ACCESS_KEY_ID.trim())}`)
console.log(`     secret                ${masque(process.env.STORAGE_SECRET_ACCESS_KEY.trim())}`)

/**
 * `forcePathStyle` est requis : sans lui le SDK construit
 * `bucket.<compte>.r2.cloudflarestorage.com`, et la même configuration
 * cesserait de fonctionner sur MinIO en développement local.
 */
const s3 = new S3Client({
  region: process.env.STORAGE_REGION.trim(),
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY.trim(),
  },
})

const cle = `_verification/${Date.now()}.txt`
const contenu = 'verification portail'
const etapes = []

async function etape(nom, fn) {
  try {
    await fn()
    etapes.push([nom, true, null])
    console.log(`     ✓ ${nom}`)
  } catch (e) {
    etapes.push([nom, false, e])
    console.log(`     ✗ ${nom} — ${e.name}: ${e.message}`)
  }
}

console.log('\n  Aller-retour')

await etape('accès au bucket', () => s3.send(new HeadBucketCommand({ Bucket: bucket })))
await etape('listage', () => s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })))
await etape('écriture', () =>
  s3.send(new PutObjectCommand({ Bucket: bucket, Key: cle, Body: contenu, ContentType: 'text/plain' })),
)
await etape('lecture', async () => {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: cle }))
  const lu = await r.Body.transformToString()
  if (lu !== contenu) throw new Error(`contenu relu inattendu : « ${lu} »`)
})
await etape('suppression', () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle })))

const echecs = etapes.filter(([, ok]) => !ok)

if (!echecs.length) {
  console.log('\n  ✓ Le stockage est opérationnel — lecture et écriture confirmées.\n')
  process.exit(0)
}

console.error('\n  ÉCHEC. Pistes selon l’erreur :')
console.error('     InvalidAccessKeyId / SignatureDoesNotMatch  → clés mal copiées, ou espace parasite')
console.error('     NoSuchBucket                                → nom de bucket incorrect')
console.error('     AccessDenied sur écriture uniquement        → jeton créé en lecture seule')
console.error('     AccessDenied partout                        → jeton non rattaché à ce bucket')
console.error('     ENOTFOUND / EAI_AGAIN                       → point de terminaison erroné\n')
process.exit(1)
