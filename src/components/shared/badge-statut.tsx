import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, Mail, Phone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StatutClient, StatutEstimation } from '@/generated/prisma/client'
import { LIBELLE_STATUT_CLIENT, LIBELLE_STATUT_ESTIMATION } from '@/config/crm'

/**
 * Badge de statut — pilule unique des cinq usages du produit : statut client,
 * statut d'estimation, employé, compte, produit de grille.
 *
 * INVARIANT DE CONTRASTE — la teinte pure ne touche QUE l'icône.
 *
 * `--serious` mesure 2,55:1 et `--warning` 1,77:1 sur fond clair. Peindre le mot
 * de la couleur d'état rendrait illisible l'information même que la règle
 * « icône ET mot » sert à garantir. Le mot reçoit donc le mélange à 55 % vers
 * `--ink`, mesuré à 4,6:1 (avertissement) et 6,7:1 (succès) sur le fond à 13 %,
 * en clair comme en sombre. Changer l'un des deux pourcentages casse ces mesures.
 */
type Ton = 'neutre' | 'bon' | 'avertissement' | 'serieux' | 'critique'

const JETON: Readonly<Record<Exclude<Ton, 'neutre'>, string>> = {
  bon: '--good',
  avertissement: '--warning',
  serieux: '--serious',
  critique: '--critical',
}

export function BadgeStatut({
  libelle,
  ton,
  icone: Icone,
}: {
  libelle: string
  ton: Ton
  icone: LucideIcon
}) {
  const jeton = ton === 'neutre' ? null : JETON[ton]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-[11px] leading-[14px] font-medium tracking-[0.02em] whitespace-nowrap"
      style={
        jeton
          ? {
              backgroundColor: `color-mix(in srgb, var(${jeton}) 13%, transparent)`,
              color: `color-mix(in srgb, var(${jeton}) 55%, var(--ink))`,
            }
          : { backgroundColor: 'var(--hover2)', color: 'var(--ink2)' }
      }
    >
      <Icone
        className="size-3.5 shrink-0"
        style={jeton ? { color: `var(${jeton})` } : undefined}
        aria-hidden
      />
      {libelle}
    </span>
  )
}

type Apparence = { ton: Ton; icone: LucideIcon }

const CLIENT: Readonly<Record<StatutClient, Apparence>> = {
  prospect: { ton: 'neutre', icone: Info },
  contacte: { ton: 'neutre', icone: Phone },
  soumission_envoyee: { ton: 'avertissement', icone: Mail },
  gagne: { ton: 'bon', icone: CheckCircle2 },
  perdu: { ton: 'critique', icone: AlertCircle },
}

/**
 * « Soumission envoyée » côté client et « Envoyé » côté estimation désignent le
 * même événement : même ton, même icône. Les faire diverger était le défaut le
 * plus visible de l'audit.
 */
const ESTIMATION: Readonly<Record<StatutEstimation, Apparence>> = {
  brouillon: { ton: 'neutre', icone: FileText },
  envoye: { ton: 'avertissement', icone: Mail },
  accepte: { ton: 'bon', icone: CheckCircle2 },
  refuse: { ton: 'critique', icone: AlertCircle },
  expire: { ton: 'serieux', icone: AlertTriangle },
}

const ACTIF: Apparence = { ton: 'bon', icone: CheckCircle2 }
const INACTIF: Apparence = { ton: 'neutre', icone: Info }

export function BadgeStatutClient({ statut }: { statut: StatutClient }) {
  return <BadgeStatut libelle={LIBELLE_STATUT_CLIENT[statut]} {...CLIENT[statut]} />
}

export function BadgeStatutEstimation({ statut }: { statut: StatutEstimation }) {
  return <BadgeStatut libelle={LIBELLE_STATUT_ESTIMATION[statut]} {...ESTIMATION[statut]} />
}

export function BadgeStatutEmploye({ actif }: { actif: boolean }) {
  return <BadgeStatut libelle={actif ? 'Actif' : 'Inactif'} {...(actif ? ACTIF : INACTIF)} />
}
