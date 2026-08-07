import { Bouton, classesBouton } from '@/components/shared/bouton'
import { cn } from '@/lib/utils'

/**
 * Bouton d'action des écrans d'authentification : le bouton noir, pleine
 * largeur, 52 px, au rayon des champs qu'il termine.
 *
 * Chaque écran d'authentification n'a qu'UNE action — « Se connecter »,
 * « Envoyer le lien », « Enregistrer » —, et la section 19 les range parmi les
 * boutons principaux. La règle du bouton noir unique par écran est donc tenue
 * par construction : il n'y a rien d'autre à cliquer.
 *
 * `classesBoutonAuth` sert aux `Link` qui prennent cette apparence.
 */

const FORME = 'mt-1 h-[52px] w-full gap-2.5 rounded-xl text-[15px]'

export function classesBoutonAuth(className?: string): string {
  return cn(classesBouton({ variante: 'principale' }), FORME, className)
}

export function BoutonAuth({ className, ...props }: React.ComponentProps<typeof Bouton>) {
  return <Bouton variante="principale" className={cn(FORME, className)} {...props} />
}
