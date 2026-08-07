/**
 * Énumération plafonnée — section 19.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Trois éléments nommés au maximum, puis le reste compté.
 *
 * Nommer sans plafond retourne l'intention contre elle-même : à quinze noms, le
 * message déborde de la modale et plus rien n'est lu. Le refus de concurrence de
 * la grille des heures nommait ainsi les soixante cellules d'une semaine.
 *
 * Les trois retenus sont les PREMIERS dans l'ordre d'affichage de la liste
 * concernée, jamais un échantillon : quelqu'un qui cherche la cause commence par
 * le haut.
 *
 * Pas de `server-only` ici : la règle sert au message d'un Server Action comme
 * au bandeau d'un composant client, et une phrase ne touche aucune donnée.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function enumerer(elements: readonly string[]): string {
  const [a, b, c] = elements

  if (elements.length <= 1) return a ?? ''
  if (elements.length === 2) return `${a} et ${b}`
  if (elements.length === 3) return `${a}, ${b} et ${c}`

  const reste = elements.length - 3
  return `${a}, ${b}, ${c} et ${reste} ${reste === 1 ? 'autre' : 'autres'}`
}
