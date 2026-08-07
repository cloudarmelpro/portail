import { AlertTriangle } from 'lucide-react'
import { EnTeteAdmin } from '@/components/admin/en-tete-admin'
import { BandeChiffres, type Chiffre } from '@/components/shared/bande-chiffres'
import { FiltresJournal } from '@/components/admin/filtres-journal'
import { classesBouton } from '@/components/shared/bouton'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
  TableauVide,
} from '@/components/shared/tableau'
import { EtatVide } from '@/components/shared/etat-vide'
import { Tronque } from '@/components/shared/tronque'
import { auteursDuJournal, listerJournal, type FiltresJournal as Criteres } from '@/lib/data/admin'
import { requirePermissionEcran } from '@/lib/guards'
import { filtresJournalSchema } from '@/lib/validations/admin'
import { estEntreprise, entreprise as entrepriseDe } from '@/config/entreprises'
import { FUSEAU } from '@/config/dates'
import { Pagination } from '@/components/shared/pagination'

/** Pas de défilement infini : de la pagination. */
const PAR_PAGE = 50

/** Une seule taille et une seule encre pour toutes les colonnes — section 19. */
const CELLULE = 'text-[13px]'

const HORODATAGE = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: FUSEAU,
})

const JOUR = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: FUSEAU })

const NOMBRE = new Intl.NumberFormat('fr-CA')

/** Journal d'audit — ADM-4. Transverse : il n'est pas cloisonné par entreprise. */
/**
 * Aucun délai de cache client sur le journal.
 *
 * Le raisonnement général — « toute action revalide, donc le cache se vide » —
 * ne vaut pas ici : le journal est nourri MAJORITAIREMENT hors des Server
 * Actions. Connexion et échec de connexion, refus d'accès, téléchargement d'un
 * CV, exports, purge d'entretien : aucun de ces chemins ne revalide quoi que ce
 * soit. Un administrateur qui consulte, navigue et revient verrait une page qui
 * omet les tentatives refusées entre-temps — sur l'écran fait pour les voir.
 */
export const unstable_dynamicStaleTime = 0

