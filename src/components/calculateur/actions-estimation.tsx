'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Copy, FileDown, Printer } from 'lucide-react'
import { Bouton, classesBouton } from '@/components/shared/bouton'
import { changerStatutEstimation, emettreEstimation } from '@/lib/actions/estimations'
import { notifier } from '@/lib/toast'
import type { EntrepriseSlug } from '@/config/entreprises'
import type { StatutEstimation } from '@/generated/prisma/client'

type Props = {
  slug: EntrepriseSlug
  estimationId: string
  reference: string
  /** Route d'export — le PDF est composé par le serveur, pas par le navigateur. */
  hrefPdf: string
  statut: StatutEstimation
  version: number
  peutEcrire: boolean
}

/**
 * Actions d'une estimation enregistrée — exigences EST-10, EST-11 et EST-13.
 *
 * Deux chemins de sortie, et l'ordre compte : le PDF du serveur est le document
 * qu'on envoie — identique d'un poste à l'autre —, l'impression du navigateur
 * n'est que le raccourci vers le papier.
 *
 * Les deux groupes sont séparés par un filet : à gauche ce qui fait AVANCER le
 * dossier, à droite ce qui en sort une copie. Sans lui, six boutons de même
 * poids se lisaient comme une seule liste où rien ne se distinguait.
 */
export function ActionsEstimation({
  slug,
  estimationId,
  reference,
  hrefPdf,
  statut,
  version,
  peutEcrire,
}: Props) {
  const [enCours, demarrer] = useTransition()

  function avancer(cible: StatutEstimation) {
    demarrer(async () => {
      const resultat =
        cible === 'envoye'
          ? await emettreEstimation({ entreprise: slug, estimationId, version })
          : await changerStatutEstimation({
              entreprise: slug,
              estimationId,
              statut: cible as 'accepte' | 'refuse' | 'expire',
              version,
            })

      if (!resultat.ok) {
        notifier.erreur(resultat.erreur)
        return
      }

      notifier.succes(`Estimation ${reference} mise à jour.`)
    })
  }

  const transitions = peutEcrire && (statut === 'brouillon' || statut === 'envoye')

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
      {peutEcrire && statut === 'brouillon' && (
        <BoutonSecondaire enCours={enCours} onClick={() => avancer('envoye')}>
          Marquer comme envoyée
        </BoutonSecondaire>
      )}

      {peutEcrire && statut === 'envoye' && (
        <>
          <BoutonSecondaire enCours={enCours} onClick={() => avancer('accepte')}>
            Marquer comme acceptée
          </BoutonSecondaire>
          <BoutonSecondaire enCours={enCours} onClick={() => avancer('refuse')}>
            Marquer comme refusée
          </BoutonSecondaire>
          <BoutonSecondaire enCours={enCours} onClick={() => avancer('expire')}>
            Marquer comme expirée
          </BoutonSecondaire>
        </>
      )}

      {transitions && <span aria-hidden className="bg-border mx-1 hidden h-5 w-px sm:block" />}

      {peutEcrire && (
        <Link
          href={`/calculateur/${slug}?depuis=${estimationId}`}
          className={classesBouton({ variante: 'secondaire' })}
        >
          <Copy className="size-4" aria-hidden />
          Dupliquer
        </Link>
      )}

      <Bouton type="button" variante="secondaire" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        Imprimer
      </Bouton>

      {/*
        Secondaire — la section 19 range « Exporter en PDF » parmi les boutons à
        filet, et le seul bouton principal du module est « Enregistrer au dossier
        client », qui n'est pas sur cet écran. Un écran sans bouton noir est
        normal : celui-ci ne fait que montrer un document déjà écrit.

        Une navigation ordinaire, et non un `Link` : la réponse est un fichier
        joint, que le routeur client ne sait pas rendre.
      */}
      <a href={hrefPdf} className={classesBouton({ variante: 'secondaire' })}>
        <FileDown className="size-4" aria-hidden />
        Exporter en PDF
      </a>
    </div>
  )
}

function BoutonSecondaire({
  enCours,
  onClick,
  children,
}: {
  enCours: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Bouton type="button" variante="secondaire" onClick={onClick} chargement={enCours}>
      {children}
    </Bouton>
  )
}
