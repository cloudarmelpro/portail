'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Loader2, SlidersHorizontal } from 'lucide-react'
import { Choix } from '@/components/shared/choix'
import { ChoixDate } from '@/components/shared/choix-date'
import { LIBELLE_MODULE, MODULES } from '@/lib/permissions'
import { ENTREPRISES } from '@/config/entreprises'
import { CHAMP_FILTRE } from '@/components/shared/gabarits'

export type Auteur = { id: string; nom: string }

/**
 * Filtres du journal d'audit — ADM-4.
 *
 * Ils vivent dans l'URL plutôt que dans un état local : une vue filtrée se
 * partage, se met en signet, et c'est elle que le bouton d'export reprend.
 */
export function FiltresJournal({ auteurs }: { auteurs: Auteur[] }) {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const [enCours, demarrer] = useTransition()

  function appliquer(cle: string, valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur) suivants.set(cle, valeur)
    else suivants.delete(cle)
    // Tout changement de filtre ramène à la première page : rester en page 7
    // d'un résultat qui en compte deux afficherait une liste vide.
    suivants.delete('page')

    const requete = suivants.toString()
    demarrer(() => router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false }))
  }

  const sensible = params.get('sensible') === '1'

  /*
    36 px, la mesure du bouton du produit : les neuf contrôles, le compte et
    l'export partagent une seule rangée, et une hauteur de plus la ferait onduler
    au repli.
  */
  const classeChamp = CHAMP_FILTRE

  return (
    /*
      DEUX rangées déclarées, pas un repli laissé au hasard de la largeur.

      En haut, ce qu'on choisit dans une liste fermée : qui, quel module, quelle
      entreprise. En bas, ce qu'on écrit ou ce qu'on date. Le repli automatique
      coupait le groupe n'importe où selon la fenêtre — les dates se retrouvaient
      seules une fois, mêlées aux recherches la fois suivante, et « Du » n'était
      jamais aligné avec « Au ».
    */
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="text-ink3 size-4" aria-hidden />

        <Choix
          valeur={params.get('utilisateur') ?? ''}
          options={auteurs.map((a) => ({ valeur: a.id, libelle: a.nom }))}
          parDefaut="Tous les utilisateurs"
          annonce="Filtrer par utilisateur"
          onChoisir={(v) => appliquer('utilisateur', v)}
        />

        {/* Les axes ci-dessous complètent ADM-4 : le journal affichait six
          colonnes et n'en filtrait que deux. */}
        <Choix
          valeur={params.get('module') ?? ''}
          options={MODULES.map((m) => ({ valeur: m, libelle: LIBELLE_MODULE[m] }))}
          parDefaut="Tous les modules"
          annonce="Filtrer par module"
          onChoisir={(v) => appliquer('module', v)}
        />

        <Choix
          valeur={params.get('entreprise') ?? ''}
          options={ENTREPRISES.map((e) => ({ valeur: e.slug, libelle: e.nom }))}
          parDefaut="Toutes les entreprises"
          annonce="Filtrer par entreprise"
          onChoisir={(v) => appliquer('entreprise', v)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          defaultValue={params.get('action') ?? ''}
          onChange={(e) => appliquer('action', e.target.value.trim() || null)}
          placeholder="Action"
          aria-label="Filtrer par action"
          className={`${classeChamp} w-[150px]`}
        />

        <input
          type="search"
          defaultValue={params.get('entite') ?? ''}
          onChange={(e) => appliquer('entite', e.target.value.trim() || null)}
          placeholder="Élément"
          aria-label="Filtrer par élément concerné"
          className={`${classeChamp} w-[170px]`}
        />

        <input
          type="search"
          defaultValue={params.get('ip') ?? ''}
          onChange={(e) => appliquer('ip', e.target.value.trim() || null)}
          placeholder="Adresse IP"
          aria-label="Filtrer par adresse IP"
          className={`${classeChamp} w-[140px] tabular-nums`}
        />

        <ChoixDate
          valeur={params.get('du') ?? ''}
          etiquette="Date de début"
          onChoisir={(iso) => appliquer('du', iso)}
        />

        <ChoixDate
          valeur={params.get('au') ?? ''}
          etiquette="Date de fin"
          onChoisir={(iso) => appliquer('au', iso)}
        />

        {/*
          Le filtre le plus utile des quatre : c'est celui qu'on ouvre quand on
          cherche quelque chose de précis. Il reste donc distinct des listes par
          sa forme d'interrupteur — mais il prend le rayon des autres contrôles,
          la pilule le faisant lire comme une étiquette plutôt qu'un bouton.
        */}
        <button
          onClick={() => appliquer('sensible', sensible ? null : '1')}
          aria-pressed={sensible}
          className={
            sensible
              ? 'border-border-strong text-ink inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-medium'
              : 'border-border text-ink2 hover:bg-hover inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px]'
          }
        >
          <AlertTriangle className="size-4" aria-hidden />
          Actions sensibles
        </button>

        {enCours && <Loader2 className="text-ink3 size-4 animate-spin" aria-hidden />}
      </div>
    </div>
  )
}
