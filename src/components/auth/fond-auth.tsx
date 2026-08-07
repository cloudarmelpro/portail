import type { CSSProperties } from 'react'

/**
 * Décor des écrans d'authentification — purement ornemental, entièrement
 * `aria-hidden`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX voiles à 4 %, et rien d'autre — section 19, « Ce que l'on ne fait pas ».
 *
 * Il y en a eu trois, à 24, 20 et 12 %, plus cinq carrés filetés aux couleurs
 * d'entreprise. Trois taches nettement lisibles là où le document en autorise
 * deux, six fois plus pâles — et cinq filets de couleur sans nom écrit à côté,
 * ce que la même section interdit ailleurs sans exception.
 *
 * L'exception qui subsiste porte sur la RÈGLE « jamais une surface », pas sur
 * son intensité : ce ne sont pas des repères d'identité mais un fond, sans forme
 * lisible ni contenu à leur contact, et l'écran de connexion est le seul où
 * aucune donnée n'est cloisonnée.
 * ─────────────────────────────────────────────────────────────────────────
 */

const HALOS: readonly CSSProperties[] = [
  {
    top: -340,
    left: -260,
    width: 1000,
    height: 1000,
    background:
      'radial-gradient(closest-side, color-mix(in srgb, var(--dev) 4%, transparent), transparent)',
  },
  {
    top: -300,
    right: -280,
    width: 960,
    height: 960,
    background:
      'radial-gradient(closest-side, color-mix(in srgb, var(--staff) 4%, transparent), transparent)',
  },
]

const MASQUE = 'radial-gradient(60% 55% at 50% 42%, black 0%, transparent 100%)'

export function FondAuth() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {HALOS.map((halo, index) => (
        <div key={index} className="absolute rounded-full" style={halo} />
      ))}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          WebkitMaskImage: MASQUE,
          maskImage: MASQUE,
        }}
      />
    </div>
  )
}
