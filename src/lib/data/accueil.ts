import 'server-only'
import { ENTREPRISES, entreprise, estEntreprise } from '@/config/entreprises'
import {
  LIBELLE_STATUT_CLIENT,
  LIBELLE_STATUT_ESTIMATION,
  LIBELLE_TYPE_INTERACTION,
} from '@/config/crm'
import { LIBELLE_VUE_CV } from '@/config/cv'
import { FUSEAU } from '@/config/dates'
import { aUneGrilleActive, listerJournal, listerUtilisateurs } from '@/lib/data/admin'
import {
  dernieresInteractions,
  derniersClients,
  relancesEchues,
  soumissionsEnAttente,
} from '@/lib/data/crm'
import { compterAEcheance, compterNonClasses, listerFichiers } from '@/lib/data/cv'
import { listerEstimations } from '@/lib/data/estimations'
import { compterEmployesSansSaisie, employesSansSaisie } from '@/lib/data/heures'
import { ajouterJours, aujourdHui, lundiDe } from '@/lib/domaine/heures'
import { formaterMontant } from '@/lib/domaine/estimation'
import { prismaCadre } from '@/lib/prisma'
import { aPermission, type Module, type Role } from '@/lib/permissions'

/**
 * Ce qui attend l'utilisateur — la matière de l'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un décompte est une PERMISSION, pas un affichage.
 *
 * Masquer une tuile côté écran ne suffirait pas : le nombre aurait déjà été lu
 * en base, et il aurait transité jusqu'au navigateur, où il se lit dans la
 * charge utile. Chaque volet est donc gardé ICI, avant sa requête — ce qu'un
 * rôle n'a pas le droit de voir n'est jamais interrogé.
 *
 * Et la garde est REFAITE pour les panneaux : ce n'est pas parce qu'un décompte
 * est autorisé que son contenu l'est. Un nombre ne nomme personne ; cinq lignes
 * nomment cinq clients.
 *
 * Le CRM et le calculateur passent par le client CADRÉ, une entreprise à la
 * fois. Une requête unique aurait traversé le cloisonnement — c'est exactement
 * le bug que l'extension Prisma existe pour rendre impossible, et un total n'en
 * est pas dispensé.
 *
 * Tuiles et panneaux sont produits ENSEMBLE, d'une seule lecture par volet. Les
 * calculer séparément doublait les allers-retours vers Neon en posant deux fois
 * la même question : combien, puis lesquels.
 * ─────────────────────────────────────────────────────────────────────────
 */
export type Tuile = {
  cle: string
  module: Module
  valeur: number
  libelle: string
  href: string
}

export type LignePanneau = {
  cle: string
  principal: string
  secondaire: string | null
  valeur: string | null
  /**
   * Où mène la rangée. Jamais nul : chaque rangée porte une flèche, et une
   * flèche qui ne mène nulle part est une promesse non tenue. À défaut de
   * destination propre, la rangée retombe sur celle du panneau.
   */
  href: string
}

export type Panneau = {
  cle: string
  titre: string
  module: Module
  href: string
  lignes: LignePanneau[]
  /**
   * Ce qui s'écrit à la place des rangées quand il n'y en a aucune.
   *
   * Elle nomme l'ABSENCE plutôt que de la constater : « Aucune relance échue »
   * est une bonne nouvelle, « Aucune donnée » ressemble à une panne.
   */
  vide: string
}

export type DonneesAccueil = { tuiles: Tuile[]; panneaux: Panneau[] }

export type Volet = DonneesAccueil

/**
 * Cinq lignes par panneau, jamais plus.
 *
 * Un panneau d'accueil n'est pas une liste : c'est un aperçu qui doit tenir sous
 * la ligne de flottaison, à côté d'un autre panneau. Au-delà, il devient une
 * seconde version de l'écran du module — qu'il faudrait garder d'accord avec
 * lui, tri compris.
 */
const LIGNES_PAR_PANNEAU = 5

