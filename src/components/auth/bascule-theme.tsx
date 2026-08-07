'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

/**
 * Bascule de thème des écrans d'authentification — la seule accessible sans
 * session ; ailleurs elle vit dans le menu utilisateur, avec les mêmes libellés.
 *
 * Les deux états sont rendus et l'un est masqué par CSS : lire le thème pendant
 * le rendu donnerait une valeur absente côté serveur, donc un écart
 * d'hydratation. `resolvedTheme` n'est consulté qu'au clic, où il est connu.
 * Le `::after` étend la cible tactile à 44 px sans déplacer le bouton.
 */
export function BasculeTheme() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="border-border bg-surface text-ink2 hover:border-border-strong hover:text-ink absolute right-5 bottom-5 flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] leading-[18px] transition-[border-color,color] duration-150 after:absolute after:-inset-1 after:content-['']"
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <span className="dark:hidden">Mode sombre</span>
      <span className="hidden dark:block">Mode clair</span>
    </button>
  )
}
