import Link from 'next/link'
import { FlecheDroite, FlecheGauche } from '@/components/shared/fleches'

type Props = {
  page: number
  pages: number
  /**
   * Adresse d'une page donnée. Chaque écran garde SA façon de la construire :
   * le CRM compose un chemin par entreprise et omet `page` quand elle vaut 1,
   * le journal empile une chaîne de requête. C'était la seule différence réelle
   * entre les deux paginations, et c'est celle qu'on laisse dehors.
   */
  lien: (n: number) => string
}

/**
 * Pagination — CRM-8, et le journal d'audit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elle a existé en DEUX exemplaires, écrits séparément.
 *
 * Même balisage, même hauteur, même gouttière, même typographie — et deux
 * sources. Le remplacement des chevrons par les flèches du client a dû être
 * fait deux fois, ce qui est exactement la façon dont on découvre ce genre de
 * dette : au deuxième passage.
 *
 * Le libellé est ÉCRIT, jamais réduit à une flèche. Deux paginations qui ne se
 * ressemblent pas dans le même produit obligent à réapprendre où cliquer d'un
 * écran à l'autre ; une flèche nue oblige à deviner.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function Pagination({ page, pages, lien }: Props) {
  return (
    <div className="flex items-center justify-between">
      <Saut href={lien(page - 1)} actif={page > 1} libelle="Page précédente" sens="precedent" />
      <span className="text-ink2 text-[13px] tabular-nums">
        Page {page} sur {pages}
      </span>
      <Saut href={lien(page + 1)} actif={page < pages} libelle="Page suivante" sens="suivant" />
    </div>
  )
}

function Saut({
  href,
  actif,
  libelle,
  sens,
}: {
  href: string
  actif: boolean
  libelle: string
  sens: 'precedent' | 'suivant'
}) {
  const Icone = sens === 'precedent' ? FlecheGauche : FlecheDroite
  const contenu = (
    <>
      {sens === 'precedent' && <Icone className="w-4" />}
      {libelle}
      {sens === 'suivant' && <Icone className="w-4" />}
    </>
  )

  // Au bout de la liste, le libellé reste ÉCRIT mais cesse d'être un lien : un
  // `<a>` inerte se tabule encore et promet une page qui n'existe pas.
  if (!actif) {
    return (
      <span className="text-ink3 flex h-9 items-center gap-1.5 px-3 text-[13px]">{contenu}</span>
    )
  }

  return (
    <Link
      href={href}
      className="text-ink2 hover:bg-hover hover:text-ink flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium"
    >
      {contenu}
    </Link>
  )
}
