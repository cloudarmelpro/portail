'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Choix } from '@/components/shared/choix'
import { ENTREPRISES } from '@/config/entreprises'
import { cn } from '@/lib/utils'

/**
 * Filtre de la grille — le dossier d'entreprise.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le libellé est AU-DESSUS du contrôle, pas dedans.
 *
 * C'est la composition du repère, et ce n'est pas qu'une question de place : un
 * menu dont le déclencheur affiche « Toutes les entreprises » ne dit pas SUR
 * QUOI il porte. Avec le mot au-dessus, le déclencheur n'a plus qu'à porter la
 * valeur retenue — ce qu'on cherche à lire est ce qui est actif.
 *
 * Le choix vit dans l'adresse, comme la semaine : une vue filtrée se partage, se
 * met en signet, et le retour arrière du navigateur la défait.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function FiltresHeures({
  entreprise,
  className,
}: {
  entreprise: string
  className?: string
}) {
  const router = useRouter()
  const chemin = usePathname()
  const params = useSearchParams()
  const [, demarrer] = useTransition()

  function choisir(valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur) suivants.set('entreprise', valeur)
    else suivants.delete('entreprise')

    const requete = suivants.toString()
    demarrer(() => {
      /*
        `scroll: false` : la grille se filtre sous les yeux de l'utilisateur.
        Remonter en haut de page lui ferait perdre la ligne qu'il regardait.
      */
      router.replace(requete ? `${chemin}?${requete}` : chemin, { scroll: false })
    })
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-ink3 text-[11px] leading-[13px] font-medium tracking-[0.02em] uppercase">
        Entreprise
      </span>
      <Choix
        valeur={entreprise}
        options={ENTREPRISES.map((e) => ({ valeur: e.slug, libelle: e.nom }))}
        parDefaut="Toutes les entreprises"
        annonce="Filtrer par entreprise"
        onChoisir={choisir}
      />
    </div>
  )
}
