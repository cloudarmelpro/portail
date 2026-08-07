'use client'

import { useEffect, useState } from 'react'
import { Menu, Search } from 'lucide-react'
import { Sheet, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ContenuTiroir } from '@/components/shared/contenu-tiroir'
import { BarreLaterale } from '@/components/layout/barre-laterale'
import { PaletteCommandes } from '@/components/layout/palette-commandes'
import { AvertissementSession } from '@/components/layout/avertissement-session'
import { FilAriane } from '@/components/layout/fil-ariane'
import { FournisseurRecherche } from '@/components/layout/contexte-recherche'
import { cn } from '@/lib/utils'
import type { EntreeNav } from '@/config/navigation'
import type { Role } from '@/lib/permissions'

type Props = {
  entrees: EntreeNav[]
  utilisateur: { nom: string; courriel: string; role: Role }
  children: React.ReactNode
}

/**
 * Ossature de l'application.
 *
 * Adaptation aux écrans — architecture.MD, section 19 :
 *   au-delà de 1280 px  barre latérale déployée, 212 px
 *   768 à 1280 px       barre réduite aux icônes, 52 px
 *   en dessous de 768   tiroir, ouvert par le bouton de l'en-tête
 *
 * Les bascules automatiques sont faites en CSS plutôt qu'en JavaScript : pas de
 * mesure de fenêtre, pas de scintillement au premier rendu. Seul le repli
 * MANUEL est un état — il n'a pas d'équivalent en media query, et il part à
 * `false`, donc le premier rendu client est identique au rendu serveur.
 *
 * La barre repose sur `--page` ; le contenu est un panneau `--surface` qui
 * flotte à côté. C'est cette respiration qui sépare les deux zones, pas un
 * filet.
 */
export function Shell({ entrees, utilisateur, children }: Props) {
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  const [replie, setReplie] = useState(false)
  const [rechercheOuverte, setRechercheOuverte] = useState(false)

  /*
    ⌘K vit ici et non dans la palette : le déclencheur est désormais dans la
    barre latérale, et deux composants qui se partagent le même état d'ouverture
    finiraient par diverger.
  */
  useEffect(() => {
    function auClavier(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setRechercheOuverte((o) => !o)
      }
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [])

  return (
    <div className="bg-page flex min-h-full flex-1">
      {/*
        Lien d'évitement — TR-14.

        Sur la fiche d'un client, il fallait traverser la barre latérale,
        l'en-tête, la palette de commandes et deux rangées d'onglets avant
        d'atteindre le contenu. À la tabulation, cela fait une vingtaine
        d'arrêts, sur chaque page.

        Invisible tant qu'il n'a pas le focus, et jamais masqué par `hidden` :
        un lien `display:none` ne reçoit pas le focus, donc n'existe pas.
      */}
      <a
        href="#contenu"
        className="bg-surface border-border text-ink focus:ring-ink focus:z-toast sr-only rounded-sm border px-4 py-2 text-[15px] font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:ring-2 focus:outline-none"
      >
        Aller au contenu
      </a>

      {/* Barre latérale — masquée sous 768 px */}
      <aside className={cn('z-20 hidden shrink-0 md:block md:w-13', !replie && 'xl:w-53')}>
        <div className="sticky top-0 h-svh">
          {/*
            Les deux variantes sont rendues et l'une est masquée en CSS. Le
            repli manuel ne fait donc que déplacer le point de bascule : aucune
            mesure de fenêtre, et rien à réconcilier à l'hydratation.
          */}
          <div className={cn('h-full', replie ? 'hidden' : 'hidden xl:block')}>
            <BarreLaterale
              entrees={entrees}
              utilisateur={utilisateur}
              onReplier={() => setReplie(true)}
              replie={replie}
              onRechercher={() => setRechercheOuverte(true)}
            />
          </div>
          <div className={cn('h-full', !replie && 'xl:hidden')}>
            <BarreLaterale
              entrees={entrees}
              utilisateur={utilisateur}
              compacte
              /*
                Le bouton de déploiement n'apparaît qu'au-delà de 1280 px : entre
                768 et 1280, le rail est imposé par la largeur, et proposer de le
                déployer promettrait quelque chose que l'écran ne peut pas tenir.
              */
              onReplier={replie ? () => setReplie(false) : undefined}
              replie={replie}
              onRechercher={() => setRechercheOuverte(true)}
            />
          </div>
        </div>
      </aside>

      {/*
        Panneau de contenu — arrondi, SANS `overflow-hidden`.

        Le rognage ferait de ce panneau un conteneur de défilement, et l'en-tête
        collant qu'il contient cesserait de coller : il se fige alors sur un
        conteneur qui ne défile jamais.

        Les coins hauts sont donc peints par le panneau lui-même. Ils l'étaient
        auparavant par l'en-tête, seul enfant à monter jusqu'à eux — il ne
        subsiste plus qu'au téléphone, où le panneau n'a pas d'arrondi.
      */}
      <div className="bg-surface @container flex min-w-0 flex-1 flex-col md:mt-2 md:mr-2 md:mb-2 md:ml-1 md:rounded-md">
        {/*
          L'en-tête n'existe plus QU'AU TÉLÉPHONE.

          Au-delà de 768 px, la barre latérale est à l'écran : le fil d'Ariane y
          redisait le nom du module, et l'onglet actif redisait déjà celui de
          l'écran. Une bande de 56 px et son filet pour deux redites.

          En dessous, elle reste indispensable — c'est le seul endroit d'où
          ouvrir le menu et la recherche, la barre latérale étant repliée dans un
          tiroir.
        */}
        <header className="border-border bg-surface sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <Sheet open={tiroirOuvert} onOpenChange={setTiroirOuvert}>
            <SheetTrigger
              className="hover:bg-hover -ml-2.5 flex size-11 items-center justify-center rounded-sm"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <ContenuTiroir side="left" className="w-65 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <BarreLaterale
                entrees={entrees}
                utilisateur={utilisateur}
                onRechercher={() => {
                  setTiroirOuvert(false)
                  setRechercheOuverte(true)
                }}
                onNaviguer={() => setTiroirOuvert(false)}
              />
            </ContenuTiroir>
          </Sheet>

          <FilAriane />

          <div className="flex-1" />

          {/* Au-delà, la recherche vit dans la barre latérale, avec son ⌘K. */}
          <button
            type="button"
            onClick={() => setRechercheOuverte(true)}
            aria-label="Rechercher"
            className="border-border text-ink3 hover:border-border-strong hover:text-ink flex size-11 shrink-0 items-center justify-center rounded-[8px] border"
          >
            <Search className="size-4" aria-hidden />
          </button>
        </header>

        {/*
          Le contenu peut demander l'ouverture de la palette — l'écran d'accueil
          en fait son champ de recherche. Le geste seul descend ; l'état, lui,
          reste ici.
        */}
        <main
          id="contenu"
          // `tabIndex={-1}` : sans lui, la cible du lien d'évitement reçoit le
          // défilement mais pas le focus, et la tabulation suivante repart du
          // haut de la page — le lien n'aurait rien évité.
          tabIndex={-1}
          className="mx-auto w-full max-w-312.5 flex-1 px-4 pt-2 pb-24 outline-none md:px-6 xl:px-8"
        >
          <FournisseurRecherche ouvrir={() => setRechercheOuverte(true)}>
            {children}
          </FournisseurRecherche>
        </main>
      </div>

      <PaletteCommandes
        entrees={entrees}
        ouverte={rechercheOuverte}
        onOuverteChange={setRechercheOuverte}
      />
      <AvertissementSession />
    </div>
  )
}
