import { ArrowDownNarrowWide, ArrowUpNarrowWide, ChevronsUpDown } from 'lucide-react'
import { Tronque } from '@/components/shared/tronque'
import { cn } from '@/lib/utils'

/**
 * Tableau unique du produit — section 19.
 *
 * Les cinq listes du produit battent la même mesure : rangées de 44 px,
 * en-tête compris, libellés de colonne en casse normale (13/18, 500),
 * `scope="col"` partout, `aria-sort` déclaré sur les seules colonnes triables,
 * actions révélées au survol ET au `focus-within`.
 *
 * UNE seule hauteur, pour l'en-tête comme pour les lignes. Elles ont divergé le
 * temps d'une itération — 44 contre 52 — et l'écart ne se voyait pas : il
 * donnait juste au tableau deux rythmes au lieu d'un. Ce qui distingue l'en-tête
 * n'a pas besoin d'être sa taille ; sa graisse, sa couleur et son filet le font
 * déjà.
 *
 * L'en-tête était en micro-majuscules espacées (11/14, 0,02em). C'était le texte
 * le plus petit du produit, sur les mots qu'on relit le plus souvent — et les
 * majuscules privent la lecture des ascendantes et des descendantes, qui sont
 * précisément ce qui permet de reconnaître un mot sans l'épeler.
 *
 * L'en-tête triable passe par `rendu` plutôt que par un `href` : le CRM et les
 * heures trient par l'URL avec `Link`, le calculateur trie localement avec un
 * `button`. Le rendu diffère, les classes ne doivent pas.
 */
export type SensTri = 'ascendant' | 'descendant' | 'aucun'

export function CadreTableau({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('border-border bg-raised overflow-x-auto rounded-[10px] border', className)}>
      {children}
    </div>
  )
}

export function Tableau({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <table className={cn('w-full border-collapse', className)}>{children}</table>
}

export function EnTeteTableau({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-border border-b">{children}</tr>
    </thead>
  )
}

export function ColonneTableau({
  libelle,
  tri,
  aDroite,
  rendu,
  className,
}: {
  libelle?: string
  /** Absent : colonne non triable, donc aucun `aria-sort` déclaré. */
  tri?: SensTri
  aDroite?: boolean
  /** Enveloppe le libellé dans le lien ou le bouton qui déclenche le tri. */
  rendu?: (contenu: React.ReactNode, classes: string) => React.ReactNode
  className?: string
}) {
  const actif = tri === 'ascendant' || tri === 'descendant'
  const Fleche =
    tri === 'ascendant'
      ? ArrowUpNarrowWide
      : tri === 'descendant'
        ? ArrowDownNarrowWide
        : ChevronsUpDown

  const classes = cn(
    'flex h-11 w-full items-center gap-1.5 px-4 text-[13px] leading-[18px] font-medium',
    aDroite ? 'justify-end' : 'justify-start',
    actif ? 'text-ink' : 'text-ink3',
    rendu && 'hover:text-ink',
  )

  const contenu = (
    <>
      {libelle}
      {tri && <Fleche className={cn('size-3 shrink-0', !actif && 'opacity-35')} aria-hidden />}
    </>
  )

  return (
    <th
      scope="col"
      aria-sort={
        tri === undefined
          ? undefined
          : tri === 'ascendant'
            ? 'ascending'
            : tri === 'descendant'
              ? 'descending'
              : 'none'
      }
      className={cn('bg-raised sticky top-0 z-10 p-0', className)}
    >
      {rendu ? rendu(contenu, classes) : <span className={classes}>{contenu}</span>}
    </th>
  )
}

export function CorpsTableau({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>
}

export function LigneTableau({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <tr className={cn('border-border hover:bg-hover group border-b last:border-0', className)}>
      {children}
    </tr>
  )
}

/**
 * Le `max-w-*` écrit sur la cellule, à reporter sur le bloc qui tronque.
 *
 * La classe est déclarée SUR LA CELLULE parce que c'est là qu'elle se lit : la
 * colonne a une largeur, le bloc n'est qu'un moyen. Mais elle n'y produit rien —
 * en disposition automatique, `max-width` sur un `<td>` est une indication que
 * l'algorithme de table peut ignorer.
 */
function plafondDe(classes?: string) {
  return classes
    ?.split(/\s+/)
    .filter((c) => c.includes('max-w-'))
    .join(' ')
}

export function CelluleTableau({
  aDroite,
  chiffres,
  discret,
  tronque,
  titre,
  className,
  children,
}: {
  aDroite?: boolean
  /** Colonne de chiffres : chasse tabulaire, jamais de retour à la ligne. */
  chiffres?: boolean
  discret?: boolean
  /**
   * Texte libre : plafonné, puis coupé sur des points de suspension. Le plafond
   * se règle en posant un `max-w-*` sur la CELLULE — il est reporté au bloc
   * intérieur, seul endroit où `text-overflow` opère en disposition automatique.
   */
  tronque?: boolean
  /** Valeur entière pour l'infobulle, quand le contenu n'est pas une chaîne. */
  titre?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <td
      className={cn(
        'h-11 px-4 text-[15px]',
        aDroite && 'text-right',
        chiffres && 'whitespace-nowrap tabular-nums',
        discret && 'text-ink2',
        className,
      )}
    >
      {tronque ? (
        // Seul le plafond passe au bloc intérieur. Y reverser tout `className`
        // y recopierait aussi une largeur ou un alignement destinés à la
        // cellule, dont l'effet sur le bloc serait tout autre.
        <Tronque titre={titre} className={plafondDe(className)}>
          {children}
        </Tronque>
      ) : (
        children
      )}
    </td>
  )
}

/**
 * Actions de fin de ligne. `opacity-0` les retire du regard, jamais du parcours
 * clavier : `group-focus-within` les rend visibles dès qu'elles reçoivent le
 * focus. Exige `LigneTableau`, qui porte la classe `group`.
 */
export function ActionsLigne({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex justify-end gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Zone de tableau sans ligne à montrer.
 *
 * Reprend le CADRE du tableau — même bordure, même rayon, même largeur — avec
 * une phrase à la place des rangées. La liste ne disparaît donc pas : elle
 * répond. Une boîte d'une autre forme aurait fait croire que l'écran avait
 * changé, alors que seul le contenu manque.
 *
 * À ne pas confondre avec `EtatVide`, qui porte un titre, une explication et un
 * bouton : celui-là est fait pour le PREMIER usage, quand il n'y a rien parce
 * qu'on n'a rien créé. Celui-ci est fait pour une recherche qui ne trouve rien,
 * où il n'y a rien à expliquer et rien à créer.
 */
export function TableauVide({ children }: { children: React.ReactNode }) {
  return (
    <CadreTableau>
      <p className="text-ink2 px-6 py-9 text-center text-[15px] leading-[22px]">{children}</p>
    </CadreTableau>
  )
}
