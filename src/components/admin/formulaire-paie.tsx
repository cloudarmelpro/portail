'use client'

import { useState, useTransition } from 'react'
import { Bouton } from '@/components/shared/bouton'
import { enregistrerParametresDePaie } from '@/lib/actions/admin'
import { notifier } from '@/lib/toast'
import { CHAMP } from '@/components/shared/gabarits'
import { cn } from '@/lib/utils'

export type ParametresPaie = {
  seuilSupplementaires: string
  majoration: string
  joursPeriode: number
  version: number
}

/**
 * Seuil d'heures supplémentaires, majoration et durée de période — HEU-7, HEU-9.
 *
 * Ces valeurs suivent la norme du travail, pas une préférence d'usage : elles
 * sont réservées à l'administrateur et changent rarement, mais un changement de
 * loi ne doit pas exiger un déploiement.
 *
 * Le seuil et la majoration restent des CHAÎNES de bout en bout, jusqu'au
 * `Decimal` de la base : les convertir en nombre ici pour les reconvertir plus
 * loin ferait passer un montant horaire par un flottant.
 */
export function FormulairePaie({ parametres }: { parametres: ParametresPaie }) {
  const [valeurs, setValeurs] = useState({
    seuilSupplementaires: parametres.seuilSupplementaires,
    majoration: parametres.majoration,
    joursPeriode: String(parametres.joursPeriode),
  })
  const [champs, setChamps] = useState<Record<string, string[]>>({})
  const [enCours, demarrer] = useTransition()

  /*
    Remise à niveau après enregistrement, ajustée PENDANT le rendu — le patron
    React, pas un effet, qui ferait clignoter les champs le temps d'un tour.

    La revalidation de l'action renvoie les valeurs telles que la base les a
    retenues :
    « 1.5 » là où l'on a saisi « 1,5 ». L'état, lui, gardait la frappe. On lisait
    donc à l'écran autre chose que ce qui était enregistré, sans rien pour le
    signaler — et la faute était du côté de l'affichage, le plus difficile à
    soupçonner.

    La version change à chaque enregistrement réussi : c'est le seul repère qui
    distingue un retour du serveur d'un simple re-rendu.
  */
  const [versionAffichee, setVersionAffichee] = useState(parametres.version)
  if (versionAffichee !== parametres.version) {
    setVersionAffichee(parametres.version)
    setValeurs({
      seuilSupplementaires: parametres.seuilSupplementaires,
      majoration: parametres.majoration,
      joursPeriode: String(parametres.joursPeriode),
    })
  }

  function enregistrer() {
    demarrer(async () => {
      /*
        La version part telle qu'elle a été reçue par la page : si un autre
        onglet a enregistré entre-temps, le serveur refuse au lieu d'écraser.
      */
      const r = await enregistrerParametresDePaie({
        seuilSupplementaires: valeurs.seuilSupplementaires,
        majoration: valeurs.majoration,
        joursPeriode: Number(valeurs.joursPeriode),
        version: parametres.version,
      })

      if (r.ok) {
        setChamps({})
        notifier.succes('Paramètres enregistrés.')
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
      className="flex max-w-[620px] flex-col gap-6"
    >
      <Champ
        id="seuilSupplementaires"
        libelle="Seuil des heures supplémentaires"
        aide="Au-delà de ce nombre d’heures par semaine, la majoration s’applique."
        valeur={valeurs.seuilSupplementaires}
        modeSaisie="decimal"
        erreurs={champs.seuilSupplementaires}
        onChange={(v) => setValeurs((x) => ({ ...x, seuilSupplementaires: v }))}
      />

      <Champ
        id="majoration"
        libelle="Majoration"
        aide="Multiplicateur appliqué au taux horaire au-delà du seuil."
        valeur={valeurs.majoration}
        modeSaisie="decimal"
        erreurs={champs.majoration}
        onChange={(v) => setValeurs((x) => ({ ...x, majoration: v }))}
      />

      <Champ
        id="joursPeriode"
        libelle="Durée de la période de paie"
        aide="Nombre de jours couverts par une période."
        valeur={valeurs.joursPeriode}
        modeSaisie="numeric"
        erreurs={champs.joursPeriode}
        /*
          Seuls des chiffres : le schéma attend un entier, et une saisie vide ou
          décimale y arriverait en `NaN`, dont le refus n'est pas rédigé.
        */
        onChange={(v) => setValeurs((x) => ({ ...x, joursPeriode: v.replace(/\D/g, '') }))}
      />

      <div>
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
  valeur,
  modeSaisie,
  erreurs,
  onChange,
}: {
  id: string
  libelle: string
  aide: string
  valeur: string
  modeSaisie: 'decimal' | 'numeric'
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
        Aucun `outline-none` ici : l'anneau de focus de `globals.css` est posé en
        couche `base`, qu'une utilitaire de Tailwind supprimerait sans bruit.
      */}
      <input
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        inputMode={modeSaisie}
        aria-invalid={Boolean(erreurs?.length)}
        aria-describedby={erreurs?.length ? idErreur : idAide}
        className={cn(CHAMP, 'w-[132px] tabular-nums')}
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
