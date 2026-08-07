'use client'

import { useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { Bouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import {
  ActionsLigne,
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'
import { restaurerFichier } from '@/lib/actions/cv'
import { notifier } from '@/lib/toast'

export type LigneCorbeille = {
  id: string
  nom: string
  supprimeLe: string
  supprimeParNom: string
  categories: { id: string; nom: string }[]
}

/**
 * Corbeille — restauration en un geste.
 *
 * Il n'y a volontairement PAS de bouton « vider la corbeille » : la purge se
 * fait par échéance, trente jours après la suppression. Un bouton de vidage
 * transformerait un filet de sécurité en piège à double clic.
 */
export function TableauCorbeille({ fichiers }: { fichiers: LigneCorbeille[] }) {
  const [enCours, demarrer] = useTransition()

  function restaurer(f: LigneCorbeille) {
    demarrer(async () => {
      const r = await restaurerFichier({ fichierId: f.id })
      if (r.ok) {
        notifier.succes(`« ${f.nom} » a été restauré.`)
      } else notifier.erreur(r.erreur)
    })
  }

  return (
    <>
      <CadreTableau className="hidden md:block">
        <Tableau>
          <EnTeteTableau>
            <ColonneTableau libelle="Nom du fichier" />
            <ColonneTableau libelle="Supprimé le" />
            <ColonneTableau libelle="Par" />
            <ColonneTableau className="w-32" />
          </EnTeteTableau>
          <CorpsTableau>
            {fichiers.map((f) => (
              <LigneTableau key={f.id}>
                <CelluleTableau tronque className="max-w-72">
                  {f.nom}
                </CelluleTableau>
                <CelluleTableau discret chiffres className="text-[13px]">
                  {f.supprimeLe}
                </CelluleTableau>
                <CelluleTableau discret tronque className="max-w-72 text-[13px]">
                  {f.supprimeParNom}
                </CelluleTableau>
                <CelluleTableau>
                  <ActionsLigne>
                    <Bouton
                      variante="secondaire"
                      taille="xs"
                      onClick={() => restaurer(f)}
                      chargement={enCours}
                      aria-label={`Restaurer ${f.nom}`}
                    >
                      {!enCours && <RotateCcw className="size-3.5" aria-hidden />}
                      Restaurer
                    </Bouton>
                  </ActionsLigne>
                </CelluleTableau>
              </LigneTableau>
            ))}
          </CorpsTableau>
        </Tableau>
      </CadreTableau>

      <ul className="flex flex-col gap-2 md:hidden">
        {fichiers.map((f) => (
          <li key={f.id} className="bg-surface border-border rounded-[10px] border p-4">
            <p className="text-[15px] font-medium">
              <Tronque className="max-w-72">{f.nom}</Tronque>
            </p>
            <p className="text-ink3 mt-1 text-[13px] tabular-nums">
              Supprimé le {f.supprimeLe} par {f.supprimeParNom}
            </p>
            <Bouton
              variante="secondaire"
              taille="sm"
              className="mt-3"
              onClick={() => restaurer(f)}
              disabled={enCours}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restaurer
            </Bouton>
          </li>
        ))}
      </ul>
    </>
  )
}
