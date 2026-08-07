import { OngletsHeures } from '@/components/heures/onglets-heures'
import { Clock, UserCheck, Users } from 'lucide-react'
import { ListeCreux } from '@/components/shared/liste-creux'
import { CartesChiffres, type CarteChiffre } from '@/components/shared/cartes-chiffres'
import { EtatVide } from '@/components/shared/etat-vide'
import { BoutonNouvelEmploye } from '@/components/heures/formulaire-employe'
import {
  type LigneEmploye,
  type Ordre,
  type Tri,
  TableauEmployes,
} from '@/components/heures/tableau-employes'
import { entreprise, estEntreprise } from '@/config/entreprises'
import {
  aujourdHui,
  compilerPeriode,
  formaterHeuresAvecUnite,
  grouperParSemaine,
  libellePeriode,
  periodeDe,
  semainesDe,
} from '@/lib/domaine/heures'
import { listerEmployes, parametresPaie, saisiesEntre } from '@/lib/data/heures'
import { requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'

const TRIS: Tri[] = ['nom', 'entreprise', 'taux', 'total', 'statut']

function comparer(a: LigneEmploye, b: LigneEmploye, tri: Tri): number {
  switch (tri) {
    case 'entreprise': {
      const nom = (s: string) => (estEntreprise(s) ? entreprise(s).nom : s)
      return nom(a.entrepriseSlug).localeCompare(nom(b.entrepriseSlug), 'fr-CA')
    }
    case 'taux':
      return (a.tauxCents ?? -1) - (b.tauxCents ?? -1)
    case 'total':
      return a.totalCentiemes - b.totalCentiemes
    case 'statut':
      return Number(a.actif) - Number(b.actif)
    default:
      return a.nom.localeCompare(b.nom, 'fr-CA')
  }
}

/** Liste des employés — exigence HEU-1. */
/**
 * Aucun délai de cache client : même raison que la grille de saisie.
 *
 * Le total de la période affiché pour chaque employé vient des mêmes lignes que
 * la grille. Le figer trente secondes ferait diverger deux écrans du même
 * module, ce qui se remarque plus vite qu'une page lente.
 */
export const unstable_dynamicStaleTime = 0

export default async function PageEmployes(props: PageProps<'/heures/employes'>) {
  const session = await requireModule('heures')
  const { tri, ordre } = await props.searchParams

  const triRetenu: Tri = TRIS.includes(tri as Tri) ? (tri as Tri) : 'nom'
  const ordreRetenu: Ordre = ordre === 'desc' ? 'desc' : 'asc'

  const parametres = await parametresPaie()
  const periode = periodeDe(aujourdHui(), parametres.joursPeriode)
  const semaines = semainesDe(periode)

  const [employes, saisies] = await Promise.all([listerEmployes(), saisiesEntre(periode)])

  const lignes: LigneEmploye[] = employes.map((e) => {
    const siennes = saisies.filter((s) => s.employeId === e.id)
    const compilation = compilerPeriode(
      grouperParSemaine(siennes, semaines),
      e.tauxCents,
      parametres,
    )
    return {
      id: e.id,
      nom: e.nom,
      entrepriseSlug: e.entrepriseSlug,
      tauxCents: e.tauxCents,
      totalCentiemes: compilation.total,
      actif: e.actif,
    }
  })

  /*
    Le tri survit à la disparition des en-têtes de colonne.

    Il vivait dans l'URL, et les colonnes n'étaient que la façon de l'écrire.
    Les rangées ne l'offrent plus — elles ne se comparent pas — mais une adresse
    mise en signet continue de rendre la liste dans l'ordre demandé, et le
    retirer aurait cassé des liens pour rien.
  */
  lignes.sort((a, b) => (ordreRetenu === 'asc' ? 1 : -1) * comparer(a, b, triRetenu))

  /*
    Les chiffres portent sur TOUS les employés, y compris les inactifs : la
    colonne « Statut » les distingue déjà, et une bande qui les retrancherait
    ferait mentir le total des heures de la période — un employé désactivé en
    cours de période a bien travaillé.
  */
  /*
    Une icône par chiffre, et non trois fois celle du module. Elles sont
    décoratives — le libellé porte l'information — mais trois fois le même
    signe sur trois cartes voisines n'aide à rien et se remarque quand même.
  */
  const chiffres: CarteChiffre[] = [
    { cle: 'employes', libelle: 'Employés', valeur: String(lignes.length), icone: Users },
    {
      cle: 'actifs',
      libelle: 'Actifs',
      valeur: String(lignes.filter((l) => l.actif).length),
      icone: UserCheck,
    },
    {
      cle: 'heures',
      libelle: 'Heures de la période',
      valeur: formaterHeuresAvecUnite(lignes.reduce((t, l) => t + l.totalCentiemes, 0)),
      icone: Clock,
    },
  ]

  return (
    <div>
      {/*
        Même en-tête que la saisie : titre à gauche, commutateur de vue à droite.
        Le titre était en `sr-only`, la bande pleine largeur portant le
        commutateur — elle a disparu, et il redevient visible.
      */}
      <div className="flex flex-wrap items-start gap-4">
        <h1 className="min-w-0 flex-1 text-[30px] leading-9 font-semibold tracking-[-0.02em]">
          Employés
        </h1>

        <OngletsHeures />
      </div>

      {/*
        Même phrase que sur la saisie : la période encadre les heures comptées
        dans la troisième carte, et la lire ici évite de se demander sur quoi
        porte ce total.
      */}
      <p className="text-ink2 mt-0.5 text-[15px] leading-5.5 tabular-nums">
        Période de paie : {libellePeriode(periode)}
      </p>

      {/*
        Des CARTES, et non la bande de chiffres du produit.

        La bande est du chrome : elle s'aligne au bord du panneau et précède le
        contenu. Cet écran n'en a plus — son titre et son commutateur sont dans
        l'en-tête — et une bande posée SOUS un titre se lit comme un second
        en-tête. Les cartes, elles, commencent la page sur l'axe du titre, comme
        à l'accueil.

        Aucun lien : ces trois valeurs n'ouvrent rien de plus précis que la
        liste qui les suit immédiatement.
      */}
      <div className="mt-8">
        <CartesChiffres cartes={chiffres} />
      </div>

      {/*
        La liste entre dans un CREUX, comme les panneaux de l'accueil : un fond
        gris, un titre, le décompte à côté et la commande à droite.

        Le tableau garde son propre cadre — c'est un vrai tableau, avec des
        colonnes triables : on y compare des lignes, ce qu'une liste de rangées
        ne soutient pas.

        La période a quitté cette rangée pour l'en-tête, sous le titre, comme sur
        la saisie : c'est le cadre dans lequel les heures comptées se situent,
        pas une commande de la liste.
      */}
      <div className="mt-4">
        {lignes.length === 0 ? (
          /*
            L'état vide reste HORS du creux : une carte grise qui n'aurait rien à
            contenir affirmerait qu'il manque quelque chose, alors qu'il n'y a
            simplement pas encore de fiche.
          */
          <EtatVide
            titre="Aucun employé"
            message="Ajoutez une première fiche : nom, entreprise de rattachement et taux horaire."
          />
        ) : (
          <ListeCreux
            titre="Employés"
            compte={lignes.length}
            aDroite={
              aPermission(session.role, 'heures:employes') ? <BoutonNouvelEmploye /> : undefined
            }
          >
            <TableauEmployes employes={lignes} />
          </ListeCreux>
        )}
      </div>
    </div>
  )
}
