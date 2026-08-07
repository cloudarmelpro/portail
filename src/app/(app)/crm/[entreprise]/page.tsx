import { ListeSoumissions } from '@/components/crm/liste-soumissions'
import { TableauRelances } from '@/components/crm/tableau-relances'
import { TuilesRelances } from '@/components/crm/tuiles-relances'
import { EtatVide } from '@/components/shared/etat-vide'
import { ListeCreux } from '@/components/shared/liste-creux'
import { relancesEchues, soumissionsEnAttente } from '@/lib/data/crm'
import { OngletsVue } from '@/components/crm/onglets-crm'
import { aPermission } from '@/lib/permissions'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

/**
 * CRM-6 — tableau de bord des relances, écran d'accueil du dossier.
 *
 * C'est délibérément la liste des clients qui est reléguée à un onglet : ouvrir
 * le CRM doit répondre à « qu'est-ce que je dois faire aujourd'hui », pas à
 * « qui sont mes clients ».
 */
export default async function PageRelances({ params }: PageProps<'/crm/[entreprise]'>) {
  const { entreprise } = await params
  const session = await requireModule('crm')
  const slug = await requireEntreprise(entreprise)
  const peutSupprimer = aPermission(session.role, 'crm:supprimer')
  const db = prismaCadre(slug)

  const [relances, soumissions] = await Promise.all([relancesEchues(db), soumissionsEnAttente(db)])

  const expirantes = soumissions.filter((s) => s.expireBientot).length

  /*
    ─────────────────────────────────────────────────────────────────────
    « En attente » veut dire : on attend encore une réponse.

    Le chiffre comptait toutes les estimations au statut « Envoyé », expirées
    comprises. Comme rien ne fait expirer une estimation automatiquement, il
    enflait indéfiniment : une soumission morte depuis six mois y figurait
    toujours. Le tableau, lui, les marquait bien « Expiré » — seul le NOMBRE
    mentait, et c'est le nombre qu'on regarde en premier.

    La liste continue de les afficher : elles méritent d'être vues, justement
    parce qu'elles n'ont jamais reçu de réponse.
    ─────────────────────────────────────────────────────────────────────
  */
  const enAttente = soumissions.filter((s) => !s.expiree).length

  return (
    <div>
      {/*
        Le titre ne s'affiche plus : le fil d'Ariane de l'en-tête nomme déjà
        l'écran, et la bande au-dessus nomme le dossier. Il RESTE dans le
        document — une page sans `h1` ne se parcourt pas par les titres, premier
        moyen de navigation d'un lecteur d'écran.
      */}
      <h1 className="sr-only">Relances</h1>

      <TuilesRelances
        aujourdhui={relances.duJour.length}
        enRetard={relances.enRetard.length}
        soumissions={enAttente}
        expirantes={expirantes}
      />

      {/*
        Le contenu est resserré sous les bandes, qui vont d'un bord à l'autre.
        L'écart avec elles est délibérément large : c'est lui qui les fait lire
        comme du chrome et ce qui suit comme du contenu.
      */}
      <div className="mt-10 xl:mx-24">
        {/*
          Le choix de vue vit dans la colonne de CONTENU, pas au bord du panneau :
          il commande ce qui suit, donc il partage sa largeur. Poussé à droite,
          parce que la lecture part du contenu à gauche et qu'un commutateur est
          un geste, pas une donnée à lire.

          Sa marge est la SIENNE, et non l'espacement du groupe qui suit : les
          trois vues du module doivent le poser à la même distance, et deux
          d'entre elles n'ont aucun groupe sous lui.
        */}
        <div className="mb-6 flex justify-end">
          <OngletsVue slug={slug} vue="relances" peutSupprimer={peutSupprimer} />
        </div>

        <div className="flex flex-col gap-4">
          {/*
            Deux listes, pas une. Confondues, elles laissaient croire qu'une
            journée de travail suffisait à solder des relances vieilles d'une
            semaine. Sans retard, la liste disparaît : le compte à zéro est
            déjà porté par la bande.
          */}
          {relances.enRetard.length > 0 && (
            <ListeCreux titre="En retard" compte={relances.enRetard.length} alerte>
              <TableauRelances relances={relances.enRetard} entreprise={slug} />
            </ListeCreux>
          )}

          {/*
            Les états vides restent des ÉTATS VIDES, hors du creux : une carte
            grise qui n'aurait rien à contenir affirmerait qu'il manque quelque
            chose, alors qu'il n'y a simplement rien à faire aujourd'hui.
          */}
          {relances.duJour.length === 0 ? (
            <EtatVide
              titre="Aucune relance prévue aujourd’hui"
              message="Les prochaines relances apparaîtront ici à leur date."
            />
          ) : (
            <ListeCreux titre="À faire aujourd’hui" compte={relances.duJour.length}>
              <TableauRelances relances={relances.duJour} entreprise={slug} />
            </ListeCreux>
          )}

          {soumissions.length === 0 ? (
            <EtatVide
              titre="Aucune soumission en attente"
              message="Les estimations envoyées apparaîtront ici jusqu’à la réponse du client."
            />
          ) : (
            <ListeCreux titre="Soumissions en attente" compte={soumissions.length}>
              <ListeSoumissions soumissions={soumissions} entreprise={slug} />
            </ListeCreux>
          )}
        </div>
      </div>
    </div>
  )
}
