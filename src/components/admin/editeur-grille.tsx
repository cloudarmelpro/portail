'use client'

import { useState, useTransition } from 'react'
import { Ban, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react'
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
import { Bouton } from '@/components/shared/bouton'
import { Choix } from '@/components/shared/choix'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { EtatVide } from '@/components/shared/etat-vide'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
  TableauVide,
} from '@/components/shared/tableau'
import { Tronque } from '@/components/shared/tronque'
import { enregistrerGrille } from '@/lib/actions/admin'
import { formaterMontant } from '@/lib/domaine/estimation'
import { notifier } from '@/lib/toast'
import { produitTarifSchema } from '@/lib/validations/admin'
import { cn } from '@/lib/utils'

/** Une seule taille et une seule encre pour toutes les colonnes — section 19. */
const CELLULE = 'text-[13px]'

/** Gabarit d'une ligne de menu — `gap-2.5` suppose une icône sur chaque entrée. */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

/* L'anneau de focus vient de la couche `base` : aucune utilitaire ne doit le
   retirer ici, `focus:border-ink` ne le remplace pas — un filet de 1 px n'est
   pas un contour détaché de 2 px. */
const CHAMP = 'border-border bg-surface h-10 w-full rounded-[6px] border px-3 text-[15px]'

export type LigneProduit = {
  /** Identifiant dans la version en cours. Absent pour une ligne ajoutée. */
  id?: string
  nom: string
  unite: string
  prixUnitaire: string
  actif: boolean
}

type Ligne = LigneProduit & { cle: string }

type Filtre = 'tous' | 'actifs' | 'retires'

/**
 * Édition d'une grille de tarifs — ADM-2 et ADM-3.
 *
 * Rien n'est modifié en place : le tableau compose la version SUIVANTE, et la
 * publication l'enregistre d'un bloc. Tant qu'on n'a pas publié, la grille en
 * vigueur reste celle que le calculateur applique — d'où l'écart possible entre
 * la bande de chiffres, qui décrit la version publiée, et ce tableau, qui
 * décrit celle qu'on prépare.
 */