/** La date du jour au fuseau du Québec : le serveur, lui, tourne en UTC. */
const DATE_COURTE = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'short', timeZone: FUSEAU })

const RIEN: Volet = { tuiles: [], panneaux: [] }

export async function donneesAccueil(role: Role): Promise<DonneesAccueil> {
  const volets = await Promise.all([
    aPermission(role, 'crm:lire') ? donneesCrm() : RIEN,
    aPermission(role, 'cv:lire') ? voletCv(aPermission(role, 'cv:supprimer')) : RIEN,
    aPermission(role, 'heures:saisir') ? voletHeures() : RIEN,
    voletAdmin(role),
  ])

  return {
    /*
      Une tuile à zéro disparaît : « 0 relance échue » occupe la place d'une
      information et n'en porte aucune. Un panneau sans ligne aussi — un cadre
      vide sous un titre affirme qu'il devrait y avoir quelque chose.
    */
    tuiles: volets.flatMap((v) => v.tuiles).filter((t) => t.valeur > 0),
    panneaux: volets.flatMap((v) => v.panneaux).filter((p) => p.lignes.length > 0),
  }
}

/** Les trois dossiers, chacun lu par son client cadré, puis remis en une liste. */
async function surLesTroisDossiers<T>(
  lire: (db: ReturnType<typeof prismaCadre>, e: (typeof ENTREPRISES)[number]) => Promise<T[]>,
): Promise<T[]> {
  const parDossier = await Promise.all(ENTREPRISES.map((e) => lire(prismaCadre(e.slug), e)))
  return parDossier.flat()
}

/** Une ligne de panneau, avec la clé de classement qui ne franchira pas la frontière. */
type LigneClassee = LignePanneau & { tri: number }

/**
 * Le volet du CRM — exporté, parce que l'écran d'entrée du module le reprend.
 *
 * Il porte déjà le cloisonnement : trois lectures cadées, une par dossier. Le
 * recopier côté CRM aurait rouvert la seule question qu'on ne veut pas voir
 * posée deux fois.
 */
export async function donneesCrm(): Promise<Volet> {
  const [relances, soumissions] = await Promise.all([
    surLesTroisDossiers<LigneClassee>(async (db, e) => {
      const dues = await relancesEchues(db)
      return [...dues.enRetard, ...dues.duJour].map((r) => ({
        cle: `${e.slug}-${r.clientId}`,
        principal: r.clientNom,
        secondaire: e.nom,
        // La fiche du client, pas la liste : c'est là que la relance se solde.
        href: `/crm/${e.slug}/clients/${r.clientId}`,
        /*
          Le retard est la valeur, pas la date d'échéance : c'est lui qui
          classe, et une date brute obligerait à la comparer à aujourd'hui de
          tête pour savoir laquelle presse.
        */
        valeur: r.retardJours > 0 ? `${r.retardJours} j` : 'aujourd’hui',
        tri: -r.retardJours,
      }))
    }),
    surLesTroisDossiers<LigneClassee>(async (db, e) => {
      const attente = await soumissionsEnAttente(db)
      return attente.map((s) => ({
        cle: `${e.slug}-${s.id}`,
        principal: s.clientNom ?? s.reference,
        secondaire: e.nom,
        /*
          Une estimation sans client rattaché n'a pas de fiche où aller : la
          rangée mène alors au dossier, ce qui reste vrai.
        */
        href: s.clientId ? `/crm/${e.slug}/clients/${s.clientId}` : `/crm/${e.slug}`,
        valeur: formaterMontant(s.total),
        // Périmées d'abord, puis celles qui le seront sous sept jours.
        tri: s.expiree ? 0 : s.expireBientot ? 1 : 2,
      }))
    }),
  ])

  return {
    /*
      La destination est `/crm`, le choix d'entreprise, et non le dossier d'une
      seule : le nombre porte sur les trois. Mener vers Paysagement aurait
      affiché une liste plus courte que la tuile qu'on vient de suivre.
    */
    tuiles: [
      {
        cle: 'relances',
        module: 'crm',
        valeur: relances.length,
        libelle: 'Relances échues',
        href: '/crm',
      },
      {
        cle: 'soumissions',
        module: 'crm',
        valeur: soumissions.length,
        libelle: 'Soumissions en attente',
        href: '/crm',
      },
    ],
    panneaux: [
      panneau('relances', 'Relances échues', 'crm', '/crm', relances, 'Aucune relance échue.'),
      panneau(
        'soumissions',
        'Soumissions en attente',
        'crm',
        '/crm',
        soumissions,
        'Aucune soumission en attente.',
      ),
    ],
  }
}

