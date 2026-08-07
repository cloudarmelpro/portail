'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Interrupteur } from '@/components/shared/interrupteur'

/**
 * Montrer ou non les comptes suspendus — ADM-1.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'interrupteur est ALLUMÉ par défaut, et ce n'est pas un détail.
 *
 * Un écran d'administration qui cache une partie des comptes sans le dire fait
 * croire qu'un compte suspendu n'existe plus. La liste est donc complète tant
 * qu'on n'a rien demandé ; l'éteindre est un geste délibéré, inscrit dans
 * l'adresse, et la bande de chiffres continue d'annoncer combien sont écartés.
 *
 * D'où l'absence du paramètre quand il est allumé : l'état par défaut ne
 * s'écrit pas dans l'URL, sans quoi deux adresses désigneraient la même vue.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function FiltreSuspendus({ className }: { className?: string }) {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const [, demarrer] = useTransition()

  const actif = params.get('suspendus') !== '0'

  function basculer(valeur: boolean) {
    const suivants = new URLSearchParams(params)
    if (valeur) suivants.delete('suspendus')
    else suivants.set('suspendus', '0')

    const requete = suivants.toString()
    demarrer(() => {
      /*
        `scroll: false` : la liste se filtre sous les yeux de l'utilisateur, et
        remonter en haut de page lui ferait perdre la ligne qu'il regardait.
      */
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false })
    })
  }

  return (
    <Interrupteur
      className={className}
      id="voir-suspendus"
      libelle="Afficher les comptes suspendus"
      actif={actif}
      onBascule={basculer}
    />
  )
}
