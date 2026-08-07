import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Couche d'accès aux données — banque de CV.
 *
 * INVARIANT N°2 : aucun appel Prisma n'est écrit hors de `lib/data/`. C'est le
 * seul dossier à auditer quand on se demande qui peut lire quoi.
 *
 * Ce module n'est PAS cadré par entreprise : le cahier des charges est explicite,
 * la banque de CV n'est pas déclinée par entreprise (section 4.2).
 */

/**
 * Repère d'ancienneté — exigence CV-10.
 *
 * Ce n'est PAS une échéance : le client a confirmé qu'aucun curriculum vitæ
 * n'est jamais effacé, quel que soit son âge. Le dossier « Plus de 24 mois »
 * signale, il ne prépare aucune suppression.
 *
 * Le préavis de deux mois qui existait ici n'avait de sens que face à une date
 * limite : il faisait apparaître dans le dossier des CV de vingt-deux mois, que
 * son nom annonce pourtant à plus de vingt-quatre.
 */
export const CONSERVATION_MOIS = 24
/** Rétention en corbeille avant purge — exigence CV-9. */
export const CORBEILLE_JOURS = 30

export function echeanceDe(deposeLe: Date): Date {
  const d = new Date(deposeLe)
  d.setMonth(d.getMonth() + CONSERVATION_MOIS)
  return d
}

/** Date de dépôt au-delà de laquelle un CV a plus de 24 mois. */
function seuilAnciennete(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - CONSERVATION_MOIS)
  return d
}

/** Toutes les requêtes excluent les fichiers en corbeille, sauf mention contraire. */
const VIVANTS = { deletedAt: null } as const

const CHAMPS = {
  id: true,
  nom: true,
  cle: true,
  taille: true,
  typeMime: true,
  deposeLe: true,
  deposeParNom: true,
  version: true,
  categories: { select: { id: true, nom: true } },
} as const

export type FichierListe = Awaited<ReturnType<typeof listerFichiers>>[number]

export async function listerCategories() {
  return prisma.categorieCv.findMany({
    // Sans ce filtre, une catégorie supprimée reparaîtrait comme dossier sur
    // l'écran d'accueil du module, et dans la liste du dialogue de reclassement.
    where: VIVANTS,
    orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    select: {
      id: true,
      nom: true,
      // Nécessaire au renommage : sans elle, l'écran ne peut pas prouver qu'il
      // travaille sur la version qu'il a lue.
      version: true,
      _count: { select: { fichiers: { where: VIVANTS } } },
    },
  })
}

export async function compterTous() {
  return prisma.fichierCv.count({ where: VIVANTS })
}

export async function compterNonClasses() {
  return prisma.fichierCv.count({ where: { ...VIVANTS, categories: { none: {} } } })
}

export async function compterAEcheance() {
  return prisma.fichierCv.count({ where: { ...VIVANTS, deposeLe: { lte: seuilAnciennete() } } })
}

type Filtre =
  | { type: 'tous' }
  | { type: 'non-classes' }
  | { type: 'echeance' }
  | { type: 'categorie'; categorieId: string }

/**
 * Les relations sont ramenées en une fois plutôt qu'en cascade : la base est
 * distante, chaque aller-retour vers Neon coûte.
 */
export async function listerFichiers(filtre: Filtre, recherche?: string, limite?: number) {
  const where = {
    ...VIVANTS,
    ...(filtre.type === 'non-classes' && { categories: { none: {} } }),
    ...(filtre.type === 'echeance' && { deposeLe: { lte: seuilAnciennete() } }),
    ...(filtre.type === 'categorie' && { categories: { some: { id: filtre.categorieId } } }),
    ...(recherche?.trim() && {
      nom: { contains: recherche.trim(), mode: 'insensitive' as const },
    }),
  }

  return prisma.fichierCv.findMany({
    where,
    orderBy: { deposeLe: 'desc' },
    // La racine n'affiche que les derniers dépôts et renvoie au dossier complet
    // pour le reste : elle montre déjà tous les dossiers au-dessus.
    ...(limite !== undefined && { take: limite }),
    select: CHAMPS,
  })
}

