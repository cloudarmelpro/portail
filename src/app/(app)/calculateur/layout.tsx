import { requireModule } from '@/lib/guards'

/**
 * Garde de rôle du module — administrateur seul, aujourd'hui.
 *
 * Elle ne protège que l'affichage : les mutations sont gardées une à une par la
 * fabrique d'actions, et les exports par leur route.
 */
export default async function CalculateurLayout({ children }: LayoutProps<'/calculateur'>) {
  await requireModule('calculateur')
  return children
}
