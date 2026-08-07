import { notFound } from 'next/navigation'
import { TableauCorbeilleCrm, type LigneSupprimee } from '@/components/crm/tableau-corbeille'
import { EtatVide } from '@/components/shared/etat-vide'
import { FUSEAU, LOCALE } from '@/config/dates'
import { listerClientsSupprimes } from '@/lib/data/crm'
import { OngletsVue } from '@/components/crm/onglets-crm'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'

const dateFr = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: FUSEAU })

/**
 * Fiches supprimées — CRM-7, « les enregistrements restent restaurables ».
 *
 * La donnée était restaurable depuis le premier jour ; il n'existait aucun écran
 * pour le faire. Une politique de restauration sans écran pour l'appliquer n'est
 * pas une garantie, c'est une phrase — le même raisonnement que pour la
 * conservation des CV (CV-10).
 */
export default async function PageCorbeilleCrm({
  params,
}: PageProps<'/crm/[entreprise]/corbeille'>) {
  const session = await requireModule('crm')
  const { entreprise } = await params
  const slug = await requireEntreprise(entreprise)
  const peutSupprimer = aPermission(session.role, 'crm:supprimer')

  // Masquer l'onglet ne suffirait pas : l'écran resterait atteignable en tapant
  // l'adresse.
  if (!aPermission(session.role, 'crm:supprimer')) notFound()

  const supprimes = await listerClientsSupprimes(prismaCadre(slug))

  const lignes: LigneSupprimee[] = supprimes.map((c) => ({
    id: c.id,
    nom: c.nom,
    type: c.type,
    statut: c.statut,
    supprimeeLe: c.deletedAt ? dateFr.format(c.deletedAt) : '—',
    interactions: c._count.interactions,
    estimations: c._count.estimations,
  }))

  return (
    <div>
      {/* Le fil d'Ariane de l'en-tête nomme l'écran ; le titre reste au document
          pour qui le parcourt par ses titres. */}
      <h1 className="sr-only">Fiches supprimées</h1>

      <div className="mt-10 xl:mx-24">
        {/*
          Le choix de vue vit dans la colonne de CONTENU, pas au bord du panneau : il
          commande ce qui suit, donc il partage sa largeur. Poussé à droite, parce
          que la lecture part du contenu à gauche et qu'un commutateur est un geste,
          pas une donnée à lire.
        */}
        <div className="mb-6 flex justify-end">
          <OngletsVue slug={slug} vue="corbeille" peutSupprimer={peutSupprimer} />
        </div>

        <p className="text-ink2 max-w-180 text-[13px] leading-4.5">
          Une fiche supprimée n’apparaît plus dans la liste, mais son historique et ses estimations
          sont conservés. Restaurer la remet exactement où elle était.
        </p>

        <div className="mt-3">
          {lignes.length === 0 ? (
            <EtatVide
              titre="Aucune fiche supprimée"
              message="Les fiches supprimées apparaîtront ici, prêtes à être restaurées."
            />
          ) : (
            <TableauCorbeilleCrm entreprise={slug} lignes={lignes} />
          )}
        </div>
      </div>
    </div>
  )
}
