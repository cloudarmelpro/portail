import { compteEstimations } from '@/components/calculateur/format'
import { ListeCreux, RangeeCreux } from '@/components/shared/liste-creux'
import { PanneauDonnees } from '@/components/shared/panneau-donnees'
import { ENTREPRISES } from '@/config/entreprises'
import { dernieresEstimations, estimationsExpirantes } from '@/lib/data/accueil'
import { compterEstimations } from '@/lib/data/estimations'
import { requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

/**
 * Le dossier se choisit avant toute donnée.
 *
 * Trois clients cadés, trois comptages : il n'existe volontairement aucune
 * requête « tous dossiers confondus » dans ce module. Le seul écran qui voit les
 * trois entreprises à la fois ne voit que des nombres — et les deux panneaux
 * ci-dessous ne dérogent pas : ils additionnent trois lectures cadrées.
 */
export default async function PageChoixEntreprise() {
  await requireModule('calculateur')

  // Tout part ensemble : en cascade, chaque bloc attendrait la latence du
  // précédent vers Neon.
  const [comptes, recentes, expirantes] = await Promise.all([
    Promise.all(ENTREPRISES.map((e) => compterEstimations(prismaCadre(e.slug)))),
    dernieresEstimations(),
    estimationsExpirantes(),
  ])

  /*
    AUCUN panneau n'est écarté, contrairement à l'accueil. Là-bas, un panneau
    vide n'a rien à dire ; ici l'écran répond à « où en est le calculateur », et
    une structure qui apparaît et disparaît selon les données se lit comme un
    écran différent à chaque visite.

    Ce qui presse d'abord — ce qui périme — puis ce qui vient d'être préparé.
  */
  const panneaux = [expirantes, recentes]

  return (
    /*
      Même bloc que le CRM et l'accueil — même mesure, même axe, même hauteur de
      départ : passer de l'un à l'autre ne doit pas faire sauter le titre.
    */
    <div className="mx-auto w-full max-w-265 pb-10">
      <div>
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">Calculateur</h1>
        {/*
          Serré sous le titre : la phrase le PROLONGE, elle ne commence pas une
          seconde chose.
        */}
        <p className="text-ink2 mt-0.5 text-[15px] leading-5.5">
          Choisissez l’entreprise pour laquelle vous préparez une estimation.
        </p>
      </div>

      {/*
        Ce qui ATTEND avant où ALLER. L'écran ne demandait qu'une chose — quel
        dossier — alors que la réponse dépend souvent de ce qui presse.
      */}
      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        {panneaux.map((p) => (
          <PanneauDonnees key={p.cle} panneau={p} />
        ))}
      </div>

      {/*
        Trois rangées en creux, et non trois cartes — comme au CRM. Les cartes
        portaient chacune un pavé d'illustration pour dire une seule chose : le
        nom du dossier.
      */}
      <div className="mt-4">
        <ListeCreux titre="Dossiers">
          {ENTREPRISES.map((e, i) => (
            <RangeeCreux
              key={e.slug}
              href={`/calculateur/${e.slug}`}
              /*
                Le nom de l'entreprise dans l'annonce : trois liens dont le texte
                visible se ressemble ne se distinguent pas dans la liste des
                liens d'un lecteur d'écran.
              */
              annonce={`Ouvrir le calculateur — ${e.nom}`}
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
              valeur={compteEstimations(comptes[i] ?? 0)}
            />
          ))}
        </ListeCreux>
      </div>
    </div>
  )
}
