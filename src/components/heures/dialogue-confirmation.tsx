'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ZONE_TEXTE } from '@/components/shared/gabarits'

export type Confirmation = {
  titre: string
  corps: string
  /** Verbe à l'infinitif — jamais « OK ». */
  libelle: string
  danger?: boolean
  /** Ouvre un champ de motif, exigé avant de pouvoir confirmer. */
  motifRequis?: boolean
  confirmer: (motif: string) => void
}

type Props = {
  confirmation: Confirmation | null
  enCours: boolean
  onFermer: () => void
}

/**
 * Confirmation du module — remontera dans `components/shared/` au deuxième
 * usage réel, pas avant.
 */
export function DialogueConfirmation({ confirmation, enCours, onFermer }: Props) {
  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={(o) => !o && onFermer()}>
      <ContenuDialogue className="sm:max-w-[480px]">
        {confirmation && (
          <Corps
            key={confirmation.titre}
            confirmation={confirmation}
            enCours={enCours}
            onFermer={onFermer}
          />
        )}
      </ContenuDialogue>
    </Dialog>
  )
}

function Corps({ confirmation, enCours, onFermer }: Props & { confirmation: Confirmation }) {
  const [motif, setMotif] = useState('')
  const motifManquant = Boolean(confirmation.motifRequis) && motif.trim().length < 5

  return (
    <>
      <DialogHeader>
        <DialogTitle>{confirmation.titre}</DialogTitle>
        <DialogDescription>{confirmation.corps}</DialogDescription>
      </DialogHeader>

      {confirmation.motifRequis && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="motif-correction">Motif de la correction</Label>
          <Textarea
            id="motif-correction"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            autoFocus
            className={ZONE_TEXTE}
          />
        </div>
      )}

      <DialogFooter>
        <Bouton type="button" variante="secondaire" onClick={onFermer}>
          Annuler
        </Bouton>
        <Bouton
          type="button"
          variante={confirmation.danger ? 'destructive' : 'principale'}
          onClick={() => confirmation.confirmer(motif.trim())}
          disabled={motifManquant}
          chargement={enCours}
        >
          {confirmation.libelle}
        </Bouton>
      </DialogFooter>
    </>
  )
}
