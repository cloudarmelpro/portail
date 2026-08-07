import Link from 'next/link'
import { FlecheDroite } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import { formaterHeuresAvecUnite, formaterMontant } from '@/lib/domaine/heures'
import { PastilleEntreprise } from '@/components/heures/pastille-entreprise'
import { BadgeStatutEmploye } from '@/components/shared/badge-statut'
import { cn } from '@/lib/utils'

export type LigneEmploye = {
  id: string
  nom: string
  entrepriseSlug: string
  tauxCents: number | null
  totalCentiemes: number
  actif: boolean
}

export type Tri = 'nom' | 'entreprise' | 'taux' | 'total' | 'statut'
export type Ordre = 'asc' | 'desc'

/**
 * Les colonnes, déclarées UNE fois — l'en-tête et les rangées la partagent.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Une grille, et non une boîte flexible.
 *
 * En flexible, chaque rangée répartit la place selon SON contenu : « Paysagement »
 * et « Staff augmentation » ne commencent pas au même endroit, et un en-tête
 * n'aurait rien à quoi s'aligner. La grille pose les mêmes pistes pour toutes
 * les rangées, en-tête compris.
 *
 * `minmax(0,1fr)` sur le nom : sans le zéro, la piste refuse de passer sous la
 * largeur de son contenu, et un nom long pousse les trois colonnes suivantes
 * hors du cadre au lieu d'être tronqué.
 *
 * Au téléphone, deux pistes seulement — le nom et le total. Le taux et le
 * dossier se lisent sur la fiche ; les serrer à cinq sur 320 px ne les rendrait
 * lisibles nulle part.
 * ─────────────────────────────────────────────────────────────────────────
 */
const COLONNES =
  'grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_5.5rem_0.875rem]'

/** Micro-majuscules de l'en-tête — le palier le plus discret de la section 19. */
const ENTETE = 'text-ink3 text-[11px] leading-[13px] font-medium tracking-[0.02em] uppercase'

/**
 * Liste des employés — rangées en creux, avec en-tête de colonnes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C'était un tableau à cinq colonnes triables.
 *
 * Ce qui disparaît avec lui : le TRI. Il passait par l'URL, et les en-têtes
 * n'étaient que la façon de l'écrire — une adresse mise en signet rend toujours
 * la liste dans l'ordre demandé. Sur une équipe de quelques personnes, l'ordre
 * alphabétique répond à la seule question qu'on pose ici : « où est la fiche
 * d'Untel ? ».
 *
 * Ce qui reste : les colonnes, parce qu'un total d'heures et un taux horaire ne
 * se lisent pas sans savoir ce qu'ils sont. Elles ne se cliquent plus.
 *
 * Le statut n'en est plus une : une colonne entière de « Actif » ne portait
 * rien. La pastille reste, à côté du nom, mais seulement sur les fiches
 * désactivées — là où l'exception se voit.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function TableauEmployes({ employes }: { employes: LigneEmploye[] }) {
  return (
    <div className="flex flex-col gap-2">
      {/*
        L'en-tête est HORS des rangées blanches, posé sur le creux : c'est une
        légende, pas un élément de la liste. Le mettre dans une rangée blanche en
        aurait fait la première de la liste.
      */}
      <div className={cn(COLONNES, 'px-3')}>
        <span className={ENTETE}>Employé</span>
        <span className={cn(ENTETE, 'hidden sm:block')}>Entreprise</span>
        <span className={cn(ENTETE, 'hidden text-right sm:block')}>Taux</span>
        <span className={cn(ENTETE, 'text-right')}>Total</span>
        {/* La colonne de la flèche : sans elle, l'en-tête déborde de 14 px. */}
        <span aria-hidden className="hidden sm:block" />
      </div>

      <ul className="flex flex-col gap-2">
        {employes.map((e) => (
          <li key={e.id}>
            <Link
              href={`/heures/employes/${e.id}`}
              className={cn(COLONNES, 'group bg-raised min-h-12 rounded-[10px] px-3 py-2')}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Tronque titre={e.nom} className="max-w-72 text-[13px] leading-4.5">
                  {e.nom}
                </Tronque>
                {/* L'état ne s'écrit que par exception — voir l'en-tête du fichier. */}
                {!e.actif && <BadgeStatutEmploye actif={e.actif} />}
              </span>

              <span className="hidden min-w-0 sm:block">
                <PastilleEntreprise slug={e.entrepriseSlug} />
              </span>

              <span className="text-ink2 hidden text-right text-[13px] leading-4.5 tabular-nums sm:block">
                {/* Sans taux renseigné, aucun montant — exigence HEU-8. Un
                    « 0,00 $ » se lirait comme un taux nul. */}
                {e.tauxCents === null ? (
                  <span className="text-ink3">—</span>
                ) : (
                  formaterMontant(e.tauxCents)
                )}
              </span>

              <span className="text-ink2 text-right text-[13px] leading-4.5 tabular-nums">
                {formaterHeuresAvecUnite(e.totalCentiemes)}
              </span>

              <FlecheDroite
                className="text-ink3 group-hover:text-ink hidden w-3.5 shrink-0 sm:block"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
