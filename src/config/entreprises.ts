/**
 * Les trois entreprises du client.
 *
 * Le slug apparaît dans les URL du CRM et du calculateur — il est donc saisi par
 * l'utilisateur et n'a aucune valeur de preuve. Toute route cloisonnée doit le
 * revalider ici avant usage : voir `estEntreprise` et `lib/guards.ts`.
 *
 * `jeton` désigne une variable CSS déclarée dans `globals.css`. La couleur ne sert
 * jamais de surface — filet de 3 px ou pastille de 8 px, toujours avec le nom
 * écrit à côté. Voir `architecture.MD`, section 19.
 */
/**
 * `prefixe` compose la référence des estimations — « PAY-2026-014 ». Il est
 * recopié dans `Estimation.reference` à l'émission, jamais relu ensuite : un
 * préfixe modifié ici ne renomme aucune estimation déjà transmise à un client.
 */
export const ENTREPRISES = [
  { slug: 'paysagement', nom: 'Paysagement', jeton: '--pays', prefixe: 'PAY' },
  { slug: 'developpement', nom: 'Développement web', jeton: '--dev', prefixe: 'DEV' },
  { slug: 'staff', nom: 'Staff augmentation', jeton: '--staff', prefixe: 'STA' },
] as const

export type Entreprise = (typeof ENTREPRISES)[number]
export type EntrepriseSlug = Entreprise['slug']

const PAR_SLUG = new Map(ENTREPRISES.map((e) => [e.slug, e]))

/** Garde de type : n'accepte que les trois slugs connus. */
export function estEntreprise(valeur: unknown): valeur is EntrepriseSlug {
  return typeof valeur === 'string' && PAR_SLUG.has(valeur as EntrepriseSlug)
}

export function entreprise(slug: EntrepriseSlug): Entreprise {
  const e = PAR_SLUG.get(slug)
  if (!e) throw new Error(`Entreprise inconnue : ${slug}`)
  return e
}
