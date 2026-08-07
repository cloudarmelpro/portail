import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

export type Tuile = {
  libelle: string
  valeur: string
  /** Écart en pourcentage avec la période précédente, ou `null` s'il n'y a rien à comparer. */
  variation: number | null
}

/**
 * Tuiles de statistiques — trois par ligne, jamais de graphique dedans.
 *
 * Les grands nombres isolés gardent les chiffres proportionnels : les chiffres
 * tabulaires ne servent qu'aux colonnes, où l'alignement compte.
 *
 * La variation reste en encre normale : `--good` et `--critical` sont réservés
 * aux états, et une hausse d'heures n'est ni bonne ni mauvaise. La flèche est
 * doublée par le signe et par le mot — rien n'est porté par le seul symbole.
 */
export function TuilesEmploye({ tuiles }: { tuiles: Tuile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tuiles.map((t) => (
        <div key={t.libelle} className="border-border bg-raised rounded-[10px] border p-5">
          <div className="text-ink3 text-[13px] leading-[18px]">{t.libelle}</div>
          <div className="mt-1 text-[30px] leading-9 font-semibold tracking-[-0.02em]">
            {t.valeur}
          </div>
          <div className="text-ink2 mt-1 flex items-center gap-1.5 text-[13px] leading-[18px]">
            {t.variation === null ? (
              <>
                <Minus className="size-3.5 shrink-0" aria-hidden />
                Aucune période précédente à comparer
              </>
            ) : (
              <>
                {t.variation >= 0 ? (
                  <ArrowUp className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ArrowDown className="size-3.5 shrink-0" aria-hidden />
                )}
                <span>
                  <span className="tabular-nums">
                    {t.variation >= 0 ? '+' : ''}
                    {t.variation}
                  </span>
                  &nbsp;% par rapport à la période précédente
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
