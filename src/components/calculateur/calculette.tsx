'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RotateCcw, User, X } from 'lucide-react'
import { DialogueRattachement } from '@/components/calculateur/dialogue-rattachement'
import { Bouton } from '@/components/shared/bouton'
import { Choix } from '@/components/shared/choix'
import { Tronque } from '@/components/shared/tronque'
import {
  dupliquerEstimation,
  enregistrerEstimation,
  creerClientRapide,
} from '@/lib/actions/estimations'
import {
  analyserNombre,
  calculer,
  formaterMontant,
  formaterPourcentage,
  formaterPrixUnitaire,
  formaterQuantite,
} from '@/lib/domaine/estimation'
import { TAUX_TPS, TAUX_TVQ } from '@/config/taxes'
import { notifier } from '@/lib/toast'
import { useBrouillon } from '@/lib/brouillon'
import { cn } from '@/lib/utils'
import type { EntrepriseSlug } from '@/config/entreprises'
import type { ClientRattachement, LigneDocument, ProduitCalculateur } from '@/lib/data/estimations'
import { CHAMP as CHAMP_PARTAGE } from '@/components/shared/gabarits'

/** Valeur du sélecteur pour une ligne reprise d'une estimation dupliquée. */
const VALEUR_FIGEE = '__figee'

/**
 * Le gabarit des quatre colonnes, écrit une fois : l'en-tête et les rangées
 * doivent battre la même mesure, et rien à la lecture ne relierait deux chaînes
 * de classes identiques posées à cinquante lignes d'écart.
 */
const GRILLE_LIGNE = 'sm:grid-cols-[minmax(0,1fr)_120px_140px_36px]'

/** Le gabarit du produit, plus la chasse tabulaire : ici tout est chiffre. */
const CHAMP = cn(CHAMP_PARTAGE, 'tabular-nums')

type LigneSaisie = {
  cle: string
  produitId: string | null
  /** Ligne héritée d'une duplication : le produit peut avoir quitté le catalogue. */
  figee: { designation: string; unite: string; prixUnitaire: number } | null
  quantite: string
}

type BrouillonCalcul = {
  lignes: LigneSaisie[]
  fraisDeplacement: string
  majorationPct: string
  rabaisMontant: string
  rabaisPct: string
}

type Props = {
  slug: EntrepriseSlug
  produits: ProduitCalculateur[]
  grilleId: string | null
  clients: ClientRattachement[]
  /**
   * Nom du client d'où provient l'appel, quand on arrive depuis sa fiche CRM.
   * Sert uniquement à préremplir la recherche du rattachement — EST-6 tient :
   * le client n'est pas une condition de départ, le calcul commence sans lui.
   */
  clientInitialNom: string | null
  /** Clé du brouillon : jamais proposé à quelqu'un d'autre (TR-13). */
  utilisateurId: string
  valideJusquauTexte: string
  /** Exigence EST-11 — copie d'une estimation existante. L'original n'est pas touché. */
  origine: {
    id: string
    lignes: LigneDocument[]
    fraisDeplacement: number
    majorationPct: number
    rabaisMontant: number
    rabaisPct: number
  } | null
}

function texteNombre(valeur: number): string {
  return valeur === 0 ? '' : formaterQuantite(valeur)
}

/**
 * La calculette — exigences EST-1 à EST-6.
 *
 * Tout le calcul se fait ici, dans le navigateur, à partir du domaine pur : le
 * total suit la frappe sans aucun aller-retour. Le serveur le refait à
 * l'enregistrement, sur les mêmes fonctions.
 *
 * C'est un outil de conversation téléphonique : le premier sélecteur prend le
 * focus à l'ouverture, et la touche entrée ajoute une ligne sans quitter le
 * clavier.
 */
