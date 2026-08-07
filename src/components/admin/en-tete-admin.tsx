import { OngletsAdmin, type Onglet } from '@/components/admin/onglets-admin'
import { BANDE_PLEINE } from '@/components/shared/bande-pleine'
import { SECTIONS_ADMIN } from '@/config/fil-ariane'
import { requireSession } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/**
 * Sections de l'administration, communes aux cinq écrans.
 *
 * Elles sont dérivées de la matrice de permissions : on ne montre jamais une
 * entrée grisée — une section inaccessible n'existe pas pour cet utilisateur, et
 * l'afficher barrée révélerait ce qui se trouve derrière.
 */
export async function EnTeteAdmin({
  titre,
  actions,
}: {
  titre: string
  actions?: React.ReactNode
}) {
  const session = await requireSession()

  const onglets: Onglet[] = SECTIONS_ADMIN.filter((s) =>
    aPermission(session.role, s.permission),
  ).map((s) => ({ libelle: s.libelle, href: s.href }))

  return (
    <>
      {/*
        DEUX bandes, et non deux rangées dans une seule.

        Le filet qui les sépare doit traverser le panneau d'un bord à l'autre,
        comme celui du bas. À l'intérieur d'une bande unique, il se serait
        arrêté au rembourrage — un trait plus court que celui d'en dessous,
        rentré de 32 px de chaque côté, ce qui se voit d'autant plus qu'ils sont
        à cinquante pixels l'un de l'autre.
      */}
      <div className={cn(BANDE_PLEINE, 'border-border -mt-2 border-b py-3')}>
        {/*
          Le fil d'Ariane a disparu des grands écrans le jour où l'en-tête de
          l'application est devenu propre au téléphone : plus rien ne nommait la
          SECTION, seulement l'onglet actif. Il revient ici, dans la bande, où
          il a l'avantage de suivre le module plutôt que la coquille.

          Le titre reprend donc sa forme VISIBLE. C'était la condition posée
          quand il est passé en `sr-only` — une page sans `h1` ne se parcourt
          pas par les titres — et le fil d'Ariane la remplit sans rien redire
          deux fois : le parent situe, le titre nomme, l'onglet actif marque.
        */}
        <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-baseline gap-2">
          <span className="text-ink3 text-[13px] leading-[18px] whitespace-nowrap">
            Administration
          </span>
          {/*
            La barre oblique est décorative : elle sépare à l'œil, et un lecteur
            d'écran qui l'annoncerait dirait « Administration barre oblique
            Utilisateurs ».
          */}
          <span aria-hidden className="text-ink3 text-[13px]">
            /
          </span>
          <h1 className="truncate text-[15px] leading-[22px] font-semibold">{titre}</h1>
        </nav>
      </div>

      <div
        className={cn(
          BANDE_PLEINE,
          'border-border flex flex-wrap items-center gap-3 border-b py-3',
        )}
      >
        <OngletsAdmin onglets={onglets} />
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
    </>
  )
}
