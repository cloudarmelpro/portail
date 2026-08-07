import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calculator, Info } from 'lucide-react'
import { classesBouton } from '@/components/shared/bouton'
import { FlecheGauche } from '@/components/shared/fleches'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'
import { BoutonSupprimerClient } from '@/components/crm/bouton-supprimer-client'
import { CarteRelance } from '@/components/crm/carte-relance'
import { Chronologie } from '@/components/crm/chronologie'
import { DialogueClient } from '@/components/crm/dialogue-client'
import { FormulaireInteraction } from '@/components/crm/formulaire-interaction'
import { SelecteurStatut } from '@/components/crm/selecteur-statut'
import { dateLongue, montant, valeurChampDate } from '@/components/crm/format'
import { LIBELLE_STATUT_ESTIMATION, LIBELLE_TYPE_CLIENT } from '@/config/crm'
import { clientParId } from '@/lib/data/crm'
import { aujourdHui } from '@/lib/domaine/dates'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { SECTION as SECTION_PARTAGEE, TITRE_SECTION } from '@/components/shared/gabarits'

/**
 * Fiche client — CRM-3, CRM-4, CRM-5, CRM-7.
 *
 * `clientParId` interroge le client cadré : un identifiant valide mais
 * appartenant à une autre entreprise ne renvoie rien, et la page se comporte
 * exactement comme si la fiche n'existait pas. C'est voulu — un message
 * distinct confirmerait son existence.
 */

/** Une seule mesure de colonne : c'est elle qui borne la lecture partout. */
const COLONNE = 'max-w-[680px]'

/** La fiche borne en plus sa colonne de lecture — les autres sections, non. */
const SECTION = cn(SECTION_PARTAGEE, COLONNE)

/** Une seule taille pour toutes les colonnes — comme le tableau des comptes. */
const CELLULE = 'text-[13px]'

