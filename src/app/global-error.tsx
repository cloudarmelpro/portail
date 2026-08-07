'use client'

import { AlertCircle } from 'lucide-react'
import './globals.css'

/**
 * Panne du gabarit racine — le dernier filet de tous.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il REMPLACE `layout.tsx`, et doit donc porter lui-même `<html>` et `<body>`.
 *
 * Sans ce fichier, une panne du gabarit racine tombait sur la page par défaut
 * de Next : anglaise, sans thème, sans issue. C'est le seul écran du produit
 * qu'un utilisateur peut atteindre sans qu'une seule ligne de notre gabarit ait
 * fonctionné.
 *
 * Deux conséquences, assumées.
 *
 * Le thème est toujours le CLAIR : `next-themes` pose sa classe depuis le
 * gabarit racine, celui-là même qui vient d'échouer. Les jetons de `:root` sont
 * ceux du clair, et c'est ce qui s'affiche — un écran clair sur un produit
 * réglé en sombre, plutôt qu'un écran illisible.
 *
 * La police est celle du système : `next/font` expose `--font-dm-sans` depuis le
 * gabarit racine. Rien à rattraper ici, sinon en dupliquant le chargement de la
 * police pour un écran que personne ne devrait voir.
 *
 * Aucun `Link` non plus : le routeur fait partie de ce qui a pu tomber. Un
 * `<a>` recharge la page entière, ce qui est précisément la reprise voulue.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function ErreurGabarit({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="bg-page text-ink flex min-h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertCircle className="text-ink3 size-6" aria-hidden />
          <h1 className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.01em]">
            Une erreur est survenue
          </h1>
          <p className="text-ink2 max-w-[420px] text-[15px] leading-[22px]">
            Réessayez. Si le problème persiste, transmettez la référence ci-dessous.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="bg-action text-action-ink inline-flex h-9 items-center gap-2 rounded-xl px-5 text-sm font-medium"
            >
              Réessayer
            </button>
            <a
              href="/accueil"
              className="border-border bg-raised text-ink hover:border-border-strong inline-flex h-9 items-center gap-2 rounded-xl border px-5 text-sm font-medium"
            >
              Retour à l’accueil
            </a>
          </div>

          {error.digest && (
            <p className="text-ink3 mt-6 text-[11px] leading-[14px] tracking-[0.02em]">
              Référence&nbsp;: <span className="tabular-nums">{error.digest}</span>
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
