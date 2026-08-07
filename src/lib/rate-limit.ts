import 'server-only'

/**
 * Limitation de débit — connexion et URL présignées.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce que cette implémentation est, et ce qu'elle n'est pas.
 *
 * Le compteur vit en mémoire du processus. Il ne survit donc pas à un
 * redémarrage, et ne se partage pas entre plusieurs instances. C'est un choix
 * proportionné, pas une négligence : l'application tourne dans un conteneur
 * unique sur un VPS, pour trois utilisateurs. Ajouter Redis pour cela
 * reviendrait à faire dépendre la connexion d'un service de plus.
 *
 * Ce qu'il faudra changer le jour où l'on passe à deux instances : un
 * compteur en mémoire compte alors deux fois le plafond, une par instance.
 * C'est le moment de sortir l'état du processus, et pas avant.
 *
 * La limitation des tentatives de CONNEXION est assurée par Better Auth
 * (`lib/auth.ts`), qui a son propre compteur. Ce module couvre le reste :
 * essentiellement les liens signés vers le stockage, que rien ne plafonnait.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type Verdict = { autorise: true } | { autorise: false; secondesAvantReprise: number }

type Fenetre = { horodatages: number[] }

const compteurs = new Map<string, Fenetre>()

/**
 * Purge des fenêtres vides.
 *
 * Sans elle, la carte grandirait d'une entrée par utilisateur et par action,
 * indéfiniment. Le déclenchement est opportuniste — au fil des appels, une fois
 * sur cinquante — plutôt que par minuterie : un `setInterval` dans un module
 * Next.js se duplique à chaque rechargement à chaud en développement.
 */
let appels = 0
function purger(maintenant: number): void {
  for (const [cle, fenetre] of compteurs) {
    if (
      fenetre.horodatages.length === 0 ||
      maintenant - (fenetre.horodatages.at(-1) ?? 0) > 3_600_000
    ) {
      compteurs.delete(cle)
    }
  }
}

/**
 * Fenêtre glissante. Retourne le verdict ET consomme une place quand elle passe.
 *
 * La consommation est faite ici plutôt que par un second appel : deux appels
 * séparés laisseraient la porte ouverte entre les deux, et c'est exactement le
 * genre de détail qu'on oublie sur le troisième site d'appel.
 */
export function limiter(cle: string, max: number, fenetreSecondes: number): Verdict {
  const maintenant = Date.now()
  const debut = maintenant - fenetreSecondes * 1000

  if (++appels % 50 === 0) purger(maintenant)

  const fenetre = compteurs.get(cle) ?? { horodatages: [] }
  const recents = fenetre.horodatages.filter((t) => t > debut)

  if (recents.length >= max) {
    const plusAncien = recents[0] ?? maintenant
    const attente = Math.ceil((plusAncien + fenetreSecondes * 1000 - maintenant) / 1000)
    compteurs.set(cle, { horodatages: recents })
    return { autorise: false, secondesAvantReprise: Math.max(1, attente) }
  }

  recents.push(maintenant)
  compteurs.set(cle, { horodatages: recents })
  return { autorise: true }
}

/**
 * Plafonds.
 *
 * Consulter vingt CV d'affilée est un usage normal du module — c'est même son
 * intérêt (CV-5). Le plafond ne vise pas la consultation attentive : il vise
 * la boucle. Cent téléchargements en cinq minutes n'est pas une lecture, c'est
 * une extraction, et une session compromise sortirait sinon la banque entière
 * sans rien rencontrer.
 */
export const PLAFONDS = {
  telechargementCv: { max: 100, fenetreSecondes: 300 },
  televersementCv: { max: 60, fenetreSecondes: 300 },
  /**
   * Dépôt de logo. Il manquait, alors que `architecture.MD` annonce la
   * limitation « sur la génération d'URL présignées » — les trois points
   * d'émission doivent l'avoir, pas deux. Le geste est rare : dix suffisent.
   */
  televersementLogo: { max: 10, fenetreSecondes: 300 },
  /**
   * Palette de commandes. Chaque pause de frappe interroge quatre familles sur
   * trois entreprises : le plafond vise l'énumération par préfixes successifs,
   * pas la personne qui cherche un nom.
   */
  recherche: { max: 60, fenetreSecondes: 60 },
  /**
   * Journalisation des refus d'accès — ADM-4.
   *
   * Un écran interdit produit DEUX refus par rendu, pas un : le layout du module
   * puis la page. Et rien n'empêche de garder F5 enfoncé. Dix entrées par cible
   * et par cinq minutes laissent voir la tentative sans laisser inonder la table.
   */
  refusAcces: { max: 10, fenetreSecondes: 300 },
} as const

/** Clé par utilisateur : un plafond global punirait la recruteuse pour autrui. */
export function cleUtilisateur(action: string, userId: string): string {
  return `${action}:${userId}`
}
