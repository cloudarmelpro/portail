import { cn } from '@/lib/utils'

/**
 * Texte qui s'arrête sur des points de suspension au lieu de pousser sa colonne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `truncate` seul ne tronque RIEN dans un tableau.
 *
 * Les neuf tableaux du produit sont en disposition automatique : le navigateur
 * mesure le contenu, puis donne à chaque colonne la largeur qu'il lui faut. Une
 * cellule ne déborde donc jamais de sa colonne — c'est la colonne qui s'élargit,
 * et avec elle le tableau, jusqu'au défilement horizontal. `text-overflow` exige
 * une largeur DÉFINIE : sans plafond, la règle est inerte.
 *
 * D'où le plafond porté ici, sur un bloc à l'intérieur de la cellule, plutôt que
 * sur la cellule elle-même : en disposition automatique, `max-width` sur un
 * `<td>` n'est qu'une indication que l'algorithme de table est libre d'ignorer.
 *
 * Dans une boîte flexible, il faut de surcroît `min-w-0` sur le parent : un
 * élément flexible refuse par défaut de passer sous sa taille de contenu
 * minimale, et le plafond reste sans effet.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `title` porte la valeur entière. C'est le seul recours universel — l'infobulle
 * native n'atteint ni le clavier ni le tactile — mais elle ne remplace rien :
 * une valeur tronquée reste lisible en entier sur la fiche que la ligne ouvre.
 * Ne pas la poser reviendrait à n'avoir aucun recours du tout.
 */
export function Tronque({
  children,
  titre,
  className,
}: {
  children: React.ReactNode
  /** Valeur entière, quand le rendu n'est pas une simple chaîne. */
  titre?: string
  className?: string
}) {
  return (
    <span
      title={titre ?? (typeof children === 'string' ? children : undefined)}
      // Le plafond par défaut est délibérément présent : sans lui, un appel
      // sans `className` ne tronquerait pas, en silence.
      className={cn('block max-w-72 truncate', className)}
    >
      {children}
    </span>
  )
}
