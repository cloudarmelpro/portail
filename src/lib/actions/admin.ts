'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  compterAdministrateursActifs,
  enregistrerLogo,
  enregistrerOrganisation,
  enregistrerParametresPaie,
  publierGrille,
  utilisateurParCourriel,
} from '@/lib/data/admin'
import { ErreurMetier } from '@/lib/erreurs'
import { estAdministrateur, LIBELLE_ROLE, type Role } from '@/lib/permissions'
import { createAction, createActionCloisonnee } from '@/lib/safe-action'
import {
  nouvelleCleLogo,
  supprimerObjet,
  typeReelConforme,
  urlTeleversement,
  verifierObjet,
} from '@/lib/storage'
import { REFUS_TAILLE_LOGO, REFUS_TYPE_LOGO, TAILLE_MAX_LOGO } from '@/config/logo'
import { cleUtilisateur, limiter, PLAFONDS } from '@/lib/rate-limit'
import {
  changerRoleSchema,
  enregistrerGrilleSchema,
  inviterUtilisateurSchema,
  modifierUtilisateurSchema,
  confirmerLogoSchema,
  organisationSchema,
  parametresPaieSchema,
  preparerLogoSchema,
  retirerLogoSchema,
  reactiverCompteSchema,
  reinitialiserMotDePasseSchema,
  suspendreCompteSchema,
} from '@/lib/validations/admin'

/**
 * Actions du module d'administration — toutes issues de la fabrique.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un refus métier est levé en `ErreurMetier`, jamais en `Error` nue.
 *
 * La fabrique remplace le message de toute erreur inattendue par « Une erreur
 * est survenue » — c'est juste, une panne peut nommer une table. Mais « ce
 * compte est le dernier administrateur actif » doit atteindre l'écran : c'est
 * la seule chose qui dise à l'administrateur quoi faire ensuite.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les comptes passent par les points d'entrée serveur de Better Auth plutôt que
 * par une écriture dans la table `user` : eux seuls savent créer le compte de
 * connexion associé, révoquer les sessions ouvertes et tenir `banExpires`.
 */

/**
 * Les points d'entrée d'administration de Better Auth revérifient la session à
 * partir des en-têtes : sans eux, ils refusent. C'est une seconde barrière après
 * celle de la fabrique, pas un remplacement.
 */
async function enTetes() {
  return { headers: await headers() }
}

/**
 * Pont de typage vers le module admin de Better Auth.
 *
 * Il type `role` sur ses propres valeurs — `admin` et `user` — alors que nos
 * trois rôles vivent dans `lib/permissions.ts`, seule source du système. La
 * colonne est une simple chaîne en base : le transtypage ne fait qu'aligner les
 * types, il n'élargit rien.
 */
function role(r: Role): 'admin' {
  return r as 'admin'
}

/** Le compte visé, ou un refus explicite s'il n'existe pas. */
async function compteVise(courriel: string) {
  const u = await utilisateurParCourriel(courriel)
  if (!u) throw new ErreurMetier('Aucun compte ne correspond à cette adresse.')
  return u
}

export const inviterUtilisateur = createAction({
  permission: 'admin:utilisateurs',
  schema: inviterUtilisateurSchema,
  action: 'Invitation d’un utilisateur',
  // Le schéma accepte le rôle « admin » : créer un compte peut créer un
  // administrateur. Le filtre « actions sensibles » du journal doit le montrer,
  // au même titre que la promotion d'un compte existant.
  sensible: true,
  entite: (e) => e.courriel,
  async handler(entree) {
    if (await utilisateurParCourriel(entree.courriel)) {
      throw new ErreurMetier('Un compte existe déjà pour cette adresse.')
    }

    /**
     * Créé SANS mot de passe : aucun compte de connexion n'est associé, donc
     * personne ne peut entrer avant que l'invité ait choisi le sien. Le lien
     * envoyé ci-dessous crée ce compte de connexion au moment où il s'en sert.
     */
    await auth.api.createUser({
      ...(await enTetes()),
      body: { name: entree.nom, email: entree.courriel, role: role(entree.role) },
    })

    await auth.api.requestPasswordReset({
      ...(await enTetes()),
      body: { email: entree.courriel, redirectTo: '/reinitialiser-mot-de-passe' },
    })

    revalidatePath('/admin/utilisateurs')
    return { courriel: entree.courriel }
  },
})

