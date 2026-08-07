'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { CHAMP_FILTRE, CHAMP_OUTIL } from '@/components/shared/gabarits'
import { cn } from '@/lib/utils'

/**
 * Recherche par nom de fichier.
 *
 * Le terme vit dans l'URL plutôt que dans un état local : une recherche se
 * partage, se met en signet, et survit à un rechargement. C'est aussi ce qui
 * permet au serveur de filtrer — le tri et la pagination restent côté données.
 *
 * `destination` sert depuis la vue racine, où l'on cherche dans l'ensemble des
 * fichiers plutôt que dans un dossier.
 */
export function ChampRecherche({
  destination,
  placeholder = 'Rechercher un fichier',
  pleineLargeur = false,
}: {
  destination?: string
  placeholder?: string
  /** Occupe la colonne entière, au-dessus de la liste qu'il filtre. */
  pleineLargeur?: boolean
}) {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const initial = params.get('q') ?? ''

  const [valeur, setValeur] = useState(initial)
  const [enCours, demarrer] = useTransition()

  const saisie = valeur.trim()

  useEffect(() => {
    /*
      La seule raison de naviguer est un écart entre la saisie et l'URL. Se fier
      au montage ne suffit pas : cet effet se relance à chaque changement
      d'identité de `params`, et React monte les effets deux fois en
      développement. Un champ vide y prenait alors `destination` pour une
      consigne et quittait la page sans que personne n'ait rien tapé.
    */
    if (saisie === (params.get('q') ?? '')) return

    // Attente avant envoi : sans elle, chaque frappe déclencherait une requête.
    const minuterie = setTimeout(() => {
      const suivants = new URLSearchParams(params)
      if (saisie) suivants.set('q', saisie)
      else suivants.delete('q')

      const cible = destination ?? chemin
      const requete = suivants.toString()

      demarrer(() => {
        // `scroll: false` : la liste se filtre sous les yeux de l'utilisateur,
        // remonter en haut de page lui ferait perdre sa place.
        router.replace(requete ? `${cible}?${requete}` : cible, { scroll: false })
      })
    }, 300)

    return () => clearTimeout(minuterie)
  }, [saisie, chemin, destination, params, router])

  return (
    <div className={cn('relative w-full', !pleineLargeur && 'sm:w-70')}>
      {/*
        Tout est centré par `top-1/2 -translate-y-1/2`, jamais par un décalage
        depuis le haut : le champ change de hauteur — 44 px au doigt, 40 ou 36 à
        la souris — et un décalage juste à l'une des trois est faux aux deux
        autres.
      */}
      <Search
        className="text-ink3 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // `pl-10` laisse huit pixels entre la loupe et la première lettre —
        // collée, elle se lit comme une partie du mot.
        className={cn(pleineLargeur ? CHAMP_OUTIL : CHAMP_FILTRE, 'w-full ps-10 pe-11')}
      />
      {enCours ? (
        <Loader2
          className="text-ink3 absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin"
          aria-hidden
        />
      ) : (
        valeur && (
          <button
            onClick={() => setValeur('')}
            aria-label="Effacer la recherche"
            className="text-ink3 hover:bg-hover hover:text-ink absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-[6px]"
          >
            <X className="size-4" aria-hidden />
          </button>
        )
      )}
    </div>
  )
}
