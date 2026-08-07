'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AlertCircle, Ban, MoreHorizontal, RotateCcwKey, UserCheck, UserPen } from 'lucide-react'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { Bouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'
import { DialogueUtilisateur, type CompteAModifier } from '@/components/admin/dialogue-utilisateur'
import { reactiverCompte, reinitialiserMotDePasse, suspendreCompte } from '@/lib/actions/admin'
import { notifier } from '@/lib/toast'
import { LIBELLE_ROLE, type Role } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/**
 * Une seule taille pour toutes les colonnes.
 *
 * Le nom était en 15 px gras, en encre pleine, et le courriel en 13 px : la
 * ligne se lisait en deux temps, et le nom prenait le pas sur ce qu'on vient
 * chercher — le rôle, la dernière connexion, le statut. Même taille et même
 * encre partout : c'est la colonne qu'on consulte qui décide, pas la mise en
 * forme.
 */
const CELLULE = 'text-[13px]'

/**
 * Gabarit d'une ligne de menu — le même que celui du menu du compte, section 19.
 *
 * `gap-2.5` suppose une icône : chaque entrée en porte une, et une entrée sans
 * icône se décalerait de l'alignement des autres.
 */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

export type LigneUtilisateur = {
  id: string
  nom: string
  courriel: string
  role: Role | null
  suspendu: boolean
  motifSuspension: string | null
  /** Déjà formatée côté serveur : la formater ici ferait diverger les deux rendus. */
  derniereConnexion: string
  /** Le compte de l'utilisateur connecté — ses gestes destructeurs sont retirés. */
  soiMeme: boolean
}

