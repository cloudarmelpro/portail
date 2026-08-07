'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Lock } from 'lucide-react'
import { Bouton, classesBouton } from '@/components/shared/bouton'
import { FlecheDroite, FlecheGauche } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import { cn } from '@/lib/utils'
import { notifier } from '@/lib/toast'
import { useBrouillon } from '@/lib/brouillon'
import {
  cloturerPeriode,
  copierSemainePrecedente,
  corrigerSemaine,
  enregistrerSemaine,
} from '@/lib/actions/heures'
import { formaterHeures, formaterHeuresAvecUnite, lireCellule } from '@/lib/domaine/heures'
import { PastilleEntreprise } from '@/components/heures/pastille-entreprise'
import { type Confirmation, DialogueConfirmation } from '@/components/heures/dialogue-confirmation'
import { enumerer } from '@/lib/enumerer'

export type JourGrille = {
  iso: string
  /** Le quantième, en grand : c'est lui qu'on cherche des yeux. */
  numero: number
  /** « lun », « août » — trois lettres chacun, en micro-majuscules. */
  jour: string
  mois: string
  /** Nom complet, pour l'annonce d'une cellule aux technologies d'assistance. */
  long: string
  date: string
  aujourdhui: boolean
}
export type EmployeGrille = { id: string; nom: string; entrepriseSlug: string }

type Props = {
  /** Lundi de la semaine affichée — porte aussi la clé du brouillon (TR-13). */
  debut: string
  /** Clé du brouillon : un brouillon n’est jamais proposé à quelqu’un d’autre. */
  utilisateurId: string
  jours: JourGrille[]
  employes: EmployeGrille[]
  /** Clé `employeId|AAAA-MM-JJ` vers les centièmes d'heure enregistrés. */
  valeurs: Record<string, number>
  seuilCentiemes: number
  cloturee: boolean
  peutSaisir: boolean
  peutCloturer: boolean
  peutCorriger: boolean
  /** Faux quand la semaine antérieure ne contient aucune saisie à recopier. */
  copieDisponible: boolean
  lienExport: string
  /**
   * Navigation de semaine et filtre, rendus par la page.
   *
   * Ils traversent la frontière serveur/client comme nœuds déjà rendus : la
   * grille ne les connaît pas, elle leur fait seulement une place à gauche de
   * ses boutons. La page les rend AUSSI quand il n'y a aucun employé actif,
   * où cette grille n'existe pas — sinon une période passée deviendrait
   * inconsultable dès qu'un employé est désactivé.
   */
  enTete?: React.ReactNode
  periode: { debut: string; fin: string }
}

const cle = (employeId: string, iso: string) => `${employeId}|${iso}`

