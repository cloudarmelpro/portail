'use client'

import { X } from 'lucide-react'
import { DialogClose, DialogContent } from '@/components/ui/dialog'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { cn } from '@/lib/utils'

/**
 * Contenu de dialogue du produit.
 *
 * `components/ui/dialog.tsx` vient de shadcn et ne se modifie pas à la main : son
 * bouton de fermeture porte le nom accessible « Close », en anglais, et c'est
 * celui de CHAQUE dialogue du produit. On le désactive et on pose le nôtre.
 */
type Props = Omit<React.ComponentProps<typeof DialogContent>, 'showCloseButton'> & {
  boutonFermer?: boolean
}

/*
  `shadow-modal` est posée ICI, et non dans `components/ui/dialog.tsx`, qui vient
  de shadcn et ne se modifie pas à la main — une variante se crée par
  composition.

  Les deux ombres du produit étaient interverties : les menus portaient
  `--sh-modal`, trois fois plus profonde, et la modale n'en portait aucune. Un
  menu de fin de ligne paraissait donc flotter plus haut que le dialogue qui
  s'ouvrait par-dessus lui.
*/
export function ContenuDialogue({ boutonFermer = true, className, children, ...props }: Props) {
  return (
    <DialogContent
      showCloseButton={false}
      /*
        L'anneau est plus appuyé en sombre que celui des menus.

        `--voile` à 60 % de noir sur la page donne presque du noir pur : la modale
        en `--raised` ne s'en détachait que de 1,27:1, contre 5,96:1 en clair. Et
        `--sh-modal` est une ombre noire, donc invisible sur un voile noir — la
        modale sombre n'avait quasiment pas de bord.

        Un menu, lui, flotte au-dessus du contenu et n'a pas ce problème : c'est
        pourquoi la surcharge est ici et non dans `FILET_FLOTTANT`.
      */
      className={cn('shadow-modal', FILET_FLOTTANT, 'dark:ring-ink/20', className)}
      {...props}
    >
      {children}
      {boutonFermer && (
        <DialogClose
          aria-label="Fermer"
          className="text-ink2 hover:bg-hover2 hover:text-ink absolute top-2 right-2 flex size-7 items-center justify-center rounded-[6px]"
        >
          <X className="size-4" aria-hidden />
        </DialogClose>
      )}
    </DialogContent>
  )
}
