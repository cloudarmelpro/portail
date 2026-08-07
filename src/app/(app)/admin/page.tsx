import { redirect } from 'next/navigation'

/**
 * `/admin` n'a pas d'écran propre : la navigation pointe déjà sur la première
 * section. La redirection existe pour l'adresse saisie à la main.
 */
export default function PageAdmin() {
  redirect('/admin/utilisateurs')
}
