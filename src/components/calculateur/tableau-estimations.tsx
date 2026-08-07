'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Eye, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BadgeStatutEstimation } from '@/components/shared/badge-statut'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'
import { Tronque } from '@/components/shared/tronque'
import {
  formaterDateCourte,
  formaterDateSeuleCourte,
  formaterMontant,
} from '@/lib/domaine/estimation'
import { cn } from '@/lib/utils'
import type { EntrepriseSlug } from '@/config/entreprises'
import type { EstimationListe } from '@/lib/data/estimations'

/** Une seule taille et une seule encre pour toutes les colonnes — section 19. */
const CELLULE = 'text-[13px]'

/** Gabarit d'une ligne de menu — `gap-2.5` suppose une icône sur chaque entrée. */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

type Cle = 'reference' | 'clientNom' | 'date' | 'total' | 'statut' | 'valideJusquau'

type Colonne = {
  cle: Cle
  libelle: string
  aDroite?: boolean
}

/** En-têtes de la section 19 — « Numéro · Client · Date · Montant · Statut · Valide jusqu'au ». */
const COLONNES: Colonne[] = [
  { cle: 'reference', libelle: 'Numéro' },
  { cle: 'clientNom', libelle: 'Client' },
  { cle: 'date', libelle: 'Date' },
  { cle: 'total', libelle: 'Montant', aDroite: true },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'valideJusquau', libelle: 'Valide jusqu’au' },
]

function valeurDeTri(estimation: EstimationListe, cle: Cle): string | number {
  switch (cle) {
    case 'date':
      return estimation.date.getTime()
    case 'valideJusquau':
      return estimation.valideJusquau?.getTime() ?? 0
    case 'total':
      return estimation.total
    default:
      return estimation[cle]
  }
}

/**
 * Liste des estimations d'une entreprise.
 *
 * Le tri est local : les trois utilisateurs travaillent sur quelques centaines de
 * lignes, et un aller-retour serveur par clic de colonne se sentirait plus que le
 * poids des données.
 */
