import { BandeChiffres, type Chiffre } from '@/components/shared/bande-chiffres'
import { ChoixEntreprise } from '@/components/admin/choix-entreprise'
import { EditeurGrille, type LigneProduit } from '@/components/admin/editeur-grille'
import { EnTeteAdmin } from '@/components/admin/en-tete-admin'
import { HistoriqueGrilles, type VersionGrille } from '@/components/admin/historique-grilles'
import { listerGrilles } from '@/lib/data/admin'
import { requireEntreprise, requirePermissionEcran } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'
import { ENTREPRISES, entreprise as entrepriseDe } from '@/config/entreprises'
import { FUSEAU } from '@/config/dates'

/**
 * Grilles de tarifs — ADM-2 et ADM-3.
 *
 * La date de publication est rendue au fuseau du Québec, pas à celui du
 * serveur : une grille publiée à 20 h ici serait datée du lendemain ailleurs.
 */
const DATE = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'medium',
  timeZone: FUSEAU,
})

export default async function PageTarifs({ searchParams }: PageProps<'/admin/tarifs'>) {
  await requirePermissionEcran('admin:tarifs')

  // Un paramètre répété dans l'URL arrive en tableau : seule la forme utilisable
  // est retenue, le reste retombe sur la première entreprise.
  const requete = await searchParams
  const demande = typeof requete.entreprise === 'string' ? requete.entreprise : ENTREPRISES[0].slug
  // Le slug vient de l'URL : il n'a aucune valeur de preuve tant qu'il n'est pas
  // repassé par la garde.
  const slug = await requireEntreprise(demande)

  const db = prismaCadre(slug)
  const grilles = await listerGrilles(db)
  const courante = grilles.find((g) => g.actif) ?? null
  const produits = courante?.produits ?? []

  /*
    Les chiffres portent sur la version EN VIGUEUR de l'entreprise courante,
    jamais sur ce que le filtre laisse voir ni sur les modifications non
    publiées : ils répondent à « qu'est-ce que le calculateur applique en ce
    moment », question dont la réponse ne doit pas bouger pendant qu'on prépare
    la version suivante.
  */
  const chiffres: Chiffre[] = [
    { libelle: 'Version en vigueur', valeur: courante ? String(courante.numero) : 'Aucune' },
    { libelle: 'Services', valeur: String(produits.length) },
    { libelle: 'Actifs', valeur: String(produits.filter((p) => p.actif).length) },
    { libelle: 'Publiée le', valeur: courante ? DATE.format(courante.createdAt) : 'Jamais' },
  ]

  const mention = courante
    ? `Version ${courante.numero} en vigueur depuis le ${DATE.format(courante.createdAt)} — ${entrepriseDe(slug).nom}. Les estimations déjà émises conservent les prix de leur version.`
    : `Aucune grille publiée pour ${entrepriseDe(slug).nom}. Les estimations déjà émises conservent les prix de leur version.`

  const versions: VersionGrille[] = grilles.map((g) => ({
    numero: g.numero,
    actif: g.actif,
    ecarts: g.ecarts,
    creeParNom: g.creeParNom,
    publiee: DATE.format(g.createdAt),
  }))

  const lignes: LigneProduit[] = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    unite: p.unite,
    prixUnitaire: p.prixUnitaire,
    actif: p.actif,
  }))

  return (
    <div>
      <EnTeteAdmin titre="Grilles de tarifs" />
      <BandeChiffres chiffres={chiffres} />

      {/*
        Le contenu part du même axe que le chrome — fil d'Ariane, onglets, bande
        de chiffres. Les cinq écrans de l'administration le partagent : deux
        onglets du même module qui ne s'alignent pas se voient au premier
        aller-retour entre les deux.

        L'écart avec les bandes reste délibérément large : c'est lui qui les fait
        lire comme du chrome et ce qui suit comme du contenu. Serré, tout se
        confondait en une seule pile de rangées.
      */}
      <div className="mt-10">
        {/*
          Le sélecteur d'entreprise et l'historique restent rendus au serveur et
          traversent l'éditeur en propriétés : la rangée d'outils porte le bouton
          de publication, qui dépend de l'état de saisie, mais rien d'autre ici
          n'a besoin du navigateur.

          La clé remonte l'entreprise : sans elle, passer de Paysagement à
          Développement web garderait la saisie de la grille précédente et
          publierait les prix de l'une sous le nom de l'autre.
        */}
        <EditeurGrille
          key={slug}
          entreprise={slug}
          numero={courante?.numero ?? 0}
          produits={lignes}
          mention={mention}
          selecteurEntreprise={<ChoixEntreprise courante={slug} />}
          historique={<HistoriqueGrilles versions={versions} />}
        />
      </div>
    </div>
  )
}
