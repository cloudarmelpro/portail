/**
 * Filet des surfaces flottantes — dialogues, menus, palette, tiroir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Deux valeurs, parce que les deux thèmes ont des besoins opposés.
 *
 * Le préréglage shadcn pose un filet à 10 % dans les deux. En thème CLAIR,
 * c'est un panneau blanc posé sur un fond presque blanc : le filet se lit comme
 * un trait dessiné, et il concurrence l'ombre, qui suffit déjà à détacher la
 * surface. Le système de design ne prévoit d'ailleurs aucun filet ici — la
 * section 19 ne compte que deux ombres, et les cartes n'ont pas de contour.
 *
 * En thème SOMBRE, le même filet est du blanc sur du noir. Il ne dessine rien :
 * il empêche le panneau de se fondre dans le fond, ce que l'ombre ne peut pas
 * faire quand l'ombre est noire et le fond aussi.
 *
 * D'où 5 % en clair, 10 % en sombre. Le jeton `--ink` bascule déjà avec le
 * thème ; seule l'opacité diffère.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `components/ui/` vient de shadcn et ne se modifie pas à la main : ces classes
 * sont posées par composition, depuis les enveloppes de `components/shared/`.
 * Elles y sont placées AVANT la classe reçue de l'appelant, pour qu'un écran
 * puisse encore trancher autrement s'il en a la raison.
 */

/** Surfaces qui portent un anneau : dialogue, menu, palette. */
export const FILET_FLOTTANT = 'ring-ink/5 dark:ring-ink/10'

/**
 * Surfaces qui portent une bordure d'un seul côté : le tiroir, plaqué contre le
 * bord de l'écran. Même règle, autre propriété CSS — un anneau ferait le tour
 * d'un panneau dont trois côtés sont hors de l'écran.
 */
export const BORDURE_FLOTTANTE = 'border-ink/5 dark:border-ink/10'
