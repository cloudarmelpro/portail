'use client'

import { useEffect } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'
import { estErreurAcces } from '@/lib/erreurs'

/**
 * Filet d'erreur de la banque de CV.
 *
 * Les vues réservées à l'administrateur — corbeille, « Plus de 24 mois » —
 * arrivent ici comme un refus d'accès. Le message ne dit RIEN de ce qui se
 * trouve derrière : jamais « cette vue est réservée à l'administrateur », qui
 * renseignerait sur l'organisation des droits.
 */
export default function ErreurCv({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const accesRefuse = estErreurAcces(error)

  useEffect(() => {
    if (!accesRefuse) console.error(error)
  }, [error, accesRefuse])

  if (accesRefuse) {
    return (
      <EtatSysteme
        icone={Lock}
        titre="Accès refusé"
        message="Vous n’avez pas accès à cette page."
        action={{ libelle: 'Retour à la banque de CV', href: '/cv' }}
      />
    )
  }

  return (
    <EtatSysteme
      icone={AlertCircle}
      titre="Une erreur est survenue"
      message="Réessayez. Si le problème persiste, transmettez la référence ci-dessous."
      reference={error.digest}
      action={{ libelle: 'Réessayer', onClick: retry }}
      secondaire={{ libelle: 'Retour à la banque de CV', href: '/cv' }}
    />
  )
}
