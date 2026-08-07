'use client'

import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FILET_FLOTTANT } from '@/components/shared/surface-flottante'
import { Tronque } from '@/components/shared/tronque'
import { cn } from '@/lib/utils'

/** Même gabarit de ligne que les autres menus du produit, section 19. */
const LIGNE_MENU =
  'flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] leading-[18px] text-ink2 hover:bg-hover hover:text-ink'

/**
 * Choix unique — même habillage que les menus de la barre latérale et des
 * lignes de tableau.
 *
 * Un `<select>` natif porte le style du SYSTÈME : sa flèche, sa liste et ses
 * surbrillances viennent de Windows ou de macOS, pas du produit. Sur une rangée
 * qui en alignait trois à côté de champs dessinés, la rupture se voyait plus que
 * les valeurs.
 *
 * Le déclencheur affiche la valeur RETENUE, pas le nom du champ : ce qu'on
 * cherche à lire est ce qui est actif.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Deux emplois, et la différence n'est pas cosmétique.
 *
 * En FILTRE, une entrée vide ouvre la liste — « Tous les modules », « Toutes les
 * entreprises » — et le contrôle est dense, à la hauteur d'une rangée d'outils.
 *
 * En CHAMP de formulaire, il n'y a pas de valeur vide : un type de client ou un
 * rôle est toujours l'un des choix. Le contrôle prend alors la hauteur des
 * autres champs et leur largeur, sans quoi il décroche de la colonne de saisie
 * de quatre pixels — écart trop petit pour se nommer, assez grand pour se voir.
 *
 * `parDefaut` distingue les deux : le donner crée l'entrée vide, l'omettre non.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function Choix({
  valeur,
  options,
  parDefaut,
  annonce,
  id,
  decritPar,
  champ = false,
  onChoisir,
}: {
  valeur: string
  options: { valeur: string; libelle: string }[]
  /** Libellé de l'entrée vide. Absent : aucune entrée vide — emploi en champ. */
  parDefaut?: string
  annonce?: string
  /** Pour qu'une étiquette `htmlFor` désigne le déclencheur. */
  id?: string
  /**
   * Identifiant d'un texte qui décrit le choix — le tarif d'un service, par
   * exemple. Sans lui, la calculette rattachait ce tarif au champ de QUANTITÉ,
   * faute de pouvoir le rattacher au sélecteur qu'il décrit.
   */
  decritPar?: string
  /** Hauteur et largeur d'un champ de formulaire plutôt que d'un filtre. */
  champ?: boolean
  onChoisir: (valeur: string | null) => void
}) {
  const actif = options.find((o) => o.valeur === valeur)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        aria-label={annonce}
        aria-describedby={decritPar}
        className={cn(
          'border-border bg-raised hover:border-border-strong data-[state=open]:border-border-strong flex items-center gap-1.5 border',
          /*
            Le rayon suit le VOISINAGE, pas le composant. En champ, le
            déclencheur est dans une colonne de saisies à 6 px : à 9 px, il
            décrochait d'un cheveu de la ligne au-dessus et de celle en dessous.
            En filtre, il côtoie les surfaces flottantes, qui sont à 9.
          */
          champ
            ? 'h-11 w-full justify-between rounded-[6px] px-3 text-[15px] md:h-10'
            : 'h-9 rounded-[9px] px-2.5 text-[13px]',
          actif ? 'text-ink font-medium' : 'text-ink2',
        )}
      >
        {/*
          `text-left` est indispensable : un `<button>` centre son texte par
          défaut. Tant que la valeur était un simple nœud de texte placé par
          `justify-between`, cela ne se voyait pas ; dans un bloc qui occupe la
          place restante, elle se centrerait.
        */}
        <Tronque
          className={cn(
            'text-left',
            // En champ, la colonne de saisie donne déjà la limite. En filtre, le
            // déclencheur épouse sa valeur : sans plafond, un nom long écarte
            // tout ce qui partage sa rangée d'outils.
            champ ? 'max-w-none min-w-0 flex-1' : 'max-w-48',
          )}
        >
          {actif?.libelle ?? parDefaut}
        </Tronque>
        <ChevronDown className="text-ink3 size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className={cn(
          'bg-raised shadow-menu max-h-80 rounded-[9px] px-1 py-1.5',
          /*
            En champ, la liste épouse le déclencheur ; en filtre, elle a sa
            propre largeur, le déclencheur étant aussi étroit que sa valeur.

            Cette largeur est désormais un plancher et non une mesure fixe : les
            entrées d'un filtre viennent parfois des données — un auteur du
            journal, un service de la calculette — et 224 px les coupaient
            toutes dès qu'une seule dépassait. Le menu s'étend jusqu'à 320 px,
            puis c'est la ligne qui tronque.
          */
          champ ? 'w-(--anchor-width)' : 'max-w-80 min-w-56',
          FILET_FLOTTANT,
        )}
      >
        <DropdownMenuRadioGroup
          value={valeur}
          onValueChange={(v) => onChoisir(v === '' ? null : v)}
        >
          {parDefaut !== undefined && (
            <DropdownMenuRadioItem value="" className={LIGNE_MENU}>
              <Tronque className="max-w-none min-w-0 flex-1 text-left">{parDefaut}</Tronque>
            </DropdownMenuRadioItem>
          )}
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.valeur} value={o.valeur} className={LIGNE_MENU}>
              {/*
                La ligne est à hauteur FIXE : un libellé qui se replierait
                déborderait de ses 34 px au lieu de pousser le menu.
              */}
              <Tronque className="max-w-none min-w-0 flex-1 text-left">{o.libelle}</Tronque>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
