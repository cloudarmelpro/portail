/**
 * Barre de chargement — le seul écran d'attente du produit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elle remplace les squelettes, et c'est un choix.
 *
 * Un squelette promet une forme : autant de cartes, autant de lignes, des
 * colonnes à telle largeur. Quand le contenu arrive et ne correspond pas — une
 * liste vide, trois lignes au lieu de huit, un tableau plus large — la page
 * saute, et l'attente a coûté un mouvement au lieu d'en épargner un.
 *
 * Un trait en haut de l'écran ne promet rien d'autre que « ça travaille ». Il
 * ne saute jamais, parce qu'il ne prend la place de rien.
 *
 * `fixed` plutôt que dans le flux : posée dans `loading.tsx`, elle est un
 * enfant de `main`, qui défile. En haut de la PAGE, elle reste visible quelle
 * que soit la position de défilement au moment de la navigation.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function BarreChargement() {
  return (
    <div
      /*
        `role="status"` avec `aria-label` : une attente sans texte n'est
        annoncée nulle part, et un lecteur d'écran resterait sur la page
        précédente sans rien signaler.
      */
      role="status"
      aria-label="Chargement"
      className="pointer-events-none fixed inset-x-0 top-0 z-70 h-[3px] overflow-hidden"
    >
      <div className="bg-ink h-full w-full origin-left [animation:barre-chargement_2.4s_cubic-bezier(0.2,0.8,0.2,1)_forwards]" />
    </div>
  )
}
