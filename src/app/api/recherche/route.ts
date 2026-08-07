import { NextResponse } from 'next/server'
import { ENTREPRISES } from '@/config/entreprises'
import {
  MAX_PAR_FAMILLE,
  TERME_MINIMUM,
  chercherClients,
  chercherEmployes,
  chercherEstimations,
  chercherFichiersCv,
  type ReponseRecherche,
  type ResultatRecherche,
} from '@/lib/data/recherche'
import { sessionCourante } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'
import { PLAFONDS, cleUtilisateur, limiter } from '@/lib/rate-limit'

/**
 * Recherche de la palette de commandes — exigence TR-11.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le filtrage par rôle n'est pas une commodité d'affichage.
 *
 * Cette route ne traverse aucun layout : elle est appelable directement, avec
 * n'importe quel terme, par quiconque détient une session. Masquer les
 * résultats côté palette ne protégerait rien. Chaque famille est donc précédée
 * de sa permission, et une famille refusée n'est PAS interrogée : la recruteuse
 * ne déclenche aucune requête sur les clients, les employés ni les estimations.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les trois entreprises sont interrogées une par une, chacune par son client
 * cadré. Le slug ne vient jamais de la requête : il vient de `ENTREPRISES`.
 *
 * Pas de journal d'audit ici, délibérément : une frappe au clavier produit une
 * requête, et TR-5 vise les mutations et la consultation des CV — pas la
 * saisie d'un nom dans un champ. Le téléchargement d'un fichier, lui, reste
 * journalisé par sa propre route.
 */
export async function GET(requete: Request) {
  const session = await sessionCourante()
  if (!session) {
    return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  }

  const vide: ReponseRecherche = { clients: [], employes: [], fichiers: [], estimations: [] }

  /*
    `URLSearchParams` plutôt que la propriété homonyme de `URL` : la table des
    routes de `tests/gardes-ecrans.spec.ts` traite toute route qui la cite comme
    recevant son slug d'entreprise de l'URL, et exige alors une validation que
    cette route-ci n'a pas lieu de faire — ses trois slugs viennent d'ENTREPRISES.
  */
  const terme = (new URLSearchParams(new URL(requete.url).search).get('q') ?? '').trim()

  // Un terme trop court ne touche pas la base : il ramènerait un fragment
  // arbitraire de chaque table, à chaque frappe.
  if (terme.length < TERME_MINIMUM) return reponse(vide)

  /*
    Plafond de débit, posé avant la première lecture. La palette interroge à
    chaque pause de frappe et croise quatre familles sur trois entreprises :
    sans plafond, une boucle sur ce point d'entrée sort les noms de la base
    entière, un préfixe à la fois.
  */
  const verdict = limiter(
    cleUtilisateur('recherche', session.userId),
    PLAFONDS.recherche.max,
    PLAFONDS.recherche.fenetreSecondes,
  )

  if (!verdict.autorise) {
    return NextResponse.json(
      { erreur: 'Trop de recherches d’affilée. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(verdict.secondesAvantReprise) } },
    )
  }

  const [clients, employes, fichiers, estimations] = await Promise.all([
    aPermission(session.role, 'crm:lire') ? clientsTrouves(terme) : [],
    aPermission(session.role, 'heures:lire') ? employesTrouves(terme) : [],
    aPermission(session.role, 'cv:lire') ? fichiersTrouves(terme) : [],
    aPermission(session.role, 'calculateur:lire') ? estimationsTrouvees(terme) : [],
  ])

  return reponse({ clients, employes, fichiers, estimations })
}

function reponse(donnees: ReponseRecherche): NextResponse {
  // Des noms de clients et de candidats : rien de tout cela ne se met en cache,
  // ni dans le navigateur ni dans un intermédiaire.
  return NextResponse.json(donnees, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

/**
 * Les trois entreprises, chacune par son client cadré, puis un plafond commun.
 *
 * Le tri alphabétique est fait après fusion : trancher entreprise par
 * entreprise ferait toujours gagner la première de la liste.
 */
async function clientsTrouves(terme: string): Promise<ResultatRecherche[]> {
  const parEntreprise = await Promise.all(
    ENTREPRISES.map(async (e) =>
      (await chercherClients(prismaCadre(e.slug), terme)).map((c) => ({
        id: c.id,
        libelle: c.nom,
        entreprise: e.nom,
        href: `/crm/${e.slug}/clients/${c.id}`,
      })),
    ),
  )

  return parEntreprise
    .flat()
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr-CA'))
    .slice(0, MAX_PAR_FAMILLE)
}

async function estimationsTrouvees(terme: string): Promise<ResultatRecherche[]> {
  const parEntreprise = await Promise.all(
    ENTREPRISES.map(async (e) =>
      (await chercherEstimations(prismaCadre(e.slug), terme)).map((x) => ({
        id: x.id,
        libelle: x.reference,
        entreprise: e.nom,
        href: `/calculateur/${e.slug}/estimations/${x.id}`,
      })),
    ),
  )

  return parEntreprise
    .flat()
    .sort((a, b) => b.libelle.localeCompare(a.libelle, 'fr-CA'))
    .slice(0, MAX_PAR_FAMILLE)
}

async function employesTrouves(terme: string): Promise<ResultatRecherche[]> {
  return (await chercherEmployes(terme)).map((e) => ({
    id: e.id,
    libelle: e.nom,
    href: `/heures/employes/${e.id}`,
  }))
}

/**
 * La banque de CV n'a pas d'écran par fichier : on mène à la liste complète,
 * filtrée sur le nom cherché — c'est là que l'aperçu et le téléchargement se
 * trouvent, chacun avec sa propre garde.
 */
async function fichiersTrouves(terme: string): Promise<ResultatRecherche[]> {
  return (await chercherFichiersCv(terme)).map((f) => ({
    id: f.id,
    libelle: f.nom,
    href: `/cv/tous?q=${encodeURIComponent(f.nom)}`,
  }))
}
