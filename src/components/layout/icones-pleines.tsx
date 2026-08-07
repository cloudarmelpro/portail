import type { Module } from '@/lib/permissions'

/**
 * Variantes PLEINES des icônes de module — état actif de la barre latérale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi du SVG écrit à la main, alors que le projet impose lucide-react.
 *
 * Lucide est une famille au trait : elle n'a pas de variante pleine, et il n'y
 * a aucun moyen d'en obtenir une. Poser `fill="currentColor"` sur une icône au
 * trait ne la remplit pas, elle l'empâte — la calculette perd ses touches, la
 * roue crantée perd son moyeu, l'horloge perd ses aiguilles. Le résultat serait
 * moins lisible que l'icône au trait qu'il remplace.
 *
 * Ces cinq tracés viennent donc du système de design, où ils sont dessinés pour
 * cet usage précis. C'est une seconde source d'icônes, et une seconde source
 * dérive : `tests/barre-laterale.spec.ts` interdit qu'un module figure dans
 * l'une des deux tables sans figurer dans l'autre.
 *
 * N'ajoute RIEN d'autre ici. Toute icône qui n'est pas l'état actif d'une
 * entrée de menu vient de lucide-react.
 * ─────────────────────────────────────────────────────────────────────────
 */

type Props = { className?: string }

function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      {children}
    </svg>
  )
}

function CrmPleine(p: Props) {
  return (
    <Svg {...p}>
      <g fill="currentColor">
        <circle cx="9" cy="7" r="4" />
        <path d="M9 13c-3.9 0-7 2.2-7 5v3h14v-3c0-2.8-3.1-5-7-5Z" />
        <circle cx="17.5" cy="8" r="3" />
        <path d="M17.5 13c-1 0-1.9.15-2.7.42 1.35 1.2 2.2 2.8 2.2 4.58v3H23v-2.6c0-2.98-3.2-5.4-5.5-5.4Z" />
      </g>
    </Svg>
  )
}

function CvPleine(p: Props) {
  return (
    <Svg {...p}>
      <g fill="currentColor">
        <path d="M2 5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v1H9.24a3 3 0 0 0-2.68 1.66L4.6 14.5 2 19.2V5Z" />
        <path d="M9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6A2 2 0 0 1 18.45 20H4a2 2 0 0 1-1.79-2.9l3.24-6.44A1.5 1.5 0 0 1 6.79 10h2.45Z" />
      </g>
    </Svg>
  )
}

function HeuresPleine(p: Props) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.9 5v4.6l3.5 2.1a1 1 0 1 1-1 1.72l-4-2.4a1 1 0 0 1-.5-.86V7a1 1 0 0 1 2 0Z"
      />
    </Svg>
  )
}

function CalculateurPleine(p: Props) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6Zm1.25 3.25h9.5v2.5h-9.5v-2.5ZM8 11.25a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm4 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm4 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1ZM8 15.9a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm4 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm4-.65a1 1 0 0 0-1 1v1.75a1 1 0 1 0 2 0V16.25a1 1 0 0 0-1-1Z"
      />
    </Svg>
  )
}

function AdminPleine(p: Props) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Zm-.22 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </Svg>
  )
}

export const ICONE_MODULE_PLEINE: Readonly<Record<Module, (p: Props) => React.ReactElement>> = {
  crm: CrmPleine,
  cv: CvPleine,
  heures: HeuresPleine,
  calculateur: CalculateurPleine,
  admin: AdminPleine,
}
