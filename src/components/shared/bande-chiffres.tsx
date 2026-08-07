import type { LucideIcon } from 'lucide-react'
import { BANDE_PLEINE } from '@/components/shared/bande-pleine'
import { cn } from '@/lib/utils'

/**
 * Un état porté par le chiffre.
 *
 * Une icône ET un mot, toujours les deux — section 19. La couleur ne va qu'à
 * l'icône : les jetons d'état mesurent moins de 3:1 sur ce fond et ne peuvent
 * pas porter de texte.
 */
export type Alerte = {
  jeton: string
  icone: LucideIcon
  mot: string
}

export type Chiffre = {
  libelle: string
  valeur: string
  /** Absente le plus souvent : un décompte n'est pas une alerte. */
  alerte?: Alerte | null
}

/**
 * Bande de chiffres, en tête d'écran.
 *
 * Elle répond à « où en est-on ? » avant que la liste ne réponde à « qui ? ».
 * Compter les lignes d'un tableau pour savoir combien de comptes sont suspendus
 * est le genre de travail que l'écran doit faire à la place de la personne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Aucune couleur d'état par défaut, et c'est délibéré.
 *
 * Le système de design réserve `--critical` et ses voisines aux états, toujours
 * accompagnées d'une icône ET d'un mot. Un nombre rouge sans icône ferait porter
 * l'alerte à la seule couleur — précisément ce que la section 19 interdit. Sur
 * les écrans d'administration, le libellé dit déjà « Suspendus » ; le chiffre
 * n'a qu'à être lisible.
 *
 * Le CRM est le seul à passer une `alerte` : un retard EST un état, et la
 * section 19 le prévoit nommément.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function BandeChiffres({ chiffres }: { chiffres: Chiffre[] }) {
  return (
    <dl className={cn(BANDE_PLEINE, 'border-border flex flex-wrap gap-x-10 gap-y-3 border-b py-6')}>
      {chiffres.map((c) => {
        const Icone = c.alerte?.icone

        return (
          <div key={c.libelle}>
            <dt className="text-ink3 text-[13px] leading-4.5">{c.libelle}</dt>
            <dd className="mt-0.5 flex items-center gap-2 text-[17px] leading-6 font-semibold tabular-nums">
              {Icone && (
                <Icone
                  className="size-4 shrink-0"
                  style={{ color: `var(${c.alerte?.jeton})` }}
                  aria-hidden
                />
              )}
              {c.valeur}
              {c.alerte && (
                <span className="text-ink2 text-[13px] leading-4.5 font-medium">
                  {c.alerte.mot}
                </span>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
