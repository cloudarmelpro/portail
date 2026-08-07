/**
 * Durées de conservation — exigence TR-6.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce sont des MINIMUMS, pas des échéances de purge.
 *
 * La confusion est facile et elle est coûteuse dans les deux sens. Une durée
 * de conservation, en droit du travail, dit « tu ne dois pas effacer avant » —
 * elle ne dit jamais « tu dois effacer après ». Lire TR-6 comme une consigne
 * d'effacement produirait exactement l'inverse de ce que la norme protège : un
 * registre d'heures détruit au premier jour de sa quatrième année, alors qu'une
 * réclamation le rendait encore opposable.
 *
 * Ce fichier n'expose donc aucune fonction de suppression, et il n'en existe
 * aucune ailleurs pour ces données. Il expose la question inverse : cette
 * donnée est-elle encore sous obligation de conservation ? Tout code qui
 * voudrait un jour effacer une heure ou une ligne de paie devra la poser.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * À ne pas confondre avec `CONSERVATION_MOIS` de `lib/data/cv.ts`, qui n'est
 * qu'un repère d'ancienneté à l'écran : le client a écarté toute limite de
 * durée pour les curriculum vitæ, et rien ne les supprime (CV-10).
 */

/** Nature de la donnée, au sens de la norme du travail. */
export type NatureConservee = 'heures' | 'paie'

/**
 * Registre des heures : 3 ans · registre de paie : 6 ans.
 *
 * En ANNÉES et non en jours : une durée légale se compte en années civiles, et
 * un calcul en jours dériverait d'une journée à chaque année bissextile — soit
 * une donnée libérée trop tôt, du mauvais côté de l'obligation.
 */
export const CONSERVATION_ANS: Record<NatureConservee, number> = {
  heures: 3,
  paie: 6,
}

/** Libellés d'interface — section 19 d'architecture.MD. */
export const LIBELLE_CONSERVATION: Record<NatureConservee, string> = {
  heures: 'Registre des heures',
  paie: 'Registre de paie',
}

/**
 * Date avant laquelle la conservation n'est plus obligatoire.
 *
 * `setFullYear` sur une copie : décaler l'objet reçu modifierait la date de
 * l'appelant, qui s'en sert souvent juste après pour afficher la période.
 */
export function finDeConservation(depuis: Date, nature: NatureConservee): Date {
  const d = new Date(depuis)
  d.setFullYear(d.getFullYear() + CONSERVATION_ANS[nature])
  return d
}

/**
 * Cette donnée est-elle encore sous obligation légale de conservation ?
 *
 * Le seul appel légitime est une garde AVANT suppression. Aucun appelant
 * aujourd'hui : c'est voulu. Rien n'efface ces registres, et cette fonction
 * existe pour que le jour où quelqu'un l'écrira, la question soit déjà posée
 * et déjà répondue au bon endroit.
 */
export function sousConservation(
  depuis: Date,
  nature: NatureConservee,
  maintenant = new Date(),
): boolean {
  return maintenant < finDeConservation(depuis, nature)
}
