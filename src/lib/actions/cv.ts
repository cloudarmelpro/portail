'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAction } from '@/lib/safe-action'
import {
  ajouterCategorie,
  categorieParNom,
  categoriesVivantesParIds,
  changerNomCategorie,
  creerFichier,
  effacerFichier,
  fichiersExpires,
  mettreEnCorbeille,
  ordonnerCategories,
  reclasserFichier,
  retirerCategorie,
  sortirDeCorbeille,
  cleDejaUtilisee,
} from '@/lib/data/cv'
import {
  TAILLE_MAX_OCTETS,
  TYPES_ACCEPTES,
  nouvelleCle,
  supprimerObjet,
  typeReelConforme,
  urlTeleversement,
  verifierObjet,
} from '@/lib/storage'
import {
  confirmerTeleversementSchema,
  creerCategorieSchema,
  deplacerFichierSchema,
  preparerTeleversementSchema,
  renommerCategorieSchema,
  reordonnerCategoriesSchema,
  restaurerFichierSchema,
  supprimerCategorieSchema,
  supprimerFichierSchema,
} from '@/lib/validations/cv'
import { ErreurMetier } from '@/lib/erreurs'
import { PLAFONDS, cleUtilisateur, limiter } from '@/lib/rate-limit'

/**
 * Actions de la banque de CV — toutes issues de `createAction`.
 *
 * Le téléversement se fait en deux temps : on prépare un lien signé, le
 * navigateur écrit DIRECTEMENT dans le stockage, puis on confirme. Le contenu du
 * fichier ne traverse jamais le serveur — cela évite de saturer la mémoire du
 * conteneur et supprime tout risque de fichier résiduel sur le VPS.
 */

/**
 * Les identifiants de catégories viennent du navigateur : ils ont l'âge de la
 * page qui les a rendus. Une catégorie mise à la corbeille entre-temps ferait
 * échouer `connect` sur une panne Prisma illisible, ou classerait le fichier
 * dans un dossier qu'aucun écran n'affiche plus.
 */
async function categoriesRetenues(ids: string[]): Promise<string[]> {
  const uniques = [...new Set(ids)]
  const vivantes = await categoriesVivantesParIds(uniques)
  if (vivantes.length === uniques.length) return vivantes

  throw new ErreurMetier(
    uniques.length - vivantes.length > 1
      ? 'Ces catégories ont été modifiées ailleurs entre-temps. Rechargez la page avant de recommencer.'
      : 'Cette catégorie a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.',
  )
}

export const preparerTeleversement = createAction({
  permission: 'cv:televerser',
  schema: preparerTeleversementSchema,
  action: 'Préparation d’un dépôt de CV',
  entite: (e) => e.nom,
  async handler(entree, { session }) {
    // Chaque appel forge une URL d'écriture vers le stockage. Sans plafond, une
    // boucle y déverse autant d'objets qu'elle veut — la facture est au volume.
    const verdict = limiter(
      cleUtilisateur('cv:televerser', session.userId),
      PLAFONDS.televersementCv.max,
      PLAFONDS.televersementCv.fenetreSecondes,
    )

    if (!verdict.autorise) {
      throw new ErreurMetier('Trop de dépôts d’affilée. Réessayez dans quelques minutes.')
    }

    const cle = nouvelleCle(entree.typeMime)
    const url = await urlTeleversement(cle, entree.typeMime)
    return { cle, url }
  },
})

export const confirmerTeleversement = createAction({
  permission: 'cv:televerser',
  schema: confirmerTeleversementSchema,
  action: 'Dépôt d’un CV',
  entite: (e) => e.nom,
  async handler(entree, { session }) {
    /**
     * La taille et le type sont relus DEPUIS le stockage, jamais repris de
     * l'entrée : le navigateur a écrit sans passer par nous, ce qu'il annonce
     * n'engage personne.
     */
    /*
      Une clé ne sert qu'UNE fois. La confirmation rejouée aurait fait deux
      lignes pour un même objet : la première purge efface le contenu, la
      seconde reste en liste et son téléchargement ne mène nulle part.
    */
    if (await cleDejaUtilisee(entree.cle)) {
      throw new ErreurMetier('Ce dépôt a déjà été confirmé.')
    }

    const objet = await verifierObjet(entree.cle)

    /*
      ─────────────────────────────────────────────────────────────────────
      Le plafond s'applique ICI, sur la taille réelle. Sans ce contrôle, il ne
      plafonnait rien.

      `preparerTeleversement` valide une taille DÉCLARÉE, avant que le fichier
      existe, et l'URL présignée ne porte aucune condition de longueur. Annoncer
      un octet puis téléverser deux gigaoctets suffisait à passer : la relecture
      ci-dessus constatait la vérité, et on l'enregistrait telle quelle.

      L'objet refusé est retiré du stockage — sans cela, le fichier resterait au
      bucket sans ligne en base, donc sans aucun moyen de le retrouver ni de le
      supprimer.
      ─────────────────────────────────────────────────────────────────────
    */
    const typeConnu = (TYPES_ACCEPTES as readonly string[]).includes(objet.typeMime)

    /*
      Le type annoncé ne prouve rien : c'est la chaîne que le navigateur a
      choisie à la signature de l'URL, et elle traverse le stockage sans être
      confrontée au contenu. On lit donc les premiers octets — CV-1 exige que
      « le type réel du fichier soit vérifié côté serveur, pas seulement son
      extension ».

      Contrôlé APRÈS la taille : inutile d'aller lire les octets d'un objet qu'on
      va refuser de toute façon.
    */
    const conforme =
      typeConnu && objet.taille <= TAILLE_MAX_OCTETS
        ? await typeReelConforme(entree.cle, objet.typeMime)
        : false

    if (objet.taille > TAILLE_MAX_OCTETS || !typeConnu || !conforme) {
      await supprimerObjet(entree.cle).catch(() => {})
      throw new ErreurMetier(
        objet.taille > TAILLE_MAX_OCTETS
          ? 'Le fichier dépasse 10 Mo. Il n’a pas été conservé.'
          : !typeConnu
            ? 'Ce format de fichier n’est pas accepté. Déposez un PDF, un DOC ou un DOCX.'
            : 'Le contenu du fichier ne correspond pas à son format annoncé. Il n’a pas été conservé.',
      )
    }

    const fichier = await creerFichier({
      nom: entree.nom,
      cle: entree.cle,
      taille: objet.taille,
      typeMime: objet.typeMime,
      deposeParId: session.userId,
      deposeParNom: session.nom,
      categorieIds: await categoriesRetenues(entree.categorieIds),
    })

    revalidatePath('/cv')
    return { fichierId: fichier.id }
  },
})

