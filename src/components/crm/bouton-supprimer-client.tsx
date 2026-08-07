'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { supprimerClient } from '@/lib/actions/crm'
import { notifier } from '@/lib/toast'

/**
 * CRM-7 — suppression réversible.
 *
 * La fiche disparaît des listes mais reste en base, avec toute sa chronologie.
 * L'onglet « Fiches supprimées » du dossier la remet exactement où elle était.
 */
export function BoutonSupprimerClient({
  entreprise,
  clientId,
  nom,
}: {
  entreprise: string
  clientId: string
  nom: string
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, demarrer] = useTransition()

  function confirmer() {
    demarrer(async () => {
      const r = await supprimerClient({ entreprise, clientId })
      if (r.ok) {
        notifier.succes(`« ${nom} » a été supprimé.`)
        setOuvert(false)
        router.replace(`/crm/${entreprise}/clients`)
      } else {
        notifier.erreur(r.erreur)
      }
    })
  }

  return (
    <>
      {/* Aucune surcharge de taille : `Bouton` porte le gabarit du produit, et
          chaque mesure recopiée sur un écran est une occasion de plus de
          diverger. */}
      <Bouton
        variante="destructive"
        onClick={() => setOuvert(true)}
        aria-label={`Supprimer la fiche de ${nom}`}
      >
        <Trash2 className="size-4" aria-hidden />
        Supprimer
      </Bouton>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <ContenuDialogue className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Supprimer cette fiche&nbsp;?</DialogTitle>
            <DialogDescription>
              «&nbsp;{nom}&nbsp;» n’apparaîtra plus dans la liste. La fiche et son historique
              restent conservés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Bouton type="button" variante="secondaire" onClick={() => setOuvert(false)}>
              Annuler
            </Bouton>
            <Bouton type="button" variante="destructive" onClick={confirmer} chargement={enCours}>
              Supprimer
            </Bouton>
          </DialogFooter>
        </ContenuDialogue>
      </Dialog>
    </>
  )
}
