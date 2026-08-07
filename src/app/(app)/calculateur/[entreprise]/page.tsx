import { Copy } from 'lucide-react'
import { Calculette } from '@/components/calculateur/calculette'
import { OngletsVue } from '@/components/calculateur/entete-module'
import { COLONNE_CONTENU } from '@/components/calculateur/mise-en-page'
import {
  grilleActive,
  listerClientsPourRattachement,
  estimationParId,
} from '@/lib/data/estimations'
import { dateValidite, formaterDateSeule } from '@/lib/domaine/estimation'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

export default async function PageNouvelleEstimation({
  params,
  searchParams,
}: PageProps<'/calculateur/[entreprise]'>) {
  const session = await requireModule('calculateur')

  const { entreprise } = await params
  const slug = await requireEntreprise(entreprise)

  // Un paramètre répété dans l'URL arrive en tableau : on ne retient que la
  // forme utilisable, plutôt que d'aller chercher une estimation nommée « a,b ».
  const requete = await searchParams
  const depuis = typeof requete.depuis === 'string' ? requete.depuis : undefined
  const clientDemande = typeof requete.client === 'string' ? requete.client : undefined

  const db = prismaCadre(slug)

  const [grille, clients, origine] = await Promise.all([
    grilleActive(db),
    listerClientsPourRattachement(db),
    depuis ? estimationParId(db, depuis) : Promise.resolve(null),
  ])

  /*
    L'identifiant vient de l'URL. On ne va pas le chercher en base : on le
    résout dans la liste DÉJÀ cadrée sur l'entreprise. Un identifiant appartenant
    à un autre dossier n'y figure pas et ne donne donc rien — la recherche
    s'ouvre vide, ce qui est le comportement correct plutôt qu'une erreur.
  */
  const clientInitialNom = clientDemande
    ? (clients.find((c) => c.id === clientDemande)?.nom ?? null)
    : null

  return (
    <div>
      {/*
        Le titre ne s'affiche plus : le fil d'Ariane de l'en-tête nomme déjà
        l'écran, et la bande au-dessus nomme le dossier. Il RESTE dans le
        document — une page sans `h1` ne se parcourt pas par les titres, premier
        moyen de navigation d'un lecteur d'écran.
      */}
      <h1 className="sr-only">Nouvelle estimation</h1>

      <div className={COLONNE_CONTENU}>
        {/*
          Le commutateur de vue est poussé à droite : la lecture part du contenu
          à gauche, et un commutateur est un geste, pas une donnée à lire.
        */}
        <div className="mb-6 flex justify-end">
          <OngletsVue slug={slug} vue="nouvelle" />
        </div>

        {origine && (
          <p className="border-border bg-raised text-ink2 mb-4 flex items-start gap-2 rounded-[10px] border px-4 py-3 text-[13px] leading-[18px]">
            <Copy className="text-ink3 mt-px size-4 shrink-0" aria-hidden />
            <span>
              Copie de{' '}
              <span className="text-ink font-medium tabular-nums">{origine.reference}</span>.
              L’originale reste inchangée&nbsp;; le numéro sera attribué à l’enregistrement.
            </span>
          </p>
        )}

        <Calculette
          slug={slug}
          produits={grille?.produits ?? []}
          grilleId={grille?.id ?? null}
          clients={clients}
          clientInitialNom={clientInitialNom}
          utilisateurId={session.userId}
          valideJusquauTexte={`Valide jusqu’au ${formaterDateSeule(dateValidite(new Date()))}`}
          origine={
            origine && {
              id: origine.id,
              lignes: origine.lignes,
              fraisDeplacement: origine.fraisDeplacement,
              majorationPct: origine.majorationPct,
              rabaisMontant: origine.rabaisMontant,
              rabaisPct: origine.rabaisPct,
            }
          }
        />
      </div>
    </div>
  )
}
