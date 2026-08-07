'use client'

import { useState, useTransition } from 'react'
import { Bouton } from '@/components/shared/bouton'
import { ChoixDate } from '@/components/shared/choix-date'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { planifierRelance } from '@/lib/actions/crm'
import { notifier } from '@/lib/toast'

type Props = {
  entreprise: string
  clientId: string
  /** Dernière interaction : c'est elle qui porte la relance courante. */
  interaction: {
    id: string
    version: number
    prochaineAction: string
    prochaineActionLe: string
  } | null
}

/**
 * Report ou annulation de la relance en cours.
 *
 * La date vit sur la dernière interaction, jamais sur le client — voir la note
 * d'en-tête de `lib/data/crm.ts`. Sans interaction, il n'y a rien à reporter :
 * la carte renvoie alors vers le formulaire d'ajout plutôt que d'offrir un
 * champ qui n'irait nulle part.
 */
export function CarteRelance({ entreprise, clientId, interaction }: Props) {
  const [action, setAction] = useState(interaction?.prochaineAction ?? '')
  const [date, setDate] = useState(interaction?.prochaineActionLe ?? '')
  const [enCours, demarrer] = useTransition()

  if (!interaction) {
    return (
      <div className="border-border bg-surface rounded-[10px] border p-5">
        <h3 className="text-[17px] leading-6 font-semibold">Prochaine relance</h3>
        <p className="text-ink3 mt-3 text-[13px] leading-[18px]">
          Ajoutez une première interaction pour planifier une relance.
        </p>
      </div>
    )
  }

  const courante = interaction
  const inchange = action === courante.prochaineAction && date === courante.prochaineActionLe

  function enregistrer() {
    demarrer(async () => {
      const r = await planifierRelance({
        entreprise,
        clientId,
        interactionId: courante.id,
        version: courante.version,
        prochaineAction: action,
        prochaineActionLe: date,
      })

      if (r.ok) {
        notifier.succes('Relance mise à jour.')
      } else {
        notifier.erreur(r.erreur)
      }
    })
  }

  return (
    <div className="border-border bg-surface rounded-[10px] border p-5">
      <h3 className="text-[17px] leading-6 font-semibold">Prochaine relance</h3>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="relanceAction" className="text-[13px] leading-[18px] font-medium">
            Prochaine action
          </Label>
          <Input
            id="relanceAction"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Relance téléphonique"
            className="h-10 rounded-[6px] text-[15px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="relanceDate" className="text-[13px] leading-[18px] font-medium">
            Le
          </Label>
          <ChoixDate
            id="relanceDate"
            valeur={date}
            etiquette="Choisir une date"
            champ
            onChoisir={(v) => setDate(v ?? '')}
          />
        </div>

        <Bouton
          type="button"
          variante="secondaire"
          onClick={enregistrer}
          disabled={inchange}
          chargement={enCours}
        >
          Enregistrer
        </Bouton>
      </div>
    </div>
  )
}
