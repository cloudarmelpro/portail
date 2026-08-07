import { requireModule } from '@/lib/guards'

/**
 * Garde de rôle du module — administrateur et recrutement.
 *
 * Elle ne protège que l'affichage : les mutations sont gardées une à une par
 * la fabrique d'actions, et le téléchargement par sa route.
 */
export default async function CvLayout({ children }: LayoutProps<'/cv'>) {
  await requireModule('cv')
  return children
}