export function TableauUtilisateurs({ utilisateurs }: { utilisateurs: LigneUtilisateur[] }) {
  const [aModifier, setAModifier] = useState<CompteAModifier | null>(null)
  const [aSuspendre, setASuspendre] = useState<LigneUtilisateur | null>(null)
  const [aReactiver, setAReactiver] = useState<LigneUtilisateur | null>(null)
  const [enCours, demarrer] = useTransition()

  function reinitialiser(u: LigneUtilisateur) {
    demarrer(async () => {
      const r = await reinitialiserMotDePasse({ courriel: u.courriel })
      if (r.ok) notifier.succes(`Courriel de réinitialisation envoyé à ${u.courriel}.`)
      else notifier.erreur(r.erreur)
    })
  }

  function confirmerReactivation() {
    if (!aReactiver) return
    const cible = aReactiver

    demarrer(async () => {
      const r = await reactiverCompte({ courriel: cible.courriel })
      if (r.ok) {
        notifier.succes('Statut du compte mis à jour.')
        setAReactiver(null)
      } else notifier.erreur(r.erreur)
    })
  }

  /**
   * Gestes de fin de ligne, repliés dans un menu.
   *
   * Trois libellés répétés sur chaque rangée formaient une colonne de mots plus
   * large que les données qu'ils accompagnent, et le regard butait dessus avant
   * d'atteindre le statut. Le menu les rend disponibles sans les faire lire
   * quatre fois.
   *
   * Le déclencheur reste VISIBLE en permanence, jamais révélé au survol : sur
   * une liste de quatre comptes, chercher où cliquer coûte plus que la sobriété
   * gagnée. `aria-label` le nomme, sinon il ne s'annonce que « bouton ».
   */
  const MenuActions = ({ compte: u }: { compte: LigneUtilisateur }) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions pour ${u.nom}`}
        className="text-ink3 hover:bg-hover2 hover:text-ink data-[state=open]:bg-hover2 data-[state=open]:text-ink inline-flex size-11 items-center justify-center rounded-sm md:size-8"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      {/*
        Même habillage que le menu du compte, dans la barre latérale : deux menus
        de la même application qui ne se ressemblent pas donnent l'impression
        d'avoir changé d'outil en cours de route.
      */}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className={cn('bg-raised shadow-menu w-40 rounded-[9px] px-1 py-1.5', FILET_FLOTTANT)}
      >
        <DropdownMenuItem
          className={LIGNE_MENU}
          onClick={() => setAModifier({ id: u.id, nom: u.nom, courriel: u.courriel, role: u.role })}
        >
          <UserPen className="size-3.75 shrink-0" aria-hidden />
          Modifier
        </DropdownMenuItem>

        <DropdownMenuItem
          className={LIGNE_MENU}
          disabled={enCours}
          onClick={() => reinitialiser(u)}
        >
          <RotateCcwKey className="size-3.75 shrink-0" aria-hidden />
          Réinitialiser
        </DropdownMenuItem>

        {/*
          Aucun geste de suspension sur son propre compte : le refuser côté
          serveur suffit à protéger, mais proposer une action vouée au refus est
          une invitation à se tromper.
        */}
        {!u.soiMeme && (
          <>
            {u.suspendu ? (
              <DropdownMenuItem className={LIGNE_MENU} onClick={() => setAReactiver(u)}>
                <UserCheck className="size-3.75 shrink-0" aria-hidden />
                Réactiver
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className={cn(LIGNE_MENU, 'text-critical-texte hover:text-critical-texte')}
                onClick={() => setASuspendre(u)}
              >
                <Ban className="size-3.75 shrink-0" aria-hidden />
                Suspendre
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const actions = (u: LigneUtilisateur) => (
    <>
      <Bouton
        variante="discrete"
        taille="xs"
        onClick={() => setAModifier({ id: u.id, nom: u.nom, courriel: u.courriel, role: u.role })}
      >
        Modifier
      </Bouton>
      <Bouton variante="discrete" taille="xs" onClick={() => reinitialiser(u)} disabled={enCours}>
        Réinitialiser
      </Bouton>
      {/*
        Aucun bouton de suspension sur son propre compte : le refuser côté serveur
        suffit à protéger, mais proposer un geste voué au refus est une invitation
        à se tromper.
      */}
      {!u.soiMeme &&
        (u.suspendu ? (
          <Bouton variante="discrete" taille="xs" onClick={() => setAReactiver(u)}>
            Réactiver
          </Bouton>
        ) : (
          <Bouton
            variante="discrete"
            taille="xs"
            className="text-critical-texte hover:text-critical-texte"
            onClick={() => setASuspendre(u)}
          >
            Suspendre
          </Bouton>
        ))}
    </>
  )

  return (
    <>
      <CadreTableau className="hidden md:block">
        <Tableau className="min-w-215">
          <EnTeteTableau>
            <ColonneTableau libelle="Nom" />
            <ColonneTableau libelle="Courriel" />
            <ColonneTableau libelle="Rôle" />
            <ColonneTableau libelle="Dernière connexion" />
            <ColonneTableau libelle="Statut" />
            <ColonneTableau libelle="Actions" aDroite />
          </EnTeteTableau>
          <CorpsTableau>
            {utilisateurs.map((u) => (
              <LigneTableau key={u.id}>
                <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-72')}>
                  {u.nom}
                </CelluleTableau>
                <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-80')}>
                  {u.courriel}
                </CelluleTableau>
                <CelluleTableau discret className={CELLULE}>
                  {libelleRole(u.role)}
                </CelluleTableau>
                <CelluleTableau discret chiffres className={CELLULE}>
                  {u.derniereConnexion}
                </CelluleTableau>
                <CelluleTableau
                  discret={!u.suspendu}
                  className={cn(CELLULE, u.suspendu && 'text-critical-texte')}
                >
                  {/*
                    Écrit, pas mis en pastille — décision du client, prise en
                    regardant cet écran. L'icône complète la règle de la section
                    19 : une couleur d'état vient toujours avec une icône ET un
                    mot. Elle garde la teinte pure, où le seuil n'est que de 3:1.
                  */}
                  <span className="inline-flex items-center gap-1.5">
                    {u.suspendu && <AlertCircle className="text-critical size-3.5" aria-hidden />}
                    {u.suspendu ? 'Suspendu' : 'Actif'}
                  </span>
                </CelluleTableau>
                <CelluleTableau aDroite>
                  <MenuActions compte={u} />
                </CelluleTableau>
              </LigneTableau>
            ))}
          </CorpsTableau>
        </Tableau>
      </CadreTableau>

      {/* Téléphone : un tableau de six colonnes y est illisible. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {utilisateurs.map((u) => (
          <li key={u.id} className="bg-surface border-border rounded-md border p-4">
            <p className="text-[15px] font-medium">
              <Tronque className="max-w-72">{u.nom}</Tronque>
            </p>
            <p className="text-ink3 text-[13px]">
              <Tronque className="max-w-80">{u.courriel}</Tronque>
            </p>
            <p className="text-ink2 mt-2 text-[13px]">
              {libelleRole(u.role)}
              <span aria-hidden> · </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  u.suspendu && 'text-critical-texte',
                )}
              >
                {u.suspendu && <AlertCircle className="text-critical size-3.5" aria-hidden />}
                {u.suspendu ? 'Suspendu' : 'Actif'}
              </span>
            </p>
            <p className="text-ink3 mt-2 text-[13px] tabular-nums">{u.derniereConnexion}</p>
            <div className="mt-3 flex flex-wrap gap-1">{actions(u)}</div>
          </li>
        ))}
      </ul>

      <DialogueUtilisateur
        compte={aModifier}
        ouvert={aModifier !== null}
        onFerme={() => setAModifier(null)}
      />

      <DialogueSuspension
        compte={aSuspendre}
        onFerme={() => setASuspendre(null)}
        onSuspendu={() => {
          setASuspendre(null)
        }}
      />

      <Dialog open={aReactiver !== null} onOpenChange={() => setAReactiver(null)}>
        <ContenuDialogue className="sm:max-w-120">
          <DialogHeader>
            <DialogTitle>Réactiver ce compte&nbsp;?</DialogTitle>
            <DialogDescription>{aReactiver?.nom} pourra de nouveau se connecter.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Bouton variante="secondaire" onClick={() => setAReactiver(null)}>
              Annuler
            </Bouton>
            <Bouton onClick={confirmerReactivation} chargement={enCours}>
              Réactiver
            </Bouton>
          </DialogFooter>
        </ContenuDialogue>
      </Dialog>
    </>
  )
}

/**
 * Rôle et statut s'ÉCRIVENT, ils ne se mettent pas en pastille.
 *
 * Six rangées portant chacune deux pilules colorées faisaient une grille de
 * capsules où le regard ne trouvait plus les noms. Le mot suffit : « Suspendu »
 * dit ce qu'une pastille rouge ne disait qu'à ceux qui en connaissaient le code.
 *
 * Seul le compte suspendu garde une couleur — le mot porte déjà l'information,
 * la teinte ne fait qu'attirer l'œil dessus. Aucune règle de la section 19 n'y
 * échappe : rien ici n'est dit par la couleur seule.
 */
function libelleRole(role: Role | null): string {
  return role ? LIBELLE_ROLE[role] : 'Rôle inconnu'
}

function DialogueSuspension({
  compte,
  onFerme,
  onSuspendu,
}: {
  compte: LigneUtilisateur | null
  onFerme: () => void
  onSuspendu: () => void
}) {
  const [motif, setMotif] = useState('')
  const [enCours, demarrer] = useTransition()

  function confirmer() {
    if (!compte) return
    demarrer(async () => {
      const r = await suspendreCompte({ courriel: compte.courriel, motif })
      if (r.ok) {
        notifier.succes('Statut du compte mis à jour.')
        setMotif('')
        onSuspendu()
      } else notifier.erreur(r.erreur)
    })
  }

  return (
    <Dialog open={compte !== null} onOpenChange={(o) => !o && onFerme()}>
      <ContenuDialogue className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>Suspendre ce compte&nbsp;?</DialogTitle>
          <DialogDescription>
            {compte?.nom} ne pourra plus se connecter. Ses entrées au journal d’audit sont
            conservées : un compte n’est jamais supprimé.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1.5">
          <span className="text-ink2 text-[13px]">Motif</span>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            className="border-border bg-surface w-full resize-none rounded-sm border px-3 py-2 text-[15px]"
          />
        </label>

        <DialogFooter>
          <Bouton variante="secondaire" onClick={onFerme}>
            Annuler
          </Bouton>
          <Bouton variante="destructive" onClick={confirmer} chargement={enCours}>
            Suspendre
          </Bouton>
        </DialogFooter>
      </ContenuDialogue>
    </Dialog>
  )
}
