'use client'

import { useEffect, useRef } from 'react'
import { Download, FileText, FolderInput, Trash2, X } from 'lucide-react'
import { Bouton, classesBouton } from '@/components/shared/bouton'
import { FlecheDroite, FlecheGauche } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import { formatLisible, formaterTaille } from '@/components/cv/format-fichier'
import type { LigneFichier } from '@/components/cv/tableau-fichiers'

type Props = {
  fichier: LigneFichier
  position: number
  total: number
  peutTelecharger: boolean
  peutSupprimer: boolean
  peutReclasser: boolean
  onPrecedent: () => void
  onSuivant: () => void
  onFermer: () => void
  onReclasser: () => void
  onSupprimer: () => void
}

const RENDU_NAVIGATEUR = ['application/pdf']

/** Ce qui reçoit le focus au clavier — l'ordre du document fait le cycle. */
const SELECTEUR_FOCUSABLE =
  'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

/**
 * Aperçu d'un CV.
 *
 * Sans lui, la recruteuse télécharge vingt fichiers pour en trier trois : son
 * dossier de téléchargements se remplit, elle ne sait plus lesquels elle a vus,
 * et l'outil devient plus pénible qu'un dossier partagé.
 *
 * Le document est servi par `/api/cv/[id]/telecharger?apercu=1`, qui vérifie la
 * session, journalise la consultation, puis redirige vers un lien signé de cinq
 * minutes. Le contenu ne transite jamais par le serveur.
 */
