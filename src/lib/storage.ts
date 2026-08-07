import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

/**
 * Stockage objet — Cloudflare R2 en production, MinIO en développement local.
 *
 * Le code est écrit contre l'API S3, qui est le standard de fait : changer de
 * fournisseur revient à modifier trois variables d'environnement.
 */

/**
 * `forcePathStyle` est indispensable. Sans lui, le SDK construit
 * `bucket.compte.r2.cloudflarestorage.com` — ce qui casse sur MinIO et impose
 * une configuration différente entre développement et production.
 */
const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
})

const BUCKET = env.STORAGE_BUCKET_CV

/** Cinq minutes : assez pour un téléversement, trop court pour être partagé. */
const VALIDITE_SECONDES = 5 * 60

export const TYPES_ACCEPTES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/**
 * Clé d'objet — identifiant aléatoire, JAMAIS le nom du candidat.
 *
 * Une clé qui contiendrait « CV_Miora_Randrianasolo.pdf » ferait fuiter un
 * renseignement personnel dans les journaux du fournisseur, les traces
 * réseau et les messages d'erreur. Le nom d'origine reste en base, associé
 * à cette clé.
 */
export function nouvelleCle(typeMime: string): string {
  const ext = EXTENSIONS[typeMime] ?? 'bin'
  return `cv/${randomUUID()}.${ext}`
}

const EXTENSIONS_LOGO: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * Clé du logo — un identifiant ALÉATOIRE, et non `logo/<entreprise>.png`.
 *
 * Une clé déductible du nom d'entreprise serait devinable, et surtout elle
 * serait RÉUTILISÉE : déposer un nouveau logo écraserait l'ancien à la même
 * adresse, et les navigateurs qui l'ont en cache continueraient d'afficher le
 * précédent. Une clé neuve à chaque dépôt supprime les deux problèmes.
 */
export function nouvelleCleLogo(typeMime: string): string {
  const ext = EXTENSIONS_LOGO[typeMime] ?? 'bin'
  return `logo/${randomUUID()}.${ext}`
}

/**
 * Lit un objet ENTIER en mémoire.
 *
 * Réservé au logo, et le plafond de 2 Mo est ce qui rend l'opération
 * acceptable : le PDF est composé par le serveur, qui a besoin des octets de
 * l'image — un lien signé ne lui servirait à rien. Ne pas s'en servir pour un
 * CV, qui pèse jusqu'à 10 Mo et n'a aucune raison de traverser le conteneur.
 */
export async function lireObjet(cle: string): Promise<Buffer | null> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: cle }))
    const octets = await r.Body?.transformToByteArray()
    return octets ? Buffer.from(octets) : null
  } catch {
    /*
      Un logo introuvable ne doit PAS empêcher d'émettre un devis. L'objet peut
      avoir disparu du seau alors que la ligne le désigne encore ; le document
      retombe alors sur la marque écrite, ce qu'il sait déjà faire.
    */
    return null
  }
}

/**
 * Lien de téléversement direct navigateur → stockage.
 *
 * Le contenu du fichier ne traverse jamais le serveur : cela évite de saturer la
 * mémoire du conteneur sur un CV volumineux et supprime tout risque de fichier
 * résiduel sur le VPS.
 */
export async function urlTeleversement(cle: string, typeMime: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: cle, ContentType: typeMime }),
    { expiresIn: VALIDITE_SECONDES },
  )
}

/**
 * Lien de téléchargement à durée limitée.
 *
 * `ContentDisposition` restitue le nom d'origine au moment du téléchargement,
 * alors que la clé stockée reste anonyme.
 */
