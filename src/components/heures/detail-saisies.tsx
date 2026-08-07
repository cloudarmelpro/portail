import { formaterHeuresAvecUnite } from '@/lib/domaine/heures'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'

export type LigneSaisie = { date: string; jour: string; centiemes: number; note: string | null }

/**
 * Détail des saisies de la période — colonnes de la section 19.
 *
 * Le titre est rendu par la fiche, pas ici : les quatre blocs de l'écran
 * portent alors le même titre de section, à la même mesure et au même endroit.
 *
 * Une période sans heure donne une PHRASE, jamais un cadre vide : la section 19
 * classe cette liste parmi les listes secondaires, où l'absence se dit en une
 * ligne — il n'y a là ni recherche à ajuster ni fiche à créer.
 */
export function DetailSaisies({ saisies }: { saisies: LigneSaisie[] }) {
  if (saisies.length === 0) {
    return (
      <p className="text-ink3 mt-3 text-[13px] leading-[18px]">
        Aucune heure saisie sur cette période.
      </p>
    )
  }

  return (
    <CadreTableau className="mt-4">
      <Tableau>
        <EnTeteTableau>
          <ColonneTableau libelle="Date" />
          <ColonneTableau libelle="Jour" />
          <ColonneTableau libelle="Heures" aDroite />
        </EnTeteTableau>
        <CorpsTableau>
          {saisies.map((s) => (
            <LigneTableau key={s.date}>
              <CelluleTableau chiffres>{s.date}</CelluleTableau>
              <CelluleTableau
                discret
                tronque
                titre={s.note ? `${s.jour} — ${s.note}` : s.jour}
                className="max-w-80"
              >
                {s.jour}
                {s.note && <span className="text-ink3 text-[13px]"> — {s.note}</span>}
              </CelluleTableau>
              <CelluleTableau aDroite chiffres>
                {formaterHeuresAvecUnite(s.centiemes)}
              </CelluleTableau>
            </LigneTableau>
          ))}
        </CorpsTableau>
      </Tableau>
    </CadreTableau>
  )
}
