'use client'

import { useState, useTransition } from 'react'
import { Download, Eye, FolderInput, Trash2 } from 'lucide-react'
import { supprimerFichier } from '@/lib/actions/cv'
import { notifier } from '@/lib/toast'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
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
import { Tronque } from '@/components/shared/tronque'
import { ApercuCv } from '@/components/cv/apercu-cv'
import { DialogueDeplacer } from '@/components/cv/dialogue-deplacer'
import { formatLisible, formaterTaille } from '@/components/cv/format-fichier'
import { Surligner } from '@/components/cv/surligner'

export type LigneFichier = {
  id: string
  nom: string
  taille: number
  typeMime: string
  deposeLe: string
  deposeParNom: string
  echeance: string | null
  version: number
  categories: { id: string; nom: string }[]
}

type Props = {
  fichiers: LigneFichier[]
  categories: { id: string; nom: string }[]
  peutSupprimer: boolean
  peutTelecharger: boolean
  peutReclasser: boolean
  /** Affiche la date à laquelle le CV a atteint 24 mois — cette vue seulement. */
  colonneEcheance?: boolean
  /** Terme recherché, surligné dans les noms de fichiers. */
  recherche?: string
}

export function TableauFichiers({
  fichiers,
  categories,
  peutSupprimer,
  peutTelecharger,
  peutReclasser,
  colonneEcheance = false,
  recherche,
}: Props) {
  const [apercu, setApercu] = useState<number | null>(null)
  const [aDeplacer, setADeplacer] = useState<LigneFichier | null>(null)
  const [aSupprimer, setASupprimer] = useState<LigneFichier | null>(null)
  const [enCours, demarrer] = useTransition()

  // Navigation circulaire : arrivé au dernier, on revient au premier plutôt que
  // de bloquer — on parcourt une pile, on ne lit pas un livre.
  const allerA = (delta: number) =>
    setApercu((i) => (i === null ? null : (i + delta + fichiers.length) % fichiers.length))

  function confirmerSuppression() {
    if (!aSupprimer) return
    const cible = aSupprimer

    demarrer(async () => {
      const r = await supprimerFichier({ fichierId: cible.id })
      if (r.ok) {
        notifier.succes(`« ${cible.nom} » déplacé dans la corbeille.`)
        setASupprimer(null)
        setApercu(null)
      } else notifier.erreur(r.erreur)
    })
  }

  const actions = (f: LigneFichier, index: number) => (
    <>
      <button
        onClick={() => setApercu(index)}
        title="Consulter"
        aria-label={`Consulter ${f.nom}`}
        className="hover:bg-hover2 flex size-11 items-center justify-center rounded-[6px] md:size-8"
      >
        <Eye className="size-4" aria-hidden />
      </button>
      {peutTelecharger && (
        <a
          href={`/api/cv/${f.id}/telecharger`}
          title="Télécharger"
          aria-label={`Télécharger ${f.nom}`}
          className="hover:bg-hover2 flex size-11 items-center justify-center rounded-[6px] md:size-8"
        >
          <Download className="size-4" aria-hidden />
        </a>
      )}
      {peutReclasser && (
        <button
          onClick={() => setADeplacer(f)}
          title="Déplacer"
          aria-label={`Déplacer ${f.nom}`}
          className="hover:bg-hover2 flex size-11 items-center justify-center rounded-[6px] md:size-8"
        >
          <FolderInput className="size-4" aria-hidden />
        </button>
      )}
      {peutSupprimer && (
        <button
          onClick={() => setASupprimer(f)}
          title="Supprimer"
          aria-label={`Supprimer ${f.nom}`}
          className="hover:bg-hover2 text-critical flex size-11 items-center justify-center rounded-[6px] md:size-8"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </>
  )

  return (
    <>
      {/* Grand écran : tableau. En-tête collant pour ne pas perdre les colonnes. */}
      <CadreTableau className="hidden md:block">
        <Tableau>
          <EnTeteTableau>
            <ColonneTableau libelle="Nom" />
            <ColonneTableau libelle="Type" />
            <ColonneTableau libelle="Catégories" />
            <ColonneTableau libelle="Déposé le" />
            {colonneEcheance && <ColonneTableau libelle="24 mois atteints le" />}
            <ColonneTableau libelle="Taille" aDroite />
            <ColonneTableau className="w-40" />
          </EnTeteTableau>
          <CorpsTableau>
            {fichiers.map((f, i) => (
              <LigneTableau key={f.id}>
                {/* Le nom porte le surlignage : la valeur entière passe par `titre`. */}
                <CelluleTableau tronque titre={f.nom} className="max-w-72">
                  <Surligner texte={f.nom} terme={recherche} />
                </CelluleTableau>
                <CelluleTableau discret className="text-[13px]">
                  {formatLisible(f.typeMime) ?? '—'}
                </CelluleTableau>
                <CelluleTableau>
                  {/*
                    Le plafond est porté par chaque pastille, pas par la rangée :
                    plafonner le conteneur ferait revenir les pastilles à la ligne
                    et déborder la cellule, qui est haute de 44 px.
                  */}
                  <div className="flex flex-wrap gap-1">
                    {f.categories.length === 0 ? (
                      <span className="text-ink3 text-[13px]">Non classé</span>
                    ) : (
                      f.categories.map((c) => (
                        <span
                          key={c.id}
                          className="bg-hover text-ink2 rounded-full px-2 py-0.5 text-[11px]"
                        >
                          <Tronque className="max-w-48">{c.nom}</Tronque>
                        </span>
                      ))
                    )}
                  </div>
                </CelluleTableau>
                <CelluleTableau discret chiffres className="text-[13px]">
                  {f.deposeLe}
                </CelluleTableau>
                {colonneEcheance && (
                  <CelluleTableau discret chiffres className="text-[13px]">
                    {f.echeance}
                  </CelluleTableau>
                )}
                <CelluleTableau discret aDroite chiffres className="text-[13px]">
                  {formaterTaille(f.taille)}
                </CelluleTableau>
                <CelluleTableau>
                  <ActionsLigne>{actions(f, i)}</ActionsLigne>
                </CelluleTableau>
              </LigneTableau>
            ))}
          </CorpsTableau>
        </Tableau>
      </CadreTableau>

      {/* Téléphone : liste de cartes. Un tableau compressé y est illisible. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {fichiers.map((f, i) => (
          <li key={f.id} className="bg-surface border-border rounded-[10px] border p-4">
            <p className="text-[15px] font-medium">
              <Tronque titre={f.nom} className="max-w-72">
                <Surligner texte={f.nom} terme={recherche} />
              </Tronque>
            </p>
            <p className="text-ink3 mt-1 text-[13px] tabular-nums">
              {f.deposeLe} — {formaterTaille(f.taille)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {f.categories.map((c) => (
                <span
                  key={c.id}
                  className="bg-hover text-ink2 rounded-full px-2 py-0.5 text-[11px]"
                >
                  <Tronque className="max-w-48">{c.nom}</Tronque>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-1">{actions(f, i)}</div>
          </li>
        ))}
      </ul>

      {apercu !== null && fichiers[apercu] && (
        <ApercuCv
          fichier={fichiers[apercu]}
          position={apercu + 1}
          total={fichiers.length}
          peutTelecharger={peutTelecharger}
          peutSupprimer={peutSupprimer}
          peutReclasser={peutReclasser}
          onPrecedent={() => allerA(-1)}
          onSuivant={() => allerA(1)}
          onFermer={() => setApercu(null)}
          onReclasser={() => setADeplacer(fichiers[apercu])}
          onSupprimer={() => setASupprimer(fichiers[apercu])}
        />
      )}

      <DialogueDeplacer
        fichier={aDeplacer}
        categories={categories}
        onFerme={() => setADeplacer(null)}
      />

      <Dialog open={Boolean(aSupprimer)} onOpenChange={() => setASupprimer(null)}>
        {/* `z-60` — même raison que dans `dialogue-deplacer.tsx` : la suppression
            se déclenche depuis l'aperçu plein écran, qui est à ce niveau. */}
        <ContenuDialogue className="z-60 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Supprimer ce CV&nbsp;?</DialogTitle>
            <DialogDescription>
              «&nbsp;{aSupprimer?.nom}&nbsp;» ira dans la corbeille. Cette action peut être annulée
              pendant 30 jours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Bouton variante="secondaire" onClick={() => setASupprimer(null)}>
              Annuler
            </Bouton>
            <Bouton variante="destructive" onClick={confirmerSuppression} chargement={enCours}>
              Supprimer
            </Bouton>
          </DialogFooter>
        </ContenuDialogue>
      </Dialog>
    </>
  )
}
