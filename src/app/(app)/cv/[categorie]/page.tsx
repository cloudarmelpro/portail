import { redirect } from 'next/navigation'
import { requireModule } from '@/lib/guards'

/**
 * Ancienne route par dossier — conservée pour les liens déjà partagés.
 *
 * Les quatre vues et les catégories se lisent maintenant dans `?vue=`, sur
 * l'écran unique du module : on y passe de l'une à l'autre sans navigation.
 * Cette route ne fait plus que reconduire vers lui.
 *
 * Aucune vérification de la valeur ici : `/cv` la résout lui-même et retombe
 * sur « Tous les CV » si elle ne désigne rien. La refaire deux fois serait une
 * seconde règle à tenir à jour.
 */
export default async function PageCategorie({ params }: PageProps<'/cv/[categorie]'>) {
  await requireModule('cv')
  const { categorie } = await params
  redirect(`/cv?vue=${encodeURIComponent(categorie)}`)
}
