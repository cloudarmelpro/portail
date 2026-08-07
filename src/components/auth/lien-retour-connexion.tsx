import Link from 'next/link'
import { FlecheGauche } from '@/components/shared/fleches'

/**
 * Sortie de secours des écrans « mot de passe oublié » et « réinitialisation ».
 *
 * Le rembourrage vertical compensé porte la cible tactile à 44 px sans écarter
 * le lien du bloc qui le précède.
 */
export function LienRetourConnexion() {
  return (
    <div className="mt-5 text-center">
      <Link
        href="/"
        className="text-ink2 hover:text-ink -my-[13px] inline-flex items-center gap-2 py-[13px] text-[13px] leading-[18px] underline-offset-4 transition-colors duration-150 hover:underline"
      >
        <FlecheGauche className="w-4 shrink-0" />
        Retour à la connexion
      </Link>
    </div>
  )
}
