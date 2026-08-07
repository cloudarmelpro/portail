'use client'

import { Eye, EyeOff } from 'lucide-react'

/**
 * Bascule d'affichage du mot de passe, posée dans le champ.
 *
 * Le `::after` porte la cible tactile à 44 px sans agrandir le rond visible.
 */
export function BasculeMotDePasse({
  visible,
  onBasculer,
}: {
  visible: boolean
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      aria-pressed={visible}
      className="text-ink3 hover:bg-hover hover:text-ink absolute top-2.5 right-2 flex size-9 items-center justify-center rounded-full transition-colors duration-150 after:absolute after:-inset-1 after:content-['']"
    >
      {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  )
}