export default async function PageJournal({ searchParams }: PageProps<'/admin/journal'>) {
  await requirePermissionEcran('admin:journal')

  const filtres = filtresJournalSchema.parse(await searchParams)
  const page = filtres.page ?? 1

  const criteres: Criteres = {
    utilisateur: filtres.utilisateur,
    module: filtres.module,
    entreprise: filtres.entreprise,
    action: filtres.action,
    entite: filtres.entite,
    ip: filtres.ip,
    du: filtres.du,
    au: filtres.au,
    sensible: filtres.sensible,
  }

  const [{ entrees, total }, journal, surveillees, auteurs] = await Promise.all([
    listerJournal(criteres, { page, parPage: PAR_PAGE }),
    listerJournal({}, { page: 1, parPage: 1 }),
    listerJournal({ sensible: true }, { page: 1, parPage: 1 }),
    auteursDuJournal(),
  ])

  /*
    La plus ancienne entrée s'obtient par la DERNIÈRE page d'un tri décroissant :
    `lib/data` n'expose aucun minimum, et un écran ne parle pas à Prisma. Il faut
    donc le total avant de pouvoir la demander.
  */
  const origine =
    journal.total > 0
      ? (await listerJournal({}, { page: journal.total, parPage: 1 })).entrees[0]
      : undefined

  /*
    Les chiffres portent sur TOUT le journal, jamais sur le filtre courant.

    Le compte filtré existe déjà, à côté de l'export, collé à la liste qu'il
    compte et au fichier qu'on s'apprête à télécharger. Le répéter ici en gros
    l'aurait dit deux fois ; le faire varier aurait surtout privé l'écran de son
    seul repère stable — « 34 actions surveillées » ne veut plus rien dire si le
    nombre change chaque fois qu'on ouvre un filtre. La bande répond « où en
    est-on ? », la liste répond « quoi ? ».
  */
  const chiffres: Chiffre[] = [
    { libelle: 'Entrées', valeur: NOMBRE.format(journal.total) },
    { libelle: 'Actions sensibles', valeur: NOMBRE.format(surveillees.total) },
    { libelle: 'Utilisateurs', valeur: NOMBRE.format(auteurs.length) },
    { libelle: 'Depuis le', valeur: origine ? JOUR.format(origine.horodatage) : '—' },
  ]

  const pages = Math.max(1, Math.ceil(total / PAR_PAGE))

  /*
    L'adresse d'export est construite sur les filtres VALIDÉS, pas sur l'URL
    reçue : le fichier remis doit correspondre à la liste affichée, sans traîner
    un paramètre que l'écran a écarté.
  */
  const requete = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(criteres)) {
    if (typeof valeur === 'string' && valeur) requete.set(cle, valeur)
  }
  if (criteres.sensible) requete.set('sensible', '1')
  const base = requete.toString()

  const compteur =
    total === 0 ? 'Aucune entrée' : total === 1 ? '1 entrée' : `${NOMBRE.format(total)} entrées`

  return (
    <div>
      <EnTeteAdmin titre="Journal d’audit" />
      <BandeChiffres chiffres={chiffres} />

      {/*
        Le journal ne se resserre PAS comme les autres écrans d'administration.
        Huit filtres et six colonnes d'horodatages, d'adresses et de libellés :
        à 96 px de retrait de chaque côté, la rangée se repliait sur deux lignes
        et le tableau tronquait ses élements. Il occupe donc la largeur des
        bandes, sur le même axe qu'elles.
      */}
      <div className="mt-10">
        {/*
          `items-start` : la rangée de filtres se replie sur deux lignes dès
          qu'elle manque de place, et l'export centré sur ce bloc se serait posé
          à une hauteur qui ne correspond à rien.
        */}
        <div className="flex flex-wrap items-start gap-3">
          <FiltresJournal auteurs={auteurs} />

          {/*
            Le compte accompagne l'export plutôt que les filtres : c'est le
            nombre de lignes du fichier qu'on est sur le point de télécharger.
          */}
          <span className="text-ink3 ml-auto flex h-9 items-center text-[13px] tabular-nums">
            {compteur}
          </span>
          <a
            href={`/admin/journal/export${base ? `?${base}` : ''}`}
            className={classesBouton({ variante: 'secondaire' })}
          >
            Exporter en CSV
          </a>
        </div>

        <div className="mt-4">
          {entrees.length > 0 ? (
            <CadreTableau>
              {/*
                Six colonnes, sans le module : son libellé d'action le nomme déjà
                — « Dépôt d'un CV » n'a jamais eu lieu ailleurs. Il reste dans
                l'export CSV, où la largeur ne coûte rien. Section 19.
              */}
              <Tableau className="min-w-250">
                <EnTeteTableau>
                  <ColonneTableau libelle="Horodatage" />
                  <ColonneTableau libelle="Utilisateur" />
                  <ColonneTableau libelle="Action" />
                  <ColonneTableau libelle="Élément" />
                  <ColonneTableau libelle="Entreprise" />
                  <ColonneTableau libelle="Adresse IP" aDroite />
                </EnTeteTableau>
                <CorpsTableau>
                  {entrees.map((e) => (
                    <LigneTableau key={e.id}>
                      <CelluleTableau discret chiffres className={CELLULE}>
                        {HORODATAGE.format(e.horodatage)}
                      </CelluleTableau>
                      {/*
                        Le plafond est porté par le bloc et non par la cellule :
                        les six colonnes partagent une seule chaîne de classes,
                        et `CELLULE` doit rester seul à l'écrire.
                      */}
                      <CelluleTableau discret className={CELLULE}>
                        <Tronque className="max-w-72">{e.utilisateur}</Tronque>
                      </CelluleTableau>
                      <CelluleTableau discret={!e.sensible} className={CELLULE}>
                        {e.sensible ? (
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <AlertTriangle
                              className="text-serious-texte size-3.5 shrink-0"
                              aria-hidden
                            />
                            {/* L'icône ne s'entend pas : le mot est dit à qui écoute. */}
                            <span className="sr-only">Action sensible&nbsp;: </span>
                            {e.action}
                          </span>
                        ) : (
                          e.action
                        )}
                      </CelluleTableau>
                      {/*
                        La valeur la plus imprévisible du produit — et une
                        preuve : l'infobulle en porte l'entier, l'export CSV la
                        rend en entier.
                      */}
                      <CelluleTableau discret className={CELLULE}>
                        <Tronque className="max-w-80">{e.entite ?? '—'}</Tronque>
                      </CelluleTableau>
                      {/*
                        L'entreprise s'écrit, sans pastille : cinquante points
                        colorés en colonne feraient de la teinte le premier
                        élément lu d'un tableau qui se parcourt à la ligne.
                      */}
                      <CelluleTableau discret className={CELLULE}>
                        {e.entreprise ? nomEntreprise(e.entreprise) : '—'}
                      </CelluleTableau>
                      <CelluleTableau discret aDroite chiffres className={CELLULE}>
                        {e.ip ?? '—'}
                      </CelluleTableau>
                    </LigneTableau>
                  ))}
                </CorpsTableau>
              </Tableau>
            </CadreTableau>
          ) : journal.total > 0 ? (
            <TableauVide>
              Aucune action sur cette période. Élargissez la période ou retirez un filtre.
            </TableauVide>
          ) : (
            /* Journal réellement vide : le premier geste consigné le remplira. */
            <EtatVide
              titre="Aucune action sur cette période"
              message="Élargissez la période ou retirez un filtre."
            />
          )}
        </div>

        {pages > 1 && (
          <div className="mt-4">
            <Pagination
              page={page}
              pages={pages}
              lien={(n) => `/admin/journal?${base ? `${base}&` : ''}page=${n}`}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function nomEntreprise(slug: string): string {
  return estEntreprise(slug) ? entrepriseDe(slug).nom : slug
}
