import { EtatVide } from '@/components/shared/etat-vide'
import { GrilleHeures } from '@/components/heures/grille-heures'
import {
  NOMS_JOURS,
  NOMS_JOURS_COURTS,
  ajouterJours,
  aujourdHui,
  enIso,
  joursDeSemaine,
  libelleJourMois,
  libellePeriode,
  libelleSemaine,
  lundiDe,
  periodeDe,
  resoudreSemaine,
} from '@/lib/domaine/heures'

/** « août » — trois lettres, comme dans l'en-tête de colonne. */
const MOIS_COURT = new Intl.DateTimeFormat('fr-CA', { month: 'short', timeZone: 'UTC' })
import {
  compterSaisies,
  listerEmployes,
  parametresPaie,
  periodeVue,
  saisiesEntre,
} from '@/lib/data/heures'
import { estEntreprise } from '@/config/entreprises'
import { CommandesSemaine } from '@/components/heures/commandes-semaine'
import { OngletsHeures } from '@/components/heures/onglets-heures'
import { requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'

/**
 * Aucun délai de cache client sur CET écran.
 *
 * `next.config.ts` en accorde trente secondes à toutes les routes dynamiques.
 * Ici c'est inacceptable : la gérante saisit pendant que l'administrateur
 * regarde, sur les mêmes lignes. Une grille de trente secondes d'âge afficherait
 * des cases vides là où des heures viennent d'être écrites, et la seconde
 * personne écraserait la première en croyant remplir un trou.
 *
 * Cet export est refusé dans un layout : il doit rester sur la page.
 */
export const unstable_dynamicStaleTime = 0

/** Grille de saisie hebdomadaire — écran principal du module (HEU-2). */
export default async function PageSaisieHeures(props: PageProps<'/heures'>) {
  const session = await requireModule('heures')
  const { semaine, entreprise } = await props.searchParams

  /*
    Le slug vient de l'URL : il n'a aucune valeur de preuve. Sans valeur
    reconnue, la grille montre les trois dossiers plutôt que de lever.
  */
  const dossier = estEntreprise(entreprise) ? entreprise : null

  const parametres = await parametresPaie()

  /**
   * La semaine par défaut se calcule sur le jour civil **québécois**. Le serveur
   * tourne en UTC : un dimanche soir, il aurait déjà basculé sur la semaine
   * suivante alors que la gérante saisit encore la sienne.
   */
  const maintenant = aujourdHui()
  const semaineCourante = lundiDe(maintenant)
  const lundi = resoudreSemaine(semaine, maintenant)
  const estCourante = enIso(lundi) === enIso(semaineCourante)

  const courante = { debut: lundi, fin: ajouterJours(lundi, 6) }
  const precedente = { debut: ajouterJours(lundi, -7), fin: ajouterJours(lundi, -1) }
  const periode = periodeDe(lundi, parametres.joursPeriode)

  const [tousEmployes, saisies, saisiesPrecedentes, vuePeriode] = await Promise.all([
    listerEmployes(true),
    saisiesEntre(courante),
    compterSaisies(precedente),
    periodeVue(periode),
  ])

  const valeurs: Record<string, number> = {}
  for (const s of saisies) valeurs[`${s.employeId}|${s.date}`] = s.centiemes

  const iso = enIso(aujourdHui())

  const jours = joursDeSemaine(lundi).map((d, i) => ({
    iso: enIso(d),
    /*
      Le quantième est séparé du nom du jour : l'en-tête les met à deux tailles,
      le nombre en grand et les lettres à côté. Recomposer « lun 3 » dans la
      grille l'obligerait à redécouper la chaîne.
    */
    numero: d.getUTCDate(),
    jour: NOMS_JOURS_COURTS[i],
    mois: MOIS_COURT.format(d),
    long: `${NOMS_JOURS[i][0].toUpperCase()}${NOMS_JOURS[i].slice(1)}`,
    date: libelleJourMois(d),
    aujourdhui: enIso(d) === iso,
  }))

  /*
    Le filtre est appliqué APRÈS la lecture, pas dans la requête : les totaux du
    pied portent alors sur ce qui est à l'écran. Les tirer d'une seconde requête
    non filtrée afficherait une somme dont aucune ligne visible ne rend compte.
  */
  const employes = dossier ? tousEmployes.filter((e) => e.entrepriseSlug === dossier) : tousEmployes

  /** Le filtre survit au changement de semaine, et la semaine au changement de dossier. */
  const lien = (d: Date) => {
    const p = new URLSearchParams({ semaine: enIso(d) })
    if (dossier) p.set('entreprise', dossier)
    return `/heures?${p.toString()}`
  }

  /*
    Rendues UNE fois et passées aux deux branches : la grille les place dans sa
    rangée de boutons, l'état vide les rend seules. Deux appels séparés auraient
    divergé à la première retouche, et c'est le cas rare qui aurait gardé
    l'ancienne version.
  */
  const commandes = (
    <CommandesSemaine
      libelle={libelleSemaine(lundi)}
      precedente={lien(ajouterJours(lundi, -7))}
      suivante={estCourante ? null : lien(ajouterJours(lundi, 7))}
      courante={estCourante ? null : lien(semaineCourante)}
      entreprise={dossier ?? ''}
    />
  )

  return (
    <div>
      {/*
        Même en-tête que l'accueil et l'entrée du CRM : titre, phrase de contexte,
        puis les commandes.

        Le titre était en `sr-only`, la bande pleine largeur portant tout. Elle
        ne dit plus rien que cet en-tête ne dise mieux : la période de paie était
        un bloc à libellé en micro-majuscules, alors que c'est une PHRASE — le
        cadre dans lequel la semaine affichée se situe, pas une valeur à régler.
      */}
      {/*
        Le commutateur de vue est à DROITE du bloc de titre, pas au-dessus.

        Il répond à « et l'autre vue ? » — une question qu'on ne se pose qu'après
        avoir vu où l'on est. En bande pleine largeur au-dessus du titre, il
        passait avant lui dans l'ordre de lecture.

        Aligné sur la première ligne, et non centré sur les deux : c'est le titre
        qu'il accompagne, pas la phrase de période.
      */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">
            Suivi des heures
          </h1>

          {/*
            La période décide de ce qui se clôture et de ce qui s'exporte. La lire
            ici évite de la chercher au bas de la grille, et elle prolonge le
            titre plutôt que de commencer une seconde chose — d'où le
            resserrement sous lui.
          */}
          <p className="text-ink2 mt-0.5 text-[15px] leading-5.5 tabular-nums">
            Période de paie : {libellePeriode(periode)}
          </p>
        </div>

        <OngletsHeures />
      </div>

      {/*
        La grille n'est PAS resserrée comme les autres écrans du produit : neuf
        colonnes sous 860 px de large partiraient en défilement horizontal, sur
        le seul écran qui se remplit au clavier sans jamais quitter la vue.
      */}
      <div className="mt-8">
        {employes.length === 0 ? (
          /*
            Les commandes restent à l'écran même sans employé actif : sinon une
            période passée devient inconsultable dès qu'un employé est désactivé.
            Elles sont ailleurs dans la rangée de la grille, qui n'existe pas ici.
          */
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">{commandes}</div>
            <EtatVide
              titre="Aucun employé actif"
              message="Créez une fiche d’employé pour commencer la saisie des heures."
              action={{ libelle: 'Employés', href: '/heures/employes' }}
            />
          </div>
        ) : (
          <GrilleHeures
            utilisateurId={session.userId}
            debut={enIso(lundi)}
            jours={jours}
            employes={employes.map((e) => ({
              id: e.id,
              nom: e.nom,
              entrepriseSlug: e.entrepriseSlug,
            }))}
            valeurs={valeurs}
            seuilCentiemes={parametres.seuilCentiemes}
            cloturee={vuePeriode.cloturee}
            peutSaisir={aPermission(session.role, 'heures:saisir')}
            peutCloturer={aPermission(session.role, 'heures:cloturer')}
            peutCorriger={aPermission(session.role, 'heures:corriger')}
            copieDisponible={saisiesPrecedentes > 0}
            lienExport={`/heures/export?debut=${enIso(periode.debut)}&fin=${enIso(periode.fin)}`}
            periode={{ debut: enIso(periode.debut), fin: enIso(periode.fin) }}
            enTete={commandes}
          />
        )}
      </div>
    </div>
  )
}
