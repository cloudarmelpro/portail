'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Choix } from '@/components/shared/choix'
import { ENTREPRISES } from '@/config/entreprises'
import { creerEmploye, modifierEmploye } from '@/lib/actions/heures'
import { formaterDecimal } from '@/lib/domaine/heures'
import { notifier } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CHAMP } from '@/components/shared/gabarits'

const ENTREPRISES_OPTIONS = ENTREPRISES.map((e) => ({ valeur: e.slug, libelle: e.nom }))

function heureCourante(): string {
  const d = new Date()
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

export type EmployeFiche = {
  id: string
  nom: string
  entrepriseSlug: string
  tauxCents: number | null
  actif: boolean
  notes: string | null
  version: number
}

/** Fiche d'employé — exigence HEU-1 : nom, rattachement, taux, statut. */
export function BoutonNouvelEmploye() {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      <Bouton type="button" onClick={() => setOuvert(true)}>
        <Plus className="size-4" aria-hidden />
        Nouvel employé
      </Bouton>
      <Dialogue employe={null} ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  )
}

export function BoutonModifierEmploye({ employe }: { employe: EmployeFiche }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      <Bouton type="button" variante="secondaire" taille="sm" onClick={() => setOuvert(true)}>
        <Pencil className="size-3.5" aria-hidden />
        Modifier
      </Bouton>
      <Dialogue employe={employe} ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  )
}

function Dialogue({
  employe,
  ouvert,
  onFermer,
}: {
  employe: EmployeFiche | null
  ouvert: boolean
  onFermer: () => void
}) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <ContenuDialogue className="sm:max-w-[480px]">
        {/* La clé réinitialise le formulaire à chaque ouverture. */}
        {ouvert && (
          <Formulaire key={employe?.version ?? 'nouveau'} employe={employe} onFermer={onFermer} />
        )}
      </ContenuDialogue>
    </Dialog>
  )
}

function Formulaire({ employe, onFermer }: { employe: EmployeFiche | null; onFermer: () => void }) {
  const [nom, setNom] = useState(employe?.nom ?? '')
  const [entrepriseSlug, setEntrepriseSlug] = useState(
    employe?.entrepriseSlug ?? ENTREPRISES[0].slug,
  )
  const [taux, setTaux] = useState(
    employe?.tauxCents === null || employe === null ? '' : formaterDecimal(employe.tauxCents),
  )
  const [actif, setActif] = useState(employe?.actif ?? true)
  const [notes, setNotes] = useState(employe?.notes ?? '')
  const [enCours, demarrer] = useTransition()

  function enregistrer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()

    const commun = {
      nom,
      entrepriseSlug,
      // Vide veut dire « taux inconnu », pas « taux nul » : seules les heures
      // seront alors totalisées (HEU-8).
      tauxHoraire: taux.trim() === '' ? null : taux,
      actif,
      notes: notes.trim() === '' ? null : notes,
    }

    demarrer(async () => {
      const r = employe
        ? await modifierEmploye({ ...commun, employeId: employe.id, version: employe.version })
        : await creerEmploye(commun)

      if (!r.ok) {
        notifier.erreur(r.erreur)
        return
      }

      notifier.succes(`Enregistré à ${heureCourante()}`)
      onFermer()
    })
  }

  return (
    <form onSubmit={enregistrer} noValidate>
      <DialogHeader>
        <DialogTitle>{employe ? 'Modifier la fiche' : 'Nouvel employé'}</DialogTitle>
        <DialogDescription>
          Le taux horaire est facultatif&nbsp;: sans lui, seules les heures sont totalisées.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Champ id="employe-nom" libelle="Nom" large>
          <input
            id="employe-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="off"
            autoFocus
            className={CHAMP}
          />
        </Champ>

        <Champ id="employe-entreprise" libelle="Entreprise">
          {/*
            Hors de `FormData`, comme tous les contrôles dessinés : la valeur est
            tenue en état et lue à la soumission. Aucun `parDefaut` — une fiche
            est toujours rattachée à l'une des trois entreprises, il n'y a pas
            d'entrée vide à proposer.
          */}
          <Choix
            id="employe-entreprise"
            valeur={entrepriseSlug}
            options={ENTREPRISES_OPTIONS}
            champ
            onChoisir={(v) => setEntrepriseSlug(v ?? ENTREPRISES[0].slug)}
          />
        </Champ>

        <Champ id="employe-taux" libelle="Taux horaire">
          <input
            id="employe-taux"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            inputMode="decimal"
            placeholder="22,50"
            autoComplete="off"
            className={cn(CHAMP, 'tabular-nums')}
          />
        </Champ>

        <Champ id="employe-notes" libelle="Notes" large>
          <textarea
            id="employe-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="border-border bg-surface placeholder:text-ink3 w-full resize-none rounded-[6px] border px-3 py-2 text-[15px] leading-[22px]"
          />
        </Champ>

        {/*
          Le statut n'est pas un champ de saisie : il tient sur une case, et lui
          donner l'étiquette et la hauteur des autres l'aurait fait passer pour
          une valeur à remplir.
        */}
        <label className="flex items-center gap-3 text-[15px] sm:col-span-2">
          <input
            type="checkbox"
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
            className="accent-action size-4 shrink-0"
          />
          Actif
        </label>
      </div>

      <DialogFooter className="mt-5">
        <Bouton type="button" variante="secondaire" onClick={onFermer}>
          Annuler
        </Bouton>
        <Bouton type="submit" chargement={enCours}>
          Enregistrer
        </Bouton>
      </DialogFooter>
    </form>
  )
}

function Champ({
  id,
  libelle,
  large = false,
  children,
}: {
  id: string
  libelle: string
  large?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', large && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
        {libelle}
      </label>
      {children}
    </div>
  )
}
