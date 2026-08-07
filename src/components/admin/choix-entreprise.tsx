import Link from 'next/link'
import { ENTREPRISES, type EntrepriseSlug } from '@/config/entreprises'

/**
 * Choix de l'entreprise dont on édite les données.
 *
 * La couleur n'est jamais une surface : pastille de 8 px, le nom écrit à côté.
 * Le choix vit dans l'URL — une grille se partage et se met en signet.
 */
export function ChoixEntreprise({
  courante,
  base = '/admin/tarifs',
}: {
  courante: EntrepriseSlug
  /** Écran destinataire — les tarifs et les coordonnées partagent ce sélecteur. */
  base?: string
}) {
  return (
    <nav aria-label="Entreprise" className="flex flex-wrap gap-1">
      {ENTREPRISES.map((e) => {
        const active = e.slug === courante
        return (
          <Link
            key={e.slug}
            href={`${base}?entreprise=${e.slug}`}
            aria-current={active ? 'page' : undefined}
            /*
              Seule l'entreprise COURANTE est un bouton. Les deux autres sont du
              texte : trois pilules identiques ne disaient pas laquelle était
              retenue, et il fallait relire la graisse pour le savoir.

              La pastille de couleur reste sur les trois — c'est un repère
              d'identité, pas un état, et le nom est écrit à côté dans tous les
              cas.
            */
            className={
              active
                ? 'border-border bg-raised text-ink inline-flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[13px] font-medium'
                : 'text-ink2 hover:text-ink inline-flex h-9 items-center gap-2 rounded-[9px] border border-transparent px-3 text-[13px]'
            }
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: `var(${e.jeton})` }}
            />
            {e.nom}
          </Link>
        )
      })}
    </nav>
  )
}