async function voletCv(peutSupprimer: boolean): Promise<Volet> {
  const [nonClasses, echeance, derniers] = await Promise.all([
    compterNonClasses(),
    // `Plus de 24 mois` est une vue RÉSERVÉE — CV-10. La compter pour qui ne
    // peut pas l'ouvrir donnerait un nombre menant à un écran refusé.
    peutSupprimer ? compterAEcheance() : Promise.resolve(0),
    listerFichiers({ type: 'tous' }, undefined, LIGNES_PAR_PANNEAU),
  ])

  return {
    tuiles: [
      {
        cle: 'cv-non-classes',
        module: 'cv',
        valeur: nonClasses,
        libelle: LIBELLE_VUE_CV['non-classes'],
        href: '/cv?vue=non-classes',
      },
      {
        cle: 'cv-echeance',
        module: 'cv',
        valeur: echeance,
        libelle: LIBELLE_VUE_CV.echeance,
        href: '/cv?vue=echeance',
      },
    ],
    panneaux: [
      {
        cle: 'cv-derniers',
        titre: 'Derniers dépôts',
        module: 'cv',
        href: '/cv',
        vide: 'Aucun CV déposé.',
        lignes: derniers.map((f) => ({
          cle: f.id,
          principal: f.nom,
          secondaire: f.deposeParNom,
          valeur: null,
          href: '/cv',
        })),
      },
    ],
  }
}

async function voletHeures(): Promise<Volet> {
  /*
    La semaine se calcule sur le jour civil québécois. Le serveur tourne en
    UTC : un dimanche soir, il aurait déjà basculé sur la semaine suivante et
    annoncé toute l'équipe en retard.
  */
  const lundi = lundiDe(aujourdHui())
  const semaine = { debut: lundi, fin: ajouterJours(lundi, 6) }

  const [combien, lesquels] = await Promise.all([
    compterEmployesSansSaisie(semaine),
    employesSansSaisie(semaine, LIGNES_PAR_PANNEAU),
  ])

  return {
    tuiles: [
      {
        cle: 'heures-sans-saisie',
        module: 'heures',
        valeur: combien,
        libelle: 'Employés sans saisie',
        href: '/heures',
      },
    ],
    panneaux: [
      {
        cle: 'heures-sans-saisie',
        titre: 'Employés sans saisie',
        module: 'heures',
        href: '/heures',
        vide: 'Toute l’équipe a saisi sa semaine.',
        lignes: lesquels.map((e) => ({
          cle: e.id,
          principal: e.nom,
          /*
            `entrepriseSlug` est une colonne texte : la vue employé la rend telle
            quelle. `estEntreprise` est le seul point où elle devient une valeur
            du produit — un slug orphelin ne nomme aucun dossier plutôt que de
            faire lever l'accueil entier.
          */
          secondaire: estEntreprise(e.entrepriseSlug) ? entreprise(e.entrepriseSlug).nom : null,
          valeur: null,
          href: `/heures/employes/${e.id}`,
        })),
      },
    ],
  }
}

/**
 * Le volet de l'administrateur.
 *
 * Ses trois permissions sont distinctes dans la matrice, et elles le restent
 * ici : `admin:journal` ne donne pas `admin:tarifs`. Les regrouper sous un seul
 * « est administrateur » ferait de l'accueil le premier endroit où la matrice
 * cesse d'être la source unique.
 */
