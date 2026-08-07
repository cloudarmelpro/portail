/**
 * Les quatre vues du fonds de CV.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Une catégorie n'en est pas une : c'est un DOSSIER.
 *
 * Les quatre vues portent sur tout le fonds — elles le filtrent. Un dossier le
 * découpe. Les confondre ferait apparaître « Plus de 24 mois » dans la liste
 * des dossiers, où il n'a rien à faire, et un dossier dans une liste de filtres.
 *
 * Les deux dernières sont réservées à qui peut supprimer : lui seul applique la
 * politique de conservation — voir cahier-des-charges.MD, CV-10.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const VUES_CV = ['tous', 'non-classes', 'echeance', 'corbeille'] as const
export type VueCv = (typeof VUES_CV)[number]

/** Vues que seul `cv:supprimer` ouvre. */
export const VUES_RESERVEES: readonly VueCv[] = ['echeance', 'corbeille']

/**
 * Le nom de chaque vue, déclaré UNE fois — section 19.
 *
 * Le chemin s'en sert, et tout écran qui nommerait une vue devrait s'en servir
 * aussi. Recopié, il divergerait sans que rien ne le signale : personne ne
 * compare un chemin à un libellé de carte.
 */
export const LIBELLE_VUE_CV: Readonly<Record<VueCv, string>> = {
  tous: 'Tous les CV',
  'non-classes': 'Non classé',
  echeance: 'Plus de 24 mois',
  corbeille: 'Corbeille',
}

export function estVueCv(valeur: unknown): valeur is VueCv {
  return typeof valeur === 'string' && (VUES_CV as readonly string[]).includes(valeur)
}
