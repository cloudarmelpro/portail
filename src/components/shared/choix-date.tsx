'use client'

import { useState } from 'react'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { fr } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FlecheDroite, FlecheGauche } from '@/components/shared/fleches'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { cn } from '@/lib/utils'

/**
 * Une date au format de l'URL — `2026-08-06` — lue et écrite SANS fuseau.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `new Date('2026-08-06')` est minuit UTC, donc le 5 août à 20 h à Montréal.
 *
 * Le calendrier aurait surligné la veille de la date filtrée, et un jour cliqué
 * serait reparti dans l'URL décalé d'un cran. C'est le même piège que celui qui
 * a déjà coûté une semaine de saisie d'heures : une date sans heure n'est pas un
 * instant, et la traiter comme tel la déplace.
 *
 * Les deux fonctions ci-dessous ne parlent donc qu'en année, mois et jour.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function versDate(iso: string): Date | undefined {
  const [a, m, j] = iso.split('-').map(Number)
  if (!a || !m || !j) return undefined
  return new Date(a, m - 1, j)
}

export function versIso(d: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`
}

/** Le format que le Québec lit — jamais `mm/dd/yyyy`. */
const DATE_LISIBLE = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' })

/**
 * Choix de date — calendrier, jamais `<input type="date">`.
 *
 * Le champ natif affichait `mm/dd/yyyy` : l'ordre AMÉRICAIN, imposé par la
 * locale du navigateur et impossible à corriger en CSS. Sur un produit
 * québécois, c'est une invitation à lire le 6 août comme un 8 juin.
 *
 * Le calendrier est en français, et la date choisie s'affiche telle qu'on
 * l'écrit ici.
 */
export function ChoixDate({
  valeur,
  etiquette,
  id,
  champ = false,
  effacable = true,
  onChoisir,
}: {
  valeur: string
  etiquette: string
  /** Pour qu'une étiquette `htmlFor` désigne le déclencheur. */
  id?: string
  /** Hauteur et largeur d'un champ de formulaire plutôt que d'un filtre. */
  champ?: boolean
  /** Faux sur une date obligatoire : on ne propose pas de la retirer. */
  effacable?: boolean
  onChoisir: (iso: string | null) => void
}) {
  const date = valeur ? versDate(valeur) : undefined

  /*
    Le calendrier se referme sur le jour choisi. En filtre, la fermeture venait
    de la navigation ; en champ, rien ne la provoque, et le panneau resterait
    ouvert par-dessus la suite du formulaire.
  */
  const [ouvert, setOuvert] = useState(false)

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger
        id={id}
        aria-label={champ ? undefined : etiquette}
        className={cn(
          'border-border bg-raised hover:border-border-strong data-[state=open]:border-border-strong flex items-center gap-1.5 border',
          // Le rayon suit le voisinage : 6 px dans une colonne de champs, 9 px
          // parmi les surfaces flottantes d'une rangée de filtres.
          champ
            ? 'h-11 w-full rounded-[6px] px-3 text-[15px] md:h-10'
            : 'h-9 rounded-[9px] px-2.5 text-[13px]',
          date ? 'text-ink font-medium tabular-nums' : 'text-ink2',
        )}
      >
        <CalendarDays className="text-ink3 size-3.5 shrink-0" aria-hidden />
        {date ? DATE_LISIBLE.format(date) : etiquette}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn('bg-raised shadow-menu w-auto gap-0 rounded-[9px] p-0', FILET_FLOTTANT)}
      >
        <Calendar
          mode="single"
          locale={fr}
          /*
            Les flèches du calendrier passent par `components`, que la copie
            shadcn étale APRÈS ses propres défauts — la surcharge tient donc
            sans toucher `components/ui/calendar.tsx`, qui ne se modifie pas à
            la main.

            `ChevronDown` reste : il ouvre le sélecteur de mois, il ne désigne
            ni la gauche ni la droite.
          */
          components={{
            Chevron: ({ orientation, className: c }) =>
              orientation === 'left' ? (
                <FlecheGauche className={cn('w-3.5', c)} />
              ) : orientation === 'right' ? (
                <FlecheDroite className={cn('w-3.5', c)} />
              ) : (
                <ChevronDown className={cn('size-4', c)} />
              ),
          }}
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            onChoisir(d ? versIso(d) : null)
            setOuvert(false)
          }}
        />
        {date && effacable && (
          <button
            type="button"
            onClick={() => {
              onChoisir(null)
              setOuvert(false)
            }}
            className="border-border text-ink2 hover:bg-hover hover:text-ink flex h-9 w-full items-center justify-center gap-1.5 border-t text-[13px]"
          >
            <X className="size-3.5" aria-hidden />
            Retirer la date
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