async function voletAdmin(role: Role): Promise<Volet> {
  const [comptes, grilles, journal] = await Promise.all([
    aPermission(role, 'admin:utilisateurs') ? listerUtilisateurs() : null,
    aPermission(role, 'admin:tarifs')
      ? Promise.all(ENTREPRISES.map((e) => aUneGrilleActive(prismaCadre(e.slug))))
      : null,
    aPermission(role, 'admin:journal')
      ? listerJournal({ sensible: true }, { page: 1, parPage: LIGNES_PAR_PANNEAU })
      : null,
  ])

  const tuiles: Tuile[] = []
  const panneaux: Panneau[] = []

  if (comptes) {
    tuiles.push({
      cle: 'comptes-suspendus',
      module: 'admin',
      valeur: comptes.filter((u) => u.suspendu).length,
      libelle: 'Comptes suspendus',
      href: '/admin/utilisateurs',
    })
  }

  if (grilles) {
    /*
      Un dossier sans grille publiée BLOQUE le calculateur : aucune estimation
      ne s'y produit. C'est la seule panne du produit qui ne se signale nulle
      part — elle attend qu'on essaie de s'en servir pour se manifester.
    */
    tuiles.push({
      cle: 'sans-grille',
      module: 'admin',
      valeur: grilles.filter((a) => !a).length,
      libelle: 'Dossiers sans grille',
      href: '/admin/tarifs',
    })
  }

  if (journal) {
    panneaux.push({
      cle: 'journal',
      titre: 'Actions sensibles',
      module: 'admin',
      href: '/admin/journal?sensible=1',
      vide: 'Aucune action sensible consignée.',
      lignes: journal.entrees.map((e) => ({
        cle: e.id,
        principal: e.action,
        secondaire: e.utilisateur,
        valeur: DATE_COURTE.format(e.horodatage),
        href: '/admin/journal?sensible=1',
      })),
    })
  }

  return { tuiles, panneaux }
}

/**
 * Les derniers clients ouverts, tous dossiers confondus — entrée du CRM.
 *
 * À part, et non dans `donneesCrm` : l'accueil parle de ce qui ATTEND, ce
 * panneau-ci de ce qui vient d'arriver. Le poser sur l'accueil y ajouterait un
 * cinquième panneau qui n'appelle aucun geste.
 *
 * Cinq par dossier sont lus pour n'en garder que cinq au total : le plus récent
 * des trois dossiers peut être le même trois fois, et n'en lire que deux par
 * dossier laisserait passer le quatrième du plus actif.
 */
export async function derniersClientsCrm(): Promise<Panneau> {
  const lignes = await surLesTroisDossiers<LigneClassee>(async (db, e) => {
    const clients = await derniersClients(db, LIGNES_PAR_PANNEAU)
    return clients.map((c) => ({
      cle: `${e.slug}-${c.id}`,
      principal: c.nom,
      href: `/crm/${e.slug}/clients/${c.id}`,
      secondaire: `${e.nom} · ${LIBELLE_STATUT_CLIENT[c.statut]}`,
      valeur: DATE_COURTE.format(c.createdAt),
      // Le plus récent en tête : `tri` classe par ordre croissant.
      tri: -c.createdAt.getTime(),
    }))
  })

  return panneau(
    'derniers-clients',
    'Derniers clients',
    'crm',
    '/crm',
    lignes,
    'Aucun client dans les trois dossiers.',
  )
}

/**
 * Les dernières interactions, tous dossiers confondus — entrée du CRM.
 *
 * C'est le journal de bord du module : ce qui a été dit à qui, et quand. Il
 * répond à une question que ni les relances ni les derniers clients ne couvrent
 * — « où en était-on ? » — et c'est la seule vue transverse qui l'ait.
 *
 * Le résumé passe en second rang plutôt qu'en tête : on cherche le client, on
 * lit ensuite ce qui s'est dit. L'inverse obligerait à parcourir cinq phrases
 * pour retrouver un nom.
 */
