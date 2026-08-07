import { Suspense } from 'react'
import { ListeCreux, RangeeCreux } from '@/components/shared/liste-creux'
import { PanneauDonnees } from '@/components/shared/panneau-donnees'
import { derniersClientsCrm, donneesCrm, interactionsRecentesCrm } from '@/lib/data/accueil'
import { ENTREPRISES } from '@/config/entreprises'
import { compterClientsActifs } from '@/lib/data/crm'
import { requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

/**
 * CRM-2 — le dossier se choisit avant toute donnée.
 *
 * Trois clients cadrés, trois comptages : il n'existe volontairement aucune
 * requête « tous dossiers confondus » dans ce module. Le seul écran qui voit
 * les trois entreprises à la fois ne voit que des nombres.
 */
export default async function PageCrm() {
  await requireModule('crm')

  return (
    /*
      Le bloc de l'accueil — même mesure, même axe, même hauteur de départ :
      ce sont les deux écrans par lesquels on entre dans le produit, et passer de
      l'un à l'autre ne doit pas faire sauter le titre.
    */
    <div className="mx-auto w-full max-w-265 pb-10">
      <div>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">CRM</h1>
        {/*
          Serré sous le titre : la phrase le PROLONGE, elle ne commence pas une
          seconde chose. À huit pixels, elle flottait entre le titre et la liste
          sans appartenir clairement à l'un ou à l'autre.
        */}
        <p className="text-ink2 mt-0.5 text-[15px] leading-5.5">
          Choisissez l’entreprise dont vous voulez suivre les clients.
        </p>
      </div>

      {/*
        Trois rangées en creux, et non trois cartes.

        Les cartes portaient chacune un pavé d'illustration de 218 px pour dire
        une seule chose : le nom du dossier. C'est beaucoup de hauteur pour un
        choix entre trois valeurs connues, et ça repoussait le troisième sous la
        ligne de flottaison sur un portable.

        La rangée dit la même chose en une ligne, et c'est la forme que le
        tableau de bord porte déjà juste derrière — on choisit un dossier de la
        même façon qu'on choisira une relance dedans.
      */}
      {/*
        Ce qui ATTEND avant où ALLER, derrière une frontière de suspension.

        L'écran ne demandait qu'une chose — quel dossier — alors que la réponse
        dépend souvent de ce qui presse. Mais les quatre panneaux coûtent une
        quinzaine de requêtes : à les attendre, le titre lui-même restait
        invisible. Ils arrivent maintenant après lui.
      */}
      <Suspense fallback={null}>
        <BlocPanneaux />
      </Suspense>

      {/*
        La liste des dossiers demande elle aussi la base — un comptage par
        dossier. Elle a sa propre frontière : trois comptages sont bien plus
        rapides que quinze lectures, et rien ne justifie qu'ils attendent.
      */}
      <div className="mt-4">
        <Suspense fallback={null}>
          <BlocDossiers />
        </Suspense>
      </div>
    </div>
  )
}

/**
 * Les quatre panneaux transverses.
 *
 * La garde est REFAITE : ce composant est rendu séparément de la page, donc
 * rien ne garantirait sinon qu'elle ait eu lieu. `sessionCourante` est
 * mémorisée par requête, le second appel ne coûte rien.
 */
async function BlocPanneaux() {
  await requireModule('crm')

  const [{ panneaux }, derniers, interactions] = await Promise.all([
    donneesCrm(),
    derniersClientsCrm(),
    interactionsRecentesCrm(),
  ])

  /*
    AUCUN panneau n'est écarté ici, contrairement à l'accueil.

    Là-bas, un panneau vide n'a rien à dire : l'écran répond à « qu'est-ce qui
    m'attend », et rien est une réponse complète. Ici l'écran répond à « où en
    est le CRM » : une structure qui apparaît et disparaît selon les données se
    lit comme un écran différent à chaque visite, et sur une base neuve elle
    laisse une page nue qu'on prend pour une panne.

    L'ordre n'est pas celui des lectures : ce qui presse d'abord — relances,
    soumissions — puis ce qui s'est passé.
  */
  const tous = [...panneaux, interactions, derniers]

  return (
    <div className="mt-8 grid gap-4 xl:grid-cols-2">
      {tous.map((p) => (
        <PanneauDonnees key={p.cle} panneau={p} />
      ))}
    </div>
  )
}

/** Les trois dossiers et leur nombre de clients actifs. */
async function BlocDossiers() {
  await requireModule('crm')

  const comptes = await Promise.all(
    ENTREPRISES.map((e) => compterClientsActifs(prismaCadre(e.slug))),
  )

  return (
    <ListeCreux titre="Dossiers">
      {ENTREPRISES.map((e, i) => (
        <RangeeCreux
          key={e.slug}
          href={`/crm/${e.slug}`}
          /*
                Le nom de l'entreprise dans l'annonce : trois liens dont le texte
                visible se ressemble ne se distinguent pas dans la liste des
                liens d'un lecteur d'écran.
              */
          annonce={`Ouvrir le CRM — ${e.nom}`}
          /*
                Pastille de 8 px, seule apparition de la couleur : jamais en fond
                de rangée, jamais en couleur du nom. Le nom écrit juste à côté
                porte l'information ; la teinte ne fait que la retrouver plus
                vite.
              */
          avant={
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${e.jeton})` }}
            />
          }
          principal={e.nom}
          valeur={compteClients(comptes[i] ?? 0)}
        />
      ))}
    </ListeCreux>
  )
}

/**
 * Le compteur nomme son unité et décline le zéro — section 19. « 0 client actif »
 * se lit comme une donnée manquante ; « Aucun client actif » se lit comme un
 * dossier encore vide, ce qui est le cas au jour un des trois entreprises.
 */
function compteClients(n: number): string {
  if (n === 0) return 'Aucun client actif'
  return n === 1 ? '1 client actif' : `${n} clients actifs`
}
