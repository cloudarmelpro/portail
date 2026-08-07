'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentProps<'input'>, 'id' | 'placeholder' | 'className' | 'style'> & {
  identifiant: string
  libelle: string
  /** Montré à la place du libellé tant que le champ est vide et au repos ; le libellé à défaut. */
  exemple?: string
  icone: LucideIcon
  erreur?: boolean
  /** Élément posé dans le champ, à droite — la bascule d'affichage du mot de passe. */
  suffixe?: React.ReactNode
}

/**
 * Champ de 56 px à étiquette flottante des écrans d'authentification.
 *
 * L'étiquette visible est décorative : le `<label>` associé reste dans le DOM,
 * porte toujours le libellé et donne son nom accessible au champ. Sans lui, le
 * nom du champ changerait avec son état — « vous@exemple.ca » au repos.
 *
 * Le repère de focus est porté par l'ENVELOPPE, pas par le champ : `globals.css`
 * retire déjà l'anneau des champs de texte, où le curseur clignotant dit mieux
 * où l'on est. L'invariant tient donc sur deux fichiers — supprimer la règle de
 * `globals.css` doublerait le trait ici.
 */
export function ChampAuth({
  identifiant,
  libelle,
  exemple,
  icone: Icone,
  erreur = false,
  suffixe,
  defaultValue,
  disabled,
  onFocus,
  onBlur,
  onInput,
  ...props
}: Props) {
  const [actif, setActif] = useState(false)
  const [rempli, setRempli] = useState(Boolean(defaultValue))

  const haut = actif || rempli

  return (
    <div
      className={cn(
        'bg-surface relative rounded-xl border transition-[border-color,box-shadow,opacity] duration-150',
        erreur
          ? 'border-critical ring-critical/15 ring-[3px]'
          : actif
            ? 'border-ink ring-ink/10 ring-[3px]'
            : 'border-border',
        disabled && 'opacity-60',
      )}
    >
      <Icone
        className={cn(
          'pointer-events-none absolute top-[19px] left-4 size-[18px] transition-colors duration-150',
          erreur ? 'text-critical-texte' : actif ? 'text-ink2' : 'text-ink3',
        )}
        aria-hidden
      />

      <label htmlFor={identifiant} className="sr-only">
        {libelle}
      </label>

      <span
        aria-hidden
        className={cn(
          'text-ink3 pointer-events-none absolute left-[46px] tracking-[0.02em] transition-[top,font-size,line-height] duration-[130ms]',
          haut ? 'top-[11px] text-[11px] leading-[14px]' : 'top-[17px] text-[15px] leading-[22px]',
        )}
      >
        {haut ? libelle : (exemple ?? libelle)}
      </span>

      <input
        id={identifiant}
        defaultValue={defaultValue}
        disabled={disabled}
        className={cn(
          'h-14 w-full rounded-xl bg-transparent pl-[46px] text-[15px] transition-[padding] duration-[130ms]',
          suffixe ? 'pr-12' : 'pr-4',
          haut ? 'pt-3.5' : 'pt-0',
        )}
        onFocus={(evenement) => {
          setActif(true)
          onFocus?.(evenement)
        }}
        onBlur={(evenement) => {
          setActif(false)
          onBlur?.(evenement)
        }}
        // `input` plutôt que `change` : le remplissage automatique du navigateur
        // ne déclenche pas toujours `change`, et l'étiquette resterait posée
        // par-dessus la valeur.
        onInput={(evenement) => {
          setRempli(evenement.currentTarget.value !== '')
          onInput?.(evenement)
        }}
        {...props}
      />

      {suffixe}
    </div>
  )
}
