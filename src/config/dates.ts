/**
 * Fuseau horaire de référence de l'application.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sans fuseau explicite, un `Intl.DateTimeFormat` suit celui du SERVEUR.
 *
 * Le serveur est en UTC : une saisie du lundi matin s'y afficherait au dimanche
 * soir. La gérante verrait ses heures glisser d'un jour, et le décalage
 * changerait deux fois par an au passage à l'heure avancée — un défaut qui se
 * répare puis revient six mois plus tard.
 *
 * Les trois entreprises sont au Québec, d'où une constante unique. Le jour où
 * ce ne serait plus vrai, c'est ici que la question se poserait, et nulle part
 * ailleurs.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const FUSEAU = 'America/Toronto'

/** Locale d'affichage. Le français du Québec, jamais celui de France. */
export const LOCALE = 'fr-CA'
