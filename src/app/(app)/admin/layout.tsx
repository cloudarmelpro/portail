import { requireModule } from '@/lib/guards'

/**
 * Garde de rôle du module d'administration.
 *
 * Elle ne protège que l'affichage : chaque page revérifie sa permission propre,
 * et les mutations sont gardées une à une par la fabrique d'actions.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireModule('admin')
  return children
}
