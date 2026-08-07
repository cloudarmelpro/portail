'use client'

import { usePathname } from 'next/navigation'
import { filAriane } from '@/config/fil-ariane'

/**
 * Fil d'Ariane de l'en-tête — section 19.
 *
 * Client uniquement pour lire l'adresse courante. Tout le raisonnement vit dans
 * `config/fil-ariane.ts`, qui est une fonction pure : ce composant ne décide de
 * rien, il place.
 */
export function FilAriane() {
  const { parent, courant } = filAriane(usePathname())

  return (
    <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-baseline gap-2">
      {parent && (
        <>
          <span className="text-ink3 text-[13px] leading-[18px] whitespace-nowrap">{parent}</span>
          {/*
            La barre oblique est décorative : elle sépare à l'œil, et un lecteur
            d'écran qui l'annoncerait dirait « CRM barre oblique Clients ».
          */}
          <span aria-hidden className="text-ink3 text-[13px]">
            /
          </span>
        </>
      )}
      <span className="truncate text-[15px] leading-[22px] font-semibold">{courant}</span>
    </nav>
  )
}
