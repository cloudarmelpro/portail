'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Entreprise = { slug: string; nom: string; jeton: string }

/**
 * Les deux niveaux de navigation du calculateur : le dossier d'entreprise, puis
 * la vue.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Une seule boîte par niveau, et c'est celle où l'on est.
 *
 * L'élément COURANT est un bouton — fond, filet, graisse. Les autres sont du
 * texte, et se lisent alors pour ce qu'ils sont : des liens. Le filet
 * TRANSPARENT des inactifs leur garde la hauteur et l'axe de l'actif ; sans lui,
 * la rangée se décale d'un pixel à chaque changement.
 *
 * Aucune ombre : le fond et le filet suffisent à désigner l'élément courant.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Changer de dossier conserve la vue mais jamais l'estimation ouverte — un
 * identifiant n'a aucun sens dans une autre entreprise, et l'y transporter
 * produirait exactement l'écran que le cloisonnement doit rendre impossible.
 */
export function OngletsCalculateur({
  entreprises,
  actif,
}: {
  entreprises: Entreprise[]
  actif: string
}) {
  const chemin = usePathname()
  const vue = chemin.startsWith(`/calculateur/${actif}/estimations`) ? '/estimations' : ''

  return (
    <nav aria-label="Entreprise" className="flex max-w-full flex-wrap gap-1">
      {entreprises.map((e) => {
        const courant = e.slug === actif
        return (
          <Link
            key={e.slug}
            href={`/calculateur/${e.slug}${vue}`}
            aria-current={courant ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-[9px] px-3 text-[13px] leading-4.5 whitespace-nowrap',
              courant
                ? 'border-border bg-raised text-ink border font-medium'
                : 'text-ink2 hover:text-ink border border-transparent',
            )}
          >
            {/*
              La pastille reste sur les trois, active ou non : c'est un repère
              d'identité, pas un état, et le nom est écrit à côté dans tous les
              cas.
            */}
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${e.jeton})` }}
            />
            {e.nom}
          </Link>
        )
      })}
    </nav>
  )
}

export type VueCalculateur = 'nouvelle' | 'liste'

/**
 * Le second niveau : la vue à l'intérieur d'un dossier.
 *
 * Chaque page SAIT quelle vue elle est — la liste des estimations n'a pas besoin
 * de lire l'adresse pour l'apprendre. La passer en propriété supprime l'écart
 * possible entre ce que l'URL dit et ce que l'écran affiche.
 */
export function OngletsVue({ slug, vue }: { slug: string; vue: VueCalculateur }) {
  return (
    <nav aria-label="Vue" className="flex max-w-full gap-1 overflow-x-auto">
      <Onglet
        href={`/calculateur/${slug}`}
        libelle="Nouvelle estimation"
        actif={vue === 'nouvelle'}
      />
      <Onglet
        href={`/calculateur/${slug}/estimations`}
        libelle="Estimations"
        actif={vue === 'liste'}
      />
    </nav>
  )
}

function Onglet({ href, libelle, actif }: { href: string; libelle: string; actif: boolean }) {
  return (
    <Link
      href={href}
      aria-current={actif ? 'page' : undefined}
      className={cn(
        'flex h-9 shrink-0 items-center rounded-[8px] px-3 text-[13px] leading-4.5 whitespace-nowrap',
        actif
          ? 'border-border bg-raised text-ink border font-medium'
          : 'text-ink2 hover:text-ink border border-transparent',
      )}
    >
      {libelle}
    </Link>
  )
}