export function TableauEstimations({
  slug,
  estimations,
}: {
  slug: EntrepriseSlug
  estimations: EstimationListe[]
}) {
  const [tri, setTri] = useState<{ cle: Cle; ascendant: boolean }>({
    cle: 'date',
    ascendant: false,
  })

  const triees = [...estimations].sort((a, b) => {
    const va = valeurDeTri(a, tri.cle)
    const vb = valeurDeTri(b, tri.cle)
    const ordre =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'fr-CA')
    return tri.ascendant ? ordre : -ordre
  })

  function basculer(cle: Cle) {
    // Un clic trie, un second inverse.
    setTri((actuel) =>
      actuel.cle === cle ? { cle, ascendant: !actuel.ascendant } : { cle, ascendant: true },
    )
  }

  /**
   * Gestes de fin de ligne, repliés dans un menu.
   *
   * Le déclencheur reste VISIBLE en permanence, jamais révélé au survol : sur
   * une liste de cent estimations, chercher où cliquer coûte plus que la
   * sobriété gagnée. `aria-label` le nomme, sinon il ne s'annonce que « bouton ».
   */
  const MenuActions = ({ estimation: e }: { estimation: EstimationListe }) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions pour ${e.reference}`}
        /* 44 px au doigt : au-delà, seule la liste en tableau reste, à la souris. */
        className="text-ink3 hover:bg-hover2 hover:text-ink data-[state=open]:bg-hover2 data-[state=open]:text-ink inline-flex size-11 items-center justify-center rounded-sm md:size-8"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      {/*
        Même habillage que les autres menus de l'application : deux menus du même
        produit qui ne se ressemblent pas donnent l'impression d'avoir changé
        d'outil en cours de route.
      */}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className={cn('bg-raised shadow-menu w-56 rounded-[9px] px-1 py-1.5', FILET_FLOTTANT)}
      >
        <DropdownMenuItem
          className={LIGNE_MENU}
          render={<Link href={`/calculateur/${slug}/estimations/${e.id}`} />}
        >
          <Eye className="size-3.75 shrink-0" aria-hidden />
          Consulter
        </DropdownMenuItem>

        {/*
          Exigence EST-11 : dupliquer ouvre une NOUVELLE estimation préremplie.
          L'originale n'est jamais modifiée — le numéro n'est attribué qu'à
          l'enregistrement de la copie.
        */}
        <DropdownMenuItem
          className={LIGNE_MENU}
          render={<Link href={`/calculateur/${slug}?depuis=${e.id}`} />}
        >
          <Copy className="size-3.75 shrink-0" aria-hidden />
          Dupliquer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <CadreTableau className="hidden md:block">
        {/*
          800 px : la largeur disponible au point le plus serré — 1280 px de
          fenêtre, barre latérale déployée. Au-delà, le cadre défile plutôt que
          d'écraser les colonnes.
        */}
        <Tableau className="min-w-200">
          <EnTeteTableau>
            {COLONNES.map((colonne) => (
              <ColonneTableau
                key={colonne.cle}
                libelle={colonne.libelle}
                aDroite={colonne.aDroite}
                tri={
                  tri.cle === colonne.cle ? (tri.ascendant ? 'ascendant' : 'descendant') : 'aucun'
                }
                rendu={(contenu, classes) => (
                  <button
                    type="button"
                    onClick={() => basculer(colonne.cle)}
                    aria-label={`Trier par ${colonne.libelle}`}
                    className={classes}
                  >
                    {contenu}
                  </button>
                )}
              />
            ))}
            <ColonneTableau libelle="Actions" aDroite />
          </EnTeteTableau>
          <CorpsTableau>
            {triees.map((e) => (
              <LigneTableau key={e.id}>
                <CelluleTableau chiffres className={cn(CELLULE, 'font-medium')}>
                  <Link
                    href={`/calculateur/${slug}/estimations/${e.id}`}
                    className="hover:underline focus-visible:underline"
                  >
                    {e.reference}
                  </Link>
                </CelluleTableau>
                <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-72')}>
                  {e.clientNom}
                </CelluleTableau>
                <CelluleTableau discret chiffres className={CELLULE}>
                  {formaterDateCourte(e.date)}
                </CelluleTableau>
                <CelluleTableau aDroite chiffres className={CELLULE}>
                  {formaterMontant(e.total)}
                </CelluleTableau>
                <CelluleTableau className={CELLULE}>
                  <BadgeStatutEstimation statut={e.statut} />
                </CelluleTableau>
                <CelluleTableau discret chiffres className={CELLULE}>
                  {formaterDateSeuleCourte(e.valideJusquau)}
                </CelluleTableau>
                <CelluleTableau aDroite>
                  <MenuActions estimation={e} />
                </CelluleTableau>
              </LigneTableau>
            ))}
          </CorpsTableau>
        </Tableau>
      </CadreTableau>

      {/* Téléphone : cartes. Un tableau de sept colonnes y devient illisible. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {triees.map((e) => (
          <li
            key={e.id}
            className="border-border bg-raised flex items-start gap-3 rounded-[10px] border p-3.5"
          >
            <Link href={`/calculateur/${slug}/estimations/${e.id}`} className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[13px] leading-[18px] font-medium tabular-nums">
                  {e.reference}
                </span>
                <BadgeStatutEstimation statut={e.statut} />
              </span>
              <Tronque className="text-ink2 mt-1 max-w-72 text-[13px] leading-[18px]">
                {e.clientNom}
              </Tronque>
              <span className="text-ink2 mt-1 block text-[13px] leading-[18px] tabular-nums">
                {formaterMontant(e.total)}
                <span aria-hidden> · </span>
                {formaterDateCourte(e.date)}
              </span>
            </Link>
            <MenuActions estimation={e} />
          </li>
        ))}
      </ul>
    </>
  )
}
