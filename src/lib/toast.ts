import { toast as sonner } from 'sonner'

/**
 * Notifications — les règles de la section 19 d'`architecture.MD`, à un seul endroit.
 *
 * Trois secondes pour un succès, **persistante pour une erreur** : un message
 * d'échec qui disparaît tout seul est un message que personne n'a lu.
 *
 * Les icônes sont posées par `components/ui/sonner.tsx` : une notification porte
 * donc toujours une icône ET un mot, jamais la couleur seule.
 */

type Action = {
  /** Libellé du bouton — verbe à l'infinitif. */
  label: string
  onClick: () => void
}

export const notifier = {
  /**
   * `action` ferme la boucle après une opération : « Estimation enregistrée »
   * suivi de « Ouvrir le dossier ». Sans ce lien, l'utilisateur doit renaviguer
   * à la main vers ce qu'il vient de créer.
   */
  succes(message: string, action?: Action) {
    return sonner.success(message, { duration: 3000, action })
  },

  erreur(message: string, action?: Action) {
    return sonner.error(message, { duration: Infinity, action })
  },

  info(message: string, action?: Action) {
    return sonner.info(message, { duration: 4000, action })
  },

  /** Pendant une opération longue : téléversement, export, génération de PDF. */

  fermer(id?: string | number) {
    sonner.dismiss(id)
  },
}
