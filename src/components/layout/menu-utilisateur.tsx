'use client'

import { useTheme } from 'next-themes'
import { LogOut, MoreHorizontal, Moon, Sun, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIBELLE_ROLE, type Role } from '@/lib/permissions'
import { purgerBrouillons } from '@/lib/brouillon'
import { seDeconnecter } from '@/lib/session-actions'
import { cn } from '@/lib/utils'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { Tronque } from '@/components/shared/tronque'

type Props = {
  utilisateur: { nom: string; courriel: string; role: Role }
  compacte?: boolean
}

/** Ligne du menu — même gabarit pour un bouton d'action et pour la déconnexion. */
const LIGNE =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

export function MenuUtilisateur({ utilisateur, compacte = false }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const sombre = resolvedTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-hover data-[state=open]:bg-hover flex w-full items-center gap-2 rounded-[8px] text-left',
          compacte ? 'h-8 justify-center px-0' : 'h-11 px-2 md:h-[30px]',
        )}
        aria-label={`Compte de ${utilisateur.nom}`}
        title={compacte ? utilisateur.nom : undefined}
      >
        <span
          className={cn(
            'bg-hover2 text-ink2 flex size-[22px] shrink-0 items-center justify-center rounded-full',
            !compacte && '-ml-1',
          )}
        >
          <User className="size-[13px]" aria-hidden />
        </span>
        {!compacte && (
          <>
            {/*
              Le nom seul, sur une ligne. Le rôle vivait ici en sous-titre : il
              ne change jamais, et il occupait la moitié d'un pied de barre qui
              doit rester silencieux. Il reste lisible dans le menu ouvert.
            */}
            {/*
              Pas de plafond chiffré : c'est la barre, large de 212 px, qui donne
              la limite. `min-w-0` reste indispensable — sans lui, l'élément
              flexible garde sa taille de contenu et pousse le chevron dehors.
            */}
            <Tronque className="max-w-full min-w-0 flex-1 text-[13px] leading-[18px]">
              {utilisateur.nom}
            </Tronque>
            <MoreHorizontal className="text-ink3 size-3.5 shrink-0" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>

      {/*
        Ouverture vers le HAUT : le déclencheur est en bas de la barre latérale,
        et un menu vers le bas sortirait de l'écran.

        La largeur épouse le déclencheur — `--anchor-width`, le défaut du
        composant — plutôt qu'une valeur fixe : à 216 px pour une barre de
        212 px, le menu débordait par la droite et flottait par-dessus le
        contenu. Il reste maintenant DANS la barre.

        En rail, la contrainte s'inverse : le déclencheur fait 32 px, et un menu
        de 32 px ne se lit pas. Il s'ouvre alors vers la droite à largeur fixe,
        seule issue quand la barre est plus étroite que son propre menu.
      */}
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={4}
        className={cn(
          'bg-raised shadow-menu rounded-[9px] px-1 py-1.5',
          FILET_FLOTTANT,
          compacte && 'w-[216px]',
        )}
      >
        <div className="px-2.5 pt-1 pb-2">
          <Tronque className="max-w-full text-[13px] leading-[18px] font-medium">
            {utilisateur.nom}
          </Tronque>
          <p className="text-ink3 truncate text-[11px] leading-[14px]">
            {LIBELLE_ROLE[utilisateur.role]}
          </p>
        </div>

        <DropdownMenuItem className={LIGNE} onClick={() => setTheme(sombre ? 'light' : 'dark')}>
          {sombre ? (
            <Sun className="size-[15px] shrink-0" aria-hidden />
          ) : (
            <Moon className="size-[15px] shrink-0" aria-hidden />
          )}
          {sombre ? 'Mode clair' : 'Mode sombre'}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border mx-2 my-1.5 h-px" />

        {/*
          La déconnexion passe par un formulaire plutôt qu'un appel client :
          l'action serveur révoque la session ET journalise, en une requête.
        */}
        {/*
          Les brouillons partent AVANT la requête de déconnexion.

          Ils vivent dans le navigateur et survivraient à la session : sur un
          poste partagé, une grille d'heures à moitié saisie resterait lisible
          par la personne suivante. « onSubmit » s'exécute avant l'action serveur,
          et n'empêche pas sa soumission.
        */}
        <form action={seDeconnecter} onSubmit={() => purgerBrouillons()}>
          <button type="submit" className={LIGNE}>
            <LogOut className="size-[15px] shrink-0" aria-hidden />
            Se déconnecter
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