export const deplacerFichier = createAction({
  permission: 'cv:televerser',
  schema: deplacerFichierSchema,
  action: 'Reclassement d’un CV',
  entite: (e) => e.fichierId,
  async handler(entree) {
    const reclasse = await reclasserFichier({
      fichierId: entree.fichierId,
      version: entree.version,
      categorieIds: await categoriesRetenues(entree.categorieIds),
    })

    if (!reclasse) {
      throw new ErreurMetier(
        'Ce fichier a été modifié ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    revalidatePath('/cv')
    return { ok: true }
  },
})

export const supprimerFichier = createAction({
  // CV-8 — la suppression est réservée à l'administrateur.
  permission: 'cv:supprimer',
  schema: supprimerFichierSchema,
  action: 'Suppression d’un CV',
  // Toute manipulation de renseignements personnels est surveillée.
  sensible: true,
  entite: (e) => e.fichierId,
  async handler(entree, { session }) {
    /**
     * Suppression réversible : l'objet reste dans le stockage. Il n'est
     * réellement effacé qu'à la purge de corbeille, trente jours plus tard.
     */
    await mettreEnCorbeille(entree.fichierId, session.nom)

    revalidatePath('/cv')
    return { ok: true }
  },
})

export const restaurerFichier = createAction({
  permission: 'cv:supprimer',
  schema: restaurerFichierSchema,
  action: 'Restauration d’un CV',
  entite: (e) => e.fichierId,
  async handler(entree) {
    await sortirDeCorbeille(entree.fichierId)

    revalidatePath('/cv')
    return { ok: true }
  },
})

export const creerCategorie = createAction({
  permission: 'cv:categories',
  schema: creerCategorieSchema,
  action: 'Création d’une catégorie de CV',
  entite: (e) => e.nom,
  async handler(entree) {
    const existante = await categorieParNom(entree.nom)
    if (existante) throw new ErreurMetier('Cette catégorie existe déjà.')

    const categorie = await ajouterCategorie(entree.nom)

    revalidatePath('/cv')
    return { categorieId: categorie.id }
  },
})

export const renommerCategorie = createAction({
  permission: 'cv:categories',
  schema: renommerCategorieSchema,
  action: 'Renommage d’une catégorie de CV',
  entite: (e) => e.nom,
  async handler(entree) {
    const homonyme = await categorieParNom(entree.nom)
    if (homonyme && homonyme.id !== entree.categorieId) {
      throw new ErreurMetier('Une autre catégorie porte déjà ce nom.')
    }

    const renomme = await changerNomCategorie(entree.categorieId, entree.nom, entree.version)
    if (!renomme) {
      throw new ErreurMetier(
        'Cette catégorie a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    revalidatePath('/cv')
    return { ok: true }
  },
})

export const reordonnerCategories = createAction({
  permission: 'cv:categories',
  schema: reordonnerCategoriesSchema,
  action: 'Réorganisation des catégories de CV',
  async handler(entree) {
    await ordonnerCategories(entree.categorieIds)

    revalidatePath('/cv')
    return { ok: true }
  },
})

export const supprimerCategorie = createAction({
  permission: 'cv:categories',
  schema: supprimerCategorieSchema,
  action: 'Suppression d’une catégorie de CV',
  // TR-9 s'applique à la structure de classement comme au reste : la
  // suppression est réversible, et surveillée.
  sensible: true,
  entite: (e) => e.categorieId,
  async handler(entree, { session }) {
    /**
     * Les fichiers ne sont PAS supprimés : la relation étant une étiquette, ils
     * basculent simplement dans « Non classé ». Supprimer une catégorie ne doit
     * jamais faire disparaître des candidatures.
     */
    await retirerCategorie(entree.categorieId, session.nom)

    revalidatePath('/cv')
    return { ok: true }
  },
})

/**
 * Purge de corbeille — efface définitivement les objets supprimés depuis plus de
 * trente jours. Destinée à une tâche planifiée, pas à un geste d'interface.
 */
export const purgerCorbeille = createAction({
  permission: 'cv:supprimer',
  schema: z.object({}),
  action: 'Purge de la corbeille',
  sensible: true,
  async handler() {
    const perimes = await fichiersExpires()

    for (const f of perimes) {
      // L'objet d'abord : si l'effacement échoue, la ligne reste et la purge
      // pourra être relancée. L'inverse laisserait un fichier orphelin, invisible
      // et impossible à retrouver.
      await supprimerObjet(f.cle)
      await effacerFichier(f.id)
    }

    revalidatePath('/cv')
    return { supprimes: perimes.length }
  },
})
