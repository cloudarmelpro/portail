/**
 * Formats d'affichage du CRM.
 *
 * Toutes les dates manipulées ici sont des jours, pas des instants : elles sont
 * stockées à minuit UTC. Les formater dans le fuseau du serveur afficherait la
 * veille dès que celui-ci est à l'ouest de Greenwich — d'où `timeZone: 'UTC'`.
 */

const LONGUE = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const COURTE = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const MONTANT = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })

export function dateLongue(d: Date | null): string {
  return d ? LONGUE.format(d) : '—'
}

export function dateCourte(d: Date | null): string {
  return d ? COURTE.format(d) : '—'
}

export function montant(n: number): string {
  return MONTANT.format(n)
}

/** Valeur d'un `<input type="date">` — même jour que celui qui a été stocké. */
export function valeurChampDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export function retardEnMots(jours: number): string {
  if (jours <= 0) return 'Aujourd’hui'
  return jours === 1 ? 'En retard de 1 jour' : `En retard de ${jours} jours`
}

/** Compteur d'une section de relances : l'unité est nommée, le zéro et le singulier déclinés. */
export function compteRelances(n: number): string {
  if (n === 0) return 'Aucune relance'
  return n === 1 ? '1 relance' : `${n} relances`
}
