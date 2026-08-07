'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ONGLETS = [
  { libelle: 'Saisie', href: '/heures' },
  { libelle: 'Employés', href: '/heures/employes' },
] as const

/**
 * Les deux vues du module — même commutateur que le CRM et l'administration.
 *
 * L'élément COURANT est un bouton — fond, filet, graisse. L'autre est du texte,
 * et se lit alors pour ce qu'il est : un lien. Le filet TRANSPARENT de l'inactif
 * lui garde la hauteur et l'axe de l'actif ; sans lui, la rangée se décale d'un
 * pixel à chaque changement de vue.
 *
 * Client parce que la vue courante se lit dans l'adresse, et que le layout qui
 * rend ce commutateur survit à la navigation entre les deux vues : il ne serait
 * pas réévalué.
 */
export function OngletsHeures() {
  const chemin = usePathname()

  /*
    `/heures` préfixe tout le module : un test de préfixe le déclarerait actif
    sur la fiche d'un employé. C'est donc l'autre onglet qui décide, et la fiche
    reste sous « Employés ».
  */
  const surEmployes = chemin.startsWith('/heures/employes')

  return (
    <nav aria-label="Vue" className="flex max-w-full gap-1 overflow-x-auto">
      {ONGLETS.map((o) => {
        const actif = o.href === '/heures/employes' ? surEmployes : !surEmployes
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center rounded-[8px] px-3 text-[13px] leading-4.5 whitespace-nowrap',
              actif
                ? 'border-border bg-raised text-ink border font-medium'
                : 'text-ink2 hover:text-ink border border-transparent',
            )}
          >
            {o.libelle}
          </Link>
        )
      })}
    </nav>
  )
}