export async function urlTelechargement(cle: string, nomFichier: string): Promise<string> {
  // Le nom transite dans un en-tête HTTP : les guillemets et retours à la ligne
  // doivent disparaître, sinon l'en-tête peut être détourné.
  const nomSur = nomFichier.replace(/["\r\n]/g, '')

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: cle,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(nomSur)}`,
    }),
    { expiresIn: VALIDITE_SECONDES },
  )
}

/** Lien de consultation en ligne — aperçu sans téléchargement. */
export async function urlApercu(cle: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: cle, ResponseContentDisposition: 'inline' }),
    { expiresIn: VALIDITE_SECONDES },
  )
}

/**
 * Vérifie qu'un objet a réellement été déposé, et sa taille réelle.
 *
 * Le navigateur téléverse directement : sans cette vérification, on
 * enregistrerait en base des fichiers qui n'existent pas, ou dont la taille
 * annoncée diffère de la taille reçue.
 */
export async function verifierObjet(cle: string): Promise<{ taille: number; typeMime: string }> {
  const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cle }))
  return {
    taille: r.ContentLength ?? 0,
    typeMime: r.ContentType ?? 'application/octet-stream',
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Signatures de fichiers — les premiers octets, qui ne se déclarent pas.
 *
 * `verifierObjet` relit le `Content-Type` depuis le stockage, ce qui A L'AIR
 * d'une vérification. C'en est une pour la taille ; pas pour le type. Cette
 * chaîne est celle que le NAVIGATEUR a choisie à la signature de l'URL, deux
 * appels plus tôt : elle traverse le stockage sans que rien ne la confronte au
 * contenu. Annoncer « application/pdf » et téléverser un exécutable produisait
 * une signature valide, un type relu conforme, une clé en `.pdf`, et une ligne
 * en base.
 *
 * Les octets de tête, eux, sont dans le fichier. On en lit huit.
 *
 * Cela ne fait pas un antivirus, et ce n'est pas la prétention : cela garantit
 * que le fichier est du type annoncé, ce que le cahier des charges demande
 * (CV-1) et que rien ne faisait.
 * ─────────────────────────────────────────────────────────────────────────
 */
const SIGNATURES: Readonly<Record<string, readonly number[][]>> = {
  // %PDF
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  // DOCX : archive ZIP. Les trois variantes couvrent l'archive vide et le
  // fragment d'archive découpée, que produisent certains outils.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  // DOC : conteneur composé OLE2.
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],

  // PNG : les huit octets complets de l'en-tête, retours à la ligne compris —
  // ce sont eux qui trahissent un fichier abîmé par un transfert en mode texte.
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // JPEG : marqueur SOI, suivi de l'un des trois APPn courants.
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  /*
    WebP : conteneur RIFF. Les quatre octets 4 à 7 portent la TAILLE, qui varie
    d'un fichier à l'autre — la signature ne peut donc pas être contiguë. Elle
    est vérifiée à part, plus bas.
  */
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
}

/**
 * Le contenu correspond-il au type annoncé ?
 *
 * Lit les huit premiers octets de l'objet — une requête à plage, pas le fichier
 * entier : un CV de 10 Mo n'a aucune raison de transiter par le serveur pour
 * cela.
 */
export async function typeReelConforme(cle: string, typeMime: string): Promise<boolean> {
  const attendues = SIGNATURES[typeMime]
  if (!attendues) return false

  /*
    Douze octets et non huit : le WebP a besoin des positions 8 à 11. Les autres
    formats n'en lisent toujours que le début — la plage coûte le même
    aller-retour.
  */
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: cle, Range: 'bytes=0-11' }))

  const octets = await r.Body?.transformToByteArray()
  if (!octets) return false

  const debutCorrespond = attendues.some(
    (signature) => octets.length >= signature.length && signature.every((o, i) => octets[i] === o),
  )
  if (!debutCorrespond) return false

  /*
    « RIFF » seul ne dit pas WebP : le même conteneur porte aussi du WAV et de
    l'AVI. C'est le second marqueur, après les quatre octets de taille, qui
    tranche — sans lui, un fichier audio renommé passerait.
  */
  if (typeMime === 'image/webp') {
    const WEBP = [0x57, 0x45, 0x42, 0x50]
    return octets.length >= 12 && WEBP.every((o, i) => octets[8 + i] === o)
  }

  return true
}

/**
 * Suppression définitive dans le stockage.
 *
 * À n'appeler que depuis la purge de corbeille : la suppression vue par
 * l'utilisateur est un `deletedAt` en base, réversible pendant 30 jours.
 */
export async function supprimerObjet(cle: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cle }))
}
