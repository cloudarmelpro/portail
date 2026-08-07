'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import { Choix } from '@/components/shared/choix'
import { LIBELLE_STATUT_CLIENT, LIBELLE_TYPE_CLIENT, ORDRE_STATUT_CLIENT } from '@/config/crm'
import { CHAMP_FILTRE } from '@/components/shared/gabarits'

/** Le champ du produit — même hauteur et même rayon que les choix qui le suivent. */
const CHAMP = CHAMP_FILTRE

/**
 * CRM-8 — recherche, filtre par statut, filtre par type.
 *
 * Tout est écrit dans l'URL, jamais dans un état local : une vue filtrée se
 * partage, se met en signet et survit à un rechargement. Changer un filtre
 * ramène à la première page — rester en page 4 d'une liste qui n'en a plus que
 * deux afficherait un tableau vide sans explication.
 */
export function BarreFiltres({
  nombre,
  action,
}: {
  nombre: number
  /** Le geste principal de l'écran, posé au bout de la rangée. */
  action?: React.ReactNode
}) {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const [enCours, demarrer] = useTransition()

  const [saisie, setSaisie] = useState(params.get('q') ?? '')
  const terme = saisie.trim()

  function naviguer(modifier: (p: URLSearchParams) => void) {
    const suivants = new URLSearchParams(params)
    modifier(suivants)
    suivants.delete('page')
    const requete = suivants.toString()
    demarrer(() => {
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false })
    })
  }

  /*
    Recherche temporisée, sans bouton — contrairement à celle des comptes.

    La liste est le lieu où l'on cherche par tâtonnement : on tape trois lettres,
    on regarde, on en retire une. Un bouton imposerait un geste entre chaque
    essai. Les deux ensemble se marcheraient dessus : la temporisation partirait
    pendant qu'on vise le bouton, et le clic relancerait une navigation déjà en
    cours.
  */
  useEffect(() => {
    // Ne naviguer que sur un écart réel : cet effet se relance à chaque nouvelle
    // identité de `params`, et React monte les effets deux fois en développement.
    if (terme === (params.get('q') ?? '')) return

    const minuterie = setTimeout(() => {
      const suivants = new URLSearchParams(params)
      if (terme) suivants.set('q', terme)
      else suivants.delete('q')
      suivants.delete('page')
      const requete = suivants.toString()
      demarrer(() => {
        router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false })
      })
    }, 300)

    return () => clearTimeout(minuterie)
  }, [terme, chemin, params, router])

  /* Le zéro et le singulier sont déclinés : « 0 clients » se lit comme une
     donnée manquante plutôt que comme une liste vide. */
  const compteur = nombre === 0 ? 'Aucun client' : nombre === 1 ? '1 client' : `${nombre} clients`

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-75">
        <Search
          className="text-ink3 pointer-events-none absolute top-2.5 left-2.5 size-4"
          aria-hidden
        />
        <input
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Rechercher un client"
          aria-label="Rechercher un client"
          /* La croix de `type="search"` est masquée : celle du produit, à côté,
             en ferait deux au même endroit. */
          className={`${CHAMP} w-full pr-9 pl-8.5`}
        />
        {enCours ? (
          <Loader2
            className="text-ink3 absolute top-2.5 right-2.5 size-4 animate-spin"
            aria-hidden
          />
        ) : (
          saisie && (
            <button
              onClick={() => setSaisie('')}
              aria-label="Effacer la recherche"
              className="text-ink3 hover:text-ink absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-[6px] md:size-6"
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>

      {/*
        Le même choix déroulant que le journal d'audit et les grilles de tarifs :
        un `<select>` natif porte le style du SYSTÈME, pas celui du produit — sa
        flèche et sa liste venaient de Windows, à côté de contrôles dessinés.
      */}
      <Choix
        valeur={params.get('statut') ?? ''}
        options={ORDRE_STATUT_CLIENT.map((s) => ({
          valeur: s,
          libelle: LIBELLE_STATUT_CLIENT[s],
        }))}
        parDefaut="Tous les statuts"
        annonce="Filtrer par statut"
        onChoisir={(v) => naviguer((p) => (v ? p.set('statut', v) : p.delete('statut')))}
      />

      <Choix
        valeur={params.get('type') ?? ''}
        options={Object.entries(LIBELLE_TYPE_CLIENT).map(([valeur, libelle]) => ({
          valeur,
          libelle,
        }))}
        parDefaut="Tous les types"
        annonce="Filtrer par type"
        onChoisir={(v) => naviguer((p) => (v ? p.set('type', v) : p.delete('type')))}
      />

      <span className="text-ink3 ml-auto flex h-9 items-center text-[13px] tabular-nums">
        {compteur}
      </span>

      {action}
    </div>
  )
}