export function EditeurGrille({
  entreprise,
  numero,
  produits,
  mention,
  selecteurEntreprise,
  historique,
}: {
  entreprise: string
  numero: number
  produits: LigneProduit[]
  /** Composée au serveur : elle porte une date, qui n'a pas le même fuseau ici. */
  mention: string
  selecteurEntreprise: React.ReactNode
  historique: React.ReactNode
}) {
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    produits.map((p, i) => ({ ...p, cle: p.id ?? `initiale-${i}` })),
  )
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [aModifier, setAModifier] = useState<Ligne | null>(null)
  const [ajout, setAjout] = useState(false)
  const [enCours, demarrer] = useTransition()

  const initiales = new Map(produits.map((p, i) => [p.id ?? `initiale-${i}`, p]))

  function enAttenteDe(l: Ligne): boolean {
    const avant = initiales.get(l.cle)
    if (!avant) return true
    return (
      avant.prixUnitaire !== l.prixUnitaire ||
      avant.actif !== l.actif ||
      avant.nom !== l.nom ||
      avant.unite !== l.unite
    )
  }

  const modifiees = lignes.filter(enAttenteDe).length
  const enAttente = modifiees > 0 || lignes.length !== produits.length

  const visibles = lignes.filter((l) =>
    filtre === 'actifs' ? l.actif : filtre === 'retires' ? !l.actif : true,
  )

  function majLigne(cle: string, champs: Partial<Ligne>) {
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...champs } : x)))
  }

  function retirerLigne(cle: string) {
    setLignes((l) => l.filter((x) => x.cle !== cle))
  }

  function annuler() {
    setLignes(produits.map((p, i) => ({ ...p, cle: p.id ?? `initiale-${i}` })))
  }

  function publier() {
    demarrer(async () => {
      const r = await enregistrerGrille({
        entreprise,
        depuisNumero: numero,
        produits: lignes.map((l) => ({
          id: l.id,
          nom: l.nom,
          unite: l.unite,
          prixUnitaire: l.prixUnitaire,
          actif: l.actif,
        })),
      })

      if (r.ok) {
        notifier.succes(`Version ${r.donnees.numero} enregistrée.`)
      } else notifier.erreur(r.erreur)
    })
  }

  /**
   * Gestes de fin de ligne, repliés dans un menu.
   *
   * Le déclencheur reste VISIBLE en permanence, jamais révélé au survol : sur
   * une grille de dix services, chercher où cliquer coûte plus que la sobriété
   * gagnée. `aria-label` le nomme, sinon il ne s'annonce que « bouton ».
   */
  const MenuActions = ({ ligne: l }: { ligne: Ligne }) => (
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
        <DropdownMenuItem className={LIGNE_MENU} onClick={() => setAModifier(l)}>
          <Pencil className="size-3.75 shrink-0" aria-hidden />
          Modifier
        </DropdownMenuItem>

        {l.actif ? (
          <DropdownMenuItem
            className={LIGNE_MENU}
            onClick={() => majLigne(l.cle, { actif: false })}
          >
            <Ban className="size-3.75 shrink-0" aria-hidden />
            Retirer du catalogue
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className={LIGNE_MENU} onClick={() => majLigne(l.cle, { actif: true })}>
            <RotateCcw className="size-3.75 shrink-0" aria-hidden />
            Remettre au catalogue
          </DropdownMenuItem>
        )}

        {/*
          Un service déjà publié ne se supprime pas : il figure dans des
          estimations passées, et le faire disparaître rendrait leur relecture
          incompréhensible. Seule une ligne encore jamais publiée s'enlève.
        */}
        {!l.id && (
          <DropdownMenuItem
            className={cn(LIGNE_MENU, 'text-critical-texte hover:text-critical-texte')}
            onClick={() => retirerLigne(l.cle)}
          >
            <Trash2 className="size-3.75 shrink-0" aria-hidden />
            Supprimer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const etat = (l: Ligne) => (
    <>
      {l.actif ? 'Actif' : 'Retiré'}
      {enAttenteDe(l) && <span className="text-ink3"> · en attente</span>}
    </>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {selecteurEntreprise}

        {/*
          Le même choix déroulant que le journal d'audit, et pour la même raison :
          un `<select>` natif porte le style du SYSTÈME, pas celui du produit.
          Sa flèche et sa liste venaient de Windows, à côté de contrôles dessinés.
        */}
        <Choix
          valeur={filtre === 'tous' ? '' : filtre}
          options={[
            { valeur: 'actifs', libelle: 'Actifs' },
            { valeur: 'retires', libelle: 'Retirés' },
          ]}
          parDefaut="Tous les services"
          annonce="Filtrer par état"
          onChoisir={(v) => setFiltre((v ?? 'tous') as Filtre)}
        />

        <div className="ml-auto flex items-center gap-2">
          {historique}
          <Bouton onClick={publier} disabled={!enAttente} chargement={enCours}>
            Enregistrer une nouvelle version
          </Bouton>
        </div>
      </div>

      <p className="text-ink2 mt-4 max-w-180 text-[13px] leading-4.5">{mention}</p>

      <div className="mt-3">
        {lignes.length === 0 ? (
          /*
            Aucun service du tout : c'est le PREMIER usage, et là il y a quelque
            chose à expliquer. L'état vide complet est justifié — il dit quoi
            faire ensuite, et porte le seul geste possible.
          */
          <EtatVide
            titre="Aucun service dans cette grille"
            message="Ajoutez un premier service, puis enregistrez une nouvelle version."
          >
            <Bouton variante="secondaire" onClick={() => setAjout(true)}>
              <Plus className="size-4" aria-hidden />
              Ajouter un service
            </Bouton>
          </EtatVide>
        ) : visibles.length === 0 ? (
          /*
            Filtre sans résultat : il n'y a rien à expliquer et rien à créer,
            donc une seule phrase dans le cadre du tableau. La grille répond au
            lieu de disparaître.
          */
          <TableauVide>
            Aucun service ne correspond à ce filtre. Retirez le filtre pour voir toute la grille.
          </TableauVide>
        ) : (
          <>
            <CadreTableau className="hidden md:block">
              <Tableau className="min-w-180">
                <EnTeteTableau>
                  <ColonneTableau libelle="Service" />
                  <ColonneTableau libelle="Unité" />
                  <ColonneTableau libelle="Prix unitaire" aDroite />
                  <ColonneTableau libelle="État" />
                  <ColonneTableau libelle="Actions" aDroite />
                </EnTeteTableau>
                <CorpsTableau>
                  {visibles.map((l) => (
                    <LigneTableau key={l.cle}>
                      <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-72')}>
                        {l.nom}
                      </CelluleTableau>
                      <CelluleTableau discret tronque className={cn(CELLULE, 'max-w-48')}>
                        {l.unite}
                      </CelluleTableau>
                      <CelluleTableau discret chiffres aDroite className={CELLULE}>
                        {prix(l.prixUnitaire)}
                      </CelluleTableau>
                      <CelluleTableau discret className={CELLULE}>
                        {etat(l)}
                      </CelluleTableau>
                      <CelluleTableau aDroite>
                        <MenuActions ligne={l} />
                      </CelluleTableau>
                    </LigneTableau>
                  ))}
                </CorpsTableau>
              </Tableau>
            </CadreTableau>

            {/* Téléphone : un tableau de cinq colonnes y est illisible. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visibles.map((l) => (
                <li
                  key={l.cle}
                  className="bg-surface border-border flex items-start gap-3 rounded-md border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">
                      <Tronque className="max-w-72">{l.nom}</Tronque>
                    </p>
                    <p className="text-ink2 mt-1 text-[13px]">
                      <Tronque className="max-w-48">{l.unite}</Tronque>
                    </p>
                    <p className="text-ink2 mt-2 text-[13px] tabular-nums">
                      {prix(l.prixUnitaire)}
                    </p>
                    <p className="text-ink2 mt-2 text-[13px]">{etat(l)}</p>
                  </div>
                  <MenuActions ligne={l} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/*
            Secondaire, comme son jumeau de l'état vide : le seul bouton noir de
            l'écran est celui qui PUBLIE. Ajouter une ligne compose la version
            suivante, ça ne l'engage pas.
          */}
          <Bouton variante="secondaire" onClick={() => setAjout(true)}>
            Ajouter
          </Bouton>

          {enAttente && (
            <Bouton variante="discrete" onClick={annuler}>
              <Undo2 className="size-4" aria-hidden />
              Annuler
            </Bouton>
          )}

          {enAttente && (
            <span className="text-ink2 ml-auto text-[13px] tabular-nums">
              {lignes.length !== produits.length
                ? `${lignes.length} services, ${modifiees} en attente`
                : `${modifiees} service${modifiees > 1 ? 's' : ''} en attente`}
            </span>
          )}
        </div>
      )}

      <DialogueService
        ligne={aModifier}
        ouvert={ajout || aModifier !== null}
        onFerme={() => {
          setAjout(false)
          setAModifier(null)
        }}
        onValide={(valeurs) => {
          if (aModifier) majLigne(aModifier.cle, valeurs)
          else setLignes((l) => [...l, { ...valeurs, cle: crypto.randomUUID(), actif: true }])
          setAjout(false)
          setAModifier(null)
        }}
      />
    </>
  )
}

/**
 * Le prix reste une CHAÎNE de bout en bout — saisie, validation, colonne
 * `Decimal`. Le nombre construit ici ne sert qu'à choisir la façon de l'écrire ;
 * il n'est jamais renvoyé au serveur.
 */
function prix(valeur: string): string {
  return formaterMontant(Number(valeur))
}

type Valeurs = { nom: string; unite: string; prixUnitaire: string }

/**
 * Saisie d'un service, à l'ajout comme à la modification.
 *
 * La validation locale emploie le schéma de la fabrique d'actions : sans elle,
 * une ligne mal saisie ne se signalerait qu'à la publication, où le refus porte
 * sur la grille entière et ne désigne aucune ligne.
 */
function DialogueService({
  ligne,
  ouvert,
  onFerme,
  onValide,
}: {
  ligne: Ligne | null
  ouvert: boolean
  onFerme: () => void
  onValide: (valeurs: Valeurs) => void
}) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFerme()}>
      <ContenuDialogue className="sm:max-w-120">
        {ouvert && (
          /* La clé réinitialise la saisie quand on passe d'un service à l'autre. */
          <FormulaireService
            key={ligne?.cle ?? 'ajout'}
            ligne={ligne}
            onFerme={onFerme}
            onValide={onValide}
          />
        )}
      </ContenuDialogue>
    </Dialog>
  )
}