export const modifierUtilisateur = createAction({
  permission: 'admin:utilisateurs',
  schema: modifierUtilisateurSchema,
  action: 'Modification d’un compte',
  // Le courriel EST l'identifiant de connexion : le changer déplace l'accès.
  sensible: true,
  entite: (e) => e.courriel,
  async handler(entree) {
    const homonyme = await utilisateurParCourriel(entree.courriel)
    if (homonyme && homonyme.id !== entree.userId) {
      throw new ErreurMetier('Un autre compte utilise déjà cette adresse.')
    }

    await auth.api.adminUpdateUser({
      ...(await enTetes()),
      body: { userId: entree.userId, data: { name: entree.nom, email: entree.courriel } },
    })

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  },
})

export const changerRole = createAction({
  permission: 'admin:utilisateurs',
  schema: changerRoleSchema,
  action: 'Changement de rôle',
  // Un changement de rôle élargit ou restreint un accès : il est surveillé.
  sensible: true,
  entite: (e) => `${e.courriel} → ${LIBELLE_ROLE[e.role]}`,
  async handler(entree, { session }) {
    if (entree.courriel === session.courriel.toLowerCase() && entree.role !== 'admin') {
      throw new ErreurMetier(
        'Vous ne pouvez pas retirer votre propre rôle d’administrateur : plus personne ne pourrait administrer le portail. Demandez à un autre administrateur.',
      )
    }

    const cible = await compteVise(entree.courriel)
    if (estAdministrateur(cible.role) && !estAdministrateur(entree.role)) {
      await refuserSiDernierAdministrateur()
    }

    await auth.api.setRole({
      ...(await enTetes()),
      body: { userId: cible.id, role: role(entree.role) },
    })

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  },
})

export const suspendreCompte = createAction({
  permission: 'admin:utilisateurs',
  schema: suspendreCompteSchema,
  action: 'Suspension d’un compte',
  sensible: true,
  entite: (e) => e.courriel,
  async handler(entree, { session }) {
    if (entree.courriel === session.courriel.toLowerCase()) {
      throw new ErreurMetier(
        'Vous ne pouvez pas suspendre votre propre compte : vous ne pourriez plus vous reconnecter pour le réactiver. Demandez à un autre administrateur.',
      )
    }

    const cible = await compteVise(entree.courriel)
    if (estAdministrateur(cible.role)) await refuserSiDernierAdministrateur()

    /**
     * Un compte n'est JAMAIS supprimé, seulement suspendu : une suppression
     * ferait disparaître l'auteur des entrées du journal d'audit, qui cesserait
     * alors de prouver quoi que ce soit.
     *
     * Better Auth révoque les sessions ouvertes dans la foulée — la suspension
     * prend effet tout de suite, pas à la prochaine expiration.
     */
    await auth.api.banUser({
      ...(await enTetes()),
      body: { userId: cible.id, banReason: entree.motif },
    })

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  },
})

export const reactiverCompte = createAction({
  permission: 'admin:utilisateurs',
  schema: reactiverCompteSchema,
  action: 'Réactivation d’un compte',
  sensible: true,
  entite: (e) => e.courriel,
  async handler(entree) {
    const cible = await compteVise(entree.courriel)
    await auth.api.unbanUser({ ...(await enTetes()), body: { userId: cible.id } })

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  },
})

