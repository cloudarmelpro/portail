import { entreprise as infoEntreprise, type EntrepriseSlug } from '@/config/entreprises'

/**
 * En-tête du document remis au client — exigence EST-10.
 *
 * Deux rendus s'en servent : l'aperçu HTML imprimable et le PDF produit par le
 * serveur. Écrits séparément, ils finiraient par ne plus dire la même chose sur
 * le même papier — et le défaut ne se verrait qu'à l'envoi.
 */

/** Coordonnées légales, saisies dans /admin/organisation. Les trois peuvent valoir `""`. */
export type CoordonneesDocument = {
  raisonSociale: string
  adresse: string
  telephone: string
}

export type EnteteDocument = {
  /** Nom de l'entreprise — c'est lui qui nomme la couleur du filet. */
  nomEntreprise: string
  /** Raison sociale, ou le nom d'entreprise à défaut. Jamais vide. */
  titre: string
  /**
   * `true` quand la raison sociale saisie diffère du nom d'entreprise : le filet
   * de couleur a besoin du nom écrit à côté (section 19), et « 9123-4567 Québec
   * inc. » ne le donne pas.
   */
  nommerEntreprise: boolean
  /** Coordonnées présentes, déjà jointes. `null` quand il n'y en a aucune. */
  coordonnees: string | null
  /**
   * Il manque au moins une coordonnée.
   *
   * Le bandeau remplace des valeurs de remplissage — même adresse pour les trois
   * entreprises, numéros en « 555 » — que rien ne signalait et qui partaient chez
   * de vrais clients. Une fausse adresse qui a l'air vraie est pire qu'une
   * absence : personne ne la corrige.
   */
  aCompleter: boolean
}

export const AVIS_COORDONNEES = 'Coordonnées à compléter avant d’envoyer ce document.'

export function composerEntete(
  slug: EntrepriseSlug,
  organisation: CoordonneesDocument,
): EnteteDocument {
  const nomEntreprise = infoEntreprise(slug).nom
  const raisonSociale = organisation.raisonSociale.trim()

  /*
    Les coordonnées présentes s'affichent même quand l'autre manque. Le bandeau
    portait auparavant le tout ou rien : une adresse saisie disparaissait du
    document entier parce que le téléphone était encore vide.
  */
  const parts = [organisation.adresse.trim(), organisation.telephone.trim()].filter(
    (p) => p.length > 0,
  )

  return {
    nomEntreprise,
    titre: raisonSociale || nomEntreprise,
    nommerEntreprise: raisonSociale.length > 0 && raisonSociale !== nomEntreprise,
    coordonnees: parts.length > 0 ? parts.join(' · ') : null,
    aCompleter: parts.length < 2,
  }
}
