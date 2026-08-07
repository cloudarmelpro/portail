import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Panneau d'information des écrans d'authentification — session expirée,
 * courriel envoyé.
 *
 * Les deux cas prenaient chacun leur habillage : un filet fin d'un côté, un
 * titre de 38 px de l'autre. Ils disent pourtant la même chose au même endroit,
 * et ils portent désormais la même forme.
 *
 * La couleur ne va qu'à l'icône, et l'icône ne va jamais sans son texte —
 * section 19.
 */
export function NoteAuth({
  icone: Icone,
  ton = 'neutre',
  children,
}: {
  icone: LucideIcon
  ton?: 'neutre' | 'succes'
  children: React.ReactNode
}) {
  return (
    <div
      /*
        `role="status"` sur le seul ton de succès : c'est le cas où la note
        REMPLACE le formulaire après une soumission. Sans annonce, un lecteur
        d'écran laisserait croire que rien ne s'est passé.
      */
      role={ton === 'succes' ? 'status' : undefined}
      className="border-border bg-surface text-ink2 flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-[13px] leading-[18px]"
    >
      <Icone
        className={cn('mt-px size-4 shrink-0', ton === 'succes' ? 'text-good' : 'text-ink3')}
        aria-hidden
      />
      <span>{children}</span>
    </div>
  )
}
