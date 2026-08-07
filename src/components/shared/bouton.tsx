import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Bouton unique du produit — section 19.
 *
 * `classesBouton` est exportée pour les éléments qui ne sont pas des `<button>` :
 * `Link`, `<a>`, `DialogTrigger`. Sans elle, chacun réécrirait la chaîne à la
 * main, et c'est exactement ainsi que vingt copies divergentes sont nées.
 *
 * Le survol et le `disabled:` sont déclarés ici et nulle part ailleurs : un
 * appelant qui les redéclare rétablit la dérive que ce fichier supprime.
 */
export const classesBouton = cva(
  "inline-flex shrink-0 items-center cursor-pointer justify-center rounded-xl whitespace-nowrap transition-[opacity,background-color,border-color,color] duration-150 disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variante: {
        /** Le bouton noir. Un seul par écran. */
        principale: 'bg-action text-action-ink hover:opacity-85 active:opacity-70',
        secondaire: 'border-border-strong border hover:bg-hover',
        discrete: 'text-ink2 hover:bg-hover2 hover:text-ink',
        destructive: 'text-critical-texte border-critical/40 border hover:bg-hover',
      },
      taille: {
        /*
          36 px et 14 px — la mesure du bouton « Inviter » de l'écran des
          comptes, prise comme référence pour tout le produit. Elle est déclarée
          ICI et nulle part ailleurs : chaque écran qui la recopiait en
          `className` était une occasion de plus de diverger.
        */
        md: 'h-9 gap-2 px-5 text-sm',
        /*
          40 px — la rangée d'outils qui coiffe un tableau pleine largeur. À 36,
          les boutons y paraissent perdus à côté d'un champ de recherche qui
          traverse l'écran. Le champ correspondant est `CHAMP_OUTIL`, dans
          `gabarits.ts` : les deux hauteurs doivent bouger ensemble.
        */
        lg: 'h-10 gap-2 px-5 text-sm',
        sm: 'h-9 gap-2 px-3 text-[13px]',
        xs: 'h-8 gap-1.5 px-2.5 text-[13px]',
      },
    },
    defaultVariants: { variante: 'principale', taille: 'md' },
  },
)

type Props = React.ComponentProps<'button'> &
  VariantProps<typeof classesBouton> & {
    chargement?: boolean
    /**
     * Annonce lue quand le témoin de chargement REMPLACE le libellé au lieu de
     * l'accompagner — écrans d'authentification uniquement.
     */
    annonceChargement?: string
  }

export function Bouton({
  className,
  variante,
  taille,
  chargement = false,
  annonceChargement,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      // `type` n'a pas de valeur par défaut : la donner transformerait en bouton
      // inerte tout appelant qui compte sur la soumission implicite d'un
      // formulaire.
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={cn(classesBouton({ variante, taille }), className)}
      {...props}
    >
      {chargement && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {chargement && annonceChargement ? (
        <span className="sr-only">{annonceChargement}</span>
      ) : (
        children
      )}
    </button>
  )
}
