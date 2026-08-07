import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ChampRechercheAccueil } from '@/components/layout/champ-recherche-accueil'
import { PanneauDonnees } from '@/components/shared/panneau-donnees'
import { TuilesAFaire } from '@/components/accueil/tuiles-a-faire'
import { navigationDe } from '@/config/navigation'
import { donneesAccueil } from '@/lib/data/accueil'
import { requireSession } from '@/lib/guards'

/**
 * Accueil — le premier écran après la connexion.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'était une redirection, et elle rendait l'écran inatteignable.
 *
 * Elle renvoyait vers le premier module autorisé : quiconque suivait un bouton
 * « Retour à l'accueil » rebondissait aussitôt vers le CRM. L'accueil existait
 * dans les libellés et nulle part à l'écran.
 *
 * Il devient donc un vrai point de départ : la recherche, puis les modules que
 * le rôle a le droit d'ouvrir. Trois utilisateurs qui vivent chacun dans un
 * module n'en auront pas besoin tous les jours — mais c'est la destination de
 * la marque, celle des filets d'erreur, et le premier écran du premier jour.
 *
 * `navigationDe` dérive de `lib/permissions.ts`, comme le menu latéral : les
 * cartes ne peuvent donc pas diverger de ce que le rôle voit. Un module retiré
 * de la matrice disparaît d'ici sans qu'on y pense.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default async function PageAccueil() {
  const session = await requireSession()
  const modules = navigationDe(session.role)

  /*
    Un rôle sans aucun module n'a rien à faire dans l'application. Le cas ne
    devrait pas exister — `permissionsDe` échoue bruyamment sur un rôle inconnu —
    mais le renvoyer à la connexion vaut mieux qu'un accueil vide.
  */
  if (modules.length === 0) redirect('/')

  return (
    <div className="mx-auto w-full max-w-265 pt-1 pb-10">
      <ChampRechercheAccueil />

      {/*
        Les lectures descendent derrière une frontière de suspension.

        À les attendre ici, le titre et le champ de recherche restaient invisibles
        derrière la plus lente d'une trentaine de requêtes — sur une base
        distante, une seconde d'écran vide avant le premier mot.

        `fallback={null}` : la barre de chargement du haut couvre déjà l'attente,
        et un squelette de tuiles ferait clignoter des cartes qui n'existent
        peut-être pas — celles à zéro ne s'affichent jamais.
      */}
      <Suspense fallback={null}>
        <BlocDonnees />
      </Suspense>
    </div>
  )
}

/**
 * Tuiles et panneaux — tout ce qui demande la base.
 *
 * La garde est REFAITE ici, et ce n'est pas une précaution décorative : ce
 * composant est rendu séparément de la page, donc rien ne garantirait sinon
 * qu'il l'ait été. `sessionCourante` est mémorisée par requête, le second appel
 * ne coûte rien.
 */
async function BlocDonnees() {
  /*
    Le rôle vient de la garde de CE composant, jamais d'une propriété.

    Il était reçu de la page : la garde s'exécutait bien, mais son résultat était
    jeté et c'est l'appelant qui décidait des permissions. Les deux valeurs sont
    identiques — même requête, même session — mais c'est la garde qui doit
    trancher, pas celui qui l'invoque.
  */
  const session = await requireSession()
  const { tuiles, panneaux } = await donneesAccueil(session.role)

  return (
    <>
      <TuilesAFaire tuiles={tuiles} />

      {/*
        Les panneaux remplacent la rangée de cartes de modules.

        Elle dupliquait la barre latérale, qui est à l'écran en permanence : cinq
        pavés pour aller où deux clics menaient déjà. La place revient à ce que la
        barre latérale ne peut pas dire — ce qu'il y a DEDANS aujourd'hui.

        Deux colonnes au plus. Un panneau de cinq lignes étalé sur toute la
        largeur d'un grand écran sépare le nom de sa valeur par une plaine vide,
        et le regard perd la ligne en chemin.
      */}
      {panneaux.length > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {panneaux.map((p) => (
            <PanneauDonnees key={p.cle} panneau={p} />
          ))}
        </div>
      )}
    </>
  )
}