export function ApercuCv({
  fichier,
  position,
  total,
  peutTelecharger,
  peutSupprimer,
  peutReclasser,
  onPrecedent,
  onSuivant,
  onFermer,
  onReclasser,
  onSupprimer,
}: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const cadre = useRef<HTMLIFrameElement>(null)
  /** Passe à vrai au premier clic DANS le document : le focus y devient légitime. */
  const focusDonne = useRef(false)
  /** Dernier élément de l'aperçu à avoir eu le focus — celui à qui le rendre. */
  const dernierFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function auClavier(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer()
      if (e.key === 'ArrowLeft') onPrecedent()
      if (e.key === 'ArrowRight') onSuivant()
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [onFermer, onPrecedent, onSuivant])

  /*
    ─────────────────────────────────────────────────────────────────────────
    Le clavier entre dans l'aperçu, y reste, et revient d'où il venait.

    Trois choses, et il n'en faisait qu'une. Le focus entrait bien — mais la
    tabulation ressortait aussitôt parcourir le tableau resté derrière le voile,
    alors qu'`aria-modal="true"` promet le contraire. Et à la fermeture, il
    repartait en haut de la page au lieu de revenir sur la ligne d'où l'aperçu
    avait été ouvert : sur une liste de quarante CV, on recommençait la descente.

    Les autres modales du produit passent par Base UI, qui fait les trois. Cet
    aperçu est écrit à la main parce qu'il occupe l'écran entier et porte sa
    propre navigation ; il doit donc les refaire.
    ─────────────────────────────────────────────────────────────────────────
  */
  useEffect(() => {
    const rendreA = document.activeElement as HTMLElement | null
    racine.current?.focus()
    return () => rendreA?.focus?.()
  }, [])

  useEffect(() => {
    function auCycle(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      const conteneur = racine.current
      if (!conteneur) return

      /*
        `:not([disabled])` et la vérification de taille écartent ce qui est
        masqué : un bouton caché garderait le cycle prisonnier d'un élément
        invisible. L'`iframe` du document en fait partie et reste dans le cycle —
        c'est là que le lecteur veut aller.
      */
      const cibles = [...conteneur.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)].filter(
        (e) => e.offsetWidth > 0 || e.offsetHeight > 0,
      )
      if (cibles.length === 0) return

      const premier = cibles[0]!
      const dernier = cibles[cibles.length - 1]!
      const actif = document.activeElement

      if (e.shiftKey && (actif === premier || actif === conteneur)) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }

    window.addEventListener('keydown', auCycle)
    return () => window.removeEventListener('keydown', auCycle)
  }, [])

  /*
    ─────────────────────────────────────────────────────────────────────────
    Le visualiseur PDF intégré s'attribue le focus dès qu'il a fini de charger.

    Un événement clavier né dans un `iframe` ne remonte JAMAIS au document
    parent : les flèches partaient alors défiler le PDF, et la liste des CV
    n'était plus parcourable — précédent/suivant du CV-5 devenaient morts sans
    que rien ne le signale.

    Quand le focus passe dans un cadre de la page, la fenêtre parente reçoit
    `blur` et `document.activeElement` DEVIENT l'élément `iframe`. C'est la
    seule façon de distinguer « le document s'est servi » de « l'utilisateur
    lui a donné le focus », ce que `focusDonne` retient.
    ─────────────────────────────────────────────────────────────────────────
  */
  useEffect(() => {
    const noeud = racine.current
    if (!noeud) return

    const auFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target !== cadre.current) {
        dernierFocus.current = e.target
      }
    }

    const auBlur = () => {
      if (focusDonne.current) return
      if (document.activeElement !== cadre.current) return

      // Rendu à « Fichier suivant » plutôt qu'au dialogue quand c'est lui qui
      // avait le focus : sinon le bouton le perd à chaque document chargé.
      const cible = dernierFocus.current
      const repli = cible && noeud.contains(cible) ? cible : noeud
      repli.focus()
    }

    noeud.addEventListener('focusin', auFocus)
    window.addEventListener('blur', auBlur)
    return () => {
      noeud.removeEventListener('focusin', auFocus)
      window.removeEventListener('blur', auBlur)
    }
  }, [])

  // Chaque document repart d'un focus non accordé : le cadre est remonté, et
  // le clic qui valait pour le précédent ne vaut pas pour celui-ci.
  useEffect(() => {
    focusDonne.current = false
  }, [fichier.id])

  const rendable = RENDU_NAVIGATEUR.includes(fichier.typeMime)
  const format = formatLisible(fichier.typeMime)

  return (
    <div
      ref={racine}
      role="dialog"
      aria-modal="true"
      aria-label={`Consulter ${fichier.nom}`}
      tabIndex={-1}
      className="bg-voile fixed inset-0 z-60 flex flex-col outline-none"
    >
      <header className="bg-page flex h-14 shrink-0 items-center gap-3 px-4">
        <button
          onClick={onFermer}
          aria-label="Fermer l’aperçu"
          className="hover:bg-hover flex size-9 items-center justify-center rounded-[6px]"
        >
          <X className="size-5" aria-hidden />
        </button>
        {/*
          Pas de plafond : la barre occupe l'écran entier, et c'est `flex-1` qui
          donne au bloc la largeur définie qu'exige la troncature. Le `min-w-0`
          est ce sans quoi le nom pousserait la barre au lieu d'être coupé.
        */}
        <Tronque className="max-w-none min-w-0 flex-1 text-[15px] font-medium">
          {fichier.nom}
        </Tronque>
        <span className="text-ink3 shrink-0 text-[13px] tabular-nums">
          {position} / {total}
        </span>
        <button
          onClick={onPrecedent}
          disabled={total < 2}
          aria-label="Fichier précédent"
          className="hover:bg-hover flex size-9 items-center justify-center rounded-[6px] disabled:opacity-30"
        >
          <FlecheGauche className="w-5" />
        </button>
        <button
          onClick={onSuivant}
          disabled={total < 2}
          aria-label="Fichier suivant"
          className="hover:bg-hover flex size-9 items-center justify-center rounded-[6px] disabled:opacity-30"
        >
          <FlecheDroite className="w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className="bg-pdf-rule flex min-h-0 flex-1 items-center justify-center p-4"
          // Le clic vaut consentement : à partir de là, le document garde le
          // focus et les flèches lui appartiennent.
          onPointerDown={() => {
            focusDonne.current = true
          }}
        >
          {rendable ? (
            <iframe
              // La clé force le rechargement du cadre quand on change de fichier :
              // sans elle, le navigateur garderait le document précédent.
              key={fichier.id}
              ref={cadre}
              src={`/api/cv/${fichier.id}/telecharger?apercu=1`}
              title={`Aperçu de ${fichier.nom}`}
              // Hors du parcours de tabulation : une tabulation qui entre dans le
              // visualiseur n'en ressort plus, et la liste cesse d'être navigable.
              tabIndex={-1}
              className="bg-pdf-paper size-full rounded-[10px]"
            />
          ) : (
            /*
              Aucun navigateur n'affiche un .doc ou .docx. Plutôt qu'un cadre
              vide, la fiche dit de quel document il s'agit — nom, format,
              taille — et mène au téléchargement.
            */
            <div className="bg-pdf-paper flex max-w-[420px] flex-col items-center rounded-[10px] p-10 text-center">
              <FileText className="text-pdf-ink2 size-8" aria-hidden />
              <p className="text-pdf-ink mt-4 text-[17px] font-semibold">Aperçu indisponible</p>
              <p className="text-pdf-ink mt-4 text-[15px] leading-[22px] font-medium break-all">
                {fichier.nom}
              </p>
              <p className="text-pdf-ink2 mt-1 text-[13px] tabular-nums">
                {format ? `${format} — ` : ''}
                {formaterTaille(fichier.taille)}
              </p>
              <p className="text-pdf-ink2 mt-4 text-[15px] leading-[22px]">
                Les documents Word ne s’affichent pas dans le navigateur. Téléchargez le fichier
                pour le consulter.
              </p>
              {peutTelecharger && (
                <a
                  href={`/api/cv/${fichier.id}/telecharger`}
                  className={classesBouton({ variante: 'principale', className: 'mt-5' })}
                >
                  <Download className="size-4" aria-hidden />
                  Télécharger
                </a>
              )}
            </div>
          )}
        </div>

        <aside className="bg-page border-border flex shrink-0 flex-col gap-4 border-t p-5 lg:w-[300px] lg:border-t-0 lg:border-l">
          <dl className="flex flex-col gap-3 text-[13px]">
            <div>
              <dt className="text-ink3">Catégories</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {fichier.categories.length === 0 ? (
                  <span className="text-ink2">Non classé</span>
                ) : (
                  fichier.categories.map((c) => (
                    <span
                      key={c.id}
                      className="bg-hover text-ink2 rounded-full px-2 py-0.5 text-[11px]"
                    >
                      <Tronque className="max-w-48">{c.nom}</Tronque>
                    </span>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink3">Déposé le</dt>
              <dd className="text-ink2 mt-1 tabular-nums">{fichier.deposeLe}</dd>
            </div>
            <div>
              <dt className="text-ink3">Déposé par</dt>
              <dd className="text-ink2 mt-1">
                <Tronque className="max-w-72">{fichier.deposeParNom}</Tronque>
              </dd>
            </div>
            {fichier.echeance && (
              <div>
                <dt className="text-ink3">24 mois atteints le</dt>
                <dd className="mt-1 tabular-nums">{fichier.echeance}</dd>
              </div>
            )}
          </dl>

          <div className="border-border flex flex-col gap-2 border-t pt-4">
            {peutTelecharger && (
              <a
                href={`/api/cv/${fichier.id}/telecharger`}
                className={classesBouton({ variante: 'secondaire' })}
              >
                <Download className="size-4" aria-hidden />
                Télécharger
              </a>
            )}
            {peutReclasser && (
              <Bouton variante="secondaire" onClick={onReclasser}>
                <FolderInput className="size-4" aria-hidden />
                Déplacer
              </Bouton>
            )}
            {peutSupprimer && (
              <Bouton variante="destructive" onClick={onSupprimer}>
                <Trash2 className="size-4" aria-hidden />
                Supprimer
              </Bouton>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
