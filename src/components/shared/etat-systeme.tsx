import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Bouton, classesBouton } from '@/components/shared/bouton'

type Props = {
  icone: LucideIcon
  titre: string
  message: string
  /** Identifiant technique à transmettre au support — écrans d'erreur seulement. */
  reference?: string
  /**
   * L'action principale, en noir. Un lien ou un geste, jamais les deux.
   *
   * Les deux existaient en parallèle — `action` et `onAction` — et rien
   * n'empêchait d'en passer deux : l'écran sortait alors deux boutons noirs,
   * ce qu'un seul écran n'a jamais le droit de faire. Un filet d'erreur qui
   * offre « Réessayer » ET « Retour à l'accueil » est pourtant le cas normal ;
   * c'est le second qui doit être secondaire.
   */
  action?: { libelle: string; href: string } | { libelle: string; onClick: () => void }
  /** L'issue de repli, à filet. Toujours après l'action principale. */
  secondaire?: { libelle: string; href: string }
}

/**
 * Écran d'état plein — accès refusé, introuvable, erreur.
 *
 * Aucune illustration : un titre court, une phrase qui explique quoi faire, et
 * une action. Voir architecture.MD, section 19.
 */
export function EtatSysteme({
  icone: Icone,
  titre,
  message,
  reference,
  action,
  secondaire,
}: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <Icone className="text-ink3 size-6" aria-hidden />
      <h1 className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.01em]">{titre}</h1>
      <p className="text-ink2 max-w-[420px] text-[15px] leading-[22px]">{message}</p>

      {(action || secondaire) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action &&
            ('href' in action ? (
              <Link href={action.href} className={classesBouton({ variante: 'principale' })}>
                {action.libelle}
              </Link>
            ) : (
              <Bouton onClick={action.onClick}>{action.libelle}</Bouton>
            ))}

          {secondaire && (
            <Link href={secondaire.href} className={classesBouton({ variante: 'secondaire' })}>
              {secondaire.libelle}
            </Link>
          )}
        </div>
      )}

      {reference && (
        <p className="text-ink3 mt-6 text-[11px] leading-[14px] tracking-[0.02em]">
          Référence&nbsp;: <span className="tabular-nums">{reference}</span>
        </p>
      )}
    </div>
  )
}
