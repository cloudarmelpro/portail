/**
 * Le compteur nomme son unité et décline le zéro — section 19.
 *
 * « 0 estimation » se lit comme une donnée manquante ; « Aucune estimation » se
 * lit comme un dossier encore vide, ce qui est le cas au jour un des trois
 * entreprises.
 *
 * Écrit ici parce que deux écrans le rendent — la carte de choix d'entreprise et
 * la rangée d'outils de la liste. Deux copies auraient fini par décliner le zéro
 * d'un côté seulement.
 */
export function compteEstimations(n: number): string {
  if (n === 0) return 'Aucune estimation'
  return n === 1 ? '1 estimation' : `${n} estimations`
}
