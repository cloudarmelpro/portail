'use client'

import { Search } from 'lucide-react'
import { useOuvrirRecherche } from '@/components/layout/contexte-recherche'

/**
 * Le champ de recherche de l'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'est un BOUTON qui a l'air d'un champ, et c'est voulu.
 *
 * Un vrai `<input>` obligerait à tenir un second terme de recherche, à le
 * transmettre à la palette et à décider lequel des deux gagne quand ils
 * divergent. Le geste est le même — on clique, on tape — mais il n'y a qu'un
 * seul endroit où le terme existe.
 *
 * Le raccourci est écrit à droite : c'est le seul moyen de le faire connaître à
 * quelqu'un qui ne lit pas la documentation d'un outil interne.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function ChampRechercheAccueil() {
  const ouvrir = useOuvrirRecherche()

  return (
    <button
      type="button"
      onClick={ouvrir}
      className="border-border bg-raised text-ink3 hover:border-border-strong flex h-12 w-full items-center gap-3 rounded-md border px-4 text-[15px]"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Rechercher un écran, un client, un employé, un CV…</span>

      {/*
        Deux pastilles, une par touche, comme sur toutes les palettes : c'est un
        raccourci à deux temps, et l'écrire d'un bloc le ferait lire comme une
        seule touche. La notation reste celle du reste du produit — ⌘, pas Ctrl.
      */}
      <span aria-hidden className="hidden shrink-0 items-center gap-1 sm:flex">
        {['⌘', 'K'].map((touche) => (
          <kbd
            key={touche}
            className="border-border text-ink3 rounded-[5px] border px-1.25 font-sans text-[11px] leading-4"
          >
            {touche}
          </kbd>
        ))}
      </span>
    </button>
  )
}
