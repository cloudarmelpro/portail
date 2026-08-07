'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeft, Search } from 'lucide-react'
import type { EntreeNav } from '@/config/navigation'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { MenuUtilisateur } from '@/components/layout/menu-utilisateur'
import { ICONE_MODULE } from '@/components/layout/icones'
import { ICONE_MODULE_PLEINE } from '@/components/layout/icones-pleines'
import type { Role } from '@/lib/permissions'

type Props = {
  entrees: EntreeNav[]
  utilisateur: { nom: string; courriel: string; role: Role }
  /** Barre réduite aux icônes — de 768 à 1280 px, ou repliée à la demande. */
  compacte?: boolean
  /** Absent dans le tiroir : on n'y replie pas une barre qui se ferme déjà. */
  onReplier?: () => void
  replie?: boolean
  onRechercher: () => void
  onNaviguer?: () => void
}

/**
 * Barre latérale.
 *
 * Les entrées viennent de `config/navigation.ts`, dérivé de la matrice de
 * permissions. On ne montre JAMAIS une entrée grisée : un module inaccessible
 * n'existe pas pour cet utilisateur.
 *
 * Elle repose sur `--page` et n'a AUCUNE bordure droite : la séparation vient
 * du panneau de contenu, qui flotte à côté sur `--surface`. Rajouter un filet
 * ferait deux lignes de séparation pour une seule frontière.
 */
export function BarreLaterale({
  entrees,
  utilisateur,
  compacte = false,
  onReplier,
  replie = false,
  onRechercher,
  onNaviguer,
}: Props) {
  const chemin = usePathname()
  const libelleRepli = replie ? 'Déployer la barre latérale' : 'Replier la barre latérale'

  return (
    <div className="bg-page flex h-full flex-col">
      {/*
        `mt-2` est la marge haute du panneau de contenu, dans `shell.tsx` : la
        marque et le panneau démarrent ainsi sur la même ligne, ce qui est la
        seule chose que les deux zones aient à partager.

        Elle a valu davantage : la rangée reprenait la bande complète de
        l'en-tête, pour que le nom s'aligne sur le fil d'Ariane et que la
        recherche démarre sur son filet bas. Cet en-tête ne subsiste plus qu'au
        téléphone, où la barre latérale est justement repliée dans un tiroir —
        il n'y a donc plus rien à aligner, et la hauteur ci-dessous n'est plus
        qu'une mesure de confort.
      */}
      <div
        className={cn(
          'mt-2 flex h-[54px] items-center',
          compacte ? 'justify-center' : 'gap-[9px] px-[11px]',
        )}
      >
        {/*
          La marque MÈNE à l'accueil. C'est la convention de tout produit web, et
          c'est aussi la seule façon d'y revenir : aucune entrée de menu ne le
          désigne, puisque ce n'est pas un module.

          Le lien enveloppe la pastille ET le nom, pour que la cible soit ce
          qu'on vise réellement — cliquer un logo, c'est cliquer le bloc.
        */}
        <Link
          href="/accueil"
          onClick={onNaviguer}
          aria-label={`${siteConfig.nom} — accueil`}
          className={cn(
            'flex min-w-0 items-center rounded-[8px]',
            compacte ? 'justify-center' : 'flex-1 gap-[9px]',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'bg-action text-action-ink flex shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold',
              compacte ? 'size-[30px]' : '-ml-px size-[26px]',
            )}
          >
            {siteConfig.nom.charAt(0)}
          </span>
          {!compacte && (
            <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-semibold tracking-[-0.01em]">
              {siteConfig.nom}
            </span>
          )}
        </Link>

        {!compacte && onReplier && (
          <button
            type="button"
            onClick={onReplier}
            aria-label={libelleRepli}
            title={libelleRepli}
            className="text-ink3 hover:bg-hover hover:text-ink flex size-[26px] shrink-0 items-center justify-center rounded-[8px]"
          >
            <PanelLeft className="size-[15px]" aria-hidden />
          </button>
        )}
      </div>

      {/*
        La recherche vit dans la barre, pas dans l'en-tête. Elle appartient à la
        navigation : c'est le moyen le plus court d'atteindre un écran, et le
        raccourci ⌘K n'est découvrable que s'il est écrit quelque part.
      */}
      {compacte ? (
        <>
          {onReplier && (
            <div className="flex justify-center pb-1.5">
              <button
                type="button"
                onClick={onReplier}
                aria-label={libelleRepli}
                title={libelleRepli}
                className="text-ink3 hover:bg-hover hover:text-ink flex size-8 items-center justify-center rounded-[8px]"
              >
                <PanelLeft className="size-[15px]" aria-hidden />
              </button>
            </div>
          )}
          <div className="flex justify-center pb-2.5">
            <button
              type="button"
              onClick={onRechercher}
              aria-label="Rechercher"
              title="Rechercher"
              className="text-ink3 hover:bg-hover hover:text-ink flex size-8 items-center justify-center rounded-[8px]"
            >
              <Search className="size-[15px]" aria-hidden />
            </button>
          </div>
        </>
      ) : (
        <div className="px-2.5 pb-2.5">
          <button
            type="button"
            onClick={onRechercher}
            className="bg-hover text-ink3 hover:bg-hover2 flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-[13px]"
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Recherche rapide…</span>
            <kbd className="border-border rounded-[5px] border px-[5px] font-sans text-[11px] leading-4">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2.5">
        {entrees.map((e) => {
          const actif = chemin === e.href || chemin.startsWith(`${e.href}/`)
          const Icone = actif ? ICONE_MODULE_PLEINE[e.module] : ICONE_MODULE[e.module]
          return (
            <Link
              key={e.module}
              href={e.href}
              onClick={onNaviguer}
              aria-current={actif ? 'page' : undefined}
              title={compacte ? e.libelle : undefined}
              className={cn(
                'flex items-center gap-2 rounded-[8px] text-[13px] leading-[18px]',
                compacte ? 'h-8 justify-center px-0' : 'h-11 px-2 md:h-[30px]',
                /*
                  L'entrée active est un pavé légèrement surélevé — fond, ombre,
                  graisse et icône pleine à la fois. Quatre signaux plutôt qu'une
                  couleur, et `aria-current` par-dessus : rien ici ne repose sur
                  la teinte seule.

                  L'ombre n'en est un qu'en thème CLAIR. `--sh-menu` est noire, et
                  la barre repose sur `--page`, déjà presque noir en sombre : elle
                  y déplace 1 point de L* au mieux. C'est alors le fond qui porte
                  seul l'élévation, et il y est plus marqué qu'en clair — ΔL* 11,1
                  contre 6,6. Ne pas compter l'ombre pour un cinquième signal.
                */
                actif
                  ? 'bg-hover2 text-ink shadow-menu font-medium'
                  : 'text-ink2 hover:bg-hover hover:text-ink',
              )}
            >
              {/*
                Toujours masquée. Elle a été exposée quand l'entrée est active,
                pour « dire » l'état — mais `aria-current` le dit déjà, et
                l'icône entrait alors dans l'arbre SANS nom accessible : un
                graphique anonyme annoncé en plus du libellé.
              */}
              <Icone className={cn('shrink-0', compacte ? 'size-4' : 'size-3.5')} aria-hidden />
              {!compacte && <span>{e.libelle}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="mx-2.5 pt-2 pb-2.5">
        <MenuUtilisateur utilisateur={utilisateur} compacte={compacte} />
      </div>
    </div>
  )
}
