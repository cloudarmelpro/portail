import { Code2, Trees, UsersRound, type LucideIcon } from 'lucide-react'
import type { EntrepriseSlug } from '@/config/entreprises'

/**
 * Un signe par entreprise, pour les cartes de choix de dossier.
 *
 * Il ne PORTE aucune information : le nom est écrit dessous, et la couleur reste
 * cantonnée au filet de 3 px. L'icône ne fait qu'aider à retrouver du premier
 * coup d'œil la carte qu'on ouvre tous les jours.
 *
 * Déclaré hors de `config/entreprises.ts` : celui-ci est lu par des modules
 * serveur qui n'ont rien à faire d'un composant React.
 */
export const ICONE_ENTREPRISE: Record<EntrepriseSlug, LucideIcon> = {
  paysagement: Trees,
  developpement: Code2,
  staff: UsersRound,
}
