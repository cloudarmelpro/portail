/**
 * Taxes de vente applicables au Québec.
 *
 * Ces valeurs sont les taux COURANTS. Elles servent à préremplir une nouvelle
 * estimation, jamais à en relire une ancienne : chaque estimation conserve les
 * siens (`tauxTps`, `tauxTvq`). Le taux de la TVQ a changé trois fois depuis
 * 2011 — une estimation de 2024 relue avec le taux de 2026 afficherait un total
 * que le client n'a jamais reçu.
 *
 * La TVQ s'applique au montant HORS TPS depuis 2013 : les deux taxes se
 * calculent sur la même assiette, elles ne se cumulent pas.
 */
export const TAUX_TPS = 0.05
export const TAUX_TVQ = 0.09975

export const LIBELLE_TAXE = {
  tps: 'TPS',
  tvq: 'TVQ',
} as const

/** Validité par défaut d'une estimation, en jours — exigence EST-13. */
export const VALIDITE_JOURS = 30