export async function interactionsRecentesCrm(): Promise<Panneau> {
  const lignes = await surLesTroisDossiers<LigneClassee>(async (db, e) => {
    const interactions = await dernieresInteractions(db, LIGNES_PAR_PANNEAU)
    return interactions.map((i) => ({
      cle: `${e.slug}-${i.id}`,
      principal: i.client.nom,
      href: `/crm/${e.slug}/clients/${i.client.id}`,
      secondaire: `${LIBELLE_TYPE_INTERACTION[i.type]} · ${i.resume}`,
      valeur: DATE_COURTE.format(i.date),
      // La plus récente en tête : `tri` classe par ordre croissant.
      tri: -i.date.getTime(),
    }))
  })

  return panneau(
    'interactions',
    'Interactions récentes',
    'crm',
    '/crm',
    lignes,
    'Aucune interaction consignée.',
  )
}

/**
 * Les dernières estimations, tous dossiers confondus — entrée du calculateur.
 *
 * Le pendant de « Derniers clients » pour son module : ce qui vient d'être
 * préparé, quel qu'en soit l'état. Un brouillon y figure — c'est même le cas où
 * la rangée sert le plus, puisqu'un brouillon oublié ne se signale nulle part.
 */
export async function dernieresEstimations(): Promise<Panneau> {
  const lignes = await surLesTroisDossiers<LigneClassee>(async (db, e) => {
    const estimations = await listerEstimations(db, {}, LIGNES_PAR_PANNEAU)
    return estimations.map((x) => ({
      cle: `${e.slug}-${x.id}`,
      principal: x.clientNom,
      href: `/calculateur/${e.slug}/estimations`,
      secondaire: `${e.nom} · ${LIBELLE_STATUT_ESTIMATION[x.statut]}`,
      valeur: formaterMontant(x.total),
      // La plus récente en tête : `tri` classe par ordre croissant.
      tri: -x.date.getTime(),
    }))
  })

  return panneau(
    'estimations',
    'Dernières estimations',
    'calculateur',
    '/calculateur',
    lignes,
    'Aucune estimation préparée.',
  )
}

/**
 * Celles qui périment sous sept jours — entrée du calculateur.
 *
 * Le CRM montre déjà les soumissions en attente, mais du point de vue du SUIVI :
 * qui n'a pas répondu. Ici c'est le point de vue du document : lequel va cesser
 * d'être valable, et devra donc être refait plutôt que relancé.
 */
export async function estimationsExpirantes(): Promise<Panneau> {
  const lignes = await surLesTroisDossiers<LigneClassee>(async (db, e) => {
    const estimations = await listerEstimations(db, { expirantSousSeptJours: true })
    return estimations.map((x) => ({
      cle: `${e.slug}-${x.id}`,
      principal: x.clientNom,
      href: `/calculateur/${e.slug}/estimations`,
      secondaire: `${e.nom} · ${x.reference}`,
      valeur: x.valideJusquau ? DATE_COURTE.format(x.valideJusquau) : '—',
      // La plus proche de son terme en tête.
      tri: x.valideJusquau ? x.valideJusquau.getTime() : Number.MAX_SAFE_INTEGER,
    }))
  })

  return panneau(
    'expirantes',
    'Bientôt périmées',
    'calculateur',
    '/calculateur',
    lignes,
    'Aucune estimation ne périme sous sept jours.',
  )
}

/** Classe, coupe à cinq, et pose l'enveloppe commune. */
function panneau(
  cle: string,
  titre: string,
  module: Module,
  href: string,
  lignes: LigneClassee[],
  vide: string,
): Panneau {
  const retenues = [...lignes].sort((a, b) => a.tri - b.tri).slice(0, LIGNES_PAR_PANNEAU)

  // `tri` classe puis disparaît : le laisser passer côté client exposerait un
  // ordre interne dans la charge utile, sans rien y faire.
  return {
    cle,
    titre,
    module,
    href,
    vide,
    lignes: retenues.map((l) => ({
      cle: l.cle,
      principal: l.principal,
      secondaire: l.secondaire,
      valeur: l.valeur,
      href: l.href,
    })),
  }
}
