import { LIBELLE_MODULE, type Permission } from '@/lib/permissions'

/**
 * Fil d'Ariane de l'en-tête — section 19.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il se DÉDUIT de l'adresse, il ne se déclare pas écran par écran.
 *
 * Le déclarer aurait voulu dire un canal de la page vers la barre du haut, qui
 * la précède dans l'arbre. Les deux issues sont un état client que la page
 * publie après coup — et l'en-tête affiche alors autre chose le temps d'un
 * rendu — ou une route parallèle par écran, soit une vingtaine de fichiers dont
 * le seul travail serait de répéter un libellé.
 *
 * Une fonction pure sur le chemin n'a ni l'un ni l'autre défaut, et elle se
 * teste sans navigateur.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sur les écrans de FICHE, le second niveau nomme la SECTION, pas la fiche.
 *
 * Le design y met le nom du client ou de l'employé. Ce nom ne se lit pas dans
 * l'adresse — seul l'identifiant y figure —, et aucune de ces pages n'en manque :
 * chacune porte déjà le nom en titre, en 30 px. Le fil d'Ariane répond donc à
 * « où suis-je ? » et le titre à « qui est-ce ? ». Rien n'est perdu ; c'est
 * l'écart assumé avec le design.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type FilAriane = {
  /** Section parente. `null` sur l'écran d'accueil d'un module. */
  parent: string | null
  courant: string
}

/**
 * Sections de l'administration — source unique.
 *
 * Lues par les onglets de `components/admin/en-tete-admin.tsx` ET par le fil
 * d'Ariane. Écrites deux fois, elles auraient fini par se contredire : l'onglet
 * aurait dit « Journal d'audit » et la barre du haut « Journal ».
 */
export const SECTIONS_ADMIN: { permission: Permission; libelle: string; href: string }[] = [
  { permission: 'admin:utilisateurs', libelle: 'Utilisateurs', href: '/admin/utilisateurs' },
  { permission: 'admin:tarifs', libelle: 'Grilles de tarifs', href: '/admin/tarifs' },
  { permission: 'admin:journal', libelle: 'Journal d’audit', href: '/admin/journal' },
  { permission: 'heures:parametres', libelle: 'Paramètres de paie', href: '/admin/paie' },
  { permission: 'admin:organisation', libelle: 'Organisation', href: '/admin/organisation' },
]

/**
 * Dossiers système de la banque de CV. Les autres segments sont des
 * identifiants de catégorie, que l'adresse ne permet pas de nommer.
 */
const DOSSIERS_CV: Readonly<Record<string, string>> = {
  tous: 'Tous les CV',
  'non-classes': 'Non classé',
  echeance: 'Plus de 24 mois',
  corbeille: 'Corbeille',
}

export function filAriane(chemin: string): FilAriane {
  const [module, ...reste] = chemin.split('/').filter(Boolean)

  switch (module) {
    case 'crm': {
      // /crm/<entreprise>/<section>/<id> — l'entreprise est nommée par les
      // onglets de l'écran, pas ici : la répéter ferait « CRM / Paysagement /
      // Clients » pour une hiérarchie que l'utilisateur voit déjà.
      const section = reste[1]
      if (!section)
        return { parent: reste[0] ? 'CRM' : null, courant: reste[0] ? 'Relances' : 'CRM' }
      if (section === 'clients') return { parent: 'CRM', courant: 'Clients' }
      if (section === 'corbeille') return { parent: 'CRM', courant: 'Fiches supprimées' }
      return { parent: null, courant: 'CRM' }
    }

    case 'cv': {
      const dossier = reste[0]
      if (!dossier) return { parent: null, courant: LIBELLE_MODULE.cv }
      return {
        parent: LIBELLE_MODULE.cv,
        courant: DOSSIERS_CV[dossier] ?? 'Catégorie',
      }
    }

    case 'heures': {
      if (reste[0] === 'employes') {
        return { parent: LIBELLE_MODULE.heures, courant: 'Employés' }
      }
      return { parent: null, courant: LIBELLE_MODULE.heures }
    }

    case 'calculateur': {
      if (!reste[0]) return { parent: null, courant: LIBELLE_MODULE.calculateur }
      if (reste[1] === 'estimations') {
        return { parent: LIBELLE_MODULE.calculateur, courant: 'Estimations' }
      }
      return { parent: LIBELLE_MODULE.calculateur, courant: 'Nouvelle estimation' }
    }

    case 'admin': {
      const section = SECTIONS_ADMIN.find((s) => s.href === `/admin/${reste[0] ?? ''}`)
      return {
        parent: LIBELLE_MODULE.admin,
        // Une section inconnue nomme le module plutôt que d'inventer : c'est le
        // cas d'une adresse tapée à la main, qui rendra un 404 juste après.
        courant: section?.libelle ?? LIBELLE_MODULE.admin,
      }
    }

    default:
      return { parent: null, courant: 'Portail' }
  }
}
