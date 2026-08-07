import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { siteConfig } from '@/config/site'
import './globals.css'

/**
 * DM Sans — police du produit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `next/font` la TÉLÉCHARGE À LA COMPILATION et la sert depuis notre origine.
 *
 * Aucune requête vers Google au moment où l'utilisateur charge la page : ni
 * fuite d'adresse IP, ni dépendance à un tiers pour afficher du texte. C'est ce
 * qui la rend compatible avec `font-src 'self'` de la politique de sécurité, et
 * avec un produit qu'on héberge soi-même.
 *
 * Aucun poids n'est déclaré : DM Sans est variable, et la version variable les
 * porte tous. En épingler trois aurait laissé le navigateur SYNTHÉTISER le
 * `font-semibold` du système de design — un faux gras, plus lourd et moins net
 * que le vrai, et qui ne se remarque qu'une fois à l'écran.
 * ─────────────────────────────────────────────────────────────────────────
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: siteConfig.nom,
  description: siteConfig.description,
  // L'application est derrière un login : elle ne doit jamais être indexée.
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${dmSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        {/*
          `suppressHydrationWarning` sur <html> est requis par next-themes :
          il pose la classe de thème avant l'hydratation, ce que React signale
          sinon comme une divergence serveur/client.
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/*
            Configuration ici plutôt que dans components/ui/sonner.tsx, qui vient
            de shadcn et n'est pas modifié à la main. Les durées sont dans
            lib/toast.ts ; ici, seule la position et la largeur.
          */}
          <Toaster position="bottom-right" style={{ width: 360 }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
