'use client'

import { useState } from 'react'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'

export type VersionGrille = {
  numero: number
  actif: boolean
  /** Écarts figés à l'enregistrement — jamais recalculés à l'affichage. */
  ecarts: string[]
  creeParNom: string
  /** Déjà formatée côté serveur. */
  publiee: string
}

/**
 * Historique des grilles — ADM-3.
 *
 * Chaque version affiche les écarts tels qu'ils ont été constatés au moment de
 * l'enregistrement. Les recalculer donnerait un historique qui change quand on
 * modifie le passé.
 */
export function HistoriqueGrilles({ versions }: { versions: VersionGrille[] }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
        Historique des versions
      </Bouton>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <ContenuDialogue className="sm:max-w-140">
          <DialogHeader>
            <DialogTitle>Historique des versions</DialogTitle>
            <DialogDescription>
              Les estimations déjà émises conservent les prix de leur version.
            </DialogDescription>
          </DialogHeader>

          {versions.length === 0 ? (
            <p className="text-ink3 py-4 text-[13px]">Aucune version enregistrée.</p>
          ) : (
            <ol className="flex max-h-105 flex-col gap-4 overflow-auto">
              {versions.map((v) => (
                <li key={v.numero} className="border-border border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[15px] font-medium tabular-nums">Version {v.numero}</span>
                    {/* Le mot suffit : une pastille grise ne le dit qu'à qui en connaît le code. */}
                    {v.actif && <span className="text-ink2 text-[13px]">En vigueur</span>}
                    <span className="text-ink3 text-[13px] tabular-nums">{v.publiee}</span>
                    <Tronque titre={v.creeParNom} className="text-ink3 max-w-72 text-[13px]">
                      — {v.creeParNom}
                    </Tronque>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {v.ecarts.map((e) => (
                      <li key={e} className="text-ink2 text-[13px] tabular-nums">
                        {e}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </ContenuDialogue>
      </Dialog>
    </>
  )
}
