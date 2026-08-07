'use client'

import { useEffect } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'
import { estErreurAcces } from '@/lib/erreurs'

/**
 * Filet d'erreur du suivi des heures.
 *
 * Un refus d'accès et une panne se ressemblent à l'écran et n'appellent pas la
 * même réaction : les confondre donnerait à une gérante le sentiment que
 * l'application est cassée alors qu'il lui manque un droit.
 *
 * `retry` et non `reset` : le second réaffiche l'arbre sans redemander les
 * données, donc rejoue la panne à l'identique. Voir la doc de `error.tsx`.
 */
export default function ErreurHeures({
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
