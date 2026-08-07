import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CarteChiffre = {
  cle: string
  libelle: string
  /**
   * Déjà formatée côté serveur — « 37,5 h », « 4 ». La formater ici ferait
   * diverger le rendu du serveur de celui du client à la première hydratation.
   */
  valeur: string
  /** Décorative : le libellé porte l'information, l'icône ne fait que la situer. */
  icone: LucideIcon
  /** Absent : la carte n'est pas un lien, et ne se comporte pas comme tel. */
  href?: string
}

/**
 * Chiffres d'un écran, en cartes — le gabarit de l'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'inverse de `BandeChiffres`, et pour un autre usage.
 *
 * La bande aligne ses valeurs sur une seule ligne, au bord du panneau : c'est du
 * CHROME, elle situe l'écran. Les cartes, elles, sont du contenu — elles
 * commencent la page, sur l'axe du titre, et chacune tient sa propre boîte.
 *
 * Une valeur qui ne mène nulle part reste une valeur : la carte ne devient un
 * lien que si on lui en donne un, et elle ne prend alors ni survol ni curseur de
 * pointage. Une carte qui réagit au survol sans rien ouvrir se fait cliquer.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function CartesChiffres({ cartes }: { cartes: CarteChiffre[] }) {
  return (
    /*
      Quatre au plus par rangée. Au-delà, les cartes deviennent plus étroites que
      leur propre libellé, et « Heures de la période » se replie sur trois lignes
      sous un nombre à deux chiffres.
    */
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cartes.map((c) => {
        const contenu = (
          <>
            <span className="flex min-w-0 flex-col gap-1">
              <dt className="text-ink3 text-[13px] leading-4.5">{c.libelle}</dt>
              <dd className="text-[30px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
                {c.valeur}
              </dd>
            </span>

            {/*
              `--hover` plutôt que `--page` : c'est un voile, donc il creuse en
              clair et éclaircit en sombre. `--page` sur une carte `--raised`
              donnerait un trou noir.
            */}
            <span className="bg-hover text-ink3 flex size-14 shrink-0 items-center justify-center rounded-[8px]">
              <c.icone className="size-5" aria-hidden strokeWidth={1.25} />
            </span>
          </>
        )

        const classes = cn(
          'border-border bg-raised flex items-center justify-between gap-3 rounded-md border p-4',
          c.href && 'hover:border-border-strong',
        )

        return c.href ? (
          <Link key={c.cle} href={c.href} className={classes}>
            {contenu}
          </Link>
        ) : (
          <div key={c.cle} className={classes}>
            {contenu}
          </div>
        )
      })}
    </dl>
  )
}
