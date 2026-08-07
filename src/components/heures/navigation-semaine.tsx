import Link from 'next/link'
import { classesBouton } from '@/components/shared/bouton'
import { FlecheDroite, FlecheGauche } from '@/components/shared/fleches'
import { cn } from '@/lib/utils'

/**
 * Sélecteur de période de la grille — exigence HEU-6.
 *
 * Aucun état : la semaine affichée vit dans l'adresse. C'est ce qui rend la page
 * partageable et le retour arrière du navigateur fidèle — et c'est aussi ce qui
 * garde la clé de brouillon `heures:<lundi>` alignée sur ce qui est à l'écran.
 */

type Props = {
  libelle: string
  precedente: string
  /** `null` sur la semaine courante : les semaines à venir ne s'affichent pas. */
  suivante: string | null
  /** `null` quand on y est déjà — un repère de retour n'a alors rien à dire. */
  courante: string | null
}

/**
 * 44 px sur téléphone, la densité des autres contrôles au-delà. Même filet et
 * même rayon que le choix dessiné et le choix de date : les trois se lisent
 * comme une seule famille de commandes.
 */
const FLECHE =
  'border-border bg-raised text-ink2 hover:border-border-strong hover:text-ink flex size-11 items-center justify-center rounded-[9px] border disabled:opacity-40 md:size-9'

export function NavigationSemaine({ libelle, precedente, suivante, courante }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/*
        Les deux flèches se touchent : elles font un seul contrôle à deux sens,
        pas deux commandes voisines. C'est la composition du repère, et c'est
        aussi ce qui évite de viser entre les deux.
      */}
      <div className="flex items-center gap-1">
        <Link href={precedente} aria-label="Semaine précédente" className={FLECHE}>
          <FlecheGauche className="w-[18px]" />
        </Link>
        {suivante === null ? (
          <button type="button" disabled aria-label="Semaine suivante" className={FLECHE}>
            <FlecheDroite className="w-[18px]" />
          </button>
        ) : (
          <Link href={suivante} aria-label="Semaine suivante" className={FLECHE}>
            <FlecheDroite className="w-[18px]" />
          </Link>
        )}
      </div>

      {/*
        La semaine affichée est posée dans un CADRE, comme la plage de dates du
        repère — même filet, même rayon et même hauteur que les flèches et le
        bouton qui l'encadrent.

        Elle était en 17 px semi-gras, à nu : elle se lisait comme un titre alors
        qu'elle est ce que les flèches font varier. Dans le cadre, la rangée se
        lit comme une seule commande — reculer, lire, avancer.
      */}
      <span className="border-border bg-raised flex h-11 items-center rounded-[9px] border px-3.5 text-[13px] leading-[18px] tabular-nums md:h-9">
        {libelle}
      </span>

      {courante !== null && (
        <Link
          href={courante}
          className={cn(classesBouton({ variante: 'secondaire', taille: 'sm' }), 'h-11 md:h-9')}
        >
          Cette semaine
        </Link>
      )}
    </div>
  )
}
