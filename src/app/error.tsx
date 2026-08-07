'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'

/**
 * Dernier filet avant la page d'erreur par défaut de Next.
 *
 * `(app)/error.tsx` couvre la zone protégée ; celui-ci couvre ce qui reste — les
 * écrans d'authentification et la page introuvable. Sans lui, une panne sur
 * l'écran de connexion affichait la page brute du cadre : ni thème, ni français,
 * ni chemin de retour.
 *
 * « Réessayer » rejoue le segment ; le repli renvoie à l'accueil, d'où le proxy
 * renvoie à la connexion en l'absence de session — ce qui est exactement la
 * reprise attendue ici. Un seul des deux est noir.
 */
export default function ErreurGlobale({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col justify-center py-16">
      <EtatSysteme
        icone={AlertCircle}
        titre="Une erreur est survenue"
        message="Réessayez. Si le problème persiste, transmettez la référence ci-dessous."
        reference={error.digest}
        action={{ libelle: 'Réessayer', onClick: retry }}
        secondaire={{ libelle: 'Retour à l’accueil', href: '/accueil' }}
      />
    </div>
  )
}
