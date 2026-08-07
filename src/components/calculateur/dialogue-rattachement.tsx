'use client'

import { useState } from 'react'
import { Search, User } from 'lucide-react'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import { LIBELLE_STATUT_CLIENT, LIBELLE_TYPE_CLIENT } from '@/config/crm'
import { cn } from '@/lib/utils'
import type { ClientRattachement } from '@/lib/data/estimations'
import { CHAMP } from '@/components/shared/gabarits'

type Props = {
  ouvert: boolean
  onFerme: () => void
  clients: ClientRattachement[]
  totalTexte: string
  enCours: boolean
  /**
   * Nom prérempli dans la recherche, quand l'estimation vient d'une fiche client
   * du CRM. On préremplit, on ne présélectionne pas : le rattachement reste un
   * geste explicite, et l'utilisateur peut avoir changé d'avis en cours d'appel.
   */
  rechercheInitiale?: string
  onClientExistant: (clientId: string, marquerContacte: boolean) => void
  onNouveauClient: (nom: string, telephone: string, marquerContacte: boolean) => void
}

/**
 * Rattachement de fin d'appel — exigences EST-6 et EST-7.
 *
 * Le client n'était pas une condition de départ : c'est ici qu'on le désigne, en
 * le cherchant ou en le créant avec deux champs. Le reste de la fiche se
 * complète plus tard depuis le CRM.
 */
export function DialogueRattachement(props: Props) {
  return (
    <Dialog open={props.ouvert} onOpenChange={(ouvert) => !ouvert && props.onFerme()}>
      <ContenuDialogue className="sm:max-w-[520px]">
        {/* La clé remet le formulaire à zéro entre deux ouvertures : une recherche
            laissée en place ferait enregistrer la suivante sur le mauvais dossier. */}
        {props.ouvert && <Contenu key={String(props.ouvert)} {...props} />}
      </ContenuDialogue>
    </Dialog>
  )
}

function Contenu({
  clients,
  totalTexte,
  enCours,
  rechercheInitiale,
  onClientExistant,
  onNouveauClient,
}: Props) {
  const [mode, setMode] = useState<'existant' | 'nouveau'>('existant')
  const [recherche, setRecherche] = useState(rechercheInitiale ?? '')
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [marquerContacte, setMarquerContacte] = useState(true)

  const terme = recherche.trim().toLowerCase()
  const resultats = clients.filter((c) => !terme || c.nom.toLowerCase().includes(terme)).slice(0, 6)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">
          Enregistrer au dossier client
        </DialogTitle>
        <DialogDescription className="text-ink2 text-[15px] leading-[22px]">
          Estimation de <span className="text-ink font-semibold tabular-nums">{totalTexte}</span>.
          Elle apparaîtra dans la chronologie du client.
        </DialogDescription>
      </DialogHeader>

      {/*
        Le mode COURANT est un pavé — filet, fond, graisse ; l'autre est du
        texte. Même vocabulaire que les commutateurs du module, et aucun rail
        gris derrière : deux boîtes identiques ne diraient pas laquelle est
        retenue.
      */}
      <div className="flex gap-1">
        <Onglet actif={mode === 'existant'} onClick={() => setMode('existant')}>
          Client existant
        </Onglet>
        <Onglet
          actif={mode === 'nouveau'}
          onClick={() => {
            setNom(recherche.trim())
            setMode('nouveau')
          }}
        >
          Nouveau client
        </Onglet>
      </div>

      {/*
        Exigence EST-8 — la case est cochée par défaut, mais elle ne fait jamais
        reculer un dossier : le serveur ne l'applique qu'à un client encore au
        statut Prospect. Aucun statut ne change automatiquement.
      */}
      <div className="flex flex-col gap-1">
        <label className="hover:bg-hover flex cursor-pointer items-center gap-3 rounded-[6px] px-2 py-2 text-[15px]">
          <input
            type="checkbox"
            checked={marquerContacte}
            onChange={(e) => setMarquerContacte(e.target.checked)}
            className="accent-action size-4 shrink-0"
          />
          Marquer le client comme contacté
        </label>
        <p className="text-ink3 px-2 text-[13px] leading-[18px]">
          Sans effet si le dossier a déjà dépassé le statut Prospect.
        </p>
      </div>

      {mode === 'existant' ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search
              className="text-ink3 pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
              aria-hidden
            />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              autoFocus
              placeholder="Rechercher un client"
              aria-label="Rechercher un client"
              className={cn(CHAMP, 'ps-9')}
            />
          </div>

          <div className="flex max-h-[280px] flex-col gap-0.5 overflow-auto">
            {resultats.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={enCours}
                onClick={() => onClientExistant(c.id, marquerContacte)}
                className="hover:bg-hover flex min-h-11 w-full items-center gap-3 rounded-[6px] px-2.5 py-2 text-left disabled:opacity-60"
              >
                <User className="text-ink3 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <Tronque className="max-w-72 text-[15px] leading-[22px] font-medium">
                    {c.nom}
                  </Tronque>
                  <span className="text-ink3 block text-[13px] leading-[18px]">
                    {LIBELLE_TYPE_CLIENT[c.type]} · {LIBELLE_STATUT_CLIENT[c.statut]}
                  </span>
                </span>
              </button>
            ))}

            {resultats.length === 0 && (
              <div className="px-2 py-5 text-center">
                <p className="text-ink2 text-[13px] leading-[18px]">
                  {terme
                    ? `Aucun résultat pour « ${recherche} ».`
                    : 'Aucun client pour cette entreprise. Ajoutez le premier.'}
                </p>
                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="sm"
                  className="mt-2.5"
                  onClick={() => {
                    setNom(recherche.trim())
                    setMode('nouveau')
                  }}
                >
                  Créer ce client
                </Bouton>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!nom.trim()) return
            onNouveauClient(nom.trim(), telephone.trim(), marquerContacte)
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rattachement-nom" className="text-[13px] leading-[18px] font-medium">
              Nom
            </label>
            {/*
              Aucun astérisque ni mention « obligatoire » : le refus est porté
              par le bouton, inerte tant que le nom manque — section 19.
            */}
            <input
              id="rattachement-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
              placeholder="Nom du client"
              className={CHAMP}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rattachement-tel" className="text-[13px] leading-[18px] font-medium">
              Téléphone
            </label>
            <input
              id="rattachement-tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="418 555-0123"
              className={cn(CHAMP, 'tabular-nums')}
            />
          </div>

          <p className="text-ink3 text-[13px] leading-[18px]">
            Le reste de la fiche se complète plus tard depuis le CRM.
          </p>

          <Bouton type="submit" disabled={!nom.trim()} chargement={enCours}>
            Créer et enregistrer
          </Bouton>
        </form>
      )}
    </>
  )
}

function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        'flex h-9 shrink-0 items-center rounded-[8px] px-3 text-[13px] leading-4.5 whitespace-nowrap',
        actif
          ? 'border-border bg-raised text-ink border font-medium'
          : 'text-ink2 hover:text-ink border border-transparent',
      )}
    >
      {children}
    </button>
  )
}
