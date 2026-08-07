'use client'

import { useState, useTransition } from 'react'
import type { StatutClient } from '@/generated/prisma/client'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Choix } from '@/components/shared/choix'
import { Textarea } from '@/components/ui/textarea'
import { changerStatut } from '@/lib/actions/crm'
import { LIBELLE_STATUT_CLIENT, ORDRE_STATUT_CLIENT, STATUTS_FERMES } from '@/config/crm'
import { notifier } from '@/lib/toast'
import { ZONE_TEXTE } from '@/components/shared/gabarits'

const FERMES: readonly StatutClient[] = STATUTS_FERMES

/**
 * CRM-5 — changement de statut.
 *
 * Aucun statut ne change tout seul : le passage à Gagné ou Perdu demande une
 * confirmation ET un motif. La boîte de dialogue n'est que la face visible du
 * contrôle — le motif est exigé par le schéma, donc aussi pour un appel HTTP
 * direct qui ne verrait jamais cette boîte.
 */
export function SelecteurStatut({
  entreprise,
  clientId,
  statut,
  version,
}: {
  entreprise: string
  clientId: string
  statut: StatutClient
  version: number
}) {
  const [aConfirmer, setAConfirmer] = useState<StatutClient | null>(null)
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()

  /**
   * ─────────────────────────────────────────────────────────────────────
   * Le choix est retenu, puis appliqué par un geste distinct.
   *
   * Un `<select>` natif dont le `onChange` mute directement est un piège au
   * clavier : sous Windows, les flèches sur une liste FERMÉE changent la valeur
   * et déclenchent `change` à chaque appui. Passer de « Prospect » à « Gagné »
   * écrivait donc « Contacté », puis « Soumission envoyée », puis ouvrait la
   * confirmation — trois entrées au journal d'audit pour un seul geste, et deux
   * changements de statut que personne n'avait voulus.
   *
   * Un utilisateur à la souris ne voyait jamais rien.
   *
   * Le bouton « Appliquer » n'apparaît que lorsque le choix diffère du statut
   * enregistré. Pour un champ qui peut clore un dossier, l'explicite vaut mieux
   * que l'immédiat.
   * ─────────────────────────────────────────────────────────────────────
   */
  const [choix, setChoix] = useState<StatutClient>(statut)
  const enAttente = choix !== statut

  /*
    `Choix` réserve sa valeur vide au premier élément de sa liste — il est fait
    pour un filtre, où elle vaut « tous ». Elle porte ici le statut ENREGISTRÉ :
    y revenir est la seule façon d'annuler un choix en attente, et le
    déclencheur affiche alors ce statut sans le poids du choix modifié.
  */
  const autres = ORDRE_STATUT_CLIENT.filter((s) => s !== statut).map((s) => ({
    valeur: s,
    libelle: LIBELLE_STATUT_CLIENT[s],
  }))

  function appliquer(cible: StatutClient, motifCloture: string | null) {
    demarrer(async () => {
      const r = await changerStatut({
        entreprise,
        clientId,
        statut: cible,
        motifCloture: motifCloture ?? '',
        version,
      })

      if (r.ok) {
        notifier.succes(`Statut mis à jour — ${LIBELLE_STATUT_CLIENT[cible]}.`)
        setAConfirmer(null)
        setMotif('')
      } else {
        setErreur(r.erreur)
        notifier.erreur(r.erreur)
        // Le choix retombe sur la valeur enregistrée : laisser la liste afficher
        // un statut que le serveur a refusé ferait croire au succès.
        setChoix(statut)
      }
    })
  }

  function appliquerLeChoix() {
    if (!enAttente) return
    setErreur(null)
    if (FERMES.includes(choix)) setAConfirmer(choix)
    else appliquer(choix, null)
  }

  return (
    <>
      <Choix
        valeur={choix === statut ? '' : choix}
        options={autres}
        parDefaut={LIBELLE_STATUT_CLIENT[statut]}
        annonce="Changer le statut"
        onChoisir={(v) => {
          setErreur(null)
          // La valeur revient de notre propre liste : la retrouver plutôt que la
          // convertir évite d'affirmer au compilateur ce qu'il peut vérifier.
          setChoix(ORDRE_STATUT_CLIENT.find((s) => s === v) ?? statut)
        }}
      />

      {enAttente && (
        <Bouton taille="sm" variante="secondaire" onClick={appliquerLeChoix} chargement={enCours}>
          Appliquer
        </Bouton>
      )}

      <Dialog
        open={aConfirmer !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAConfirmer(null)
            setMotif('')
            setErreur(null)
            // Renoncer à clore le dossier remet la liste sur le statut réel :
            // laisser « Gagné » affiché ferait croire à un changement en attente.
            setChoix(statut)
          }
        }}
      >
        <ContenuDialogue className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Passer le dossier à «&nbsp;
              {aConfirmer ? LIBELLE_STATUT_CLIENT[aConfirmer] : ''}&nbsp;»&nbsp;?
            </DialogTitle>
            <DialogDescription>
              Ce statut ferme le dossier. Indiquez le motif de la décision.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor="motifCloture" className="text-[13px] leading-[18px] font-medium">
              Motif
            </label>
            <Textarea
              id="motifCloture"
              value={motif}
              rows={3}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Prix trop élevé, délai trop long, contrat signé…"
              // `components/ui` rend `rounded-lg`, soit 16 px avec le thème du
              // projet — le rayon des MODALES. Le gabarit du produit le corrige.
              className={ZONE_TEXTE}
            />
            {erreur && (
              <p className="text-critical-texte text-[13px] leading-[18px]" role="alert">
                {erreur}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => {
                setAConfirmer(null)
                setMotif('')
                setErreur(null)
                setChoix(statut)
              }}
            >
              Annuler
            </Bouton>
            <Bouton
              type="button"
              chargement={enCours}
              disabled={motif.trim().length === 0}
              onClick={() => aConfirmer && appliquer(aConfirmer, motif.trim())}
            >
              {/*
                Le verbe du titre, jamais « Confirmer » — section 19. Celui qui
                lit le bouton sans avoir lu le titre doit savoir ce qu'il
                déclenche ; « Confirmer » ne dit rien de la fermeture d'un
                dossier.
              */}
              Passer le dossier
            </Bouton>
          </DialogFooter>
        </ContenuDialogue>
      </Dialog>
    </>
  )
}
