import Link from 'next/link'
import { FlecheDroite } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import { cn } from '@/lib/utils'

/**
 * Creux — un fond gris qui porte un titre, et ce qu'on y pose.
 *
 * `CarteCreux` est l'enveloppe : titre, décompte, commande à droite, et ce qu'on
 * lui donne en dessous. `ListeCreux` en est l'emploi le plus fréquent — des
 * rangées blanches — mais un tableau s'y pose aussi bien, et c'est alors le
 * tableau qui porte son propre cadre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'inverse d'un tableau, et pour un autre usage.
 *
 * Un tableau sert à COMPARER : ses colonnes s'alignent, son en-tête les nomme,
 * son tri les réordonne. Une liste en creux sert à PRENDRE une ligne — la
 * relance à traiter, le client à rappeler. Chaque rangée y est un objet posé
 * sur un fond, pas une rangée de cellules.
 *
 * D'où ce qu'elle n'a pas, et qui n'est pas un oubli : ni en-tête de colonne, ni
 * tri, ni pagination. Trois affordances qui promettraient une comparaison que la
 * forme ne soutient pas.
 *
 * Les rangées n'ont pas de filet : le contraste des deux fonds pose déjà leur
 * limite, et un filet par-dessus l'aurait redite une seconde fois. Le survol se
 * marque donc sur la flèche — un fond survolé aurait dû être plus clair que
 * blanc.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function CarteCreux({
  titre,
  compte,
  alerte,
  aDroite,
  className,
  children,
}: {
  titre: string
  compte?: number
  alerte?: boolean
  aDroite?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const id = `creux-${titre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section aria-labelledby={id} className={cn('bg-rail rounded-[12px] p-4', className)}>
      {/*
        `items-center` dès qu'une commande est à droite : un bouton n'a pas de
        ligne de base commune avec un titre de 17 px, et aligné sur elle il
        s'enfonçait de quelques pixels sous le mot.
      */}
      <div className={cn('flex gap-3 px-1', aDroite ? 'items-center' : 'items-baseline')}>
        <h2 id={id} className="text-[17px] leading-6 font-semibold">
          {titre}
        </h2>

        {compte !== undefined && (
          <span
            className={cn(
              'shrink-0 text-[13px] leading-4.5 tabular-nums',
              alerte ? 'text-critical-texte' : 'text-ink3',
            )}
          >
            {compte}
          </span>
        )}

        {aDroite && <div className="ml-auto shrink-0">{aDroite}</div>}
      </div>

      <div className={cn(aDroite ? 'mt-4' : 'mt-3')}>{children}</div>
    </section>
  )
}

