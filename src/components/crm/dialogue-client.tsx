'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { TypeClient } from '@/generated/prisma/client'
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
import { creerClient, modifierClient } from '@/lib/actions/crm'
import { creerClientSchema, modifierClientSchema } from '@/lib/validations/crm'
import { LIBELLE_TYPE_CLIENT } from '@/config/crm'
import { notifier } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CHAMP, ZONE_TEXTE } from '@/components/shared/gabarits'

export type ClientModifiable = {
  id: string
  version: number
  type: TypeClient
  nom: string
  personneRessource: string | null
  courriel: string | null
  telephone: string | null
  adresse: string | null
  provenance: string | null
  notes: string | null
}

const TYPES = Object.entries(LIBELLE_TYPE_CLIENT).map(([valeur, libelle]) => ({
  valeur,
  libelle,
}))

/** CRM-3 — création et modification d'une fiche partagent le même formulaire. */
export function DialogueClient({
  entreprise,
  client,
}: {
  entreprise: string
  client?: ClientModifiable
}) {
  const [ouvert, setOuvert] = useState(false)
  const modification = Boolean(client)

  return (
    <>
      <Bouton
        onClick={() => setOuvert(true)}
        variante={modification ? 'secondaire' : 'principale'}
        taille={modification ? 'sm' : 'md'}
      >
        {modification ? (
          <Pencil className="size-3.5" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        )}
        {modification ? 'Modifier' : 'Nouveau client'}
      </Bouton>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <ContenuDialogue className="sm:max-w-[560px]">
          {/* La clé repart d'un formulaire neuf à chaque ouverture. */}
          {ouvert && (
            <Formulaire
              key={client?.version ?? 'nouveau'}
              entreprise={entreprise}
              client={client}
              onFerme={() => setOuvert(false)}
            />
          )}
        </ContenuDialogue>
      </Dialog>
    </>
  )
}

function Formulaire({
  entreprise,
  client,
  onFerme,
}: {
  entreprise: string
  client?: ClientModifiable
  onFerme: () => void
}) {
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [type, setType] = useState<string>(client?.type ?? 'particulier')
  const [enCours, demarrer] = useTransition()

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const f = new FormData(evenement.currentTarget)

    const brut = {
      entreprise,
      type,
      nom: f.get('nom'),
      personneRessource: f.get('personneRessource'),
      courriel: f.get('courriel'),
      telephone: f.get('telephone'),
      adresse: f.get('adresse'),
      provenance: f.get('provenance'),
      notes: f.get('notes'),
      ...(client && { clientId: client.id, version: client.version }),
    }

    const analyse = client
      ? modifierClientSchema.safeParse(brut)
      : creerClientSchema.safeParse(brut)

    if (!analyse.success) {
      const champs: Record<string, string> = {}
      for (const p of analyse.error.issues) champs[String(p.path[0])] = p.message
      setErreurs(champs)
      return
    }

    setErreurs({})
    demarrer(async () => {
      const r = client ? await modifierClient(analyse.data) : await creerClient(analyse.data)

      if (r.ok) {
        notifier.succes(client ? 'Fiche mise à jour.' : 'Client ajouté.')
        onFerme()
        return
      }

      if (r.champs) {
        const champs: Record<string, string> = {}
        for (const [cle, messages] of Object.entries(r.champs)) champs[cle] = messages[0] ?? ''
        setErreurs(champs)
      }
      notifier.erreur(r.erreur)
    })
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <DialogHeader>
        <DialogTitle>{client ? 'Modifier la fiche' : 'Nouveau client'}</DialogTitle>
        <DialogDescription>
          Le nom et le type suffisent pour commencer&nbsp;; le reste se complète au fil des
          échanges.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Champ id="nom" libelle="Nom" erreur={erreurs.nom} large>
          <input
            id="nom"
            name="nom"
            defaultValue={client?.nom ?? ''}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(erreurs.nom)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="type" libelle="Type" erreur={erreurs.type}>
          {/*
            Hors de `FormData`, comme tous les contrôles dessinés : la valeur est
            tenue en état et lue à la soumission.
          */}
          <Choix
            id="type"
            valeur={type}
            options={TYPES}
            champ
            onChoisir={(v) => setType(v ?? '')}
          />
        </Champ>

        <Champ
          id="personneRessource"
          libelle="Personne-ressource"
          erreur={erreurs.personneRessource}
        >
          <input
            id="personneRessource"
            name="personneRessource"
            defaultValue={client?.personneRessource ?? ''}
            autoComplete="off"
            aria-invalid={Boolean(erreurs.personneRessource)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="courriel" libelle="Courriel" erreur={erreurs.courriel}>
          <input
            id="courriel"
            name="courriel"
            type="email"
            defaultValue={client?.courriel ?? ''}
            autoComplete="off"
            aria-invalid={Boolean(erreurs.courriel)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="telephone" libelle="Téléphone" erreur={erreurs.telephone}>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            defaultValue={client?.telephone ?? ''}
            placeholder="418 555-0123"
            autoComplete="off"
            aria-invalid={Boolean(erreurs.telephone)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="adresse" libelle="Adresse" erreur={erreurs.adresse} large>
          <input
            id="adresse"
            name="adresse"
            defaultValue={client?.adresse ?? ''}
            autoComplete="off"
            aria-invalid={Boolean(erreurs.adresse)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="provenance" libelle="Provenance du contact" erreur={erreurs.provenance} large>
          <input
            id="provenance"
            name="provenance"
            defaultValue={client?.provenance ?? ''}
            autoComplete="off"
            aria-invalid={Boolean(erreurs.provenance)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="notes" libelle="Notes" erreur={erreurs.notes} large>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={client?.notes ?? ''}
            aria-invalid={Boolean(erreurs.notes)}
            className={ZONE_TEXTE}
          />
        </Champ>
      </div>

      <DialogFooter className="mt-5">
        <Bouton type="button" variante="secondaire" onClick={onFerme}>
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
  erreur,
  large = false,
  children,
}: {
  id: string
  libelle: string
  erreur?: string
  large?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', large && 'sm:col-span-2')}>
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
        {libelle}
      </label>
      {children}
      {erreur && (
        <p role="alert" className="text-critical-texte text-[13px] leading-[18px]">
          {erreur}
        </p>
      )}
    </div>
  )
}
