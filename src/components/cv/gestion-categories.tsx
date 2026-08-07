'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton, classesBouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import { Input } from '@/components/ui/input'
import {
  creerCategorie,
  renommerCategorie,
  reordonnerCategories,
  supprimerCategorie,
} from '@/lib/actions/cv'
import { notifier } from '@/lib/toast'
import { CHAMP } from '@/components/shared/gabarits'

export type CategorieGeree = { id: string; nom: string; compte: number; version: number }

/**
 * Gestion des catégories — exigence CV-2 : « la liste est modifiable par
 * l'administrateur ».
 *
 * Le classement doit suivre les métiers que le client recrute, et ceux-ci
 * changent. Figer la liste dans le code obligerait à une intervention technique
 * pour chaque nouveau poste.
 *
 * Le réordonnancement se fait par flèches plutôt que par glisser-déposer : c'est
 * utilisable au clavier, sur téléphone, et par quelqu'un qui n'a pas la main
 * sûre. Le glisser-déposer serait plus élégant et moins accessible.
 */
export function GestionCategories({ categories }: { categories: CategorieGeree[] }) {
  const [ouvert, setOuvert] = useState(false)
  const [liste, setListe] = useState(categories)
  const [nouveau, setNouveau] = useState('')
  const [edition, setEdition] = useState<{ id: string; nom: string; version: number } | null>(null)
  const [aSupprimer, setASupprimer] = useState<CategorieGeree | null>(null)
  const [enCours, demarrer] = useTransition()

  function ouvrir(o: boolean) {
    setOuvert(o)
    if (o) setListe(categories)
    else {
      setEdition(null)
      setNouveau('')
    }
  }

  function ajouter() {
    const nom = nouveau.trim()
    if (nom.length < 2) return

    demarrer(async () => {
      const r = await creerCategorie({ nom })
      if (r.ok) {
        setNouveau('')
        notifier.succes(`Catégorie « ${nom} » créée.`)
      } else notifier.erreur(r.erreur)
    })
  }

  function renommer() {
    if (!edition) return
    const { id, nom, version } = edition

    demarrer(async () => {
      // TR-10 : la version prouve que l'écran renomme bien ce qu'il a lu.
      const r = await renommerCategorie({ categorieId: id, nom: nom.trim(), version })
      if (r.ok) {
        setEdition(null)
        notifier.succes('Catégorie renommée.')
      } else notifier.erreur(r.erreur)
    })
  }

  function deplacer(index: number, direction: -1 | 1) {
    const cible = index + direction
    if (cible < 0 || cible >= liste.length) return

    const suivante = [...liste]
    ;[suivante[index], suivante[cible]] = [suivante[cible], suivante[index]]
    // Réordonnancement optimiste : l'ordre bouge tout de suite à l'écran, la
    // base suit. Un aller-retour par clic rendrait la manipulation pénible.
    setListe(suivante)

    demarrer(async () => {
      const r = await reordonnerCategories({ categorieIds: suivante.map((c) => c.id) })
      /*
        L'ordre est déjà à l'écran, posé avant l'appel. En cas de succès il n'y a
        donc rien à faire : l'action a revalidé `/cv`, et Next re-rend la route
        de lui-même. En cas d'échec, on remet la liste telle qu'elle était.
      */
      if (!r.ok) {
        setListe(liste)
        notifier.erreur(r.erreur)
      }
    })
  }

  function confirmerSuppression() {
    if (!aSupprimer) return
    const cible = aSupprimer

    demarrer(async () => {
      const r = await supprimerCategorie({ categorieId: cible.id })
      if (r.ok) {
        setListe((l) => l.filter((c) => c.id !== cible.id))
        setASupprimer(null)
        notifier.succes(`Catégorie « ${cible.nom} » supprimée.`)
      } else notifier.erreur(r.erreur)
    })
  }

  return (
    <>
      <Dialog open={ouvert} onOpenChange={ouvrir}>
        <DialogTrigger className={classesBouton({ variante: 'secondaire', taille: 'lg' })}>
          Catégories
        </DialogTrigger>

        <ContenuDialogue className="sm:max-w-140">
          <DialogHeader>
            <DialogTitle>Gérer les catégories</DialogTitle>
            <DialogDescription>
              Les catégories correspondent aux postes recrutés. Un même CV peut appartenir à
              plusieurs d’entre elles.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ajouter()
                }
              }}
              placeholder="Nouvelle catégorie"
              aria-label="Nom de la nouvelle catégorie"
              className={CHAMP}
            />
            <Bouton onClick={ajouter} disabled={nouveau.trim().length < 2 || enCours}>
              <Plus className="size-4" aria-hidden />
              Ajouter
            </Bouton>
          </div>

          {liste.length === 0 ? (
            <p className="text-ink3 py-6 text-center text-[13px]">
              Aucune catégorie. Créez la première ci-dessus.
            </p>
          ) : (
            <ul className="flex max-h-[340px] flex-col gap-1 overflow-auto">
              {liste.map((c, i) => (
                <li
                  key={c.id}
                  className="border-border flex items-center gap-2 rounded-[6px] border px-2 py-1.5"
                >
                  {edition?.id === c.id ? (
                    <>
                      <Input
                        value={edition.nom}
                        onChange={(e) =>
                          setEdition({ id: c.id, nom: e.target.value, version: c.version })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renommer()
                          if (e.key === 'Escape') setEdition(null)
                        }}
                        autoFocus
                        aria-label={`Nouveau nom pour ${c.nom}`}
                        className={CHAMP}
                      />
                      <button
                        onClick={renommer}
                        disabled={enCours}
                        aria-label="Enregistrer"
                        className="hover:bg-hover flex size-11 shrink-0 items-center justify-center rounded-[6px] md:size-8"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => setEdition(null)}
                        aria-label="Annuler"
                        className="hover:bg-hover flex size-11 shrink-0 items-center justify-center rounded-[6px] md:size-8"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </>
                  ) : (
                    <>
                      <Tronque className="max-w-none min-w-0 flex-1 text-[15px]">{c.nom}</Tronque>
                      <span className="text-ink3 shrink-0 text-[11px] tabular-nums">
                        {c.compte} CV
                      </span>
                      <button
                        onClick={() => deplacer(i, -1)}
                        disabled={i === 0 || enCours}
                        aria-label={`Monter ${c.nom}`}
                        className="hover:bg-hover flex size-11 shrink-0 items-center justify-center rounded-[6px] disabled:opacity-30 md:size-8"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => deplacer(i, 1)}
                        disabled={i === liste.length - 1 || enCours}
                        aria-label={`Descendre ${c.nom}`}
                        className="hover:bg-hover flex size-11 shrink-0 items-center justify-center rounded-[6px] disabled:opacity-30 md:size-8"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => setEdition({ id: c.id, nom: c.nom, version: c.version })}
                        aria-label={`Renommer ${c.nom}`}
                        className="hover:bg-hover flex size-11 shrink-0 items-center justify-center rounded-[6px] md:size-8"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => setASupprimer(c)}
                        aria-label={`Supprimer ${c.nom}`}
                        className="hover:bg-hover text-critical flex size-11 shrink-0 items-center justify-center rounded-[6px] md:size-8"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ContenuDialogue>
      </Dialog>

      <Dialog open={Boolean(aSupprimer)} onOpenChange={() => setASupprimer(null)}>
        <ContenuDialogue className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Supprimer cette catégorie&nbsp;?</DialogTitle>
            <DialogDescription>
              {/* Rassurer explicitement : la crainte naturelle est de perdre les CV. */}«{' '}
              {aSupprimer?.nom}&nbsp;» sera retirée.{' '}
              {aSupprimer?.compte
                ? `Les ${aSupprimer.compte} CV qu’elle contient ne sont pas supprimés : ils passent dans « Non classé ».`
                : 'Elle ne contient aucun CV.'}
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
