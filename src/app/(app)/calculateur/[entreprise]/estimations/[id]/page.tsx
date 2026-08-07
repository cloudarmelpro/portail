import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionsEstimation } from '@/components/calculateur/actions-estimation'
import { BadgeStatutEstimation } from '@/components/shared/badge-statut'
import { FlecheGauche } from '@/components/shared/fleches'
import { DocumentEstimation, ID_DOCUMENT } from '@/components/calculateur/document-estimation'
import { COLONNE_CONTENU } from '@/components/calculateur/mise-en-page'
import { organisation } from '@/lib/data/admin'
import { estimationParId } from '@/lib/data/estimations'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'
import { urlApercu } from '@/lib/storage'

/**
 * Aperçu imprimable d'une estimation — exigence EST-10.
 *
 * L'export de référence est le PDF composé par le serveur (`./pdf/route.ts`).
 * Cette feuille couvre l'autre chemin : l'impression directe depuis l'écran.
 *
 * Elle isole le document par visibilité plutôt qu'en masquant les blocs de
 * l'application : la coquille — barre latérale, en-tête — appartient à un autre
 * module, et une règle qui dépendrait de sa structure casserait à la première
 * refonte.
 */
const STYLE_IMPRESSION = `
@media print {
  body * { visibility: hidden; }
  #${ID_DOCUMENT}, #${ID_DOCUMENT} * { visibility: visible; }
  #${ID_DOCUMENT} {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    /* Sans cela le navigateur retire les aplats : le filet de 3 px de
       l'entreprise — la seule marque du document — ne s'imprimerait pas. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #${ID_DOCUMENT} thead { display: table-header-group; }
  #${ID_DOCUMENT} tr,
  #${ID_DOCUMENT} [data-bloc='totaux'],
  #${ID_DOCUMENT} footer { break-inside: avoid; }
  #${ID_DOCUMENT} p { orphans: 3; widows: 3; }
  /* Lettre US : le format des imprimantes du Québec. */
  @page { size: letter; margin: 16mm; }
}
`

export default async function PageApercuEstimation({
  params,
}: PageProps<'/calculateur/[entreprise]/estimations/[id]'>) {
  const session = await requireModule('calculateur')

  const { entreprise, id } = await params
  const slug = await requireEntreprise(entreprise)

  const estimation = await estimationParId(prismaCadre(slug), id)
  if (!estimation) notFound()

  // Coordonnées légales de CETTE entreprise — cloisonnées comme le reste. Vides
  // tant que l'administrateur ne les a pas saisies, auquel cas le document
  // imprime un bandeau plutôt qu'une adresse inventée.
  const org = await organisation(prismaCadre(slug))
  // Signée et valable cinq minutes — TR-3 : aucun fichier n'est servi par une
  // adresse directe, pas même un logo.
  const logoUrl = org.logoCle ? await urlApercu(org.logoCle) : null

  return (
    <div className={COLONNE_CONTENU}>
      {/* `href` et `precedence` font remonter la feuille dans le <head> et la
          dédoublonnent — c'est la façon dont React 19 gère une feuille de style. */}
      <style href="calculateur-impression" precedence="default">
        {STYLE_IMPRESSION}
      </style>

      <div className="print:hidden">
        <Link
          href={`/calculateur/${slug}/estimations`}
          className="text-ink2 hover:text-ink inline-flex items-center gap-1.5 text-[13px] leading-[18px]"
        >
          <FlecheGauche className="w-3.5" />
          Estimations
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-4">
          {/*
            Le fil d'Ariane nomme la SECTION — « Calculateur / Estimations ». Le
            numéro de l'estimation ne se lit nulle part ailleurs : ce titre reste
            donc visible, là où les autres écrans passent le leur en `sr-only`.
          */}
          <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
            {estimation.reference}
          </h1>
          <BadgeStatutEstimation statut={estimation.statut} />

          <ActionsEstimation
            slug={slug}
            estimationId={estimation.id}
            reference={estimation.reference}
            hrefPdf={`/calculateur/${slug}/estimations/${estimation.id}/pdf`}
            statut={estimation.statut}
            version={estimation.version}
            peutEcrire={aPermission(session.role, 'calculateur:ecrire')}
          />
        </div>
      </div>

      <div className="border-border bg-raised mt-8 overflow-hidden rounded-[10px] border print:mt-0 print:rounded-none print:border-0">
        <DocumentEstimation
          slug={slug}
          estimation={estimation}
          organisation={org}
          logoUrl={logoUrl}
        />
      </div>
    </div>
  )
}
