import Link from 'next/link'
import { AlertCircle, FileDown, X } from 'lucide-react'
import { OngletsVue } from '@/components/calculateur/entete-module'
import { compteEstimations } from '@/components/calculateur/format'
import { COLONNE_CONTENU } from '@/components/calculateur/mise-en-page'
import { TableauEstimations } from '@/components/calculateur/tableau-estimations'
import { classesBouton } from '@/components/shared/bouton'
import { EtatVide } from '@/components/shared/etat-vide'
import { listerEstimations } from '@/lib/data/estimations'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

export default async function PageEstimations({
  params,
  searchParams,
}: PageProps<'/calculateur/[entreprise]/estimations'>) {
  await requireModule('calculateur')

  const { entreprise } = await params
  const slug = await requireEntreprise(entreprise)
  const expirant = (await searchParams).filtre === 'expirant'

  const estimations = await listerEstimations(prismaCadre(slug), {
    expirantSousSeptJours: expirant,
  })

  return (
    <div>
      {/*
        Le titre ne s'affiche plus : le fil d'Ariane de l'en-tête nomme déjà
        l'écran, et la bande au-dessus nomme le dossier. Il RESTE dans le
        document — une page sans `h1` ne se parcourt pas par les titres.
      */}
      <h1 className="sr-only">Estimations</h1>

      <div className={COLONNE_CONTENU}>
        <div className="mb-6 flex justify-end">
          <OngletsVue slug={slug} vue="liste" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {expirant && (
            <span className="border-border-strong inline-flex h-9 items-center gap-2 rounded-full border py-1 pr-2 pl-3 text-[13px] leading-[18px] font-medium">
              {/* Le mot porte l'information ; la couleur ne va qu'à l'icône. */}
              <AlertCircle className="text-serious-texte size-3.5 shrink-0" aria-hidden />
              Estimations expirant sous 7 jours
              <Link
                href={`/calculateur/${slug}/estimations`}
                aria-label="Retirer le filtre"
                className="text-ink3 hover:bg-hover2 hover:text-ink inline-flex size-5 items-center justify-center rounded-full"
              >
                <X className="size-3" aria-hidden />
              </Link>
            </span>
          )}

          <span className="text-ink3 ml-auto flex h-9 items-center text-[13px] tabular-nums">
            {compteEstimations(estimations.length)}
          </span>

          {/* Nomenclature Intuit — reprise directe dans QuickBooks (EST-14). */}
          <a
            href={`/calculateur/${slug}/estimations/csv`}
            title="Nomenclature compatible avec QuickBooks"
            className={classesBouton({ variante: 'secondaire' })}
          >
            <FileDown className="size-4" aria-hidden />
            Exporter en CSV
          </a>
        </div>

        <div className="mt-4">
          {estimations.length === 0 ? (
            <EtatVide
              titre="Aucune estimation enregistrée"
              message={
                expirant
                  ? 'Retirez le filtre ou créez une nouvelle estimation.'
                  : 'Calculez une estimation, puis enregistrez-la au dossier d’un client.'
              }
              action={{ libelle: 'Nouvelle estimation', href: `/calculateur/${slug}` }}
            />
          ) : (
            <TableauEstimations slug={slug} estimations={estimations} />
          )}
        </div>
      </div>
    </div>
  )
}
