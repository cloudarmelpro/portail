import Link from 'next/link'
import { classesBouton } from '@/components/shared/bouton'

type Props = {
  titre: string
  message: string
  action?: { libelle: string; href: string }
  children?: React.ReactNode
}

/**
 * État vide.
 *
 * Trois éléments : un titre court, une phrase qui explique quoi faire, et le
 * bouton d'action. Aucune illustration.
 *
 * Une liste vide qui affiche « Aucun résultat » est fonctionnelle ; une qui dit
 * quoi faire ensuite est utilisable. C'est le premier écran que verra chaque
 * utilisateur au jour un.
 *
 * `action` sort en NOIR, sans réglage. Un état vide occupe la place du contenu :
 * l'écran qui l'affiche n'a, par construction, rien d'autre à proposer. Le jour
 * où l'un des deux cas se présentera vraiment, la variante s'ajoutera ici — pas
 * avant, sinon personne ne saura lequel des deux réglages est le bon.
 */
export function EtatVide({ titre, message, action, children }: Props) {
  return (
    <div className="border-border bg-surface flex flex-col items-center justify-center rounded-[10px] border px-6 py-14 text-center">
      <h2 className="text-[17px] leading-6 font-semibold">{titre}</h2>
      <p className="text-ink2 mt-2 max-w-[380px] text-[15px] leading-[22px]">{message}</p>
      {action && (
        <Link
          href={action.href}
          className={classesBouton({ variante: 'principale', className: 'mt-5' })}
        >
          {action.libelle}
        </Link>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
