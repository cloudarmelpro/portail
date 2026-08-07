'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Bouton } from '@/components/shared/bouton'
import { Choix } from '@/components/shared/choix'
import { ChoixDate } from '@/components/shared/choix-date'
import { ajouterInteraction } from '@/lib/actions/crm'
import { ajouterInteractionSchema } from '@/lib/validations/crm'
import { LIBELLE_TYPE_INTERACTION } from '@/config/crm'
import { notifier } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CHAMP } from '@/components/shared/gabarits'

/**
 * CRM-4 — ajout rapide d'une interaction depuis la fiche.
 *
 * `aujourdhui` vient du serveur : calculée dans le navigateur, la date par
 * défaut serait celle du poste de l'utilisateur, qui n'est pas forcément à
 * l'heure du Québec.
 *
 * Consigner une interaction remplace le plan de relance précédent — voir la
 * note d'en-tête de `lib/data/crm.ts`. C'est pour cela que la prochaine action
 * se saisit ici, dans le même geste.
 */

const TYPES = Object.entries(LIBELLE_TYPE_INTERACTION).map(([valeur, libelle]) => ({
  valeur,
  libelle,
}))

export function FormulaireInteraction({
  entreprise,
  clientId,
  aujourdhui,
}: {
  entreprise: string
  clientId: string
  aujourdhui: string
}) {
  const formulaire = useRef<HTMLFormElement>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [enCours, demarrer] = useTransition()

  /*
    Le menu et les deux calendriers ne sont pas des contrôles natifs : ils ne
    déposent rien dans `FormData`. Leur valeur est donc tenue ici, et le
    `reset()` du formulaire — qui ne les touche pas non plus — est doublé d'un
    retour explicite aux valeurs de départ.
  */
  const [type, setType] = useState('appel')
  const [date, setDate] = useState(aujourdhui)
  const [prochaineActionLe, setProchaineActionLe] = useState('')

  function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const f = new FormData(evenement.currentTarget)

    const analyse = ajouterInteractionSchema.safeParse({
      entreprise,
      clientId,
      type,
      date,
      resume: f.get('resume'),
      prochaineAction: f.get('prochaineAction'),
      prochaineActionLe,
    })

    if (!analyse.success) {
      const champs: Record<string, string> = {}
      for (const p of analyse.error.issues) champs[String(p.path[0])] = p.message
      setErreurs(champs)
      return
    }

    setErreurs({})
    demarrer(async () => {
      const r = await ajouterInteraction(analyse.data)
      if (r.ok) {
        notifier.succes('Interaction ajoutée.')
        formulaire.current?.reset()
        setType('appel')
        setDate(aujourdhui)
        setProchaineActionLe('')
        setErreurs({})
      } else {
        notifier.erreur(r.erreur)
      }
    })
  }

  return (
    <form ref={formulaire} onSubmit={soumettre} noValidate className="mt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id="type" libelle="Type d’interaction" erreur={erreurs.type}>
          <Choix
            id="type"
            valeur={type}
            options={TYPES}
            champ
            onChoisir={(v) => setType(v ?? '')}
          />
        </Champ>

        <Champ id="date" libelle="Date de l’interaction" erreur={erreurs.date}>
          {/*
            Obligatoire : pas de « Retirer la date ». Un formulaire qui refuse
            une valeur ne doit pas offrir de l'effacer.
          */}
          <ChoixDate
            id="date"
            valeur={date}
            etiquette="Choisir une date"
            champ
            effacable={false}
            onChoisir={(v) => setDate(v ?? '')}
          />
        </Champ>

        <Champ id="resume" libelle="Résumé" erreur={erreurs.resume} large>
          <input
            id="resume"
            name="resume"
            placeholder="Ce qui a été dit ou fait…"
            aria-invalid={Boolean(erreurs.resume)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="prochaineAction" libelle="Prochaine action" erreur={erreurs.prochaineAction}>
          <input
            id="prochaineAction"
            name="prochaineAction"
            placeholder="Relance téléphonique"
            aria-invalid={Boolean(erreurs.prochaineAction)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="prochaineActionLe" libelle="Le" erreur={erreurs.prochaineActionLe}>
          <ChoixDate
            id="prochaineActionLe"
            valeur={prochaineActionLe}
            etiquette="Choisir une date"
            champ
            onChoisir={(v) => setProchaineActionLe(v ?? '')}
          />
        </Champ>
      </div>

      <div className="mt-5">
        <Bouton type="submit" variante="secondaire" chargement={enCours}>
          {!enCours && <Plus className="size-4" aria-hidden />}
          Ajouter
        </Bouton>
      </div>
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
  /** Occupe les deux colonnes : le résumé est la seule saisie longue du lot. */
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
