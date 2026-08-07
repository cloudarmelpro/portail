'use client'

import { useEffect } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'
import { estErreurAcces } from '@/lib/erreurs'

/**
 * Filet d'erreur de la zone protégée.
 *
 * Il distingue deux cas : un accès refusé — levé par les gardes — et une panne
 * réelle. Les confondre donnerait à un utilisateur légitime le sentiment que
 * l'application est cassée, alors qu'il lui manque simplement un droit.
 */
export default function ErreurApp({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const accesRefuse = estErreurAcces(error)

  useEffect(() => {
    // Un refus d'accès n'est pas un incident : le journaliser noierait les vraies
    // pannes dans le bruit.
    if (!accesRefuse) console.error(error)
  }, [error, accesRefuse])

  if (accesRefuse) {
    return (
      <EtatSysteme
        icone={Lock}
        titre="Accès refusé"
        // Ne RIEN révéler de ce qui se trouve derrière : jamais « ce client
        // appartient à une autre entreprise ».
        message="Vous n’avez pas accès à cette page."
        action={{ libelle: 'Retour à l’accueil', href: '/accueil' }}
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
      secondaire={{ libelle: 'Retour à l’accueil', href: '/accueil' }}
    />
  )
}
