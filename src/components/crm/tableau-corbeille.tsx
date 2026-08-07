'use client'

import { useTransition } from 'react'
import { MoreHorizontal, Undo2 } from 'lucide-react'
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
import { restaurerClient } from '@/lib/actions/crm'
import { notifier } from '@/lib/toast'
import { LIBELLE_STATUT_CLIENT, LIBELLE_TYPE_CLIENT } from '@/config/crm'
import type { EntrepriseSlug } from '@/config/entreprises'
import type { StatutClient, TypeClient } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'

/** Une seule taille et une seule encre pour toutes les colonnes — section 19. */
const CELLULE = 'text-[13px]'

/** Gabarit d'une ligne de menu — `gap-2.5` suppose une icône sur chaque entrée. */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

export type LigneSupprimee = {
  id: string
  nom: string
  type: TypeClient
  statut: StatutClient
  supprimeeLe: string
  interactions: number
  estimations: number
}

/**
 * Fiches supprimées d'une entreprise — CRM-7.
 *
 * Il n'y a **pas** de bouton « vider la corbeille », comme dans la banque de CV.
 * Une fiche client porte un historique d'interactions et des estimations émises ;
 * la seule opération offerte est le retour en arrière.
 */
export function TableauCorbeilleCrm({
  entreprise,
  lignes,
}: {
  entreprise: EntrepriseSlug
  lignes: LigneSupprimee[]
}) {
  const [enCours, demarrer] = useTransition()

  function restaurer(ligne: LigneSupprimee) {
    demarrer(async () => {
      const r = await restaurerClient({ entreprise, clientId: ligne.id })
      if (r.ok) {
        notifier.succes(`« ${ligne.nom} » a été restauré.`)
      } else notifier.erreur(r.erreur)
    })
  }

  return (
    <CadreTableau>
      <Tableau className="min-w-180">
        <EnTeteTableau>
          <ColonneTableau libelle="Nom" />
          <ColonneTableau libelle="Type" />
          <ColonneTableau libelle="Statut" />
          <ColonneTableau libelle="Supprimée le" />
          <ColonneTableau libelle="Historique" />
          <ColonneTableau libelle="Actions" aDroite />
        </EnTeteTableau>

        <CorpsTableau>
          {lignes.map((l) => (
            <LigneTableau key={l.id}>
              <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-72')}>
                {l.nom}
              </CelluleTableau>
              <CelluleTableau discret className={CELLULE}>
                {LIBELLE_TYPE_CLIENT[l.type]}
              </CelluleTableau>
              {/* Le statut s'écrit : une pastille ne dit son mot qu'à qui en
                  connaît déjà le code. */}
              <CelluleTableau discret className={CELLULE}>
                {LIBELLE_STATUT_CLIENT[l.statut]}
              </CelluleTableau>
              <CelluleTableau discret chiffres className={CELLULE}>
                {l.supprimeeLe}
              </CelluleTableau>
              {/*
                Ce que la restauration ramène, dit en clair : sans ce compte, on
                ne sait pas si l'on récupère une fiche vide ou deux ans de suivi.
              */}
              <CelluleTableau discret chiffres className={CELLULE}>
                {l.interactions === 0 && l.estimations === 0
                  ? '—'
                  : [
                      l.interactions > 0 &&
                        `${l.interactions} interaction${l.interactions > 1 ? 's' : ''}`,
                      l.estimations > 0 &&
                        `${l.estimations} estimation${l.estimations > 1 ? 's' : ''}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </CelluleTableau>
              <CelluleTableau aDroite>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions pour ${l.nom}`}
                    className="text-ink3 hover:bg-hover2 hover:text-ink data-[state=open]:bg-hover2 data-[state=open]:text-ink inline-flex size-11 items-center justify-center rounded-sm md:size-8"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    className={cn(
                      'bg-raised shadow-menu w-56 rounded-[9px] px-1 py-1.5',
                      FILET_FLOTTANT,
                    )}
                  >
                    <DropdownMenuItem
                      className={LIGNE_MENU}
                      disabled={enCours}
                      onClick={() => restaurer(l)}
                    >
                      <Undo2 className="size-3.75 shrink-0" aria-hidden />
                      Restaurer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CelluleTableau>
            </LigneTableau>
          ))}
        </CorpsTableau>
      </Tableau>
    </CadreTableau>
  )
}