function FormulaireService({
  ligne,
  onFerme,
  onValide,
}: {
  ligne: Ligne | null
  onFerme: () => void
  onValide: (valeurs: Valeurs) => void
}) {
  const [nom, setNom] = useState(ligne?.nom ?? '')
  const [unite, setUnite] = useState(ligne?.unite ?? '')
  const [prixUnitaire, setPrixUnitaire] = useState(ligne?.prixUnitaire ?? '')
  const [champs, setChamps] = useState<Record<string, string[]>>({})

  const modification = ligne !== null

  function envoyer() {
    const r = produitTarifSchema.safeParse({
      nom,
      unite,
      prixUnitaire,
      actif: ligne?.actif ?? true,
    })

    if (!r.success) {
      const erreurs: Record<string, string[]> = {}
      for (const probleme of r.error.issues) {
        const champ = String(probleme.path[0])
        erreurs[champ] = [...(erreurs[champ] ?? []), probleme.message]
      }
      setChamps(erreurs)
      return
    }

    // Le schéma normalise le prix — « 11,75 » devient « 11.75 » — et c'est cette
    // forme qui doit être conservée, sinon l'écart avec la version précédente se
    // calcule sur deux écritures du même montant.
    onValide({
      nom: r.data.nom,
      unite: r.data.unite,
      prixUnitaire: r.data.prixUnitaire,
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{modification ? 'Modifier le service' : 'Ajouter un service'}</DialogTitle>
        <DialogDescription>
          Les estimations déjà émises conservent les prix de leur version.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Champ libelle="Service" erreurs={champs.nom}>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="off"
            className={CHAMP}
          />
        </Champ>

        <Champ libelle="Unité" erreurs={champs.unite}>
          <input
            value={unite}
            onChange={(e) => setUnite(e.target.value)}
            autoComplete="off"
            className={CHAMP}
          />
        </Champ>

        <Champ libelle="Prix unitaire" erreurs={champs.prixUnitaire}>
          <input
            value={prixUnitaire}
            onChange={(e) => setPrixUnitaire(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className={cn(CHAMP, 'tabular-nums')}
          />
        </Champ>
      </div>

      <DialogFooter>
        <Bouton variante="secondaire" onClick={onFerme}>
          Annuler
        </Bouton>
        <Bouton onClick={envoyer}>{modification ? 'Enregistrer' : 'Ajouter'}</Bouton>
      </DialogFooter>
    </>
  )
}

function Champ({
  libelle,
  erreurs,
  children,
}: {
  libelle: string
  erreurs?: string[]
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] leading-[18px] font-medium">{libelle}</span>
      {children}
      {/*
        `role="alert"` : sans lui, un refus de validation n'est annoncé nulle
        part. À la soumission d'une invitation refusée, un lecteur d'écran
        restait muet — le seul module du produit dans ce cas.
      */}
      {erreurs?.map((e) => (
        <p key={e} role="alert" className="text-critical-texte text-[13px] leading-[18px]">
          {e}
        </p>
      ))}
    </label>
  )
}