export default async function PageFicheClient({
  params,
}: PageProps<'/crm/[entreprise]/clients/[client]'>) {
  const session = await requireModule('crm')
  const { entreprise, client: clientId } = await params
  const slug = await requireEntreprise(entreprise)

  const fiche = await clientParId(prismaCadre(slug), clientId)
  if (!fiche) notFound()

  const derniere = fiche.interactions[0] ?? null
  const jour = aujourdHui()

  return (
    <div className="mt-8 xl:mx-24">
      <Link
        href={`/crm/${slug}/clients`}
        className="text-ink2 hover:text-ink inline-flex items-center gap-1.5 text-[13px] leading-[18px]"
      >
        <FlecheGauche className="w-3.5" />
        Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-4">
        {/*
          Le fil d'Ariane de l'en-tête nomme la SECTION — « CRM / Clients ». Le
          nom du client ne se lit nulle part ailleurs : ce titre reste donc
          visible, là où les autres écrans passent le leur en `sr-only`.
        */}
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">{fiche.nom}</h1>
        <span className="text-ink2 text-[15px] leading-[22px]">
          {LIBELLE_TYPE_CLIENT[fiche.type]}
        </span>

        {/*
          Le statut ne s'affiche qu'ICI, par le sélecteur : une pilule le
          répétait à deux centimètres du contrôle qui le porte, et il fallait
          comparer les deux pour savoir lequel disait vrai.
        */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SelecteurStatut
            entreprise={slug}
            clientId={fiche.id}
            statut={fiche.statut}
            version={fiche.version}
          />
          <DialogueClient
            entreprise={slug}
            client={{
              id: fiche.id,
              version: fiche.version,
              type: fiche.type,
              nom: fiche.nom,
              personneRessource: fiche.personneRessource,
              courriel: fiche.courriel,
              telephone: fiche.telephone,
              adresse: fiche.adresse,
              provenance: fiche.provenance,
              notes: fiche.notes,
            }}
          />
          {aPermission(session.role, 'crm:supprimer') && (
            <BoutonSupprimerClient entreprise={slug} clientId={fiche.id} nom={fiche.nom} />
          )}
          {/* Seul bouton noir de l'écran. */}
          <Link
            href={`/calculateur/${slug}?client=${fiche.id}`}
            className={classesBouton({ variante: 'principale', taille: 'sm' })}
          >
            <Calculator className="size-3.5" aria-hidden />
            Nouvelle estimation
          </Link>
        </div>
      </div>

      {fiche.motifCloture && (
        <p
          className={cn(
            'border-border bg-hover text-ink2 mt-6 flex items-start gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-[18px]',
            COLONNE,
          )}
        >
          {/* Un dossier clos est un état, pas une alerte : l'icône est en encre,
              aucune couleur d'état n'a de raison d'apparaître ici. */}
          <Info className="text-ink3 mt-px size-4 shrink-0" aria-hidden />
          <span>
            Dossier clos le <span className="tabular-nums">{dateLongue(fiche.clotureLe)}</span> —{' '}
            {fiche.motifCloture}
          </span>
        </p>
      )}

      <section className={cn('mt-10', COLONNE)}>
        <h2 className={TITRE_SECTION}>Coordonnées</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Coordonnee libelle="Téléphone" valeur={fiche.telephone} />
          <Coordonnee libelle="Courriel" valeur={fiche.courriel} coupe />
          <Coordonnee libelle="Adresse" valeur={fiche.adresse} />
          <Coordonnee libelle="Personne-ressource" valeur={fiche.personneRessource} />
          <Coordonnee libelle="Provenance du contact" valeur={fiche.provenance} />
          {fiche.notes && (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-ink3 text-[13px] leading-[18px] font-medium">Notes</dt>
              <dd className="mt-0.5 text-[15px] leading-[22px] text-pretty">{fiche.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      {/*
        La carte de relance porte son propre filet : lui ajouter le séparateur
        des autres sections aurait dessiné deux traits pour une seule coupure.
      */}
      <div className={cn('mt-12', COLONNE)}>
        <CarteRelance
          entreprise={slug}
          clientId={fiche.id}
          interaction={
            derniere
              ? {
                  id: derniere.id,
                  version: derniere.version,
                  prochaineAction: derniere.prochaineAction ?? '',
                  prochaineActionLe: valeurChampDate(derniere.prochaineActionLe),
                }
              : null
          }
        />
      </div>

      <section className={SECTION}>
        <h2 className={TITRE_SECTION}>Ajouter une interaction</h2>
        <FormulaireInteraction
          entreprise={slug}
          clientId={fiche.id}
          aujourdhui={valeurChampDate(jour)}
        />
      </section>

      <section className={SECTION}>
        <h2 className={TITRE_SECTION}>Historique</h2>
        <Chronologie
          entrees={fiche.interactions.map((i) => ({
            id: i.id,
            type: i.type,
            date: i.date,
            resume: i.resume,
            prochaineAction: i.prochaineAction,
            prochaineActionLe: i.prochaineActionLe,
            auteurNom: i.auteurNom,
            // Le montant est converti ici : un `Decimal` Prisma ne franchit pas
            // la frontière du composant client.
            estimation: i.estimation
              ? { reference: i.estimation.reference, total: Number(i.estimation.total) }
              : null,
          }))}
        />
      </section>

      <section className={SECTION}>
        <h2 className={TITRE_SECTION}>Estimations</h2>
        {fiche.estimations.length === 0 ? (
          <p className="text-ink3 mt-3 text-[13px] leading-[18px]">
            Aucune estimation pour ce client.
          </p>
        ) : (
          <div className="mt-4">
            <CadreTableau>
              <Tableau>
                <EnTeteTableau>
                  <ColonneTableau libelle="Numéro" />
                  <ColonneTableau libelle="Montant" aDroite />
                  <ColonneTableau libelle="Valide jusqu’au" />
                  <ColonneTableau libelle="Statut" />
                </EnTeteTableau>
                <CorpsTableau>
                  {fiche.estimations.map((e) => (
                    <LigneTableau key={e.id}>
                      <CelluleTableau discret chiffres className={CELLULE}>
                        {e.reference}
                      </CelluleTableau>
                      <CelluleTableau discret aDroite chiffres className={CELLULE}>
                        {montant(Number(e.total))}
                      </CelluleTableau>
                      <CelluleTableau discret chiffres className={CELLULE}>
                        {dateLongue(e.valideJusquau)}
                      </CelluleTableau>
                      {/*
                        Le statut s'ÉCRIT. Une pilule de plus par rangée aurait
                        fait de cette liste de trois lignes une grille de
                        capsules, et le mot dit déjà tout ce qu'elle disait.
                      */}
                      <CelluleTableau discret className={CELLULE}>
                        {LIBELLE_STATUT_ESTIMATION[e.statut]}
                      </CelluleTableau>
                    </LigneTableau>
                  ))}
                </CorpsTableau>
              </Tableau>
            </CadreTableau>
          </div>
        )}
      </section>
    </div>
  )
}

function Coordonnee({
  libelle,
  valeur,
  coupe = false,
}: {
  libelle: string
  valeur: string | null
  /** Une adresse courriel sans espace déborde de sa colonne sans cette coupure. */
  coupe?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-ink3 text-[13px] leading-[18px] font-medium">{libelle}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[15px] leading-[22px]',
          coupe && 'break-all',
          !valeur && 'text-ink3',
        )}
      >
        {valeur ?? '—'}
      </dd>
    </div>
  )
}
