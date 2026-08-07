import { redirect } from 'next/navigation'
import { requireModule } from '@/lib/guards'

/**
 * Ancienne route de la corbeille — conservée pour les liens déjà partagés.
 *
 * Elle est désormais l'une des vues de l'écran unique. Le droit `cv:supprimer`
 * est vérifié LÀ-BAS : sans lui, `/cv` retombe sur « Tous les CV » plutôt que
 * de lever, et il n'y a donc rien à garder ici de plus que le module.
 */
export default async function PageCorbeille() {
  await requireModule('cv')
  redirect('/cv?vue=corbeille')
}
