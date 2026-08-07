'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { Tronque } from '@/components/shared/tronque'
import type { EntreeNav } from '@/config/navigation'
import { ICONE_MODULE } from '@/components/layout/icones'
import type { ReponseRecherche, ResultatRecherche } from '@/lib/data/recherche'

/**
 * Palette de commandes — ⌘K, exigence TR-11.
 *
 * Les écrans viennent de la navigation, elle-même dérivée de la matrice de
 * permissions. Le reste — clients, employés, fichiers de CV, estimations —
 * vient de `/api/recherche`, qui refait la vérification de rôle famille par
 * famille : ce composant n'a aucun pouvoir de filtrage, il affiche ce qu'on lui
 * rend.
 */

/** Sans quoi chaque frappe déclencherait une requête sur une base distante. */
const DELAI_MS = 200

/**
 * Même plancher que `TERME_MINIMUM` de `lib/data/recherche.ts`, recopié parce
 * qu'un module `server-only` ne s'importe pas ici. Celui-ci évite la requête,
 * celui du serveur est la garantie.
 */
const TERME_MINIMUM = 2

const AUCUN: ReponseRecherche = { clients: [], employes: [], fichiers: [], estimations: [] }

/** Comparaison indifférente à la casse et aux accents — « heures » trouve « Suivi des heures ». */
function aplati(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

type Props = {
  entrees: EntreeNav[]
  /**
   * Ouverture PILOTÉE par le shell. La palette n'a plus de déclencheur à elle :
   * il vit dans la barre latérale, avec le raccourci écrit à côté. Deux
   * composants qui détiendraient chacun un état d'ouverture finiraient par
   * afficher deux vérités.
   */
  ouverte: boolean
  onOuverteChange: (ouverte: boolean) => void
}

export function PaletteCommandes({ entrees, ouverte, onOuverteChange }: Props) {
  const [terme, setTerme] = useState('')
  /**
   * Le terme voyage AVEC ses résultats. C'est ce qui permet de déduire
   * « recherche en cours » au rendu plutôt que de le tenir dans un second état :
   * poser un drapeau depuis le corps d'un effet enchaîne les rendus, et deux
   * états à maintenir en accord finissent toujours par diverger.
   */
  const [rendu, setRendu] = useState<{ terme: string; donnees: ReponseRecherche } | null>(null)
  const router = useRouter()

  const cherche = terme.trim()

  useEffect(() => {
    if (cherche.length < TERME_MINIMUM) return

    const controleur = new AbortController()

    const minuterie = setTimeout(() => {
      fetch(`/api/recherche?q=${encodeURIComponent(cherche)}`, { signal: controleur.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ReponseRecherche>) : AUCUN))
        .catch(() => AUCUN)
        .then((donnees) => {
          /*
            La frappe suivante a annulé celle-ci : ne rien écrire. Sans ce
            contrôle, une réponse tardive écraserait la plus récente.
          */
          if (controleur.signal.aborted) return
          setRendu({ terme: cherche, donnees })
        })
    }, DELAI_MS)

    return () => {
      clearTimeout(minuterie)
      controleur.abort()
    }
  }, [cherche])

  function basculer(etat: boolean) {
    onOuverteChange(etat)
    // La palette rouvre vierge : le terme d'hier n'est jamais celui d'aujourd'hui.
    if (!etat) setTerme('')
  }

  function aller(href: string) {
    basculer(false)
    router.push(href)
  }

  const filtre = aplati(cherche)
  const ecrans = entrees.filter((e) => aplati(e.libelle).includes(filtre))

  const aJour = rendu?.terme === cherche
  const resultats = aJour && rendu ? rendu.donnees : AUCUN
  const enCours = cherche.length >= TERME_MINIMUM && !aJour

  const rien =
    ecrans.length === 0 &&
    resultats.clients.length === 0 &&
    resultats.employes.length === 0 &&
    resultats.fichiers.length === 0 &&
    resultats.estimations.length === 0

  return (
    <>
      {/*
        La palette n'a pas d'enveloppe dans `shared/` : elle est le seul appelant
        de `CommandDialog`. Elle applique donc le filet elle-même, depuis la même
        constante que les dialogues et les menus.
      */}
      <CommandDialog
        open={ouverte}
        onOpenChange={basculer}
        title="Rechercher"
        description="Atteindre un écran ou un élément"
        className={FILET_FLOTTANT}
      >
        {/*
          ─────────────────────────────────────────────────────────────────
          La racine `Command` est posée ICI, et elle est indispensable.

          `CommandDialog`, tel que livré par le préréglage shadcn de ce projet,
          rend ses enfants directement dans `DialogContent` sans les envelopper
          dans `CommandPrimitive.Root`. Or `CommandInput`, `CommandList` et
          `CommandItem` lisent tous le magasin d'état de cmdk par le contexte :
          sans racine, il est `undefined`, et le premier abonnement lève
          « Cannot read properties of undefined (reading 'subscribe') ».

          La palette plantait donc à l'ouverture, au ⌘K comme au clic.

          `components/ui/` vient de shadcn et ne se modifie pas à la main : la
          correction se fait par composition, ici, conformément à la convention.
          ─────────────────────────────────────────────────────────────────
        */}
        {/*
          `shouldFilter={false}` : les résultats de données sont déjà filtrés par
          le serveur, sur des règles qui ne sont pas celles de cmdk. Le laisser
          refiltrer masquerait une estimation trouvée par sa référence ou un
          client trouvé par un fragment de raison sociale. Les écrans, eux, sont
          filtrés juste au-dessus.
        */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un écran, un client, un employé, un CV…"
            value={terme}
            onValueChange={setTerme}
          />
          <CommandList aria-busy={enCours}>
            {/* Pendant l'attente, se taire : « Aucun résultat. » serait faux. */}
            {rien && !enCours && <CommandEmpty>Aucun résultat.</CommandEmpty>}

            {ecrans.length > 0 && (
              <CommandGroup heading="Écrans">
                {ecrans.map((e) => {
                  const Icone = ICONE_MODULE[e.module]
                  return (
                    <CommandItem
                      key={e.module}
                      value={`ecran-${e.module}`}
                      onSelect={() => aller(e.href)}
                    >
                      <Icone className="size-4" aria-hidden />
                      {e.libelle}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            <Famille
              titre="Clients"
              cle="client"
              icone={ICONE_MODULE.crm}
              resultats={resultats.clients}
              onChoisir={aller}
            />
            <Famille
              titre="Employés"
              cle="employe"
              icone={ICONE_MODULE.heures}
              resultats={resultats.employes}
              onChoisir={aller}
            />
            <Famille
              titre="Banque de CV"
              cle="fichier"
              icone={ICONE_MODULE.cv}
              resultats={resultats.fichiers}
              onChoisir={aller}
            />
            <Famille
              titre="Estimations"
              cle="estimation"
              icone={ICONE_MODULE.calculateur}
              resultats={resultats.estimations}
              onChoisir={aller}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

/**
 * L'entreprise est écrite en toutes lettres, jamais portée par une couleur :
 * deux clients homonymes de deux dossiers différents ne se distinguent que par
 * elle. Voir architecture.MD, section 19.
 */
function Famille({
  titre,
  cle,
  icone: Icone,
  resultats,
  onChoisir,
}: {
  titre: string
  cle: string
  icone: LucideIcon
  resultats: ResultatRecherche[]
  onChoisir: (href: string) => void
}) {
  if (resultats.length === 0) return null

  return (
    <CommandGroup heading={titre}>
      {resultats.map((r) => (
        <CommandItem key={r.id} value={`${cle}-${r.id}`} onSelect={() => onChoisir(r.href)}>
          <Icone className="size-4" aria-hidden />
          {/*
            `min-w-0` sur l'élément flexible, sans quoi le plafond reste inerte :
            un enfant de boîte flexible ne descend pas sous sa taille de contenu.
          */}
          <Tronque className="max-w-72 min-w-0">{r.libelle}</Tronque>
          {r.entreprise && (
            <span className="text-ink3 ml-auto shrink-0 text-[13px]">{r.entreprise}</span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
