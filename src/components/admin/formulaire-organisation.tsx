'use client'

import { useState, useTransition } from 'react'
import { Bouton } from '@/components/shared/bouton'
import { enregistrerOrganisationAction } from '@/lib/actions/admin'
import { notifier } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { EntrepriseSlug } from '@/config/entreprises'
import { CHAMP } from '@/components/shared/gabarits'

type Props = {
  entreprise: EntrepriseSlug
  raisonSociale: string
  adresse: string
  telephone: string
  version: number
}

/**
 * Coordonnées portées par le document remis au client — EST-10.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elles étaient codées en dur, et inventées.
 *
 * Trois raisons sociales déduites d'un prénom, la même adresse pour les trois,
 * des numéros en « 555 » — la plage réservée à la fiction. Rien ne
 * les signalait, et elles s'imprimaient en en-tête d'une estimation envoyée à de
 * vrais clients.
 *
 * Une saisie PAR ENTREPRISE : Paysagement, Développement web et Staff
 * augmentation sont trois entreprises distinctes, trois dossiers séparés dès le
 * départ. Chacune a donc sa raison sociale, son adresse et son téléphone.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function FormulaireOrganisation({
  entreprise,
  raisonSociale,
  adresse,
  telephone,
  version,
}: Props) {
  const [valeurs, setValeurs] = useState({ raisonSociale, adresse, telephone })
  const [champs, setChamps] = useState<Record<string, string[]>>({})
  const [enCours, demarrer] = useTransition()

  /*
    Remise à niveau après enregistrement, ajustée PENDANT le rendu — le patron
    React, pas un effet, qui ferait clignoter les champs le temps d'un tour.

    La revalidation de l'action renvoie les valeurs telles que la base les a
    retenues,
    espaces de bord retirés. L'état, lui, gardait la frappe : on lisait à l'écran
    autre chose que ce qui était enregistré, et le logo — qui partage cette même
    colonne `version` — pouvait faire remonter des coordonnées périmées.

    La version change à chaque enregistrement réussi : c'est le seul repère qui
    distingue un retour du serveur d'un simple re-rendu.
  */
  const [versionAffichee, setVersionAffichee] = useState(version)
  if (versionAffichee !== version) {
    setVersionAffichee(version)
    setValeurs({ raisonSociale, adresse, telephone })
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await enregistrerOrganisationAction({ entreprise, ...valeurs, version })

      if (r.ok) {
        setChamps({})
        notifier.succes('Coordonnées enregistrées.')
        return
      }

      setChamps(r.champs ?? {})
      notifier.erreur(r.erreur)
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enregistrer()
      }}
      className="flex flex-col gap-4"
    >
      <Champ
        id="raisonSociale"
        libelle="Raison sociale"
        aide="Le nom légal sous lequel l’entreprise est enregistrée."
        valeur={valeurs.raisonSociale}
        erreurs={champs.raisonSociale}
        onChange={(v) => setValeurs((x) => ({ ...x, raisonSociale: v }))}
      />

      <Champ
        id="adresse"
        libelle="Adresse"
        aide="Telle qu’elle doit paraître sur un document commercial."
        valeur={valeurs.adresse}
        erreurs={champs.adresse}
        onChange={(v) => setValeurs((x) => ({ ...x, adresse: v }))}
      />

      {/*
        La largeur du champ annonce ce qu'on attend : un numéro de dix chiffres
        dans une ligne aussi longue que l'adresse se lit comme une saisie
        incomplète.
      */}
      <Champ
        id="telephone"
        libelle="Téléphone"
        aide="Le numéro auquel un client doit pouvoir vous joindre."
        exemple="418 555-0123"
        type="tel"
        largeur="w-full max-w-[240px]"
        valeur={valeurs.telephone}
        erreurs={champs.telephone}
        onChange={(v) => setValeurs((x) => ({ ...x, telephone: v }))}
      />

      <div className="mt-2">
        <Bouton type="submit" chargement={enCours}>
          Enregistrer
        </Bouton>
      </div>
    </form>
  )
}

function Champ({
  id,
  libelle,
  aide,
  exemple,
  type = 'text',
  largeur = 'w-full',
  valeur,
  erreurs,
  onChange,
}: {
  id: string
  libelle: string
  aide: string
  exemple?: string
  type?: 'text' | 'tel'
  largeur?: string
  valeur: string
  erreurs?: string[]
  onChange: (v: string) => void
}) {
  const idAide = `${id}-aide`
  const idErreur = `${id}-erreur`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
        {libelle}
      </label>
      {/*
        44 px au doigt, 40 à la souris — section 19, cibles tactiles.
        L'anneau de focus vient de la couche `base` de `globals.css` : une
        utilitaire qui le retirerait passerait après elle quelle que soit sa
        spécificité. `focus:border-ink` s'y ajoute, il ne le remplace pas.
      */}
      <input
        id={id}
        type={type}
        value={valeur}
        placeholder={exemple}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(erreurs?.length)}
        aria-describedby={erreurs?.length ? idErreur : idAide}
        // `largeur` passe après le gabarit : `tailwind-merge` laisse le
        // téléphone borner sa colonne sans redéclarer le reste.
        className={cn(CHAMP, largeur)}
      />
      {erreurs?.length ? (
        <p id={idErreur} role="alert" className="text-critical-texte text-[13px] leading-[18px]">
          {erreurs[0]}
        </p>
      ) : (
        <p id={idAide} className="text-ink3 text-[13px] leading-[18px]">
          {aide}
        </p>
      )}
    </div>
  )
}
