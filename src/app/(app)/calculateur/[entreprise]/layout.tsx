import { OngletsCalculateur } from '@/components/calculateur/entete-module'
import { BANDE_PLEINE } from '@/components/shared/bande-pleine'
import { ENTREPRISES } from '@/config/entreprises'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { cn } from '@/lib/utils'

/**
 * Dossier d'entreprise — bande de chrome commune aux écrans du calculateur.
 *
 * Le slug vient de l'URL, donc de l'utilisateur : il n'a aucune valeur de preuve
 * tant que `requireEntreprise` ne l'a pas reconnu. Cette validation est refaite
 * dans chaque page — un layout ne protège pas ce qui est rendu en dessous s'il
 * est contourné, et il ne protège aucun Server Action.
 *
 * Le titre de l'écran n'est PAS ici : il change d'une vue à l'autre, et chaque
 * page porte le sien.
 */
export default async function LayoutDossierCalculateur({
  children,
  params,
}: LayoutProps<'/calculateur/[entreprise]'>) {
  await requireModule('calculateur')
  const { entreprise } = await params
  const slug = await requireEntreprise(entreprise)

  return (
    <>
      {/*
        `-mt-5 md:-mt-6` annule le rembourrage haut de `main` : la bande doit
        toucher le filet de l'en-tête, sinon elle flotte au lieu de séparer.
      */}
      <div className={cn(BANDE_PLEINE, 'border-border -mt-2 border-b py-4')}>
        <OngletsCalculateur
          entreprises={ENTREPRISES.map((e) => ({ slug: e.slug, nom: e.nom, jeton: e.jeton }))}
          actif={slug}
        />
      </div>
      {children}
    </>
  )
}
