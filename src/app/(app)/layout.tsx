import { Shell } from '@/components/layout/shell'
import { navigationDe } from '@/config/navigation'
import { requireSession } from '@/lib/guards'

/**
 * Zone protégée — session obligatoire.
 *
 * Cette garde empêche l'AFFICHAGE d'une page sans session. Elle ne protège
 * aucune mutation : un Server Action ne traverse pas les layouts. C'est
 * `lib/safe-action.ts` qui s'en charge, action par action.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession()

  return (
    <Shell
      entrees={navigationDe(session.role)}
      utilisateur={{ nom: session.nom, courriel: session.courriel, role: session.role }}
    >
      {children}
    </Shell>
  )
}
