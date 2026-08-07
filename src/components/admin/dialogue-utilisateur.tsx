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
import { Choix } from '@/components/shared/choix'
import { changerRole, inviterUtilisateur, modifierUtilisateur } from '@/lib/actions/admin'
import { notifier } from '@/lib/toast'
import { LIBELLE_ROLE, ROLES, type Role } from '@/lib/permissions'
import { CHAMP } from '@/components/shared/gabarits'

const OPTIONS_ROLE = ROLES.map((r) => ({ valeur: r, libelle: LIBELLE_ROLE[r] }))

export type CompteAModifier = {
  id: string
  nom: string
  courriel: string
  role: Role | null
}

type Props = {
  /** Compte existant, ou `null` pour une invitation. */
  compte?: CompteAModifier | null
  ouvert?: boolean
  onFerme?: () => void
}

/**
 * Invitation et modification d'un compte.
 *
 * Sans `compte`, le composant rend son propre bouton d'ouverture — c'est le seul
 * bouton noir de l'écran des utilisateurs.
 */
export function DialogueUtilisateur({ compte = null, ouvert, onFerme }: Props) {
  const [interne, setInterne] = useState(false)
  const controle = ouvert !== undefined

  const affiche = controle ? ouvert : interne
  const fermer = () => (controle ? onFerme?.() : setInterne(false))

  return (
    <>
      {!controle && <Bouton onClick={() => setInterne(true)}>Nouvel utilisateur</Bouton>}

      <Dialog open={affiche} onOpenChange={(o) => !o && fermer()}>
        <ContenuDialogue className="sm:max-w-120">
          {affiche && (
            /* La clé réinitialise l'état quand on passe d'un compte à l'autre. */
            <Formulaire key={compte?.id ?? 'invitation'} compte={compte} onFerme={fermer} />
          )}
        </ContenuDialogue>
      </Dialog>
    </>
  )
}

function Formulaire({ compte, onFerme }: { compte: CompteAModifier | null; onFerme: () => void }) {
  const [nom, setNom] = useState(compte?.nom ?? '')
  const [courriel, setCourriel] = useState(compte?.courriel ?? '')
  const [role, setRole] = useState<Role>(compte?.role ?? 'recrutement')
  const [champs, setChamps] = useState<Record<string, string[]>>({})
  const [enCours, demarrer] = useTransition()

  const modification = compte !== null

  function envoyer() {
    setChamps({})

    demarrer(async () => {
      if (!modification) {
        const r = await inviterUtilisateur({ nom, courriel, role })
        if (!r.ok) {
          setChamps(r.champs ?? {})
          notifier.erreur(r.erreur)
          return
        }
        notifier.succes(`Invitation envoyée à ${courriel}.`)
        onFerme()
        return
      }

      const r = await modifierUtilisateur({ userId: compte.id, nom, courriel })
      if (!r.ok) {
        setChamps(r.champs ?? {})
        notifier.erreur(r.erreur)
        return
      }

      /**
       * Le rôle est changé par une action distincte, marquée sensible : le
       * journal doit pouvoir répondre à « qui a donné quel droit, et quand »
       * sans avoir à déduire quoi que ce soit d'une modification de fiche.
       */
      if (role !== compte.role) {
        const rr = await changerRole({ courriel, role })
        if (!rr.ok) {
          notifier.erreur(rr.erreur)
          return
        }
      }

      notifier.succes('Compte mis à jour.')
      onFerme()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{modification ? 'Modifier le compte' : 'Inviter un utilisateur'}</DialogTitle>
        <DialogDescription>
          {modification
            ? 'Le mot de passe n’est jamais modifiable ici : l’utilisateur choisit le sien.'
            : 'L’utilisateur reçoit un courriel et choisit lui-même son mot de passe.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Champ id="nom" libelle="Nom" erreurs={champs.nom}>
          <input
            id="nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="off"
            className={CHAMP}
          />
        </Champ>

        <Champ id="courriel" libelle="Courriel" erreurs={champs.courriel}>
          <input
            id="courriel"
            type="email"
            value={courriel}
            onChange={(e) => setCourriel(e.target.value)}
            autoComplete="off"
            className={CHAMP}
          />
        </Champ>

        <Champ id="role" libelle="Rôle" erreurs={champs.role}>
          {/*
            Hors de `FormData`, comme tous les contrôles dessinés : la valeur est
            tenue en état et lue à la soumission.
          */}
          <Choix
            id="role"
            valeur={role}
            options={OPTIONS_ROLE}
            champ
            onChoisir={(v) => v && setRole(v as Role)}
          />
        </Champ>
      </div>

      <DialogFooter>
        <Bouton variante="secondaire" onClick={onFerme}>
          Annuler
        </Bouton>
        <Bouton onClick={envoyer} chargement={enCours}>
          {modification ? 'Enregistrer' : 'Envoyer l’invitation'}
        </Bouton>
      </DialogFooter>
    </>
  )
}

/**
 * L'étiquette désigne son champ par `htmlFor` et non en l'enveloppant : le
 * déclencheur du `Choix` est un `<button>`, que `<label>` ne sait pas étiqueter
 * implicitement — le champ « Rôle » se serait retrouvé sans nom accessible.
 */
function Champ({
  id,
  libelle,
  erreurs,
  children,
}: {
  id: string
  libelle: string
  erreurs?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
        {libelle}
      </label>
      {children}
      {/*
        `role="alert"` : sans lui, un refus de validation n'est annoncé nulle
        part. À la soumission d'une invitation refusée, un lecteur d'écran
        restait muet — le seul module du produit dans ce cas.
      */}
      {erreurs?.map((e) => (
        <p key={e} role="alert" className="text-critical-texte text-[13px] leading-[18px]">
          {e}
        </p>
      ))}
    </div>
  )
}