export async function fichierParId(id: string) {
  return prisma.fichierCv.findFirst({ where: { id, ...VIVANTS }, select: CHAMPS })
}

export async function categorieParId(id: string) {
  // Une catégorie supprimée n'est plus atteignable par son URL : la vue
  // afficherait des fichiers sous un dossier qui n'existe plus.
  return prisma.categorieCv.findFirst({
    where: { id, ...VIVANTS },
    select: { id: true, nom: true },
  })
}

/**
 * Contrôle d'homonymie parmi les catégories VIVANTES.
 *
 * La base ne porte plus de contrainte d'unicité sur le nom — voir le commentaire
 * de « CategorieCv » dans le schéma. Cette fonction est donc la seule chose qui
 * empêche deux « Designer » de coexister, et elle doit rester consultée par
 * « creerCategorie » comme par « renommerCategorie ».
 */
export async function categorieParNom(nom: string) {
  return prisma.categorieCv.findFirst({
    where: { nom, ...VIVANTS },
    select: { id: true, nom: true },
  })
}

/**
 * Ne renvoie que les identifiants qui désignent une catégorie VIVANTE.
 *
 * Les identifiants arrivent du navigateur — dépôt par lot, reclassement — et
 * `connect` accepterait sans broncher une catégorie mise à la corbeille : le
 * fichier serait classé dans un dossier qu'aucun écran n'affiche plus.
 */
export async function categoriesVivantesParIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []

  const trouvees = await prisma.categorieCv.findMany({
    where: { id: { in: ids }, ...VIVANTS },
    select: { id: true },
  })

  return trouvees.map((c) => c.id)
}

/** Frontière de la corbeille : au-delà, un fichier est à effacer pour de bon. */
function seuilCorbeille(): Date {
  const d = new Date()
  d.setDate(d.getDate() - CORBEILLE_JOURS)
  return d
}

/**
 * Corbeille — réservée à l'administrateur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elle montre TOUT ce qui est supprimé, y compris au-delà des 30 jours.
 *
 * Le filtre `gte: seuilCorbeille()` paraissait juste — « la corbeille garde
 * trente jours » — et créait un trou : au 31ᵉ jour, un fichier quittait cet
 * écran sans avoir été effacé. Il restait en base et dans le seau, sans plus
 * aucun moyen de l'atteindre, ni pour le restaurer ni pour le purger. Un objet
 * inaccessible et jamais détruit est le contraire d'une politique de
 * conservation.
 *
 * La règle des trente jours reste : c'est `fichiersExpires` qui la porte, et la
 * purge qui l'applique. L'écran, lui, ne cache rien — un fichier « à purger »
 * s'y voit, ce qui rend visible le fait que la purge n'a pas tourné.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function listerCorbeille() {
  return prisma.fichierCv.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select: { ...CHAMPS, deletedAt: true, supprimeParNom: true },
  })
}

export async function fichiersExpires() {
  return prisma.fichierCv.findMany({
    where: { deletedAt: { not: null, lt: seuilCorbeille() } },
    select: { id: true, cle: true },
  })
}

/* ══════════════════════════════════════════════════════════════════
   Écritures — appelées par les actions, qui gardent permission,
   validation et journal.
   ══════════════════════════════════════════════════════════════════ */

type NouveauFichier = {
  nom: string
  cle: string
  taille: number
  typeMime: string
  deposeParId: string | null
  deposeParNom: string
  categorieIds: string[]
}

/**
 * La clé de dépôt a-t-elle déjà servi ?
 *
 * La colonne est `@unique`, donc un rejeu casserait de toute façon — mais sur
 * une violation de contrainte, que la fabrique remplace par un message
 * générique. Le contrôle explicite dit ce qui s'est passé, et il évite surtout
 * de traverser `verifierObjet` et `typeReelConforme` pour rien.
 */
export async function cleDejaUtilisee(cle: string): Promise<boolean> {
  return (await prisma.fichierCv.count({ where: { cle } })) > 0
}

export async function creerFichier(donnees: NouveauFichier) {
  return prisma.fichierCv.create({
    data: {
      nom: donnees.nom,
      cle: donnees.cle,
      taille: donnees.taille,
      typeMime: donnees.typeMime,
      deposeParId: donnees.deposeParId,
      deposeParNom: donnees.deposeParNom,
      categories: { connect: donnees.categorieIds.map((id) => ({ id })) },
    },
    select: { id: true },
  })
}

