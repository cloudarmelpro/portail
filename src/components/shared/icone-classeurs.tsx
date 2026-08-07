import type { SVGProps } from 'react'

/**
 * Les deux classeurs — l'emblème de la banque de CV, fourni par le client.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Recopié en composant, comme les flèches, et pour les mêmes raisons.
 *
 * L'original est un PNG noir de 512 px. Servi par une balise `<img>`, il
 * resterait noir en thème sombre, ne suivrait pas la couleur du texte, et
 * demanderait une requête réseau pour vingt-quatre pixels. Ici, une seule
 * couleur — `currentColor` — et le contour se creuse par `fill-rule`.
 *
 * Le tracé reprend les mesures RELEVÉES sur l'image, pas estimées à l'œil :
 * corps de 32 à 226, fenêtre d'étiquette de 68 à 333 en hauteur, pastille
 * centrée en 419 avec un diamètre de 66. Le cadre reste donc en 512, où ces
 * nombres sont ceux du fichier d'origine.
 *
 * `evenodd` : la fenêtre et la pastille sont des TROUS dans le corps, pas des
 * formes blanches posées dessus — sur un fond sombre, du blanc peint se verrait.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function IconeClasseurs({
  className,
  ...props
}: Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'>) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden
      className={className}
      {...props}
    >
      {/* Classeur de gauche : corps, fenêtre d’étiquette, pastille. */}
      <path d="M60 17h139a28 28 0 0 1 28 28v422a28 28 0 0 1-28 28H60a28 28 0 0 1-28-28V45a28 28 0 0 1 28-28ZM89 68h80a10 10 0 0 1 10 10v245a10 10 0 0 1-10 10H89a10 10 0 0 1-10-10V78a10 10 0 0 1 10-10ZM129 386a33 33 0 1 0 0 66 33 33 0 0 0 0-66Z" />
      {/* Celui de droite, décalé de 253 — la mesure prise sur l’image. */}
      <path d="M313 17h139a28 28 0 0 1 28 28v422a28 28 0 0 1-28 28H313a28 28 0 0 1-28-28V45a28 28 0 0 1 28-28ZM342 68h80a10 10 0 0 1 10 10v245a10 10 0 0 1-10 10H342a10 10 0 0 1-10-10V78a10 10 0 0 1 10-10ZM382 386a33 33 0 1 0 0 66 33 33 0 0 0 0-66Z" />
    </svg>
  )
}
