import { entreprise, estEntreprise } from '@/config/entreprises'

/**
 * Repère d'entreprise — pastille de 8 px suivie du nom écrit.
 *
 * La couleur n'est jamais une surface ni une couleur de texte, et jamais seule :
 * le vert du paysagement mesure 2,74:1 sur fond clair, sous le seuil de
 * contraste. Voir architecture.MD, section 19.
 */
export function PastilleEntreprise({ slug, className }: { slug: string; className?: string }) {
  if (!estEntreprise(slug)) {
    return <span className={className}>{slug}</span>
  }

  const e = entreprise(slug)

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: `var(${e.jeton})` }}
      />
      {e.nom}
    </span>
  )
}
