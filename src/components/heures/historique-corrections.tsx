import { FlecheDroite } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import { formaterHeuresAvecUnite } from '@/lib/domaine/heures'

export type LigneCorrection = {
  id: string
  date: string
  ancienneCentiemes: number | null
  nouvelleCentiemes: number
  motif: string
  parNom: string
}

/**
 * Trace nominative des corrections — exigence HEU-10.
 *
 * Une valeur antérieure absente s'écrit « aucune saisie » et non « 0 h » : le
 * journal ne doit pas dire ce qu'il ne sait pas.
 *
 * Le cadre, le filet et le rayon sont ceux du tableau voisin — la fiche pose les
 * deux listes côte à côte, et deux boîtes de formes différentes se seraient lues
 * comme deux natures de contenu.
 */
export function HistoriqueCorrections({ corrections }: { corrections: LigneCorrection[] }) {
  if (corrections.length === 0) {
    return (
      <p className="text-ink3 mt-3 text-[13px] leading-[18px]">
        Aucune correction sur cette fiche.
      </p>
    )
  }

  return (
    <ul className="border-border bg-raised mt-4 rounded-[10px] border">
      {corrections.map((c) => (
        <li key={c.id} className="border-border border-b px-4 py-3 last:border-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-medium tabular-nums">{c.date}</span>
            <Tronque
              titre={`par ${c.parNom}`}
              className="text-ink3 max-w-72 text-[13px] leading-[18px]"
            >
              par {c.parNom}
            </Tronque>
          </div>

          {/*
            La flèche est doublée par les deux valeurs, qui se lisent dans
            l'ordre : rien n'est porté par le seul symbole.
          */}
          <div className="text-ink2 mt-1 flex items-center gap-1.5 text-[13px] leading-[18px] tabular-nums">
            {c.ancienneCentiemes === null
              ? 'aucune saisie'
              : formaterHeuresAvecUnite(c.ancienneCentiemes)}
            <FlecheDroite className="text-ink3 w-3.5 shrink-0" />
            {formaterHeuresAvecUnite(c.nouvelleCentiemes)}
          </div>

          <p className="text-ink3 mt-1 text-[13px] leading-[18px]">{c.motif}</p>
        </li>
      ))}
    </ul>
  )
}
