import { connection } from 'next/server'
import { SearchX } from 'lucide-react'
import { EtatSysteme } from '@/components/shared/etat-systeme'

/**
 * Rendue à la demande pour la même raison que `mot-de-passe-oublie` : le nonce
 * de la CSP n'est apposé qu'au rendu serveur, et une page pré-rendue au build
 * verrait ses scripts bloqués par `script-src 'strict-dynamic'`.
 *
 * Ici l'enjeu est moindre — le texte s'afficherait quand même — mais le bouton
 * de retour cesserait de naviguer sans rechargement complet.
 */
export default async function Introuvable() {
  await connection()

  return (
    // Cette page est rendue HORS du gabarit de l'application : il n'y a ni
    // barre latérale ni en-tête pour la porter, d'où le centrage sur toute la
    // hauteur.
    <div className="flex flex-1 flex-col justify-center py-16">
      <EtatSysteme
        icone={SearchX}
        titre="Cette page n’existe pas"
        message="Le lien est peut-être erroné, ou la page a été retirée."
        action={{ libelle: 'Retour à l’accueil', href: '/accueil' }}
      />
    </div>
  )
}
