'use client'

import { X } from 'lucide-react'
import { SheetClose, SheetContent } from '@/components/ui/sheet'
import { BORDURE_FLOTTANTE } from '@/components/shared/surface-flottante'
import { cn } from '@/lib/utils'

/** Même raison que `contenu-dialogue.tsx` : le tiroir de shadcn ferme sur « Close ». */
type Props = Omit<React.ComponentProps<typeof SheetContent>, 'showCloseButton'> & {
  boutonFermer?: boolean
}

export function ContenuTiroir({ boutonFermer = true, className, children, ...props }: Props) {
  return (
    <SheetContent
      showCloseButton={false}
      className={cn('shadow-modal', BORDURE_FLOTTANTE, className)}
      {...props}
    >
      {children}
      {boutonFermer && (
        <SheetClose
          aria-label="Fermer"
          className="text-ink2 hover:bg-hover2 hover:text-ink absolute top-3 right-3 flex size-7 items-center justify-center rounded-[6px]"
        >
          <X className="size-4" aria-hidden />
        </SheetClose>
      )}
    </SheetContent>
  )
}
