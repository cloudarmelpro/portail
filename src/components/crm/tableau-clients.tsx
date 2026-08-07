'use client'

import Link from 'next/link'
import { Calculator, Eye, MoreHorizontal } from 'lucide-react'
import type { CleTri, LigneClient } from '@/lib/data/crm'
import { LIBELLE_STATUT_CLIENT, LIBELLE_TYPE_CLIENT, LIBELLE_TYPE_INTERACTION } from '@/config/crm'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { dateCourte } from '@/components/crm/format'
import { retardEnJours } from '@/lib/domaine/dates'
import { cn } from '@/lib/utils'

/** Une seule taille et une seule encre pour toutes les colonnes — section 19. */
const CELLULE = 'text-[13px]'

/** Gabarit d'une ligne de menu — `gap-2.5` suppose une icône sur chaque entrée. */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

type Props = {
  lignes: LigneClient[]
  entreprise: string
  tri: CleTri
  sens: 'asc' | 'desc'
  /** Filtres courants, reconduits dans chaque lien de tri. */
  filtres: Record<string, string>
  /** Le jour civil du Québec, rendu par `aujourdHui()` — jamais celui du serveur. */
  jour: Date
}

const COLONNES: { cle: CleTri; libelle: string }[] = [
  { cle: 'nom', libelle: 'Client' },
  { cle: 'type', libelle: 'Type' },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'dernier', libelle: 'Dernière interaction' },
  { cle: 'relance', libelle: 'Prochaine relance' },
]

/**
 * CRM-8 — liste triable.
 *
 * Les en-têtes sont des liens, pas des boutons : le tri vit dans l'URL, donc il
 * se partage et survit au rechargement. Aucun JavaScript n'est nécessaire pour
 * trier, et le clic droit « ouvrir dans un nouvel onglet » fonctionne.
 */
export function TableauClients({ lignes, entreprise, tri, sens, filtres, jour }: Props) {
  const chemin = `/crm/${entreprise}/clients`

  function lienTri(cle: CleTri): string {
    const p = new URLSearchParams(filtres)
    // Un premier clic trie en croissant ; un second inverse ; une autre colonne
    // repart en croissant.
    p.set('tri', cle)
    p.set('sens', tri === cle && sens === 'asc' ? 'desc' : 'asc')
    return `${chemin}?${p.toString()}`
  }

  /**
   * Gestes de fin de ligne, repliés dans un menu.
   *
   * Le déclencheur reste VISIBLE en permanence, jamais révélé au survol :
   * chercher où cliquer coûte plus que la sobriété gagnée. `aria-label` le
   * nomme, sinon il ne s'annonce que « bouton ».
   */
  const MenuActions = ({ ligne: l }: { ligne: LigneClient }) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions pour ${l.nom}`}
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
        <DropdownMenuItem className={LIGNE_MENU} render={<Link href={`${chemin}/${l.id}`} />}>
          <Eye className="size-3.75 shrink-0" aria-hidden />
          Consulter
        </DropdownMenuItem>

        <DropdownMenuItem
          className={LIGNE_MENU}
          render={<Link href={`/calculateur/${entreprise}?client=${l.id}`} />}
        >
          <Calculator className="size-3.75 shrink-0" aria-hidden />
          Nouvelle estimation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <CadreTableau className="hidden md:block">
        {/*
          800 px : la largeur disponible au point le plus serré — 1280 px de
          fenêtre, barre latérale déployée, moins le retrait de 96 px que la page
          pose sous les bandes. Au-delà, le cadre défile plutôt que d'écraser les
          colonnes.
        */}
        <Tableau className="min-w-200">
          <EnTeteTableau>
            {COLONNES.map((c) => (
              <ColonneTableau
                key={c.cle}
                libelle={c.libelle}
                tri={tri === c.cle ? (sens === 'asc' ? 'ascendant' : 'descendant') : 'aucun'}
                rendu={(contenu, classes) => (
                  <Link href={lienTri(c.cle)} className={classes}>
                    {contenu}
                  </Link>
                )}
              />
            ))}
            <ColonneTableau libelle="Actions" aDroite />
          </EnTeteTableau>
          <CorpsTableau>
            {lignes.map((l) => {
              const enRetard = l.relanceLe !== null && retardEnJours(l.relanceLe, jour) > 0

              return (
                <LigneTableau key={l.id}>
                  {/* Le contenu est un lien, pas une chaîne : l'infobulle reçoit
                      la valeur entière par `titre`. */}
                  <CelluleTableau discret tronque titre={l.nom} className={cn(CELLULE, 'max-w-72')}>
                    <Link
                      href={`${chemin}/${l.id}`}
                      className="hover:underline focus-visible:underline"
                    >
                      {l.nom}
                    </Link>
                  </CelluleTableau>
                  <CelluleTableau discret className={CELLULE}>
                    {LIBELLE_TYPE_CLIENT[l.type]}
                  </CelluleTableau>
                  {/*
                    Le statut s'ÉCRIT. Cinq pastilles colorées en colonne
                    faisaient de la teinte le premier élément lu d'un tableau qui
                    se parcourt à la ligne, et « Soumission envoyée » ne se
                    devinait qu'à ceux qui en connaissaient le code.
                  */}
                  <CelluleTableau discret className={CELLULE}>
                    {LIBELLE_STATUT_CLIENT[l.statut]}
                  </CelluleTableau>
                  <CelluleTableau discret chiffres className={CELLULE}>
                    {l.derniereType
                      ? `${LIBELLE_TYPE_INTERACTION[l.derniereType]} · ${dateCourte(l.derniereLe)}`
                      : '—'}
                  </CelluleTableau>
                  {/* Le mot « En retard » porte l'information ; la couleur ne fait
                      qu'attirer l'œil dessus. */}
                  <CelluleTableau
                    discret={!enRetard}
                    chiffres
                    className={cn(CELLULE, enRetard && 'text-critical-texte font-medium')}
                  >
                    {l.relanceLe ? (
                      <>
                        {dateCourte(l.relanceLe)}
                        {enRetard && ' · En retard'}
                      </>
                    ) : (
                      '—'
                    )}
                  </CelluleTableau>
                  <CelluleTableau aDroite>
                    <MenuActions ligne={l} />
                  </CelluleTableau>
                </LigneTableau>
              )
            })}
          </CorpsTableau>
        </Tableau>
      </CadreTableau>

      {/* Téléphone : cartes. Un tableau de six colonnes y devient illisible. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {lignes.map((l) => {
          const enRetard = l.relanceLe !== null && retardEnJours(l.relanceLe, jour) > 0

          return (
            <li
              key={l.id}
              className="border-border bg-surface flex items-start gap-3 rounded-[10px] border p-3.5"
            >
              <Link href={`${chemin}/${l.id}`} className="min-w-0 flex-1">
                <Tronque className="max-w-72 text-[13px] leading-[18px] font-medium">
                  {l.nom}
                </Tronque>
                <span className="text-ink2 mt-1 block text-[13px] leading-[18px]">
                  {LIBELLE_TYPE_CLIENT[l.type]}
                  <span aria-hidden> · </span>
                  {LIBELLE_STATUT_CLIENT[l.statut]}
                </span>
                <span
                  className={cn(
                    'mt-1 block text-[13px] leading-[18px] tabular-nums',
                    enRetard ? 'text-critical-texte font-medium' : 'text-ink2',
                  )}
                >
                  Relance&nbsp;: {l.relanceLe ? dateCourte(l.relanceLe) : '—'}
                  {enRetard && ' · En retard'}
                </span>
              </Link>
              <MenuActions ligne={l} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