export function ListeCreux({
  titre,
  compte,
  alerte,
  aDroite,
  vide,
  className,
  children,
}: {
  titre: string
  /** Le nombre d'éléments, à côté du titre. Absent : rien n'est annoncé. */
  compte?: number
  /** Le compte porte alors une icône ET un mot : jamais la couleur seule. */
  alerte?: boolean
  /** Un lien de sortie, ou tout autre commande propre à la liste. */
  aDroite?: React.ReactNode
  /**
   * Phrase à rendre quand il n'y a aucune rangée.
   *
   * Absente, la liste ne rend RIEN plutôt qu'un creux vide — c'est le bon choix
   * sur un écran de choses à faire, où un cadre sans contenu affirme qu'il
   * devrait y avoir quelque chose. Présente, la liste garde sa place : sur
   * l'écran d'entrée d'un module, une structure qui apparaît et disparaît selon
   * les données se lit comme un écran différent à chaque visite.
   */
  vide?: string
  className?: string
  children: React.ReactNode
}) {
  const id = `liste-${titre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section aria-labelledby={id} className={cn('bg-rail rounded-[12px] p-4', className)}>
      {/*
        `items-center` dès qu'une commande est à droite : un bouton n'a pas de
        ligne de base commune avec un titre de 17 px, et aligné sur elle il
        s'enfonçait de quelques pixels sous le mot.
      */}
      <div className={cn('flex gap-3 px-1', aDroite ? 'items-center' : 'items-baseline')}>
        <h2 id={id} className="text-[17px] leading-6 font-semibold">
          {titre}
        </h2>

        {compte !== undefined && (
          <span
            className={cn(
              'shrink-0 text-[13px] leading-4.5 tabular-nums',
              alerte ? 'text-critical-texte' : 'text-ink3',
            )}
          >
            {compte}
          </span>
        )}

        {aDroite && <div className="ml-auto shrink-0">{aDroite}</div>}
      </div>

      {/*
        La phrase prend la forme d'une rangée — même fond, même rayon, même
        hauteur — plutôt que de flotter dans le creux. La liste garde ainsi sa
        mesure pleine, et deux panneaux côte à côte ne se décalent pas parce que
        l'un est vide.
      */}
      {vide ? (
        <p className="bg-raised text-ink3 mt-3 flex min-h-12 items-center rounded-[10px] px-3 py-2 text-[13px] leading-4.5">
          {vide}
        </p>
      ) : (
        <ul className={cn('flex flex-col gap-2', aDroite ? 'mt-4' : 'mt-3')}>{children}</ul>
      )}
    </section>
  )
}

/**
 * Une rangée de liste en creux.
 *
 * `href` n'est pas facultatif : la rangée porte une flèche, et une flèche sans
 * destination est une promesse non tenue. Là où il n'y a rien de plus précis à
 * ouvrir, la rangée retombe sur la destination de sa liste.
 */
export function RangeeCreux({
  href,
  avant,
  principal,
  titre,
  secondaire,
  valeur,
  annonce,
}: {
  href: string
  /**
   * Marque d'identité en tête de rangée — la pastille d'entreprise, une icône.
   * Jamais porteuse d'information à elle seule : le mot qui suit la porte.
   */
  avant?: React.ReactNode
  principal: React.ReactNode
  /** Valeur entière pour l'infobulle, quand `principal` n'est pas une chaîne. */
  titre?: string
  secondaire?: React.ReactNode
  /** Chiffre, montant ou état — poussé au bout, juste avant la flèche. */
  valeur?: React.ReactNode
  /**
   * Nom du lien pour un lecteur d'écran, quand le texte de la rangée ne suffit
   * pas à le distinguer de ses voisines dans la liste des liens.
   */
  annonce?: string
}) {
  return (
    <li>
      <Link
        href={href}
        aria-label={annonce}
        className="group bg-raised flex min-h-12 items-center gap-3 rounded-[10px] px-3 py-2"
      >
        {avant}

        <Tronque titre={titre} className="max-w-72 text-[13px] leading-4.5">
          {principal}
        </Tronque>

        {/*
          Le mot du milieu situe la rangée sans la nommer — le dossier, l'auteur,
          l'action prévue. Il s'efface avant le reste sur un écran étroit :
          perdre le contexte coûte moins que perdre le nom ou l'échéance.
        */}
        {secondaire && (
          <Tronque className="text-ink3 hidden max-w-80 text-[13px] leading-4.5 sm:block">
            {secondaire}
          </Tronque>
        )}

        {valeur && (
          <span className="text-ink2 ml-auto shrink-0 text-[13px] leading-4.5 tabular-nums">
            {valeur}
          </span>
        )}

        {/*
          `ml-auto` conditionnel : sans valeur à droite, c'est la flèche qui doit
          être poussée au bout. Avec, elle la suit de près — deux marges
          automatiques se partageraient l'espace et sépareraient le nombre de sa
          flèche.
        */}
        <FlecheDroite
          className={cn('text-ink3 group-hover:text-ink w-3.5 shrink-0', !valeur && 'ml-auto')}
          aria-hidden
        />
      </Link>
    </li>
  )
}
