import type { SVGProps } from 'react'

/**
 * Les deux flèches du produit — celles fournies dans `public/icons/`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ATTENTION : les deux fichiers d'origine portent des noms INVERSÉS.
 *
 * `public/icons/Left.svg` contient une flèche qui pointe vers la DROITE — son
 * identifiant interne le dit lui-même, `right-arrow-foward-sign`, et son tracé
 * finit à droite du cadre. `Right.svg` est l'inverse. Les reprendre par leur nom
 * aurait mis une flèche « suivant » sur le bouton « précédent », sur toute
 * l'application d'un coup.
 *
 * Les tracés ci-dessous sont donc repris par leur CONTENU, pas par le nom du
 * fichier dont ils viennent.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Recopiées en composants plutôt que servies depuis `public/` : une balise
 * `<img>` ne suit pas la couleur du texte, ne change pas avec le thème, et
 * demande une requête réseau pour quinze pixels. `fill="currentColor"` les fait
 * se comporter comme les icônes Lucide du reste du produit.
 *
 * Le cadre d'origine est plat — 15,7 × 8,7 — là où Lucide est carré. La flèche
 * garde donc sa proportion : `size-*` fixerait sa hauteur à sa largeur et
 * l'étirerait. C'est `w-*` qui la dimensionne, la hauteur suivant seule.
 */
type Props = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'>

export function FlecheGauche({ className, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 15.699 8.707"
      fill="currentColor"
      aria-hidden
      className={className}
      {...props}
    >
      <polygon points="15.699,3.854 1.914,3.854 5.061,0.707 4.354,0 0,4.354 4.354,8.707 5.061,8 1.914,4.854 15.699,4.854" />
    </svg>
  )
}

export function FlecheDroite({ className, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 15.698 8.706"
      fill="currentColor"
      aria-hidden
      className={className}
      {...props}
    >
      <polygon points="11.354,0 10.646,0.706 13.786,3.853 0,3.853 0,4.853 13.786,4.853 10.646,8 11.354,8.706 15.698,4.353" />
    </svg>
  )
}
