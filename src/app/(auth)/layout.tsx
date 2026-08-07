import { BasculeTheme } from '@/components/auth/bascule-theme'
import { FondAuth } from '@/components/auth/fond-auth'
import { siteConfig } from '@/config/site'

/**
 * Zone publique — aucune session requise : connexion, mot de passe oublié,
 * réinitialisation.
 *
 * Le seul écran aéré du produit : décor, marque et pied de page vivent ici,
 * chaque page n'apporte que son en-tête et son formulaire dans la colonne de
 * 400 px.
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="bg-page relative flex min-h-full flex-1 flex-col overflow-hidden">
      <FondAuth />

      <div className="relative flex flex-1 items-center justify-center px-6 pt-14 pb-6">
        <div className="w-[400px] max-w-full">
          <div className="flex items-center justify-center gap-2.5">
            {/*
              Trois filets de 3 px, jamais des aplats : la règle des couleurs
              d'entreprise vaut aussi pour la marque. Le nom qui les accompagne
              est celui du produit, et le titre juste dessous dit « Trois
              entreprises ».
            */}
            <span className="flex items-end gap-1" aria-hidden>
              <span className="bg-pays h-[16px] w-[3px] rounded-full" />
              <span className="bg-dev h-[20px] w-[3px] rounded-full" />
              <span className="bg-staff h-[16px] w-[3px] rounded-full" />
            </span>
            <span className="text-[22px] leading-[28px] font-semibold tracking-[-0.02em]">
              {siteConfig.nom}
            </span>
          </div>

          {children}
        </div>
      </div>

      <div className="text-ink3 relative px-6 pb-5 text-center text-[11px] leading-[16px] tracking-[0.02em]">
        Renseignements personnels protégés. Chaque accès est journalisé.
      </div>

      <BasculeTheme />
    </div>
  )
}