export const reinitialiserMotDePasse = createAction({
  permission: 'admin:utilisateurs',
  schema: reinitialiserMotDePasseSchema,
  action: 'Réinitialisation de mot de passe',
  // Déclencher la réinitialisation sur le compte d'autrui — même geste que
  // suspendre, du point de vue de qui relit le journal.
  sensible: true,
  entite: (e) => e.courriel,
  async handler(entree) {
    await compteVise(entree.courriel)

    /**
     * L'administrateur ne choisit jamais le mot de passe d'autrui : il déclenche
     * l'envoi du lien, et l'utilisateur choisit le sien. Rien ne transite par une
     * conversation.
     */
    await auth.api.requestPasswordReset({
      ...(await enTetes()),
      body: { email: entree.courriel, redirectTo: '/reinitialiser-mot-de-passe' },
    })

    return { ok: true }
  },
})

/**
 * Invariant réparti : l'auto-suspension est déjà refusée plus haut, mais deux
 * administrateurs peuvent se retirer mutuellement leurs droits. Ce contrôle ferme
 * le dernier chemin vers un portail inadministrable.
 */
async function refuserSiDernierAdministrateur(): Promise<void> {
  if ((await compterAdministrateursActifs()) <= 1) {
    throw new ErreurMetier(
      'C’est le dernier compte administrateur actif. Nommez un autre administrateur avant de retirer celui-ci.',
    )
  }
}

/* ══════════════════════════════════════════════════════════════════
   Grilles de tarifs — ADM-2 et ADM-3
   ══════════════════════════════════════════════════════════════════ */

export const enregistrerGrille = createActionCloisonnee({
  permission: 'admin:tarifs',
  schema: enregistrerGrilleSchema,
  action: 'Publication d’une grille de tarifs',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => `${e.produits.length} services`,
  async handler(entree, { db, session, entreprise }) {
    const resultat = await publierGrille(db, {
      produits: entree.produits,
      depuisNumero: entree.depuisNumero,
      creeParId: session.userId,
      creeParNom: session.nom,
    })

    if (resultat.etat === 'conflit') {
      throw new ErreurMetier(
        'Une nouvelle version a été publiée entre-temps. Rechargez la page avant de recommencer.',
      )
    }
    if (resultat.etat === 'inchangee') {
      throw new ErreurMetier('Aucun changement à enregistrer.')
    }

    revalidatePath('/admin/tarifs')
    // Le calculateur lit la grille active : sans cela, il proposerait encore les
    // anciens prix jusqu'à la prochaine navigation complète.
    revalidatePath(`/calculateur/${entreprise}`)

    return { numero: resultat.numero }
  },
})

/* ══════════════════════════════════════════════════════════════════
   Paramètres de paie — HEU-7 et HEU-9
   ══════════════════════════════════════════════════════════════════ */

