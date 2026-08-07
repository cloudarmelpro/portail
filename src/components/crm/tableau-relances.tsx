import { AlertTriangle } from 'lucide-react'
import type { RelanceDue } from '@/lib/data/crm'
import { LIBELLE_TYPE_INTERACTION } from '@/config/crm'
import { RangeeCreux } from '@/components/shared/liste-creux'
import { dateCourte, retardEnMots } from '@/components/crm/format'

/**
 * CRM-6 — un groupe de relances, en retard ou du jour.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'était un tableau à quatre colonnes ; c'est maintenant une liste en creux.
 *
 * Un tableau sert à comparer des lignes entre elles. Ici, on n'en compare
 * aucune : on prend la plus urgente et on la traite. La source trie déjà par
 * échéance croissante, l'écran sépare déjà les retards du jour — il ne restait
 * à la grille de colonnes qu'à faire lire quatre valeurs de front là où une
 * seule décide.
 *
 * Ce qui a disparu avec elle : l'en-tête « Client · Prochaine action · Dernier
 * contact · Échéance ». La rangée le rend sans le nommer — le nom du client à
 * gauche, l'action prévue à côté, l'échéance au bout, dans cet ordre de lecture.
 * Le dernier contact est le seul vraiment perdu ; il vit sur la fiche, à un clic.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le retard est dit par une icône, un mot et une couleur — jamais par la couleur
 * seule. La rangée entière mène à la fiche : un menu qui ne contiendrait que
 * « Consulter » doublerait ce lien sans rien ajouter.
 */
export function TableauRelances({
  relances,
  entreprise,
}: {
  relances: RelanceDue[]
  entreprise: string
}) {
  return (
    <>
      {relances.map((r) => (
        <RangeeCreux
          key={r.clientId}
          href={`/crm/${entreprise}/clients/${r.clientId}`}
          principal={r.clientNom}
          secondaire={
            r.prochaineAction ??
            `${LIBELLE_TYPE_INTERACTION[r.interactionType]} · ${dateCourte(r.interactionLe)}`
          }
          valeur={
            r.retardJours > 0 ? (
              <span className="text-critical-texte inline-flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {retardEnMots(r.retardJours)}
              </span>
            ) : (
              'Aujourd’hui'
            )
          }
        />
      ))}
    </>
  )
}
