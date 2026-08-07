'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * Interrupteur nommé — la bascule et son libellé sur la même ligne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ne l'employer que là où la bascule prend effet TOUT DE SUITE.
 *
 * C'est ce qui le distingue d'une case à cocher : une case attend qu'on valide
 * un formulaire, un interrupteur agit. Dans un formulaire, il mentirait sur ce
 * qu'il vient de faire — l'utilisateur le croirait appliqué avant de l'avoir
 * enregistré.
 *
 * Le libellé est un vrai `<label>` : cliquer le mot bascule l'interrupteur, et
 * il double la cible de pointage. `htmlFor` suffit à le nommer, donc aucun
 * `aria-label` — un second nom finirait par diverger de celui qui est écrit.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function Interrupteur({
  id,
  libelle,
  actif,
  onBascule,
  className,
}: {
  id: string
  libelle: string
  actif: boolean
  onBascule: (actif: boolean) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Switch id={id} checked={actif} onCheckedChange={onBascule} />
      <label htmlFor={id} className="text-ink cursor-pointer text-[13px] leading-[18px]">
        {libelle}
      </label>
    </div>
  )
}
