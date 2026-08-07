'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type Onglet = { libelle: string; href: string }

/**
 * Sections de l'administration — contrôle segmenté de shadcn.
 *
 * Client uniquement parce qu'il faut connaître l'adresse courante pour marquer
 * la section active. La liste, elle, est décidée côté serveur à partir des
 * permissions : une section absente n'est pas grisée, elle n'existe pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le composant vient de shadcn ; ce qu'il porte reste des LIENS.
 *
 * `render` remplace le `<button>` de la primitive par le `<Link>` de Next sans
 * rien changer à l'habillage. Sans lui, chaque section deviendrait un bouton :
 * plus d'adresse à copier, plus d'ouverture dans un nouvel onglet, plus de
 * préchargement au survol — et le retour arrière du navigateur ne reviendrait
 * plus à la section précédente.
 *
 * Le rail gris est celui du variant par défaut. Il avait été retiré une fois, au
 * motif qu'il donnait cinq boîtes pour une seule section courante ; il est
 * rétabli sur demande, et c'est alors le CONTRASTE qui doit faire le travail que
 * le rail ne fait pas — la pastille active est blanche et filetée sur un fond
 * gris, là où le variant de shadcn se contente d'une ombre.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function OngletsAdmin({ onglets }: { onglets: Onglet[] }) {
  const chemin = usePathname()
  const courant = onglets.find((o) => chemin === o.href || chemin.startsWith(`${o.href}/`))

  return (
    // `gap-0` : la racine réserve sinon une gouttière pour un panneau qui
    // n'existe pas ici — la navigation remplace l'écran, elle ne l'échange pas.
    <Tabs value={courant?.href ?? ''} className="min-w-0 gap-0">
      <TabsList
        aria-label="Sections de l’administration"
        /*
          `h-9!` — avec le point d'exclamation, et c'est indispensable.

          Le variant de shadcn déclare sa hauteur sous une VARIANTE :
          `group-data-horizontal/tabs:h-8`. Un simple `h-9` écrit ici a beau
          venir après, il perd : le sélecteur de la variante est plus spécifique.
          Le rail restait donc à 32 px, la pastille à 24, et toute retouche de
          hauteur était sans effet — sans rien lever, sans rien souligner.

          40 px de rail, 2 px de rembourrage, 36 px de pastille. La
          pastille remplit presque le rail, comme dans le repère : creusée
          davantage, elle flotterait dedans et le rail compterait pour un second
          cadre autour d'elle.

          Aucun filet sur le rail : il n'a que son fond pour bord. Le filet de la
          pastille reste, lui, et c'est ce qui la fait ressortir — elle est
          alors la seule des cinq à en porter un.

          `bg-rail` remplace le `bg-muted` de shadcn, qui pointe sur le jeton de
          SURVOL. Un rail peint avec la couleur d'un état paraît survolé en
          permanence, et le vrai survol n'a plus rien à dire.
        */
        className="bg-rail h-10! max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-[9px] p-0.5"
      >
        {onglets.map((o) => {
          const actif = o.href === courant?.href
          return (
            <TabsTrigger
              key={o.href}
              value={o.href}
              /*
                `nativeButton={false}` : la primitive attend un `<button>` et
                vérifie à l'exécution qu'elle en a bien un. Ici c'est une ancre —
                délibérément, voir l'en-tête du fichier. Sans cette déclaration,
                elle avertit en console à chaque rendu, et pose des attributs
                pensés pour un bouton sur un élément qui n'en est pas un.
              */
              nativeButton={false}
              render={<Link href={o.href} aria-current={actif ? 'page' : undefined} />}
              className={cn(
                'h-full flex-none shrink-0 rounded-[6px] px-3.5 text-[13px] leading-4.5 whitespace-nowrap',
                /*
                  Le trait du variant souligné, retiré — et pas seulement pour
                  l'œil. Le composant le pose en `::after` à 5 px SOUS l'onglet ;
                  dans un rail qui défile, il déborde en hauteur, la barre
                  verticale apparaît, elle mange de la largeur, et la barre
                  horizontale suit. Deux barres pour cinq mots.

                  `overflow-y-hidden` sur le rail ferme la même porte : une seule
                  valeur `auto` suffit à rendre l'autre axe défilant.
                */
                'after:hidden',
                /*
                  L'actif est blanc et FILETÉ, pas seulement ombré comme le
                  propose shadcn : sur un rail à 4 % de noir, une ombre douce ne
                  détache presque rien, et c'est justement là qu'il faut voir du
                  premier coup laquelle des cinq est ouverte.

                  Le filet TRANSPARENT des inactifs leur garde la hauteur et
                  l'axe de l'actif. Sans lui, les cinq se décalaient d'un pixel
                  au changement de section.
                */
                actif
                  ? // `border-input` et non `border-border` : mesuré à 3,18:1 sur le rail
                    // en clair et 4,10:1 en sombre, contre 1,24 et 1,26 pour le filet
                    // décoratif. C'est un filet qui IDENTIFIE un état, donc 3:1 est exigé.
                    'border-input bg-raised text-ink border font-medium'
                  : 'text-ink2 hover:text-ink border border-transparent',
              )}
            >
              {o.libelle}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
