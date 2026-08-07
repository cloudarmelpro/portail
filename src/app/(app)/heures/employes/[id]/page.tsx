import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DetailSaisies } from '@/components/heures/detail-saisies'
import { BoutonModifierEmploye } from '@/components/heures/formulaire-employe'
import { GraphiqueSemaines } from '@/components/heures/graphique-semaines'
import { HistoriqueCorrections } from '@/components/heures/historique-corrections'
import { PastilleEntreprise } from '@/components/heures/pastille-entreprise'
import { BadgeStatutEmploye } from '@/components/shared/badge-statut'
import { FlecheGauche } from '@/components/shared/fleches'
import { type Tuile, TuilesEmploye } from '@/components/heures/tuiles-employe'
import {
  NOMS_JOURS,
  ajouterJours,
  aujourdHui,
  compilerPeriode,
  formaterHeuresAvecUnite,
  formaterMontant,
  grouperParSemaine,
  jour,
  libelleDate,
  libelleJourMois,
  libellePeriode,
  lundiDe,
  periodeDe,
  repartirSemaine,
  semainesDe,
  totalSemaine,
} from '@/lib/domaine/heures'
import { correctionsEmploye, employeParId, parametresPaie, saisiesEntre } from '@/lib/data/heures'
import { requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { SECTION, TITRE_SECTION } from '@/components/shared/gabarits'

const SEMAINES_GRAPHIQUE = 8

/** Séparateur entre deux temps de la fiche — même vocabulaire que la fiche client. */

/** Écart en pourcentage, ou `null` quand il n'y a rien à comparer. */
function variation(courant: number, precedent: number): number | null {
  if (precedent === 0) return null
  return Math.round(((courant - precedent) / precedent) * 100)
}

export default async function PageFicheEmploye(props: PageProps<'/heures/employes/[id]'>) {
  const session = await requireModule('heures')
  const { id } = await props.params

  const [employe, parametres] = await Promise.all([employeParId(id), parametresPaie()])
  if (!employe) notFound()

  const periode = periodeDe(aujourdHui(), parametres.joursPeriode)
  const precedente = periodeDe(ajouterJours(periode.debut, -1), parametres.joursPeriode)

  const derniereSemaine = lundiDe(aujourdHui())
  const semainesGraphique = Array.from({ length: SEMAINES_GRAPHIQUE }, (_, i) =>
    ajouterJours(derniereSemaine, (i - (SEMAINES_GRAPHIQUE - 1)) * 7),
  )

  // Une seule lecture couvrant les deux périodes et le graphique : la base est
  // distante, chaque aller-retour vers Neon coûte.
  const debuts = [precedente.debut, semainesGraphique[0]].map((d) => d.getTime())
  const fins = [periode.fin, ajouterJours(derniereSemaine, 6)].map((d) => d.getTime())
  const [saisies, corrections] = await Promise.all([
    saisiesEntre(
      { debut: new Date(Math.min(...debuts)), fin: new Date(Math.max(...fins)) },
      employe.id,
    ),
    correctionsEmploye(employe.id),
  ])

  const courante = compilerPeriode(
    grouperParSemaine(saisies, semainesDe(periode)),
    employe.tauxCents,
    parametres,
  )
  const anterieure = compilerPeriode(
    grouperParSemaine(saisies, semainesDe(precedente)),
    employe.tauxCents,
    parametres,
  )

  const tuiles: Tuile[] = [
    {
      libelle: 'Heures de la période',
      valeur: formaterHeuresAvecUnite(courante.total),
      variation: variation(courante.total, anterieure.total),
    },
    {
      libelle: 'Heures supplémentaires',
      valeur: formaterHeuresAvecUnite(courante.supplementaires),
      variation: variation(courante.supplementaires, anterieure.supplementaires),
    },
  ]

  // HEU-8 — sans taux renseigné, aucun montant n'est affiché.
  if (courante.montantCents !== null && anterieure.montantCents !== null) {
    tuiles.push({
      libelle: 'Montant de la période',
      valeur: formaterMontant(courante.montantCents),
      variation: variation(courante.montantCents, anterieure.montantCents),
    })
  }

  const barres = grouperParSemaine(saisies, semainesGraphique).map((semaine, i) => {
    const r = repartirSemaine(totalSemaine(semaine), parametres)
    return {
      libelle: libelleJourMois(semainesGraphique[i]),
      normales: r.normales,
      supplementaires: r.supplementaires,
    }
  })

  const detail = saisies
    .filter((s) => {
      const d = jour(s.date)
      return d >= periode.debut && d <= periode.fin
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => ({
      date: libelleDate(jour(s.date)),
      jour: NOMS_JOURS[(jour(s.date).getUTCDay() + 6) % 7],
      centiemes: s.centiemes,
      note: s.note,
    }))

  return (
    <div className="mt-8 xl:mx-24">
      <Link
        href="/heures/employes"
        className="text-ink2 hover:text-ink inline-flex items-center gap-1.5 text-[13px] leading-[18px]"
      >
        <FlecheGauche className="w-3.5" />
        Employés
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-4">
        {/*
          Le fil d'Ariane de l'en-tête nomme la SECTION — « Suivi des heures /
          Employés ». Le nom de l'employé ne se lit nulle part ailleurs : ce
          titre reste donc visible, là où les autres écrans passent le leur en
          `sr-only`.
        */}
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em]">{employe.nom}</h1>
        <PastilleEntreprise slug={employe.entrepriseSlug} className="text-ink2 text-[15px]" />
        <BadgeStatutEmploye actif={employe.actif} />

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-ink3 text-[13px] leading-[18px]">
            Taux horaire&nbsp;:{' '}
            <span className="text-ink font-medium tabular-nums">
              {/* HEU-8 — sans taux renseigné, aucun montant n'est affiché. */}
              {employe.tauxCents === null ? '—' : `${formaterMontant(employe.tauxCents)} / h`}
            </span>
          </span>
          {aPermission(session.role, 'heures:employes') && (
            <BoutonModifierEmploye
              employe={{
                id: employe.id,
                nom: employe.nom,
                entrepriseSlug: employe.entrepriseSlug,
                tauxCents: employe.tauxCents,
                actif: employe.actif,
                notes: employe.notes,
                version: employe.version,
              }}
            />
          )}
        </div>
      </div>

      <p className="text-ink3 mt-4 text-[13px] leading-[18px] tabular-nums">
        {libellePeriode(periode)}
      </p>

      <div className="mt-6">
        <TuilesEmploye tuiles={tuiles} />
      </div>

      <section className={SECTION}>
        <h2 className={TITRE_SECTION}>Heures par semaine — 8 dernières semaines</h2>
        <GraphiqueSemaines semaines={barres} />
      </section>

      {/*
        Les deux listes secondaires côte à côte au-delà de 1280 px : elles se
        lisent ensemble — une heure corrigée et la journée qu'elle corrige — et
        empilées, la seconde tombait sous la ligne de flottaison.
      */}
      <div className={`${SECTION} grid items-start gap-8 xl:grid-cols-2`}>
        <section>
          <h2 className={TITRE_SECTION}>Détail des saisies</h2>
          <DetailSaisies saisies={detail} />
        </section>

        <section>
          <h2 className={TITRE_SECTION}>Historique des corrections</h2>
          <HistoriqueCorrections
            corrections={corrections.map((c) => ({
              id: c.id,
              date: libelleDate(jour(c.date)),
              ancienneCentiemes: c.ancienneCentiemes,
              nouvelleCentiemes: c.nouvelleCentiemes,
              motif: c.motif,
              parNom: c.parNom,
            }))}
          />
        </section>
      </div>

      {employe.notes && (
        <section className={SECTION}>
          <h2 className={TITRE_SECTION}>Notes</h2>
          <p className="text-ink2 mt-3 max-w-[680px] text-[15px] leading-[22px] whitespace-pre-line">
            {employe.notes}
          </p>
        </section>
      )}
    </div>
  )
}
