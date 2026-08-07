import { requireModule } from '@/lib/guards'

/**
 * Garde de rôle du module — administrateur et gestion des heures.
 *
 * Elle ne protège que l'affichage : chaque mutation est gardée séparément par
 * la fabrique d'actions, et l'export par sa propre route.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Le commutateur de vue vivait ici, dans une bande pleine largeur.
 *
 * Il l'a quittée pour l'en-tête de chaque écran, à droite du titre. La bande
 * coûtait une rangée de 68 px et un filet pour porter deux mots, au-dessus d'un
 * titre qui nommait déjà l'écran — et elle mettait le commutateur AVANT le titre
 * dans l'ordre de lecture, alors qu'il répond à « et l'autre vue ? », une
 * question qu'on ne se pose qu'après avoir vu où l'on est.
 *
 * Le prix : chaque écran le rend lui-même, donc il est redessiné à chaque
 * navigation entre les deux vues, et `loading.tsx` doit le porter aussi pour
 * qu'il ne clignote pas.
 * ────────────────────────────────────────────────────────────────────────────
 */
export default async function HeuresLayout({ children }: LayoutProps<'/heures'>) {
  await requireModule('heures')

  return children
}