/**
 * Reclassement sous contrôle de version : deux onglets qui reclassent le même
 * fichier ne doivent pas se contredire sans que personne le sache. Renvoie
 * `false` si la version fournie est périmée — l'appelant en fait un message.
 *
 * L'incrément de version et le reclassement tiennent dans UNE transaction :
 * séparés, un échec du second laisserait la version incrémentée sans changement
 * associé, et l'onglet concurrent serait invité à recharger pour une
 * modification qui n'a jamais eu lieu.
 */
export async function reclasserFichier(entree: {
  fichierId: string
  version: number
  categorieIds: string[]
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const maj = await tx.fichierCv.updateMany({
      where: { id: entree.fichierId, version: entree.version, ...VIVANTS },
      data: { version: { increment: 1 } },
    })

    if (maj.count === 0) return false

    await tx.fichierCv.update({
      where: { id: entree.fichierId },
      data: { categories: { set: entree.categorieIds.map((id) => ({ id })) } },
    })

    return true
  })
}

/**
 * Les deux bascules de corbeille refusent de rejouer l'état où elles sont déjà.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sans la condition, supprimer un fichier DÉJÀ en corbeille l'écrasait.
 *
 * Le nom du premier auteur disparaissait de l'écran de corbeille — remplacé par
 * celui du second — et le compteur des trente jours repartait à zéro : un
 * fichier pouvait rester indéfiniment hors de la purge. `restaurerClient`, dans
 * le CRM, portait déjà cette condition et l'expliquait ; les deux modules ne
 * suivaient pas la même règle.
 *
 * `updateMany` plutôt qu'`update` : sur une condition non satisfaite, le premier
 * ne fait rien quand le second lève. Les deux appelants sont des actions dont le
 * geste est idempotent du point de vue de l'utilisateur.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function mettreEnCorbeille(id: string, supprimeParNom: string) {
  await prisma.fichierCv.updateMany({
    where: { id, ...VIVANTS },
    data: { deletedAt: new Date(), supprimeParNom },
  })
}

export async function sortirDeCorbeille(id: string) {
  await prisma.fichierCv.updateMany({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null, supprimeParNom: null },
  })
}

export async function effacerFichier(id: string) {
  await prisma.fichierCv.delete({ where: { id } })
}

export async function ajouterCategorie(nom: string) {
  const derniere = await prisma.categorieCv.findFirst({
    where: VIVANTS,
    orderBy: { ordre: 'desc' },
  })

  return prisma.categorieCv.create({
    data: { nom, ordre: (derniere?.ordre ?? 0) + 1 },
    select: { id: true },
  })
}

/**
 * Renommage avec contrôle de concurrence (TR-10). Retourne `false` si la
 * catégorie a bougé entre-temps — deux onglets qui la renomment ne doivent pas
 * s'écraser en silence.
 */
export async function changerNomCategorie(
  id: string,
  nom: string,
  version: number,
): Promise<boolean> {
  const { count } = await prisma.categorieCv.updateMany({
    where: { id, version, ...VIVANTS },
    data: { nom, version: { increment: 1 } },
  })
  return count > 0
}

/**
 * Une transaction : un ordre partiellement écrit donnerait deux catégories au
 * même rang, et un affichage instable d'un rechargement à l'autre.
 */
export async function ordonnerCategories(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) => prisma.categorieCv.update({ where: { id }, data: { ordre: index } })),
  )
}

/**
 * Suppression réversible (TR-9). Les fichiers basculent en « Non classé »
 * puisque la relation est une étiquette, mais la structure de classement reste
 * restaurable — la reconstituer à la main coûterait une demi-journée.
 */
export async function retirerCategorie(id: string, supprimeParNom: string) {
  await prisma.categorieCv.update({
    where: { id },
    data: { deletedAt: new Date(), supprimeParNom },
  })
}

export async function restaurerCategorie(id: string) {
  await prisma.categorieCv.update({
    where: { id },
    data: { deletedAt: null, supprimeParNom: null },
  })
}