function heureCourante(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Grille de saisie hebdomadaire — exigence HEU-2.
 *
 * Toute la saisie se fait au clavier : tabulation, entrée, flèches. C'est une
 * gérante qui remplit soixante cellules chaque semaine ; si elle doit lâcher le
 * clavier pour attraper la souris, elle retourne à Excel.
 */
export function GrilleHeures(props: Props) {
  const {
    debut,
    utilisateurId,
    jours,
    employes,
    valeurs,
    seuilCentiemes,
    cloturee,
    peutSaisir,
    peutCloturer,
    peutCorriger,
    copieDisponible,
    lienExport,
    enTete,
    periode,
  } = props

  /*
    TR-13 — la grille est le formulaire le plus long du produit : soixante
    cellules. Une session expirée ou un onglet fermé les emportait toutes.
    Le brouillon est propre à la SEMAINE affichée : revenir sur une autre
    semaine ne doit pas y déverser des heures saisies ailleurs.
  */
  const {
    brouillon,
    enregistrer: retenir,
    oublier,
  } = useBrouillon<Record<string, string>>(utilisateurId, `heures:${debut}`)

  const [saisies, setSaisies] = useState<Record<string, string>>(brouillon ?? {})
  const [brouillonRepris] = useState(() => brouillon !== null && Object.keys(brouillon).length > 0)
  const [motifCorrection, setMotifCorrection] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [enregistreA, setEnregistreA] = useState<string | null>(null)
  const [employeAffiche, setEmployeAffiche] = useState(0)
  const [enCours, demarrer] = useTransition()
  const tableau = useRef<HTMLTableSectionElement>(null)

  const modeCorrection = motifCorrection !== null
  const modifiable = modeCorrection ? peutCorriger : peutSaisir && !cloturee

  const texteDe = (k: string) =>
    saisies[k] ?? (valeurs[k] === undefined ? '' : formaterHeures(valeurs[k]))

  const lectures = useMemo(() => {
    const m = new Map<string, ReturnType<typeof lireCellule>>()
    for (const e of employes) {
      for (const j of jours) {
        const k = cle(e.id, j.iso)
        m.set(
          k,
          lireCellule(saisies[k] ?? (valeurs[k] === undefined ? '' : formaterHeures(valeurs[k]))),
        )
      }
    }
    return m
  }, [employes, jours, saisies, valeurs])

  const centiemesDe = (k: string) => {
    const l = lectures.get(k)
    return l && l.etat === 'valeur' ? l.centiemes : 0
  }

  const totalEmploye = (employeId: string) =>
    jours.reduce((t, j) => t + centiemesDe(cle(employeId, j.iso)), 0)

  const totalJour = (iso: string) => employes.reduce((t, e) => t + centiemesDe(cle(e.id, iso)), 0)

  const totalEquipe = employes.reduce((t, e) => t + totalEmploye(e.id), 0)

  const auMoinsUneInvalide = [...lectures.values()].some((l) => l.etat === 'invalide')

  /**
   * Cellules dont la valeur affichée diffère de celle enregistrée.
   *
   * `avant` part avec la modification : le serveur refuse l'écriture si la base
   * ne porte plus cette valeur — c'est ce qui empêche un second onglet
   * d'effacer sans un mot la saisie du premier.
   */
  const modifications = useMemo(() => {
    const liste: {
      employeId: string
      date: string
      centiemes: number | null
      avant: number | null
    }[] = []
    for (const [k, lecture] of lectures) {
      if (lecture.etat === 'invalide') continue
      const [employeId, date] = k.split('|')
      const avant = valeurs[k]
      const apres = lecture.etat === 'vide' ? null : lecture.centiemes
      if (avant === undefined ? apres === null : avant === apres) continue
      liste.push({ employeId, date, centiemes: apres, avant: avant ?? null })
    }
    return liste
  }, [lectures, valeurs])

  const cellulesRemplies = [...lectures.values()].filter(
    (l) => l.etat === 'valeur' && l.centiemes > 0,
  ).length

  function changer(k: string, valeur: string) {
    setSaisies((s) => {
      const suivantes = { ...s, [k]: valeur }
      // Le brouillon suit la frappe, avec un délai. Sans lui, une session
      // expirée ou un onglet fermé emporte soixante cellules (TR-13).
      retenir(suivantes)
      return suivantes
    })
    setEnregistreA(null)
  }

  /**
   * Entrée et flèche bas descendent d'une ligne, flèche haut remonte. Les
   * flèches latérales ne changent de colonne qu'aux extrémités du texte, sinon
   * elles déplaceraient le curseur — c'est ce qu'attend quelqu'un qui corrige
   * un chiffre.
   */
  function naviguer(e: React.KeyboardEvent<HTMLInputElement>, ligne: number, colonne: number) {
    const champ = e.currentTarget
    let l = ligne
    let c = colonne

    if (e.key === 'Enter' || e.key === 'ArrowDown') l += 1
    else if (e.key === 'ArrowUp') l -= 1
    else if (e.key === 'ArrowLeft' && champ.selectionStart === 0) c -= 1
    else if (e.key === 'ArrowRight' && champ.selectionStart === champ.value.length) c += 1
    else return

    const cible = tableau.current?.querySelector<HTMLInputElement>(
      `[data-ligne="${l}"][data-colonne="${c}"]`,
    )
    if (!cible) return

    e.preventDefault()
    cible.focus()
    cible.select()
  }

  function apresEcriture() {
    const message = `Enregistré à ${heureCourante(new Date())}`
    // La donnée est au serveur : garder le brouillon ferait reproposer une
    // saisie déjà enregistrée à la prochaine ouverture.
    oublier()
    setSaisies({})
    setEnregistreA(message)
    setConfirmation(null)
    notifier.succes(message)
  }

  function echouer(message: string) {
    setConfirmation(null)
    notifier.erreur(message)
  }

  function ecrire() {
    demarrer(async () => {
      const r = modeCorrection
        ? await corrigerSemaine({ debut, motif: motifCorrection, saisies: modifications })
        : await enregistrerSemaine({ debut, saisies: modifications })

      if (!r.ok) return echouer(r.erreur)
      if (modeCorrection) setMotifCorrection(null)
      apresEcriture()
    })
  }

  /**
   * HEU-4 — un employé actif sans aucune heure est **nommé** dans la
   * confirmation. Le nom permet de distinguer un oubli de saisie d'une absence
   * réelle ; « 3 employés sans heures » ne le permet pas.
   */
  function enregistrer() {
    if (auMoinsUneInvalide) {
      notifier.erreur('Certains champs sont invalides.')
      return
    }

    const vides = employes.filter((e) => totalEmploye(e.id) === 0)
    if (vides.length === 0) {
      ecrire()
      return
    }

    setConfirmation({
      titre: 'Enregistrer quand même ?',
      corps:
        vides.length === 1
          ? `1 employé n’a aucune heure cette semaine : ${vides[0].nom}.`
          : `${vides.length} employés n’ont aucune heure cette semaine : ${enumerer(
              vides.map((e) => e.nom),
            )}.`,
      libelle: 'Enregistrer',
      confirmer: ecrire,
    })
  }

  function copier() {
    const lancer = () =>
      demarrer(async () => {
        const r = await copierSemainePrecedente({ debut })
        if (!r.ok) return echouer(r.erreur)
        oublier()
        setSaisies({})
        setConfirmation(null)
        notifier.succes('Semaine précédente copiée.')
      })

    if (cellulesRemplies === 0) {
      lancer()
      return
    }

    setConfirmation({
      titre: 'Remplacer les heures déjà saisies ?',
      corps:
        cellulesRemplies === 1
          ? '1 cellule sera remplacée par les heures de la semaine précédente.'
          : `${cellulesRemplies} cellules seront remplacées par les heures de la semaine précédente.`,
      libelle: 'Remplacer',
      danger: true,
      confirmer: lancer,
    })
  }

  function cloturer() {
    setConfirmation({
      titre: 'Clôturer la période ?',
      corps:
        'La grille passera en lecture seule. Une correction restera possible avec un motif consigné.',
      libelle: 'Clôturer',
      confirmer: () =>
        demarrer(async () => {
          const r = await cloturerPeriode(periode)
          if (!r.ok) return echouer(r.erreur)
          setConfirmation(null)
          notifier.succes('Période clôturée.')
        }),
    })
  }

  function ouvrirCorrection() {
    setConfirmation({
      titre: 'Corriger une période clôturée',
      corps:
        'Indiquez le motif de la correction. Il sera consigné au journal d’audit avec la valeur précédente.',
      libelle: 'Corriger',
      motifRequis: true,
      confirmer: (motif) => {
        setMotifCorrection(motif)
        setConfirmation(null)
        notifier.succes('Correction ouverte — motif consigné.')
      },
    })
  }

  const employeTelephone = employes[Math.min(employeAffiche, employes.length - 1)]

  return (
    <div className="flex flex-col gap-4">
      {/*
        UNE seule rangée de commandes, et non deux.

        La navigation de semaine et le filtre viennent de la page ; les trois
        boutons dépendent de l'état de saisie et vivent donc ici. Rendus dans
        deux rangées superposées, ils se lisaient comme deux niveaux de commande
        alors qu'ils portent tous sur la même semaine.

        Alignée par le BAS : le filtre porte son libellé au-dessus de lui, les
        boutons non. Par le haut, ils se seraient décalés de la hauteur d'un mot.
      */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {enTete}

        {peutSaisir && (
          <Bouton
            type="button"
            variante="secondaire"
            taille="sm"
            onClick={copier}
            disabled={!modifiable || !copieDisponible || enCours}
          >
            Copier la semaine précédente
          </Bouton>
        )}

        {/* Le fichier produit est un CSV : le libellé nomme ce qui est téléchargé. */}
        <a
          href={lienExport}
          className={cn(
            classesBouton({ variante: 'secondaire', taille: 'sm' }),
            /*
              `ml-auto` sur le PREMIER bouton poussé à droite, pas sur chacun :
              deux marges automatiques se partageraient l'espace et sépareraient
              les trois actions au lieu de les grouper.

              Il porte donc la marge même quand « Copier » est absent, où il est
              le premier de la rangée après l'en-tête.
            */
            'ml-auto',
          )}
        >
          Exporter en CSV
        </a>

        {peutCloturer && !cloturee && (
          <Bouton
            type="button"
            variante="secondaire"
            taille="sm"
            onClick={cloturer}
            disabled={enCours}
          >
            Clôturer la période
          </Bouton>
        )}
      </div>

      {(cloturee || modeCorrection) && (
        <div className="border-border bg-hover text-ink2 flex items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-[18px]">
          <Lock className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            {modeCorrection
              ? 'Correction en cours — les modifications seront consignées au journal.'
              : 'Période clôturée — grille en lecture seule.'}
          </span>
          {cloturee && !modeCorrection && peutCorriger && (
            <Bouton type="button" variante="secondaire" taille="xs" onClick={ouvrirCorrection}>
              Corriger
            </Bouton>
          )}
        </div>
      )}

      {/* Grand écran : la grille complète, employés en lignes, jours en colonnes. */}
      {/*
        Cadre à angles DROITS, contrairement aux tableaux du produit.

        Les cases sont carrées et fermées sur leurs quatre côtés : un arrondi au
        pourtour rognerait les quatre cases des coins et casserait le quadrillage
        là où il doit être le plus net. C'est un calendrier, pas une liste dans
        une carte.
      */}
      <div className="border-border bg-raised hidden overflow-x-auto rounded-none border md:block">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            {/*
              Une seule hauteur, pour l'en-tête comme pour les lignes, et des
              libellés en casse normale : c'est la mesure du tableau du produit,
              `components/shared/tableau.tsx`. Les micro-majuscules espacées
              privaient la lecture des ascendantes sur les sept mots qu'on relit
              le plus souvent.
            */}
            {/*
              L'en-tête est CARRÉ comme les cases, 88 px de côté : le
              quadrillage garde le même pas d'un bout à l'autre. À 64, la
              première rangée était plus basse que les autres, et le calendrier
              commençait par une exception.

              Le quantième EN GRAND, la date en micro-majuscules à côté.

              Sept colonnes se distinguaient par « lun 3 » en treize pixels : on
              devait lire pour compter. Le nombre porte maintenant la lecture, et
              les trois lettres du jour et du mois l'accompagnent sans la
              disputer — c'est le palier « Micro » de la section 19, prévu pour
              les en-têtes de colonne en majuscules.
            */}
            <tr>
              <th
                scope="col"
                /*
                  Les deux libellés de bout suivent le même palier que « lun » et
                  « août » : micro-majuscules de 11 px. Toute la rangée d'en-tête
                  se lit alors d'un seul registre, au lieu de mêler deux corps et
                  deux casses.
                */
                className="border-border text-ink3 h-22 border-r border-b px-4 text-left align-middle text-[11px] leading-[13px] font-medium tracking-[0.02em] uppercase"
              >
                Employé
              </th>
              {jours.map((j) => (
                <th
                  key={j.iso}
                  scope="col"
                  /*
                    Le jour courant se signale par un FOND et une encre pleine,
                    jamais par une teinte seule — section 19. `aria-current`
                    l'annonce en plus, ce qu'aucun contraste ne fait.
                  */
                  aria-current={j.aujourdhui ? 'date' : undefined}
                  className={cn(
                    'border-border h-22 w-22 border-r border-b px-3 text-left align-middle whitespace-nowrap',
                    j.aujourdhui && 'bg-hover',
                  )}
                >
                  {/*
                    Le quantième à gauche, le jour et le mois empilés à sa
                    droite — la composition du repère. Le nombre est GRAND et de
                    graisse normale : c'est sa taille qui le fait ressortir, pas
                    son épaisseur, et une colonne de sept nombres gras se lirait
                    comme sept titres.

                    `justify-between` sur huit unités : « lun » se pose en haut
                    du nombre, « août » en bas. Les deux calés à ses extrémités,
                    et non centrés à côté, sans quoi les sept en-têtes flottent
                    chacun à une hauteur légèrement différente selon la largeur
                    du mois.
                  */}
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[34px] leading-9 tabular-nums',
                        j.aujourdhui ? 'text-ink font-semibold' : 'text-ink font-normal',
                      )}
                    >
                      {j.numero}
                    </span>
                    {/*
                      30 px, et non la hauteur de la boîte de ligne du nombre.

                      Un chiffre de 34 px n'occupe pas les 36 px de sa boîte de
                      ligne : le reste est le blanc au-dessus et en dessous.
                      Étaler « mar » et « août » sur ces 36 les faisait dépasser
                      du chiffre par le haut ET par le bas ; les serrer à 26 les
                      rentrait trop. 30, centrées, les posent sur le sommet et le
                      pied des chiffres.

                      Réglé à l'œil : la hauteur réelle d'un chiffre dépend de la
                      police, et DM Sans ne la déclare nulle part où le code
                      puisse la lire.
                    */}
                    <span className="flex h-[30px] flex-col justify-between text-[11px] leading-[13px] tracking-[0.02em] uppercase">
                      <span className="text-ink2 font-medium">{j.jour}</span>
                      <span className="text-ink3">{j.mois}</span>
                    </span>
                  </span>
                </th>
              ))}
              <th
                scope="col"
                // Centré comme les en-têtes de jour, et non aligné à droite sur
                // les nombres qu'il coiffe : c'est un titre de colonne, pas une
                // valeur.
                className="border-border text-ink3 h-22 w-24 border-b px-4 text-center align-middle text-[11px] leading-[13px] font-medium tracking-[0.02em] uppercase"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody ref={tableau}>
            {employes.map((e, ligne) => {
              const total = totalEmploye(e.id)
              const depasse = total > seuilCentiemes
              return (
                <tr key={e.id} className="hover:bg-hover">
                  {/*
                    Pas de pastille d'entreprise ici : une couleur d'entreprise ne
                    paraît jamais sans son nom écrit à côté, et la colonne n'a pas
                    la place. Le rattachement se lit dans l'onglet « Employés ».
                  */}
                  <td className="border-border h-22 border-r border-b px-4 whitespace-nowrap">
                    {/*
                      Le plafond est ici, et non sur la cellule : `whitespace-nowrap`
                      laisserait sinon un nom long élargir la colonne, et avec elle
                      toute la grille — les sept cases carrées partiraient en
                      défilement horizontal.

                      Et il est plus bas qu'ailleurs dans le produit — 192 px au
                      lieu de 288. Le budget de la grille est compté : sept cases
                      de 88 px et une colonne de total en occupent 712 sur les
                      860 déclarés. À 11 px en micro-majuscules, 192 px tiennent
                      largement un nom ; 288 rendraient la grille plus large que
                      son propre plancher.
                    */}
                    <Tronque titre={e.nom} className="max-w-48">
                      <Link
                        href={`/heures/employes/${e.id}`}
                        /*
                          Même encre, même casse, même graisse ET même corps que
                          l'en-tête « EMPLOYÉ » qui la coiffe — le palier « Micro »
                          de la section 19.

                          Toute la grille tient désormais dans ce registre, les
                          chiffres saisis compris : un seul corps, une seule encre,
                          une seule casse d'un bout à l'autre.
                        */
                        className="text-ink3 hover:text-ink text-[11px] leading-[13px] tracking-[0.02em] uppercase hover:underline"
                      >
                        {e.nom}
                      </Link>
                    </Tronque>
                  </td>
                  {jours.map((j, colonne) => {
                    const k = cle(e.id, j.iso)
                    const invalide = lectures.get(k)?.etat === 'invalide'
                    return (
                      /*
                        La case est CARRÉE — 88 px de côté, la largeur de la
                        colonne — et fermée sur ses quatre côtés.

                        La grille n'avait que des filets horizontaux : sept
                        colonnes de chiffres sans séparation verticale, où l'œil
                        devait suivre une ligne imaginaire pour rester dans le
                        bon jour. Le repère ferme chaque case ; c'est ce qui fait
                        lire un calendrier plutôt qu'un tableau de nombres.
                      */
                      <td
                        key={j.iso}
                        className={cn(
                          'border-border h-22 border-r border-b p-2 text-center',
                          j.aujourdhui && 'bg-hover',
                        )}
                      >
                        <input
                          value={texteDe(k)}
                          onChange={(ev) => changer(k, ev.target.value)}
                          onKeyDown={(ev) => naviguer(ev, ligne, colonne)}
                          onFocus={(ev) => ev.currentTarget.select()}
                          disabled={!modifiable}
                          data-ligne={ligne}
                          data-colonne={colonne}
                          inputMode="decimal"
                          aria-invalid={invalide || undefined}
                          aria-label={`Heures — ${e.nom} — ${j.long} ${j.date}`}
                          /*
                            Le champ REMPLIT sa case : cliquer n'importe où dans
                            le carré donne le focus, ce qu'un champ de cinquante-
                            six pixels au milieu d'une case de quatre-vingt-huit
                            ne permettait pas.

                            Son propre filet n'apparaît qu'au survol — la case a
                            déjà le sien, et deux cadres emboîtés au repos font
                            une grille de boîtes où l'on ne distingue plus les
                            chiffres. Le zéro gris marque chaque case et
                            disparaît à la première frappe : c'est l'exemple que
                            la section 19 donne pour ce champ. Le focus, lui, est
                            porté par l'anneau global de `globals.css`.
                          */
                          placeholder="0"
                          className={cn(
                            'placeholder:text-ink3 h-full w-full rounded-[8px] border bg-transparent text-center text-[11px] leading-[13px] tracking-[0.02em] tabular-nums',
                            /*
                              `bg-raised` sous le filet d'erreur : `--critical` ne bascule pas, et
                              en sombre il tombait à 2,43:1 sur la case du jour d'une ligne
                              survolée — deux voiles de `--hover` empilés. Sur `--raised` : 3,27:1.
                            */
                            invalide
                              ? 'border-critical bg-raised'
                              : 'hover:border-border hover:bg-raised border-transparent',
                          )}
                        />
                      </td>
                    )
                  })}
                  {/*
                    Centrée, en majuscules, dans l'encre du titre et de graisse
                    normale : la colonne des totaux se lit exactement comme le
                    reste de la grille, sans se donner de relief.

                    Le dépassement d'heures reste signalé — l'icône devant le
                    nombre et le mot en légende —, si bien que rien ne dépend
                    plus de la graisse pour se remarquer.
                  */}
                  <td className="border-border text-ink3 h-22 border-b px-4 text-center text-[11px] leading-[13px] tracking-[0.02em] whitespace-nowrap uppercase">
                    {/*
                      Seule l'ICÔNE porte la couleur ; le nombre reste en encre.

                      `--warning` sur `--surface` mesure 1,77:1 — le seuil est de
                      4,5:1. Peindre le total en jaune rendait illisible le seul
                      chiffre qui déclenche la paie majorée. L'icône, elle, n'a
                      pas à être lue : elle est doublée par le mot en légende,
                      et le dépassement reste annoncé aux lecteurs d'écran.
                    */}
                    <span className="inline-flex items-center justify-center gap-1.5 tabular-nums">
                      {depasse && (
                        <AlertTriangle className="text-warning-texte size-3.5" aria-hidden />
                      )}
                      {formaterHeuresAvecUnite(total)}
                      {depasse && <span className="sr-only">heures supplémentaires</span>}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              {/*
                En majuscules et dans la même encre que le reste de la grille :
                le pied nomme une rangée, pas une valeur. Seul son filet supérieur
                appuyé le distingue — c'est la ligne de synthèse de l'écran, et
                elle n'a pas besoin d'une teinte à elle.
              */}
              <td className="border-border border-border-strong text-ink3 h-14 border-t border-r px-4 text-[11px] leading-[13px] tracking-[0.02em] uppercase">
                Total de l’équipe
              </td>
              {jours.map((j) => (
                <td
                  key={j.iso}
                  className={cn(
                    'border-border border-border-strong text-ink3 h-14 border-t border-r px-2 text-center text-[11px] leading-[13px] tracking-[0.02em] uppercase tabular-nums',
                    j.aujourdhui && 'bg-hover',
                  )}
                >
                  {formaterHeuresAvecUnite(totalJour(j.iso))}
                </td>
              ))}
              <td className="border-border-strong text-ink3 h-14 border-t px-4 text-center text-[11px] leading-[13px] tracking-[0.02em] uppercase tabular-nums">
                {formaterHeuresAvecUnite(totalEquipe)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Téléphone : un employé à la fois, sept champs empilés, cibles de 48 px. */}
      {employeTelephone && (
        <div className="border-border bg-raised rounded-[10px] border p-4 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEmployeAffiche((i) => Math.max(0, i - 1))}
              disabled={employeAffiche === 0}
              aria-label="Employé précédent"
              className="border-border text-ink2 hover:border-border-strong hover:text-ink flex size-11 shrink-0 items-center justify-center rounded-[9px] border disabled:opacity-30"
            >
              <FlecheGauche className="w-[18px]" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              {/* Pas de plafond : la carte donne déjà la largeur définie. */}
              <Tronque className="max-w-none text-[17px] leading-6 font-semibold">
                {employeTelephone.nom}
              </Tronque>
              <div className="text-ink3 flex items-center justify-center gap-1.5 text-[13px] leading-[18px]">
                <PastilleEntreprise slug={employeTelephone.entrepriseSlug} />
                <span>
                  · {Math.min(employeAffiche, employes.length - 1) + 1} de {employes.length}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmployeAffiche((i) => Math.min(employes.length - 1, i + 1))}
              disabled={employeAffiche >= employes.length - 1}
              aria-label="Employé suivant"
              className="border-border text-ink2 hover:border-border-strong hover:text-ink flex size-11 shrink-0 items-center justify-center rounded-[9px] border disabled:opacity-30"
            >
              <FlecheDroite className="w-[18px]" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {jours.map((j) => {
              const k = cle(employeTelephone.id, j.iso)
              const invalide = lectures.get(k)?.etat === 'invalide'
              return (
                <div key={j.iso} className="flex items-center gap-3">
                  <label htmlFor={`jour-${j.iso}`} className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-[22px] font-medium">{j.long}</span>
                    <span className="text-ink3 block text-[13px] leading-[18px]">{j.date}</span>
                  </label>
                  <input
                    id={`jour-${j.iso}`}
                    value={texteDe(k)}
                    onChange={(ev) => changer(k, ev.target.value)}
                    disabled={!modifiable}
                    inputMode="decimal"
                    placeholder="0"
                    aria-invalid={invalide || undefined}
                    aria-label={`Heures — ${employeTelephone.nom} — ${j.long}`}
                    className={`bg-surface h-12 w-24 shrink-0 rounded-[6px] border px-3 text-right text-[17px] tabular-nums ${
                      invalide ? 'border-critical' : 'border-border'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          <div className="border-border-strong mt-4 flex items-baseline gap-2 border-t pt-4">
            {/*
              Même registre qu'en grande vue : micro-majuscules, encre du titre,
              pas de graisse. Le rendu téléphone est le même écran, il n'a pas de
              raison de se donner un relief que la grille a abandonné.
            */}
            <span className="text-ink3 flex-1 text-[11px] leading-[13px] tracking-[0.02em] uppercase">
              Total de la semaine
            </span>
            {/* Même règle qu'en grande vue : la couleur va à l'icône, pas au nombre. */}
            <span className="text-ink3 inline-flex items-center gap-1.5 text-[11px] leading-[13px] tracking-[0.02em] uppercase tabular-nums">
              {totalEmploye(employeTelephone.id) > seuilCentiemes && (
                <AlertTriangle className="text-warning-texte size-3.5" aria-hidden />
              )}
              {formaterHeuresAvecUnite(totalEmploye(employeTelephone.id))}
            </span>
          </div>
        </div>
      )}

      {/*
        HEU-5 — le dépassement porte une icône ET un mot. La colonne « Total »
        est trop étroite pour le mot : il est donné ici, avec la même icône.
      */}
      <p className="text-ink3 flex items-center gap-1.5 text-[13px] leading-[18px]">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        <span>
          Au-delà de <span className="tabular-nums">{formaterHeuresAvecUnite(seuilCentiemes)}</span>{' '}
          par semaine&nbsp;: heures supplémentaires.
        </span>
      </p>

      {/*
        La rangée entière disparaît en lecture seule : rendue vide, elle laissait
        un intervalle de 16 px sous la grille, que rien n'expliquait.
      */}
      {(modifiable || brouillonRepris || enregistreA) && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/*
            Une restauration silencieuse est déroutante : on retrouve des chiffres
            sans savoir d'où ils viennent, et on ne sait pas s'ils sont enregistrés.
            Le message le dit, et disparaît dès le premier enregistrement.
          */}
          {brouillonRepris && !enregistreA && (
            <span className="text-ink2 text-[13px] leading-[18px]">
              Saisie en cours reprise. Elle n’est pas encore enregistrée.
            </span>
          )}
          {enregistreA && (
            <span className="text-ink3 text-[13px] leading-[18px]">{enregistreA}</span>
          )}
          {modifiable && (
            <Bouton
              type="button"
              onClick={enregistrer}
              disabled={modifications.length === 0}
              chargement={enCours}
            >
              Enregistrer
            </Bouton>
          )}
        </div>
      )}

      <DialogueConfirmation
        confirmation={confirmation}
        enCours={enCours}
        onFermer={() => setConfirmation(null)}
      />
    </div>
  )
}
