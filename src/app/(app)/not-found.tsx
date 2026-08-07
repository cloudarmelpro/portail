import { SearchX } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'

/**
 * Introuvable, DANS le gabarit de l'application.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sans ce fichier, un `notFound()` levé depuis un module remontait jusqu'à
 * `app/not-found.tsx`, rendu hors du gabarit.
 *
 * Un identifiant de client erroné faisait donc disparaître la barre latérale,
 * l'en-tête et le fil d'Ariane d'un coup : l'utilisateur, toujours connecté,
 * se retrouvait sur une page nue, sans autre issue qu'un retour à l'accueil.
 *
 * Le message reste le même que celui de la racine : il ne dit RIEN de ce qui se
 * trouve derrière. Jamais « ce client appartient à une autre entreprise », qui
 * confirmerait son existence — voir le filet d'erreur du CRM.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function Introuvable() {
  return (
    <EtatSysteme
      icone={SearchX}
      titre="Cette page n’existe pas"
      message="Le lien est peut-être erroné, ou la page a été retirée."
      action={{ libelle: 'Retour à l’accueil', href: '/accueil' }}
    />
  )
}
