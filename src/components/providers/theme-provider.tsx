'use client'

import { ThemeProvider as NextThemes, type ThemeProviderProps } from 'next-themes'

/**
 * Frontière client explicite pour `next-themes`.
 *
 * Le fournisseur injecte un `<script>` qui pose la classe de thème AVANT
 * l'hydratation — c'est ce qui évite le clignotement clair→sombre au chargement.
 *
 * Importé directement depuis un composant serveur, React tente de rendre ce
 * script côté navigateur, où il ne s'exécute jamais. Ce fichier marque la
 * frontière : le script reste au rendu serveur, où il a un sens.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemes {...props}>{children}</NextThemes>
}
