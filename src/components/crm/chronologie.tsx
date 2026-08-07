import { FileText, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'
import type { TypeInteraction } from '@/generated/prisma/client'
import { LIBELLE_TYPE_INTERACTION } from '@/config/crm'
import { dateLongue, montant } from '@/components/crm/format'
import { cn } from '@/lib/utils'

export type EntreeChronologie = {
  id: string
  type: TypeInteraction
  date: Date
  resume: string
  prochaineAction: string | null
  prochaineActionLe: Date | null
  auteurNom: string
  estimation: { reference: string; total: number } | null
}

const ICONE: Readonly<Record<TypeInteraction, LucideIcon>> = {
  appel: Phone,
  courriel: Mail,
  visite: MapPin,
  soumission: FileText,
}

/**
 * CRM-4 — chronologie des interactions, du plus récent au plus ancien.
 *
 * C'est un FIL, pas une grille : le filet vertical relie les pastilles d'un bout
 * à l'autre. Chaque entrée avait un filet horizontal sous elle, et l'ensemble se
 * lisait comme des rangées de tableau sans en-tête — quatre lignes empilées dont
 * rien ne disait qu'elles se suivaient dans le temps.
 *
 * L'icône ne dit jamais seule de quelle interaction il s'agit : le mot est écrit
 * à côté, en toutes lettres.
 */
export function Chronologie({ entrees }: { entrees: EntreeChronologie[] }) {
  if (entrees.length === 0) {
    return (
      <p className="text-ink3 mt-3 text-[13px] leading-[18px]">
        Aucune interaction enregistrée pour ce client.
      </p>
    )
  }

  return (
    <ol className="mt-4 flex flex-col">
      {entrees.map((e, rang) => {
        const Icone = ICONE[e.type]
        const dernier = rang === entrees.length - 1

        return (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className="bg-hover2 text-ink2 flex size-7 shrink-0 items-center justify-center rounded-full"
              >
                <Icone className="size-3.5" />
              </span>
              {!dernier && <span aria-hidden className="bg-border w-px flex-1" />}
            </div>

            <div className={cn('min-w-0 flex-1', !dernier && 'pb-6')}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] leading-[18px] font-semibold">
                  {LIBELLE_TYPE_INTERACTION[e.type]}
                </span>
                <span className="text-ink3 text-[13px] leading-[18px] tabular-nums">
                  {dateLongue(e.date)}
                </span>
                <span className="text-ink3 text-[13px] leading-[18px]">· {e.auteurNom}</span>
              </p>

              <p className="text-ink2 mt-1 text-[15px] leading-[22px] text-pretty">{e.resume}</p>

              {e.estimation && (
                <p className="text-ink2 mt-1.5 text-[13px] leading-[18px]">
                  {e.estimation.reference} —{' '}
                  <span className="tabular-nums">{montant(e.estimation.total)}</span>
                </p>
              )}

              {/*
                La relance était en pilule de 11 px. Une pilule porte un jeton
                court ; celle-ci contenait une phrase entière avec sa date, dans
                le plus petit corps du produit, sur l'information la plus
                actionnable du fil.
              */}
              {e.prochaineActionLe && (
                <p className="mt-1.5 text-[13px] leading-[18px]">
                  <span className="text-ink3">Prochaine action&nbsp;: </span>
                  <span className="text-ink2">{e.prochaineAction ?? 'à planifier'}</span>
                  <span className="text-ink3"> · </span>
                  <span className="text-ink2 tabular-nums">{dateLongue(e.prochaineActionLe)}</span>
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
