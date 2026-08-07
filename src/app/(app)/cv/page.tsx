import { Suspense } from 'react'
import Link from 'next/link'
import { Folder, Trash2 } from 'lucide-react'
import { BoutonDepot } from '@/components/cv/bouton-depot'
import { ChampRecherche } from '@/components/cv/champ-recherche'
import { GestionCategories } from '@/components/cv/gestion-categories'
import { TableauCorbeille } from '@/components/cv/tableau-corbeille'
import { TableauFichiers, type LigneFichier } from '@/components/cv/tableau-fichiers'
import { EtatVide } from '@/components/shared/etat-vide'
import { FlecheDroite } from '@/components/shared/fleches'
import { IconeClasseurs } from '@/components/shared/icone-classeurs'
import { Tronque } from '@/components/shared/tronque'
import {
  CORBEILLE_JOURS,
  categorieParId,
  compterAEcheance,
  compterNonClasses,
  compterTous,
  echeanceDe,
  listerCategories,
  listerCorbeille,
  listerFichiers,
} from '@/lib/data/cv'
import { LIBELLE_VUE_CV, VUES_RESERVEES, estVueCv, type VueCv } from '@/config/cv'
import { requireModule } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const dateFr = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' })

/**
 * Banque de CV — UN seul écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Plus aucune navigation : tout se joue dans le même tableau.
 *
 * Chaque vue avait sa page — « Tous les CV », « Non classé », « Plus de 24
 * mois », la corbeille — et chaque catégorie aussi. Passer de l'une à l'autre
 * rechargeait l'écran entier, et revenir en arrière était le seul chemin
 * latéral : deux navigations pour un mouvement de côté, précisément là où l'on
 * cherche dans quel dossier se trouve un nom.
 *
 * Ce qui est montré vit maintenant dans `?vue=`, et rien d'autre ne bouge : les
 * onglets, l'en-tête, la recherche et la colonne de droite restent en place
 * pendant que le tableau se recompose.
 *
 * `vue` porte soit l'un des quatre mots de `onglets-cv.tsx`, soit l'identifiant
 * d'une catégorie. Un seul paramètre pour une seule question — ce que le
 * tableau montre.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default async function PageBanqueCv({ searchParams }: PageProps<'/cv'>) {
  const session = await requireModule('cv')
  const { q, vue } = await searchParams

  const admin = aPermission(session.role, 'cv:supprimer')
  const recherche = typeof q === 'string' ? q.trim() || undefined : undefined
  const demande = typeof vue === 'string' ? vue : undefined

  /*
    La vue est RÉSOLUE avant tout affichage : le paramètre vient de l'URL et n'a
    aucune valeur de preuve. Une vue réservée demandée sans le droit, ou une
    catégorie inconnue, retombe sur « Tous les CV » plutôt que d'ouvrir un écran
    vide ou de lever.
  */
  const ouvert = demande && !estVueCv(demande) ? await categorieParId(demande) : null
  const reservee = estVueCv(demande) && VUES_RESERVEES.includes(demande)
  const active: VueCv = estVueCv(demande) && (!reservee || admin) ? demande : 'tous'

  return (
    /*
      Borné et centré — plus large que l'accueil, qui n'a pas de tableau à loger
      à côté d'une colonne d'appoint. Sans la borne, l'écran suit `main` et tout
      l'excédent d'un moniteur large part dans le tableau, la colonne d'appoint
      restant à 360 quoi qu'il arrive.
    */
    <div>
      <div className="mt-0.5">
        <div>
          <div>
            <h1 className="flex items-center gap-2.5 text-[30px] leading-9 font-semibold tracking-[-0.02em]">
              {/*
                L'emblème fourni par le client, pas l'icône de dossier de la
                barre latérale : celle-ci nomme le module dans un menu, celui-là
                titre l'écran.
              */}
              <IconeClasseurs className="text-ink2 size-6 shrink-0" />
              Banque de CV
            </h1>
            <p className="text-ink2 mt-1 text-[15px] leading-5.5">
              Déposez, classez et retrouvez les curriculum vitæ.
            </p>
          </div>
        </div>

        {/*
          La recherche et les deux actions sur UNE rangée, comme dans le repère :
          le champ prend la place qui reste, les boutons se posent à sa droite.

          Elle traverse les deux colonnes. C'est ce qui permet au chemin et au
          titre « Le fonds » de commencer à la même hauteur juste en dessous,
          sans qu'aucune marge n'ait à compenser la hauteur du champ.
        */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {/*
            La recherche ne s'applique pas à la corbeille : on n'y cherche pas,
            on y restaure ce qu'on vient de supprimer. Le champ cède alors la
            place, mais les boutons restent à droite.
          */}
          {!(active === 'corbeille' && !ouvert) && (
            <div className="min-w-0 flex-1">
              <ChampRecherche placeholder="Rechercher un CV" pleineLargeur />
            </div>
          )}

          {/* Un seul bouton noir par écran : la gestion des catégories est secondaire. */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {aPermission(session.role, 'cv:categories') && (
              <Suspense fallback={null}>
                <BlocCategories />
              </Suspense>
            )}
            {aPermission(session.role, 'cv:televerser') && (
              <Suspense fallback={null}>
                <BlocDepot />
              </Suspense>
            )}
          </div>
        </div>

        {/*
          Le filet ferme la rangée de recherche et traverse les deux colonnes :
          le chemin et « Le fonds » démarrent tous deux dessous.
        */}
        <div className="border-border mt-6 grid gap-8 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {/*
              Le CHEMIN, juste au-dessus du tableau — c'est là que le repère le
              place, et c'est là qu'il sert : il nomme ce que la liste montre.

              Le filet est porté par la grille, donc AU-DESSUS de lui : il ferme
              la recherche, il n'ouvre pas le tableau. Le tableau a déjà son
              propre cadre, et un second trait juste au-dessus en aurait fait
              deux pour une frontière.

              Il est TOUJOURS là, pour toutes les vues, dossier compris. Il n'a
              d'abord existé que pour les dossiers, puis cohabité avec une
              rangée d'onglets : dans les deux cas quelque chose apparaissait ou
              disparaissait, et le haut du tableau bougeait d'une vue à l'autre.
            */}
            <nav
              aria-label="Chemin"
              /*
                `min-h-7 items-end` : sept unités, la hauteur de ligne du titre
                « Le fonds » en face. Les deux textes s'appuient donc sur la
                même ligne de fond, sans qu'aucune marge ne le calcule.
              */
              className="text-ink3 flex min-h-7 items-end gap-1.5 text-[13px]"
            >
              <Link href="/cv" className="hover:text-ink">
                Banque de CV
              </Link>
              <span aria-hidden>/</span>
              <Tronque className="text-ink max-w-72 font-medium">
                {ouvert ? ouvert.nom : LIBELLE_VUE_CV[active]}
              </Tronque>
            </nav>

            <div className="mt-4">
              <Suspense fallback={null}>
                <Liste recherche={recherche} dossier={ouvert} vue={active} />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={null}>
            <Appoint ouvert={ouvert?.id ?? null} vue={active} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

async function BlocCategories() {
  /*
    La garde est REFAITE ici, et le rôle en vient.

    Ce composant est rendu séparément de sa page, derrière une frontière de
    suspension : rien ne garantirait sinon que la garde ait eu lieu. Recevoir le
    rôle ou une autorisation en propriété revient à laisser l'appelant trancher à
    la place de la garde — c'est la forme faible du motif, et c'est celle que le
    reste du produit a déjà corrigée.

    `sessionCourante` est mémorisée par requête : le second appel ne coûte pas
    d'aller-retour.
  */
  await requireModule('cv')
  const categories = await listerCategories()
  return (
    <GestionCategories
      categories={categories.map((c) => ({
        id: c.id,
        nom: c.nom,
        compte: c._count.fichiers,
        version: c.version,
      }))}
    />
  )
}

/**
 * Depuis la racine, aucun dossier n'est ouvert : le lot n'a pas de catégorie
 * préselectionnée, et le dialogue impose de choisir — exigence CV-6.
 */
async function BlocDepot() {
  /*
    La garde est REFAITE ici, et le rôle en vient.

    Ce composant est rendu séparément de sa page, derrière une frontière de
    suspension : rien ne garantirait sinon que la garde ait eu lieu. Recevoir le
    rôle ou une autorisation en propriété revient à laisser l'appelant trancher à
    la place de la garde — c'est la forme faible du motif, et c'est celle que le
    reste du produit a déjà corrigée.

    `sessionCourante` est mémorisée par requête : le second appel ne coûte pas
    d'aller-retour.
  */
  await requireModule('cv')
  const categories = await listerCategories()
  return <BoutonDepot categories={categories.map((c) => ({ id: c.id, nom: c.nom }))} />
}

/** Ce que la vue demandée montre. La corbeille a son propre tableau. */
async function Liste({
  recherche,
  dossier,
  vue,
}: {
  recherche?: string
  dossier: { id: string; nom: string } | null
  vue: VueCv
}) {
  /*
    La garde est REFAITE ici, et le rôle en vient.

    Ce composant est rendu séparément de sa page, derrière une frontière de
    suspension : rien ne garantirait sinon que la garde ait eu lieu. Recevoir le
    rôle ou une autorisation en propriété revient à laisser l'appelant trancher à
    la place de la garde — c'est la forme faible du motif, et c'est celle que le
    reste du produit a déjà corrigée.

    `sessionCourante` est mémorisée par requête : le second appel ne coûte pas
    d'aller-retour.
  */
  const session = await requireModule('cv')
  const role = session.role
  const admin = aPermission(role, 'cv:supprimer')

  if (!dossier && vue === 'corbeille') {
    const fichiers = await listerCorbeille()

    return (
      <>
        <p className="text-ink2 mb-4 text-[13px] leading-[18px]">
          Les fichiers supprimés sont conservés {CORBEILLE_JOURS} jours, puis effacés
          définitivement.
        </p>

        {fichiers.length === 0 ? (
          <EtatVide titre="La corbeille est vide" message="Aucun fichier supprimé récemment." />
        ) : (
          <TableauCorbeille
            fichiers={fichiers.map((f) => ({
              id: f.id,
              nom: f.nom,
              supprimeLe: f.deletedAt ? dateFr.format(f.deletedAt) : '—',
              supprimeParNom: f.supprimeParNom ?? '—',
              categories: f.categories,
            }))}
          />
        )}
      </>
    )
  }

  const filtre = dossier
    ? ({ type: 'categorie', categorieId: dossier.id } as const)
    : vue === 'non-classes'
      ? ({ type: 'non-classes' } as const)
      : vue === 'echeance'
        ? ({ type: 'echeance' } as const)
        : ({ type: 'tous' } as const)

  const [fichiers, categories] = await Promise.all([
    listerFichiers(filtre, recherche),
    listerCategories(),
  ])

  if (fichiers.length === 0) {
    return recherche ? (
      <EtatVide
        titre={`Aucun résultat pour « ${recherche} »`}
        message="Ajustez la recherche, ou vérifiez le dossier dans lequel le CV a été classé."
      />
    ) : dossier ? (
      <EtatVide
        titre="Ce dossier est vide"
        message="Déposez un CV, ou déplacez-en un depuis un autre dossier."
      />
    ) : vue === 'echeance' ? (
      <EtatVide
        titre="Aucun CV de plus de 24 mois"
        message="Les curriculum vitæ déposés il y a plus de deux ans apparaîtront ici. Aucun n’est supprimé."
      />
    ) : vue === 'non-classes' ? (
      <EtatVide titre="Aucun CV sans dossier" message="Tous les curriculum vitæ sont classés." />
    ) : (
      <EtatVide
        titre="Aucun CV pour l’instant"
        message={
          aPermission(role, 'cv:televerser')
            ? 'Déposez un premier curriculum vitæ pour commencer.'
            : 'Les curriculum vitæ déposés apparaîtront ici.'
        }
      />
    )
  }

  const colonneEcheance = !dossier && vue === 'echeance'

  const lignes: LigneFichier[] = fichiers.map((f) => ({
    id: f.id,
    nom: f.nom,
    taille: f.taille,
    typeMime: f.typeMime,
    version: f.version,
    deposeLe: dateFr.format(f.deposeLe),
    deposeParNom: f.deposeParNom,
    echeance: colonneEcheance ? dateFr.format(echeanceDe(f.deposeLe)) : null,
    categories: f.categories,
  }))

  return (
    <TableauFichiers
      fichiers={lignes}
      categories={categories.map((c) => ({ id: c.id, nom: c.nom }))}
      peutSupprimer={admin}
      peutTelecharger={aPermission(role, 'cv:telecharger')}
      peutReclasser={aPermission(role, 'cv:televerser')}
      colonneEcheance={colonneEcheance}
      recherche={recherche}
    />
  )
}

/**
 * La colonne d'appoint : ce qui décrit le fonds, jamais ce qui le modifie.
 *
 * Les comptes partent en parallèle : une cascade ferait quatre allers-retours
 * successifs vers Neon là où un seul temps de latence suffit.
 */
async function Appoint({ ouvert, vue }: { ouvert: string | null; vue: VueCv }) {
  /*
    La garde est REFAITE ici, et le rôle en vient.

    Ce composant est rendu séparément de sa page, derrière une frontière de
    suspension : rien ne garantirait sinon que la garde ait eu lieu. Recevoir le
    rôle ou une autorisation en propriété revient à laisser l'appelant trancher à
    la place de la garde — c'est la forme faible du motif, et c'est celle que le
    reste du produit a déjà corrigée.

    `sessionCourante` est mémorisée par requête : le second appel ne coûte pas
    d'aller-retour.
  */
  const session = await requireModule('cv')
  const admin = aPermission(session.role, 'cv:supprimer')

  const [categories, tous, nonClasses, echeance] = await Promise.all([
    listerCategories(),
    compterTous(),
    compterNonClasses(),
    admin ? compterAEcheance() : Promise.resolve(0),
  ])

  return (
    <aside className="flex flex-col gap-8">
      <section>
        <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Le fonds</h2>

        {/*
          La carte est GRISE, et le corps est un panneau blanc posé dessus : ses
          deux coins hauts s'arrondissent, si bien qu'on voit la carte passer
          derrière lui. Un en-tête gris à filet droit donnait deux blocs
          empilés ; ici il n'y en a qu'un, dont une partie remonte.
        */}
        <div className="border-border bg-hover mt-3 overflow-hidden rounded-md border">
          <Link
            href="/cv"
            className="hover:bg-hover2 flex items-center justify-between gap-2 px-4 py-2.5"
          >
            <span className="text-[13px] leading-[18px] font-medium">Tous les CV</span>
            <FlecheDroite className="text-ink3 w-3.5 shrink-0" />
          </Link>

          <div className="border-border bg-raised rounded-t-md border-t px-4 pt-4 pb-5">
            <p className="text-ink3 text-[13px] leading-[18px]">Curriculum vitæ conservés</p>

            {/*
              Un anneau, pas un disque : il ne remplit rien et ne mesure aucune
              proportion. Le fonds n'a pas de plafond — le chiffre se lit, il ne
              se compare à rien.
            */}
            <div className="mt-4 flex items-center gap-4">
              <span
                aria-hidden
                className="border-hover2 flex size-[72px] shrink-0 items-center justify-center rounded-full border-[9px] text-[15px] font-semibold tabular-nums"
              >
                {tous}
              </span>
              <p className="text-ink2 min-w-0 text-[13px] leading-[18px]">
                {mentionFonds(tous, nonClasses)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Chiffre libelle="Non classé" valeur={nonClasses} href="/cv?vue=non-classes" />
          {admin && <Chiffre libelle="Plus de 24 mois" valeur={echeance} href="/cv?vue=echeance" />}
        </div>
      </section>

      <section>
        <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">Dossiers</h2>

        {/*
          Ils PILOTENT le tableau plutôt que d'ouvrir un écran : le clic pose
          `?vue=` et la liste se recompose à gauche. C'est ce qui permet de
          passer d'un dossier à l'autre sans jamais revenir en arrière.

          `overflow-hidden` : le fond de survol de la première et de la dernière
          ligne est carré, et déborderait des coins arrondis du filet.
        */}
        <div className="border-border bg-raised divide-border mt-3 divide-y overflow-hidden rounded-md border">
          {categories.length === 0 ? (
            <p className="text-ink3 px-4 py-3 text-[13px] leading-[18px]">
              Aucune catégorie. Créez-en une depuis «&nbsp;Catégories&nbsp;».
            </p>
          ) : (
            categories.map((c) => (
              <Rangee
                key={c.id}
                href={`/cv?vue=${c.id}`}
                nom={c.nom}
                compte={c._count.fichiers}
                actif={c.id === ouvert}
              />
            ))
          )}

          {/*
            La corbeille ferme la liste. Elle n'est pas un dossier — c'est une
            vue —, mais c'est ici qu'on la cherche : au bas des dossiers, comme
            dans n'importe quel classeur.
          */}
          {admin && (
            <Rangee
              href="/cv?vue=corbeille"
              icone={Trash2}
              nom={LIBELLE_VUE_CV.corbeille}
              actif={vue === 'corbeille'}
            />
          )}
        </div>
      </section>
    </aside>
  )
}

/**
 * La phrase qui accompagne l'anneau.
 *
 * Elle dit ce que le chiffre ne dit pas : combien reste à classer. Sur un fonds
 * vide, elle remplace un « 0 non classés » qui se lirait comme un travail fait.
 */
function mentionFonds(tous: number, nonClasses: number): string {
  if (tous === 0) return 'Aucun CV déposé pour l’instant.'
  if (nonClasses === 0) return 'Tous sont classés dans un dossier.'
  if (nonClasses === 1) return '1 CV reste à classer.'
  return `${nonClasses} CV restent à classer.`
}

function Chiffre({ libelle, valeur, href }: { libelle: string; valeur: number; href: string }) {
  return (
    <Link
      href={href}
      className="border-border bg-raised hover:border-border-strong block rounded-md border px-4 py-3"
    >
      <span className="text-ink3 block text-[13px] leading-[18px]">{libelle}</span>
      <span className="mt-1 block text-[22px] leading-7 font-semibold tabular-nums">{valeur}</span>
    </Link>
  )
}

function Rangee({
  href,
  nom,
  compte,
  icone: Icone = Folder,
  actif = false,
}: {
  href: string
  nom: string
  /** Absent sur la corbeille : son contenu se vide de lui-même. */
  compte?: number
  icone?: typeof Folder
  actif?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center gap-2.5 px-4 text-[13px] leading-[18px]',
        // Fond ET graisse, plus `aria-current` : le dossier ouvert ne se
        // signale jamais par la seule teinte — section 19.
        actif ? 'bg-hover2 text-ink font-medium' : 'hover:bg-hover',
      )}
    >
      <Icone className="text-ink3 size-3.5 shrink-0" aria-hidden />
      <Tronque className="max-w-none min-w-0 flex-1">{nom}</Tronque>
      {compte !== undefined && <span className="text-ink3 shrink-0 tabular-nums">{compte}</span>}
    </Link>
  )
}
