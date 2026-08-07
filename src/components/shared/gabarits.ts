/**
 * Les mesures que plusieurs écrans partagent, déclarées une fois.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce ne sont pas des composants, et c'est délibéré.
 *
 * Un `<Champ>` partagé devrait absorber toutes les variantes déjà en place :
 * étiquette flottante de l'authentification, aide sous le champ de
 * l'organisation, chasse tabulaire de la calculette, largeur bornée du
 * téléphone. Il finirait avec huit props et personne ne saurait plus lequel des
 * huit écrans il sert.
 *
 * Une CHAÎNE de classes se compose avec `cn()` sans rien imposer d'autre. Ce qui
 * doit être identique l'est ; le reste reste local.
 *
 * Elles étaient recopiées au caractère près dans six fichiers. Un ajustement de
 * hauteur sur l'un laissait les cinq autres en arrière, et l'écart ne se voyait
 * qu'en passant d'un module à l'autre — ce que personne ne fait en relisant un
 * diff.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Champ de saisie. 44 px au doigt, 40 à la souris — section 19, cibles
 * tactiles. Rayon de 6 px : plus rond, il aurait l'air d'un bouton.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `ps-3 pe-3` et non `px-3`, dans les trois gabarits, et ce n'est pas un goût.
 *
 * `px` produit `padding-inline` ; `pl` produit `padding-left`. Les deux
 * appartiennent à des familles différentes : `tailwind-merge` ne les voit pas en
 * conflit et les laisse toutes deux passer, après quoi c'est l'ORDRE dans la
 * feuille de style qui tranche — et il ne tranche pas en faveur du dernier écrit.
 *
 * Un `cn(CHAMP_OUTIL, 'pl-10')` était donc simplement sans effet : la loupe de
 * la recherche se retrouvait par-dessus le texte. Avec `ps`/`pe`, l'appelant
 * écrit dans la MÊME famille, `tailwind-merge` reconnaît le conflit, et le
 * dernier gagne comme on l'attend.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const CHAMP =
  'border-border bg-surface placeholder:text-ink3 h-11 w-full rounded-[6px] border ps-3 pe-3 text-[15px] md:h-10'

/**
 * Champ d'une rangée d'OUTILS — recherche, filtre.
 *
 * Il ne prend pas la forme d'un champ de saisie : il vit à côté des menus
 * déroulants de `Choix` en mode filtre, dont il reprend la hauteur, le rayon de
 * 9 px et la surface surélevée. Un champ de saisie au milieu d'une barre de
 * filtres décrocherait des contrôles qui l'entourent.
 *
 * Quatre écrans l'avaient recopié avec quatre formes différentes : passer de
 * `/admin/utilisateurs` à `/crm/x/clients` puis à `/cv/tous` faisait changer
 * trois fois le rayon, la hauteur et le corps du même contrôle.
 *
 * `h-11 md:h-9` : 44 px au doigt, section 19, cibles tactiles.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La croix native de `type="search"` est masquée ICI, pour tous.
 *
 * Le navigateur en dessine une — bleue sur Chromium — dès qu'un terme est
 * saisi. Elle vide le champ SANS relancer la recherche : on se retrouvait avec
 * un champ vierge au-dessus d'une liste toujours filtrée, deux affirmations
 * contradictoires à l'écran. Et là où le produit dessine déjà la sienne, il y en
 * avait deux côte à côte.
 *
 * Deux écrans sur quatre la masquaient, chacun dans son coin. Portée par le
 * gabarit, la règle vaut pour le prochain champ de recherche sans qu'on ait à y
 * penser.
 *
 * Le type reste `search` : il porte la sémantique, et c'est lui qui fait
 * proposer l'historique de recherche du navigateur.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const CHAMP_FILTRE =
  'border-border bg-raised h-11 rounded-[9px] border ps-3 pe-3 text-[13px] md:h-9 [&::-webkit-search-cancel-button]:hidden'

/**
 * Champ de la rangée d'outils PRINCIPALE — celle qui coiffe un tableau pleine
 * largeur, avec ses actions à droite.
 *
 * Quatre pixels de plus que `CHAMP_FILTRE`, et un corps de 15 plutôt que 13 :
 * un contrôle de 36 px paraît perdu quand il traverse mille deux cents pixels.
 * `CHAMP_FILTRE` reste la forme des rangées de FILTRES, où le champ côtoie des
 * menus de 36 px et doit s'aligner sur eux.
 *
 * Sa hauteur va de pair avec la taille `lg` de `bouton.tsx` : les deux se
 * posent sur la même rangée, et bouger l'une sans l'autre les désaligne.
 */
export const CHAMP_OUTIL =
  'border-border bg-raised h-11 w-full rounded-[9px] border ps-3 pe-3 text-[15px] md:h-10 [&::-webkit-search-cancel-button]:hidden'

/**
 * Zone de texte multi-lignes. Même filet et même rayon que le champ, sans la
 * hauteur fixe — c'est le nombre de lignes qui la donne.
 *
 * `resize-none` : une poignée de redimensionnement dans un dialogue laisse
 * étirer le champ par-dessus les boutons.
 */
export const ZONE_TEXTE =
  'border-border bg-surface placeholder:text-ink3 w-full resize-none rounded-[6px] border ps-3 pe-3 py-2 text-[15px] leading-[22px]'

/** Séparation entre deux sections d'une fiche. */
export const SECTION = 'border-border mt-12 border-t pt-8'

/** Titre de section — jamais un titre de page, jamais une action. */
export const TITRE_SECTION = 'text-[17px] leading-6 font-semibold'
