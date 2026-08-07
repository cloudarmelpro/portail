import { AlertCircle } from 'lucide-react'
import type { SoumissionEnAttente } from '@/lib/data/crm'
import { RangeeCreux } from '@/components/shared/liste-creux'
import { dateCourte, montant } from '@/components/crm/format'

/**
 * CRM-6 — soumissions en attente, celles qui expirent bientôt en tête.
 *
 * Le tri par date de validité croissante fait remonter les plus urgentes de
 * lui-même ; l'icône et le mot disent lesquelles, la couleur ne fait que suivre.
 * Aucune pastille : « Expiré » s'écrit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le numéro passe au second rang, derrière le nom.
 *
 * Il ouvrait le tableau, parce qu'une colonne « Numéro » se met à gauche. Mais
 * personne ne cherche une soumission par sa référence : on cherche celle d'un
 * client. La référence sert à la NOMMER — dans un courriel, au téléphone — donc
 * elle reste, à côté du nom, et prend sa place quand le client manque.
 *
 * Ce qui disparaît de l'écran : le montant et la date de validité ne peuvent pas
 * tenir tous deux au bout d'une rangée. C'est l'échéance qui reste, parce que
 * c'est elle qui décide s'il faut agir aujourd'hui ; le montant se lit sur la
 * fiche, à un clic.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function ListeSoumissions({
  soumissions,
  entreprise,
}: {
  soumissions: SoumissionEnAttente[]
  entreprise: string
}) {
  return (
    <>
      {soumissions.map((s) => (
        <RangeeCreux
          key={s.id}
          /*
            Une estimation sans client rattaché n'a pas de fiche où aller : la
            rangée mène alors au dossier, ce qui reste vrai.
          */
          href={s.clientId ? `/crm/${entreprise}/clients/${s.clientId}` : `/crm/${entreprise}`}
          principal={s.clientNom ?? s.reference}
          titre={s.clientNom ?? s.reference}
          secondaire={`${s.reference} · ${montant(s.total)}`}
          valeur={
            /*
              `--serious` mesure 2,55:1 : sur « Expire bientôt », la couleur ne
              va qu'à l'icône. `--critical` passe le seuil et peut porter le mot,
              comme le « Suspendu » de l'administration.
            */
            s.expiree ? (
              <span className="text-critical-texte inline-flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                Expiré · {dateCourte(s.valideJusquau)}
              </span>
            ) : s.expireBientot ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="text-serious-texte size-3.5 shrink-0" aria-hidden />
                Expire bientôt · {dateCourte(s.valideJusquau)}
              </span>
            ) : (
              dateCourte(s.valideJusquau)
            )
          }
        />
      ))}
    </>
  )
}