export const enregistrerParametresDePaie = createAction({
  permission: 'heures:parametres',
  schema: parametresPaieSchema,
  action: 'Modification des paramètres de paie',
  sensible: true,
  entite: (e) => `Seuil ${e.seuilSupplementaires} h — majoration ${e.majoration}`,
  async handler(entree) {
    const resultat = await enregistrerParametresPaie(entree)
    if (resultat.etat === 'conflit') {
      throw new ErreurMetier(
        'Ces paramètres ont été modifiés ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    revalidatePath('/admin/paie')
    revalidatePath('/heures')
    return { ok: true }
  },
})

/* ══════════════════════════════════════════════════════════════════
   Organisation — EST-10
   ══════════════════════════════════════════════════════════════════ */

export const enregistrerOrganisationAction = createActionCloisonnee({
  permission: 'admin:organisation',
  schema: organisationSchema,
  action: 'Modification des coordonnées',
  entrepriseDe: (e) => e.entreprise,
  entite: (e) => e.raisonSociale,
  async handler(entree, { db }) {
    const fait = await enregistrerOrganisation(db, entree)
    if (!fait) {
      throw new ErreurMetier(
        'Ces coordonnées ont été modifiées ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    revalidatePath('/admin/organisation')
    // Le document d'estimation les porte : sans cela, il continuerait d'afficher
    // le bandeau « à compléter » jusqu'à la prochaine navigation complète.
    revalidatePath('/calculateur', 'layout')
    return { ok: true }
  },
})

/* ══════════════════════════════════════════════════════════════════
   Logo d'entreprise — EST-10
   ══════════════════════════════════════════════════════════════════ */

/**
 * Le logo suit le chemin du dépôt de CV : lien signé, écriture DIRECTE du
 * navigateur vers le stockage, puis confirmation. Le fichier ne traverse jamais
 * le serveur.
 *
 * Il aurait été plus court de le poster à un Server Action — 2 Mo passent. Mais
 * ce serait un second chemin de téléversement, avec sa propre vérification de
 * type, sa propre limite et son propre oubli à venir. Un seul motif, vérifié
 * une fois.
 */
export const preparerLogo = createActionCloisonnee({
  permission: 'admin:organisation',
  schema: preparerLogoSchema,
  action: 'Préparation d’un dépôt de logo',
  entrepriseDe: (e) => e.entreprise,
  async handler(entree, { session }) {
    /*
      Chaque appel forge une URL d'ÉCRITURE sur le stockage. Sans plafond, une
      boucle y déverse autant d'objets qu'elle veut — c'est le raisonnement de
      `preparerTeleversement`, et il n'avait pas été appliqué ici.
    */
    const verdict = limiter(
      cleUtilisateur('admin:logo', session.userId),
      PLAFONDS.televersementLogo.max,
      PLAFONDS.televersementLogo.fenetreSecondes,
    )

    if (!verdict.autorise) {
      throw new ErreurMetier('Trop de dépôts d’affilée. Réessayez dans quelques minutes.')
    }

    const cle = nouvelleCleLogo(entree.typeMime)
    const url = await urlTeleversement(cle, entree.typeMime)
    return { cle, url }
  },
})

export const confirmerLogo = createActionCloisonnee({
  permission: 'admin:organisation',
  schema: confirmerLogoSchema,
  action: 'Dépôt d’un logo',
  entrepriseDe: (e) => e.entreprise,
  async handler(entree, { db }) {
    /*
      Le navigateur a écrit seul dans le stockage. Tout ce qu'il a annoncé à
      l'étape précédente — type, taille — est donc une déclaration, pas un fait.
      On relit l'objet, puis ses premiers octets.
    */
    const reel = await verifierObjet(entree.cle)

    if (reel.taille === 0 || reel.taille > TAILLE_MAX_LOGO) {
      await supprimerObjet(entree.cle)
      throw new ErreurMetier(REFUS_TAILLE_LOGO)
    }

    if (!(await typeReelConforme(entree.cle, entree.typeMime))) {
      // L'objet part : le garder laisserait dans le seau un fichier que rien ne
      // désigne et dont on vient d'établir qu'il n'est pas ce qu'il prétend.
      await supprimerObjet(entree.cle)
      throw new ErreurMetier(REFUS_TYPE_LOGO)
    }

    const { fait, ancienne } = await enregistrerLogo(db, {
      cle: entree.cle,
      version: entree.version,
    })

    if (!fait) {
      await supprimerObjet(entree.cle)
      throw new ErreurMetier(
        'Ces coordonnées ont été modifiées ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    // L'ancien objet APRÈS l'écriture réussie. Dans l'autre ordre, un échec de
    // la mise à jour laisserait la ligne désignant un fichier déjà effacé.
    if (ancienne) await supprimerObjet(ancienne)

    revalidatePath('/admin/organisation')
    revalidatePath('/calculateur', 'layout')
    return { ok: true }
  },
})

export const retirerLogo = createActionCloisonnee({
  permission: 'admin:organisation',
  schema: retirerLogoSchema,
  action: 'Retrait d’un logo',
  entrepriseDe: (e) => e.entreprise,
  async handler(entree, { db }) {
    const { fait, ancienne } = await enregistrerLogo(db, { cle: null, version: entree.version })

    if (!fait) {
      throw new ErreurMetier(
        'Ces coordonnées ont été modifiées ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    if (ancienne) await supprimerObjet(ancienne)

    revalidatePath('/admin/organisation')
    revalidatePath('/calculateur', 'layout')
    return { ok: true }
  },
})
