'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import { deplacerFichier } from '@/lib/actions/cv'
import { notifier } from '@/lib/toast'
import type { LigneFichier } from '@/components/cv/tableau-fichiers'

type Props = {
  fichier: LigneFichier | null
  categories: { id: string; nom: string }[]
  onFerme: () => void
}

/**
 * Reclassement d'un CV.
 *
 * Cases à cocher et non liste déroulante : les catégories sont des étiquettes,
 * un même candidat peut relever de plusieurs postes. Une liste à choix unique
 * obligerait à dupliquer le fichier — et l'on aurait deux versions divergentes
 * six mois plus tard.
 */
export function DialogueDeplacer({ fichier, categories, onFerme }: Props) {
  return (
    <Dialog open={Boolean(fichier)} onOpenChange={(o) => !o && onFerme()}>
      {/*
        `z-60` : invariant réparti avec `components/cv/apercu-cv.tsx`.

        L'aperçu plein écran se place à 60 — « modale » dans l'échelle de la
        section 19. `components/ui/dialog.tsx` vient de shadcn et pose 50, qui
        est le niveau du VOILE : sans ce relèvement, ce dialogue s'ouvre DERRIÈRE
        l'aperçu. On clique, rien ne bouge visiblement, et le focus part dans une
        fenêtre invisible. Le composant shadcn ne se modifie pas à la main ; on
        surcharge donc à l'usage.
      */}
      <ContenuDialogue className="z-60 sm:max-w-[480px]">
        {fichier && (
          /*
            La clé réinitialise l'état à chaque changement de fichier. Synchroniser
            par `useEffect` déclencherait un rendu en cascade — et c'est de toute
            façon la façon dont React veut qu'on réinitialise un état local.
          */
          <Formulaire
            key={fichier.id}
            fichier={fichier}
            categories={categories}
            onFerme={onFerme}
          />
        )}
      </ContenuDialogue>
    </Dialog>
  )
}

function Formulaire({
  fichier,
  categories,
  onFerme,
}: {
  fichier: LigneFichier
  categories: { id: string; nom: string }[]
  onFerme: () => void
}) {
  const [choisies, setChoisies] = useState<Set<string>>(
    () => new Set(fichier.categories.map((c) => c.id)),
  )
  const [enCours, demarrer] = useTransition()

  function basculer(id: string) {
    setChoisies((s) => {
      const suivante = new Set(s)
      if (suivante.has(id)) suivante.delete(id)
      else suivante.add(id)
      return suivante
    })
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await deplacerFichier({
        fichierId: fichier.id,
        categorieIds: [...choisies],
        version: fichier.version,
      })

      if (r.ok) {
        notifier.succes('Classement mis à jour.')
        onFerme()
      } else {
        // Le message de conflit de version dit quoi faire, pas ce qui a échoué :
        // « rechargez la page avant de recommencer ».
        notifier.erreur(r.erreur)
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Déplacer le fichier</DialogTitle>
        <DialogDescription>
          «&nbsp;{fichier.nom}&nbsp;» — un CV peut appartenir à plusieurs catégories.
        </DialogDescription>
      </DialogHeader>

      {categories.length === 0 ? (
        <p className="text-ink3 py-4 text-[13px]">
          Aucune catégorie n’existe encore. Créez-en une depuis «&nbsp;Catégories&nbsp;».
        </p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-0.5 overflow-auto">
          {categories.map((c) => (
            <li key={c.id}>
              <label className="hover:bg-hover flex cursor-pointer items-center gap-3 rounded-[6px] px-2 py-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={choisies.has(c.id)}
                  onChange={() => basculer(c.id)}
                  className="accent-action size-4 shrink-0"
                />
                <Tronque className="max-w-none min-w-0 flex-1">{c.nom}</Tronque>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink3 text-[13px]">
        {choisies.size === 0
          ? 'Aucune catégorie : le fichier ira dans « Non classé ».'
          : `${choisies.size} catégorie${choisies.size > 1 ? 's' : ''} sélectionnée${choisies.size > 1 ? 's' : ''}.`}
      </p>

      <DialogFooter>
        <Bouton variante="secondaire" onClick={onFerme}>
          Annuler
        </Bouton>
        <Bouton onClick={enregistrer} chargement={enCours}>
          Enregistrer
        </Bouton>
      </DialogFooter>
    </>
  )
}
