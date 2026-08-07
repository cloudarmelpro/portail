import 'server-only'
import { prisma, type PrismaCadre } from '@/lib/prisma'

/**
 * Couche d'accès aux données — recherche de la palette de commandes (TR-11).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce que ces fonctions rendent, et surtout ce qu'elles ne rendent pas.
 *
 * Un nom, un libellé, une référence, un identifiant : de quoi écrire une ligne
 * et fabriquer un lien, rien de plus. Aucun montant, aucun taux horaire, aucune
 * clé de stockage ne franchit cette frontière — la palette est le seul écran de
 * l'application qui interroge les quatre modules à la fois, et une colonne
 * ajoutée « par commodité » ici contournerait d'un coup les quatre gardes
 * d'écran. `tests/recherche.spec.ts` relit ce fichier pour l'imposer.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Clients et estimations reçoivent `db: PrismaCadre`, déjà cadré sur une
 * entreprise, et n'écrivent jamais `entrepriseSlug` à la main. L'appelant
 * interroge les trois entreprises une par une : le résultat doit dire de
 * laquelle il vient, sinon deux homonymes sont indistinguables.
 *
 * Employés et fichiers de CV ne sont pas cloisonnés — voir la note d'en-tête de
 * `lib/prisma.ts` sur `MODELES_CLOISONNES`.
 */

/**
 * En deçà, on ne cherche rien. Une lettre isolée ramène la moitié de la base à
 * chaque frappe, pour une réponse qu'on ne peut pas lire.
 *
 * La palette applique le même plancher côté client pour ne pas émettre la
 * requête ; celui-ci reste la seule garantie, la route étant appelable
 * directement.
 */
export const TERME_MINIMUM = 2

/** Une poignée par famille : la palette se lit d'un coup d'œil, elle ne pagine pas. */
export const MAX_PAR_FAMILLE = 5

const VIVANTS = { deletedAt: null } as const

function contient(terme: string) {
  return { contains: terme, mode: 'insensitive' as const }
}

/** Ligne d'un résultat désigné par son nom. */
export type LigneNommee = { id: string; nom: string }

/** Ligne d'un résultat désigné par sa référence — « PAY-2026-014 ». */
export type LigneReferencee = { id: string; reference: string }

/**
 * Résultat prêt pour l'affichage. `entreprise` porte le NOM écrit de
 * l'entreprise, jamais son slug ni sa couleur : la palette l'affiche en toutes
 * lettres à côté du libellé.
 */
export type ResultatRecherche = {
  id: string
  libelle: string
  href: string
  entreprise?: string
}

export type ReponseRecherche = {
  clients: ResultatRecherche[]
  employes: ResultatRecherche[]
  fichiers: ResultatRecherche[]
  estimations: ResultatRecherche[]
}

export async function chercherClients(db: PrismaCadre, terme: string): Promise<LigneNommee[]> {
  return db.client.findMany({
    where: { ...VIVANTS, nom: contient(terme) },
    orderBy: { nom: 'asc' },
    take: MAX_PAR_FAMILLE,
    select: { id: true, nom: true },
  })
}

/** Les employés inactifs restent atteignables : leurs heures passées le sont aussi. */
export async function chercherEmployes(terme: string): Promise<LigneNommee[]> {
  return prisma.employe.findMany({
    where: { ...VIVANTS, nom: contient(terme) },
    orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    take: MAX_PAR_FAMILLE,
    select: { id: true, nom: true },
  })
}

export async function chercherFichiersCv(terme: string): Promise<LigneNommee[]> {
  return prisma.fichierCv.findMany({
    where: { ...VIVANTS, nom: contient(terme) },
    orderBy: { deposeLe: 'desc' },
    take: MAX_PAR_FAMILLE,
    select: { id: true, nom: true },
  })
}

export async function chercherEstimations(
  db: PrismaCadre,
  terme: string,
): Promise<LigneReferencee[]> {
  return db.estimation.findMany({
    where: { ...VIVANTS, reference: contient(terme) },
    orderBy: [{ annee: 'desc' }, { numero: 'desc' }],
    take: MAX_PAR_FAMILLE,
    select: { id: true, reference: true },
  })
}