export function Calculette({
  slug,
  produits,
  grilleId,
  clients,
  clientInitialNom,
  utilisateurId,
  valideJusquauTexte,
  origine,
}: Props) {
  /*
    TR-13 — une estimation se compose PENDANT un appel. Perdre quinze lignes
    parce qu'un onglet s'est fermé oblige à rappeler le client, ou à improviser.

    Le brouillon est propre à l'entreprise et à l'origine d'une duplication :
    deux calculs en cours ne doivent pas se mélanger. Il est lu AVANT les états,
    puisqu'il en fournit les valeurs initiales.
  */
  const {
    brouillon: brouillonInitial,
    enregistrer: retenir,
    oublier,
  } = useBrouillon<BrouillonCalcul>(utilisateurId, `calcul:${slug}:${origine?.id ?? 'neuf'}`)

  const [lignes, setLignes] = useState<LigneSaisie[]>(
    () =>
      brouillonInitial?.lignes ??
      (origine && origine.lignes.length > 0
        ? origine.lignes.map((l, i) => ({
            cle: `l${i}`,
            produitId: null,
            figee: {
              designation: l.designation,
              unite: l.unite,
              prixUnitaire: l.prixUnitaire,
            },
            quantite: texteNombre(l.quantite),
          }))
        : [{ cle: 'l0', produitId: null, figee: null, quantite: '' }]),
  )
  const [fraisDeplacement, setFraisDeplacement] = useState(
    brouillonInitial?.fraisDeplacement ?? texteNombre(origine?.fraisDeplacement ?? 0),
  )
  const [majorationPct, setMajorationPct] = useState(
    brouillonInitial?.majorationPct ?? texteNombre(origine?.majorationPct ?? 0),
  )
  const [rabaisMontant, setRabaisMontant] = useState(
    brouillonInitial?.rabaisMontant ?? texteNombre(origine?.rabaisMontant ?? 0),
  )
  const [rabaisPct, setRabaisPct] = useState(
    brouillonInitial?.rabaisPct ?? texteNombre(origine?.rabaisPct ?? 0),
  )

  const [brouillonRepris] = useState(() => brouillonInitial !== null)
  const [rattachementOuvert, setRattachementOuvert] = useState(false)
  const [enCours, demarrer] = useTransition()
  const compteur = useRef(lignes.length)
  const router = useRouter()

  /**
   * La cible du focus est une référence et non un état : elle ne décrit rien de
   * ce qui s'affiche, et la porter en état déclencherait un rendu de plus à
   * chaque ligne ajoutée.
   *
   * Elle part à `0` : le premier sélecteur prend le focus à l'ouverture, on
   * calcule en parlant au téléphone. `autoFocus` ne peut plus le faire — le
   * contrôle est dessiné, et sa cible de focus est un déclencheur de menu.
   */
  const aFocaliser = useRef<number | null>(0)

  useEffect(() => {
    if (aFocaliser.current === null) return
    document.getElementById(`calculateur-service-${aFocaliser.current}`)?.focus()
    aFocaliser.current = null
  })

  /*
    Le brouillon suit les cinq états. Un effet, et non un appel dans chaque
    setter : c'est une écriture vers un stockage EXTERNE, exactement ce à quoi
    sert un effet — et il y aurait sinon huit points d'appel à ne pas oublier.

    Rien n'est retenu tant que le formulaire est vierge : créer un brouillon
    pour un écran qu'on n'a fait qu'ouvrir ferait annoncer une « saisie reprise »
    qui n'existe pas.
  */
  const vierge =
    lignes.every((l) => !l.produitId && !l.figee && !l.quantite.trim()) &&
    !fraisDeplacement.trim() &&
    !majorationPct.trim() &&
    !rabaisMontant.trim() &&
    !rabaisPct.trim()

  useEffect(() => {
    if (vierge) return
    retenir({ lignes, fraisDeplacement, majorationPct, rabaisMontant, rabaisPct })
  }, [vierge, lignes, fraisDeplacement, majorationPct, rabaisMontant, rabaisPct, retenir])

  const parId = new Map(produits.map((p) => [p.id, p]))
  const options = produits.map((p) => ({ valeur: p.id, libelle: p.nom }))

  const lignesCalcul = lignes.map((l) => {
    const produit = l.produitId ? parId.get(l.produitId) : undefined
    const source = produit
      ? {
          designation: produit.nom,
          unite: produit.unite,
          prixUnitaire: produit.prixUnitaire,
        }
      : (l.figee ?? { designation: '', unite: '—', prixUnitaire: 0 })

    return { ...source, quantite: analyserNombre(l.quantite) }
  })

  const totaux = calculer(lignesCalcul, {
    fraisDeplacement: analyserNombre(fraisDeplacement),
    majorationPct: analyserNombre(majorationPct),
    rabaisMontant: analyserNombre(rabaisMontant),
    rabaisPct: analyserNombre(rabaisPct),
  })

  const retenues = lignesCalcul
    .map((l, i) => ({ ...l, sousTotal: totaux.lignes[i] ?? 0 }))
    .filter((l) => l.designation && l.quantite > 0)

  function modifierLigne(index: number, patch: Partial<LigneSaisie>) {
    setLignes((actuelles) => actuelles.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function ajouterLigne() {
    compteur.current += 1
    setLignes((actuelles) => [
      ...actuelles,
      {
        cle: `l${compteur.current}`,
        produitId: null,
        figee: null,
        quantite: '',
      },
    ])
    aFocaliser.current = lignes.length
  }

  function retirerLigne(index: number) {
    setLignes((actuelles) => {
      const restantes = actuelles.filter((_, i) => i !== index)
      if (restantes.length > 0) return restantes
      compteur.current += 1
      return [
        {
          cle: `l${compteur.current}`,
          produitId: null,
          figee: null,
          quantite: '',
        },
      ]
    })
  }

  /**
   * Exigence EST-1 : entrée ajoute une ligne et y place le curseur. C'est ce qui
   * rend l'outil tenable pendant un appel — la main ne quitte pas le clavier.
   */
  function surToucheQuantite(evenement: React.KeyboardEvent, index: number) {
    if (evenement.key !== 'Enter') return
    evenement.preventDefault()

    if (index < lignes.length - 1) {
      document.getElementById(`calculateur-service-${index + 1}`)?.focus()
      return
    }
    ajouterLigne()
  }

  function corpsEstimation(clientId: string, marquerContacte: boolean) {
    return {
      entreprise: slug,
      clientId,
      marquerContacte,
      grilleId,
      fraisDeplacement: analyserNombre(fraisDeplacement),
      majorationPct: analyserNombre(majorationPct),
      rabaisMontant: analyserNombre(rabaisMontant),
      rabaisPct: analyserNombre(rabaisPct),
      lignes: lignes
        .map((l, i) => {
          const calcul = lignesCalcul[i]
          if (!calcul || !calcul.designation || calcul.quantite <= 0) return null
          return {
            produitId: l.produitId,
            designation: calcul.designation,
            unite: calcul.unite,
            prixUnitaire: calcul.prixUnitaire,
            quantite: calcul.quantite,
          }
        })
        .filter((l) => l !== null),
    }
  }

  function reinitialiser() {
    oublier()
    compteur.current += 1
    setLignes([
      {
        cle: `l${compteur.current}`,
        produitId: null,
        figee: null,
        quantite: '',
      },
    ])
    setFraisDeplacement('')
    setMajorationPct('')
    setRabaisMontant('')
    setRabaisPct('')
  }

  function traiter(resultat: Awaited<ReturnType<typeof enregistrerEstimation>>) {
    if (!resultat.ok) {
      notifier.erreur(resultat.erreur)
      return
    }

    const { reference, clientNom, id } = resultat.donnees
    setRattachementOuvert(false)
    reinitialiser()
    // On reste sur le calculateur, prêt pour l'estimation suivante : la
    // notification porte le lien vers ce qui vient d'être créé.
    notifier.succes(`Estimation ${reference} enregistrée au dossier de ${clientNom}.`, {
      label: 'Voir l’estimation',
      onClick: () => router.push(`/calculateur/${slug}/estimations/${id}`),
    })
  }

  function enregistrer(clientId: string, marquerContacte: boolean) {
    demarrer(async () => {
      const corps = corpsEstimation(clientId, marquerContacte)
      traiter(
        origine
          ? await dupliquerEstimation({ ...corps, origineId: origine.id })
          : await enregistrerEstimation(corps),
      )
    })
  }

  function creerPuisEnregistrer(nom: string, telephone: string, marquerContacte: boolean) {
    demarrer(async () => {
      // Deux actions plutôt qu'une : le journal doit garder « Création d'une
      // fiche client » distincte de « Création d'une estimation ».
      const client = await creerClientRapide({
        entreprise: slug,
        nom,
        telephone,
      })
      if (!client.ok) {
        notifier.erreur(client.erreur)
        return
      }

      const corps = corpsEstimation(client.donnees.id, marquerContacte)
      traiter(
        origine
          ? await dupliquerEstimation({ ...corps, origineId: origine.id })
          : await enregistrerEstimation(corps),
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {brouillonRepris && (
        <p
          role="status"
          className="border-border bg-raised text-ink2 flex items-center gap-2 rounded-[10px] border px-4 py-3 text-[13px] leading-[18px]"
        >
          <RotateCcw className="text-ink3 size-4 shrink-0" aria-hidden />
          Calcul en cours repris. Il n’est pas encore enregistré.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-[17px] leading-6 font-semibold">Services</h2>

            {produits.length === 0 ? (
              /*
                Le cadre reste, avec une phrase à la place des rangées : la
                grille de saisie ne disparaît pas, elle répond.
              */
              <div className="border-border bg-raised mt-3 rounded-[10px] border">
                <p className="text-ink2 px-6 py-9 text-center text-[15px] leading-[22px]">
                  Aucune grille de tarifs active pour cette entreprise. Un administrateur doit en
                  enregistrer une avant de calculer.
                </p>
              </div>
            ) : (
              <>
                <div className="border-border bg-raised mt-3 rounded-[10px] border">
                  {/*
                    L'en-tête bat la mesure des rangées — 44 px, casse normale,
                    13/18 en demi-gras — comme le tableau du produit. Il est
                    masqué aux technologies d'assistance : chaque contrôle porte
                    déjà son propre nom, et trois mots isolés annoncés en plus ne
                    diraient à quelle ligne ils se rapportent.
                  */}
                  <div
                    aria-hidden
                    className={cn(
                      'border-border text-ink3 hidden h-11 items-center gap-2 border-b px-3 text-[13px] leading-[18px] font-medium sm:grid',
                      GRILLE_LIGNE,
                    )}
                  >
                    <span>Service</span>
                    <span className="text-right">Quantité</span>
                    <span className="text-right">Montant</span>
                    <span />
                  </div>

                  {lignes.map((ligne, index) => {
                    const calcul = lignesCalcul[index]
                    /*
                      EST-1 — le tarif du service choisi, lisible SANS quitter la
                      ligne : la personne au téléphone doit pouvoir répondre « c'est
                      45 $ du mètre » pendant qu'elle saisit la quantité.

                      `designation` non vide est le seul témoin fiable d'un service
                      choisi : une ligne FIGÉE — reprise d'une duplication, produit
                      sorti du catalogue — n'a pas de `produitId` mais porte bien un
                      prix, et un prix nul est une valeur, pas une absence.
                    */
                    const tarif =
                      calcul && calcul.designation
                        ? formaterPrixUnitaire(calcul.prixUnitaire, calcul.unite)
                        : null
                    return (
                      /*
                        ─────────────────────────────────────────────────────
                        Deux dispositions, parce que c'est l'outil du téléphone.

                        Les quatre colonnes fixes totalisent 296 px plus les
                        gouttières : sur un écran de 375 px, il ne resterait rien
                        pour le sélecteur de service.

                        En dessous de `sm`, la ligne se plie en deux rangées :
                        service et retrait au-dessus, quantité et sous-total en
                        dessous. `order-*` réordonne sans toucher au DOM, donc
                        sans déplacer le parcours au clavier — ce qui compte, la
                        touche entrée servant à enchaîner les lignes (EST-1).
                        ─────────────────────────────────────────────────────
                      */
                      <div
                        key={ligne.cle}
                        className={cn(
                          'border-border grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2 border-b px-3 py-2.5 last:border-0',
                          GRILLE_LIGNE,
                        )}
                      >
                        <div className="order-1 flex min-w-0 flex-col gap-1 sm:order-none">
                          <Choix
                            id={`calculateur-service-${index}`}
                            valeur={ligne.produitId ?? (ligne.figee ? VALEUR_FIGEE : '')}
                            options={
                              ligne.figee
                                ? [
                                    { valeur: VALEUR_FIGEE, libelle: ligne.figee.designation },
                                    ...options,
                                  ]
                                : options
                            }
                            parDefaut="Choisir un service…"
                            annonce={`Service de la ligne ${index + 1}`}
                            // Le tarif décrit le SERVICE. Il a été rattaché au
                            // champ de quantité tant que `Choix` n'acceptait
                            // aucune description.
                            decritPar={tarif ? `calculateur-tarif-${index}` : undefined}
                            champ
                            onChoisir={(v) =>
                              modifierLigne(index, {
                                // « Choisir un service… » vaut null, jamais la chaîne
                                // vide : elle remonterait telle quelle au serveur.
                                produitId: v === VALEUR_FIGEE || v === null ? null : v,
                                figee: v === VALEUR_FIGEE ? ligne.figee : null,
                              })
                            }
                          />

                          {tarif && (
                            <span
                              id={`calculateur-tarif-${index}`}
                              className="text-ink2 px-0.5 text-[11px] leading-[14px] tabular-nums"
                            >
                              {tarif}
                            </span>
                          )}
                        </div>

                        <div className="relative order-3 sm:order-none">
                          <input
                            value={ligne.quantite}
                            onChange={(e) => modifierLigne(index, { quantite: e.target.value })}
                            onKeyDown={(e) => surToucheQuantite(e, index)}
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`Quantité de la ligne ${index + 1}`}
                            className={cn(CHAMP, 'pe-12 text-right')}
                          />
                          <span className="text-ink3 pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px]">
                            {calcul?.unite ?? '—'}
                          </span>
                        </div>

                        <span className="order-4 text-right text-[15px] font-medium tabular-nums sm:order-none">
                          {calcul && calcul.quantite > 0
                            ? formaterMontant(totaux.lignes[index] ?? 0)
                            : '—'}
                        </span>

                        <button
                          type="button"
                          onClick={() => retirerLigne(index)}
                          aria-label={`Retirer la ligne ${index + 1}`}
                          className="text-ink3 hover:bg-hover2 hover:text-critical order-2 flex size-11 items-center justify-center justify-self-end rounded-[6px] sm:order-none sm:size-9"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="sm"
                  className="mt-3"
                  onClick={ajouterLigne}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Ajouter un service
                </Bouton>
              </>
            )}
          </section>

          <section>
            <h2 className="text-[17px] leading-6 font-semibold">Ajustements</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ChampMontant
                id="ajustement-frais"
                libelle="Frais de déplacement"
                valeur={fraisDeplacement}
                onChange={setFraisDeplacement}
                placeholder="0,00"
              />
              <ChampMontant
                id="ajustement-majoration"
                libelle="Majoration (%)"
                valeur={majorationPct}
                onChange={setMajorationPct}
                placeholder="0"
              />
              <ChampMontant
                id="ajustement-rabais-montant"
                libelle="Rabais ($)"
                valeur={rabaisMontant}
                onChange={setRabaisMontant}
                placeholder="0,00"
              />
              <ChampMontant
                id="ajustement-rabais-pct"
                libelle="Rabais (%)"
                valeur={rabaisPct}
                onChange={setRabaisPct}
                placeholder="0"
              />
            </div>
          </section>
        </div>

        <aside className="border-border bg-raised rounded-[10px] border p-5 xl:sticky xl:top-6">
          <h2 className="text-[17px] leading-6 font-semibold">Estimation en direct</h2>

          {retenues.length === 0 ? (
            <p className="text-ink2 mt-3 text-[13px] leading-[18px]">
              Choisissez un service et une quantité pour voir le total apparaître ici.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-2.5">
                {retenues.map((l, i) => (
                  <div key={i} className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1">
                      <Tronque className="max-w-72 text-[13px] leading-[18px] font-medium">
                        {l.designation}
                      </Tronque>
                      <span className="text-ink3 block text-[11px] leading-[14px] tabular-nums">
                        {formaterQuantite(l.quantite)} {l.unite} × {formaterMontant(l.prixUnitaire)}
                      </span>
                    </span>
                    <span className="text-[13px] whitespace-nowrap tabular-nums">
                      {formaterMontant(l.sousTotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-border my-4 h-px" />

              <dl className="flex flex-col gap-2 text-[13px] leading-[18px]">
                <Ligne libelle="Sous-total" valeur={formaterMontant(totaux.sousTotalLignes)} />
                {totaux.fraisDeplacement > 0 && (
                  <Ligne
                    libelle="Frais de déplacement"
                    valeur={formaterMontant(totaux.fraisDeplacement)}
                  />
                )}
                {totaux.majoration > 0 && (
                  <Ligne libelle="Majoration" valeur={formaterMontant(totaux.majoration)} />
                )}
                {totaux.rabais > 0 && (
                  <Ligne libelle="Rabais" valeur={`− ${formaterMontant(totaux.rabais)}`} />
                )}
                <Ligne
                  libelle={`TPS (${formaterPourcentage(TAUX_TPS * 100)})`}
                  valeur={formaterMontant(totaux.tps)}
                />
                <Ligne
                  libelle={`TVQ (${formaterPourcentage(TAUX_TVQ * 100)})`}
                  valeur={formaterMontant(totaux.tvq)}
                />
              </dl>

              <div className="bg-border-strong my-4 h-px" />

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">Total</span>
                {/* Grand nombre isolé : chiffres proportionnels, pas tabulaires — section 19. */}
                <span className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">
                  {formaterMontant(totaux.total)}
                </span>
              </div>
              <p className="text-ink3 mt-2 text-[11px] leading-[14px]">{valideJusquauTexte}</p>
            </>
          )}

          {/* Seul bouton noir de l'écran — les onglets sont des liens, et
              « Ajouter un service » compose, il n'engage rien. */}
          <Bouton
            type="button"
            onClick={() => {
              if (totaux.total <= 0) {
                notifier.erreur('Ajoutez au moins un service avant d’enregistrer.')
                return
              }
              setRattachementOuvert(true)
            }}
            className="mt-5 w-full"
            chargement={enCours}
          >
            {!enCours && <User className="size-4" aria-hidden />}
            Enregistrer au dossier client
          </Bouton>
        </aside>
      </div>

      <DialogueRattachement
        ouvert={rattachementOuvert}
        onFerme={() => setRattachementOuvert(false)}
        clients={clients}
        totalTexte={formaterMontant(totaux.total)}
        enCours={enCours}
        rechercheInitiale={clientInitialNom ?? undefined}
        onClientExistant={enregistrer}
        onNouveauClient={creerPuisEnregistrer}
      />
    </div>
  )
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="text-ink2 flex justify-between gap-3">
      <dt>{libelle}</dt>
      <dd className="text-ink tabular-nums">{valeur}</dd>
    </div>
  )
}

function ChampMontant({
  id,
  libelle,
  valeur,
  onChange,
  placeholder,
}: {
  id: string
  libelle: string
  valeur: string
  onChange: (valeur: string) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium">
        {libelle}
      </label>
      <input
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className={cn(CHAMP, 'text-right')}
      />
    </div>
  )
}
