'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Bouton } from '@/components/shared/bouton'
import { CHAMP_FILTRE } from '@/components/shared/gabarits'
import { cn } from '@/lib/utils'

/**
 * Recherche dans la liste des comptes — ADM-1.
 *
 * Le terme est écrit dans l'URL, jamais dans un état local : une vue filtrée se
 * partage, se met en signet et survit à un rechargement.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Recherche EXPLICITE, contrairement à celle du CRM.
 *
 * Le CRM navigue tout seul, 300 ms après la dernière frappe. Ici un bouton la
 * déclenche : les deux ensemble se marcheraient dessus — la temporisation
 * partirait pendant qu'on vise le bouton, et le clic relancerait une navigation
 * déjà en cours. Un bouton qui ne sert à rien la moitié du temps est pire que
 * pas de bouton du tout.
 *
 * C'est le FORMULAIRE qui porte la soumission : la touche entrée fonctionne
 * sans qu'on ait à l'écouter, et le bouton n'a besoin d'aucun gestionnaire.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function RechercheUtilisateurs() {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const [enCours, demarrer] = useTransition()

  const dansUrl = params.get('q') ?? ''
  const [saisie, setSaisie] = useState(dansUrl)

  /*
    Le champ suit l'URL quand elle change SANS lui — retour arrière du
    navigateur, lien, signet. Ajusté pendant le rendu et non dans un effet : un
    effet aurait laissé afficher l'ancien terme le temps d'une image, alors que
    React réexécute ce rendu-ci avant de peindre quoi que ce soit.
  */
  const [urlVue, setUrlVue] = useState(dansUrl)
  if (urlVue !== dansUrl) {
    setUrlVue(dansUrl)
    setSaisie(dansUrl)
  }

  function chercher(evenement: React.FormEvent) {
    evenement.preventDefault()

    const terme = saisie.trim()
    const suivants = new URLSearchParams(params)
    if (terme) suivants.set('q', terme)
    else suivants.delete('q')

    const requete = suivants.toString()
    demarrer(() => {
      // `replace` et non `push` : chercher trois fois de suite ne doit pas
      // obliger à appuyer trois fois sur retour pour quitter l'écran.
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false })
    })
  }

  return (
    <form onSubmit={chercher} className="flex w-full items-end gap-2 sm:w-auto">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-90 sm:min-w-55 sm:flex-none">
        {/*
          Le libellé est AU-DESSUS du champ, et il est VISIBLE : il l'était
          auparavant pour les seuls lecteurs d'écran, en `aria-label`. Un
          remplaçant ne dit pas la même chose qu'un nom — « Nom ou courriel »
          dit ce qu'on peut taper, pas ce qu'on cherche — et il disparaît dès
          la première frappe, quand le champ se remplit.
        */}
        <label htmlFor="recherche-utilisateur" className="text-ink3 text-[13px] leading-[18px]">
          Rechercher un utilisateur
        </label>
        <input
          id="recherche-utilisateur"
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Nom ou courriel"
          /*
            La croix de `type="search"` est retirée : elle vide le champ sans
            relancer la recherche, et laissait donc un champ vierge au-dessus
            d'une liste toujours filtrée — deux affirmations contradictoires à
            l'écran. Vider soi-même puis soumettre reste possible, et dit la
            vérité.

            Le type reste `search` : il porte la sémantique, et c'est lui qui
            fait proposer l'historique de recherche du navigateur.
          */
          /*
            Les plafonds de largeur sont passés sur l'enveloppe, qui porte
            désormais le libellé en plus du champ : les laisser ici aurait
            plafonné le champ sans plafonner le mot au-dessus.

            `min-w-0` sur téléphone : un plancher de 220 px plus le bouton
            dépassaient d'un écran de 320 px, et le bouton sortait du cadre.

            Même hauteur que le bouton qui le suit. Un champ et son bouton côte
            à côte à deux hauteurs différentes se voient immédiatement, et il
            n'y a pas de bonne façon de les aligner ensuite.
          */
          className={cn(CHAMP_FILTRE, 'w-full min-w-0')}
        />
      </div>

      {/*
        Aucune surcharge de taille : `Bouton` porte le gabarit du produit, et
        chaque `className` de hauteur recopiée sur un écran est une occasion de
        plus de diverger.
      */}
      <Bouton type="submit" variante="secondaire" chargement={enCours}>
        {/*
          L'icône s'efface pendant l'attente : `Bouton` pose le témoin à sa
          place, et deux ronds côte à côte diraient deux fois la même chose.
        */}
        {!enCours && <Search className="size-4" aria-hidden />}
        Rechercher
      </Bouton>
    </form>
  )
}
