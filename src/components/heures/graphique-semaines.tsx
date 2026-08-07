import { formaterHeures } from '@/lib/domaine/heures'

export type BarreSemaine = {
  libelle: string
  normales: number
  supplementaires: number
}

const LARGEUR = 720
const HAUTEUR_BASE = 172
const X0 = 40
const X1 = 712
const Y0 = 8
const LARGEUR_BARRE = 26
/** Pas de la grille horizontale : 10 h, en centièmes. */
const PAS = 1000

/**
 * Heures par semaine — barres empilées, deux séries, donc légende obligatoire.
 *
 * Un seul axe vertical, extrémités arrondies, 2 px de fond entre les segments.
 * Les séries n'apparaissent qu'en surface pleine : sur cet écran, aucun aplat
 * ne désigne une entreprise et aucun filet ne désigne une série.
 *
 * Le titre est rendu par la fiche, comme pour les deux listes qui suivent : la
 * figure n'a plus à porter le sien, et les trois sections s'alignent.
 */
export function GraphiqueSemaines({ semaines }: { semaines: BarreSemaine[] }) {
  const maximum = Math.max(
    4800,
    Math.ceil(Math.max(...semaines.map((s) => s.normales + s.supplementaires), 0) / PAS) * PAS,
  )

  const pas = (X1 - X0) / Math.max(1, semaines.length)
  const yDe = (v: number) => Y0 + (HAUTEUR_BASE - Y0) * (1 - v / maximum)

  const lignes: number[] = []
  for (let v = 0; v <= maximum; v += PAS) lignes.push(v)

  return (
    <div className="border-border bg-raised mt-4 rounded-[10px] border p-5">
      <div className="flex flex-wrap gap-4">
        <span className="text-ink2 inline-flex items-center gap-1.5 text-[13px] leading-[18px]">
          <span className="bg-s1 size-2.5 rounded-[3px]" aria-hidden />
          Heures normales
        </span>
        <span className="text-ink2 inline-flex items-center gap-1.5 text-[13px] leading-[18px]">
          <span className="bg-s2 size-2.5 rounded-[3px]" aria-hidden />
          Heures supplémentaires
        </span>
      </div>

      <svg
        viewBox={`0 0 ${LARGEUR} 200`}
        role="img"
        aria-label="Heures normales et supplémentaires des huit dernières semaines"
        className="mt-3 block h-auto w-full"
      >
        {lignes.map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={yDe(v)} y2={yDe(v)} stroke="var(--border)" strokeWidth={1} />
            <text
              x={X0 - 6}
              y={yDe(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--ink3)"
              className="tabular-nums"
            >
              {formaterHeures(v)}
            </text>
          </g>
        ))}

        <line
          x1={X0}
          x2={X1}
          y1={HAUTEUR_BASE}
          y2={HAUTEUR_BASE}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />

        {semaines.map((s, i) => {
          const total = s.normales + s.supplementaires
          const x = X0 + pas * i + (pas - LARGEUR_BARRE) / 2
          const centre = X0 + pas * i + pas / 2
          const yNormales = yDe(s.normales)
          const ySupplementaires = yDe(total)
          return (
            <g key={s.libelle}>
              <rect
                x={x}
                y={yNormales}
                width={LARGEUR_BARRE}
                height={Math.max(0, HAUTEUR_BASE - yNormales)}
                fill="var(--s1)"
                rx={3}
              />
              {s.supplementaires > 0 && (
                <rect
                  x={x}
                  y={ySupplementaires}
                  width={LARGEUR_BARRE}
                  height={Math.max(0, yNormales - ySupplementaires - 2)}
                  fill="var(--s2)"
                  rx={3}
                />
              )}
              {s.supplementaires > 0 && (
                <text
                  x={centre}
                  y={ySupplementaires - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--ink2)"
                  className="tabular-nums"
                >
                  {formaterHeures(total)}
                </text>
              )}
              <text x={centre} y={190} textAnchor="middle" fontSize={11} fill="var(--ink3)">
                {s.libelle}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
