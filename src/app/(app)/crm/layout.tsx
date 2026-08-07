import { requireModule } from '@/lib/guards'

/**
 * Garde de rôle du module — CRM-1, réservé à l'administrateur.
 *
 * Elle ne protège que l'affichage. Les mutations sont gardées une à une par la
 * fabrique d'actions, et le cloisonnement par entreprise par `prismaCadre`.
 */
export default async function CrmLayout({ children }: LayoutProps<'/crm'>) {
  await requireModule('crm')
  return children
}
