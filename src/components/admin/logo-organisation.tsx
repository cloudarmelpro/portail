'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImageOff, Upload } from 'lucide-react'
import { Bouton } from '@/components/shared/bouton'
import { confirmerLogo, preparerLogo, retirerLogo } from '@/lib/actions/admin'
import { notifier } from '@/lib/toast'
import { REFUS_TAILLE_LOGO, REFUS_TYPE_LOGO, TAILLE_MAX_LOGO, TYPES_LOGO } from '@/config/logo'
import type { EntrepriseSlug } from '@/config/entreprises'

type Props = {
  entreprise: EntrepriseSlug
  /** Adresse signée du logo en place, ou `null`. */
  logoUrl: string | null
  nomEntreprise: string
  version: number
}

/**
 * Logo d'entreprise — en-tête du document remis au client (EST-10).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sans logo, le document n'est pas nu : il porte le nom de l'entreprise posé
 * sur son filet de couleur de 3 px. C'est un état volontaire et présentable,
 * pas un trou à remplir — d'où l'aperçu qui le montre tel quel plutôt qu'un
 * cadre vide barré d'une croix.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le dépôt suit le chemin d'un CV : lien signé, écriture DIRECTE du navigateur
 * vers le stockage, puis confirmation côté serveur, qui relit les premiers
 * octets du fichier. Le type annoncé par le navigateur ne prouve rien.
 */
export function LogoOrganisation({ entreprise, logoUrl, nomEntreprise, version }: Props) {
  const router = useRouter()
  const champ = useRef<HTMLInputElement>(null)
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function deposer(fichier: File) {
    setErreur(null)

    /*
      Ce filtre n'est qu'une politesse : il évite un aller-retour et rend le refus
      immédiat. La garantie est côté serveur, sur les octets réellement reçus.
    */
    if (!TYPES_LOGO.includes(fichier.type as (typeof TYPES_LOGO)[number])) {
      setErreur(REFUS_TYPE_LOGO)
      return
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setErreur(REFUS_TAILLE_LOGO)
      return
    }

    demarrer(async () => {
      const prepare = await preparerLogo({
        entreprise,
        typeMime: fichier.type,
        taille: fichier.size,
      })

      if (!prepare.ok) {
        setErreur(prepare.erreur)
        return
      }

      const reponse = await fetch(prepare.donnees.url, {
        method: 'PUT',
        body: fichier,
        headers: { 'Content-Type': fichier.type },
      })

      if (!reponse.ok) {
        setErreur('Envoi refusé par le stockage.')
        return
      }

      const confirme = await confirmerLogo({
        entreprise,
        cle: prepare.donnees.cle,
        typeMime: fichier.type,
        version,
      })

      if (!confirme.ok) {
        setErreur(confirme.erreur)
        return
      }

      notifier.succes('Logo enregistré.')
      router.refresh()
    })
  }

  function retirer() {
    demarrer(async () => {
      const r = await retirerLogo({ entreprise, version })

      if (!r.ok) {
        setErreur(r.erreur)
        return
      }

      notifier.succes('Logo retiré.')
      router.refresh()
    })
  }

  return (
    <div>
      <h2 className="text-[17px] leading-6 font-semibold">Logo</h2>
      <p className="text-ink2 mt-1 text-[15px] leading-[22px]">
        Il paraît en en-tête des estimations de {nomEntreprise}. Une image large et peu haute rend
        mieux sur le document.
      </p>

      {/*
        Aperçu sur fond de papier et non sur la surface de l'application : c'est
        là que le logo ira, et un logo blanc sur fond blanc doit se voir ici
        plutôt qu'à l'envoi du premier devis.
      */}
      <div className="border-border bg-pdf-paper mt-6 flex min-h-[86px] items-center rounded-[6px] border px-5 py-4">
        {logoUrl ? (
          /*
            `<img>` et non `next/image` : l'adresse est signée et expire en cinq
            minutes. L'optimiseur la mettrait en cache derrière une URL stable et
            publique — exactement ce que TR-3 interdit pour tout le stockage.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`Logo de ${nomEntreprise}`}
            className="block h-[34px] w-auto max-w-[200px] object-contain object-left"
          />
        ) : (
          <p className="text-pdf-ink2 text-[13px] leading-[18px]">
            Aucun logo. Les estimations portent le nom de l’entreprise sur son filet de couleur.
          </p>
        )}
      </div>

      {erreur && (
        <p role="alert" className="text-critical-texte mt-3 text-[13px] leading-[18px]">
          {erreur}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={champ}
          type="file"
          accept={TYPES_LOGO.join(',')}
          className="sr-only"
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            // Le champ est remis à zéro pour que redéposer le MÊME fichier après
            // un refus déclenche bien un nouvel événement.
            e.target.value = ''
            if (fichier) deposer(fichier)
          }}
        />

        <Bouton
          type="button"
          variante="secondaire"
          disabled={enCours}
          onClick={() => champ.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {logoUrl ? 'Remplacer le logo' : 'Déposer un logo'}
        </Bouton>

        {logoUrl && (
          <Bouton type="button" variante="secondaire" disabled={enCours} onClick={retirer}>
            <ImageOff className="size-4" aria-hidden />
            Retirer le logo
          </Bouton>
        )}
      </div>

      {/* La contrainte est annoncée avant le geste, puis rappelée en cas de refus. */}
      <p className="text-ink3 mt-3 text-[13px] leading-[18px]">PNG, JPEG ou WebP, 2 Mo maximum.</p>
    </div>
  )
}
