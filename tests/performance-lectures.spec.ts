import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ce que coûte un affichage — les défauts qu'un audit a mesurés.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La base est distante : 99,5 % du coût d'une requête est le réseau.
 *
 * Mesuré depuis la machine de développement : le serveur exécute dix requêtes
 * en 13 ms, mais chaque aller-retour coûte 275 ms. Le volume de données ne
 * compte pour rien ; le NOMBRE d'allers-retours compte pour tout.
 *
 * D'où ces contrôles, qui portent tous sur la même chose : ne pas demander à la
 * base plus que ce qu'on affiche, et ne jamais fermer une connexion qu'on va
 * rouvrir.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PRISMA = lire('src/lib/prisma.ts')
const ACCUEIL = lire('src/lib/data/accueil.ts')
const HEURES = lire('src/lib/data/heures.ts')
const ESTIMATIONS = lire('src/lib/data/estimations.ts')
const SCHEMA_HEURES = lire('prisma/schema/heures.prisma')

describe('Le pool garde ses connexions', () => {
  it('la durée d’inactivité est déclarée, jamais laissée au défaut', () => {
    /*
      `node-postgres` ferme toute connexion inutilisée depuis DIX secondes.
      Mesuré : après cinq secondes d'inactivité la requête suivante coûte
      270 ms, après dix elle en coûte 1 976 — la poignée de main complète.

      Trois personnes sur un outil interne laissent presque toujours passer plus
      de dix secondes entre deux clics.
    */
    expect(PRISMA).toContain('idleTimeoutMillis')
    expect(PRISMA).toContain('max: 10')
  })
})

describe('Ne pas lire plus que ce qu’on affiche', () => {
  it('l’existence d’une grille se compte, elle ne se charge pas', () => {
    // `grilleActive` ramène la grille AVEC tous ses produits : l'appeler pour
    // n'en tirer qu'un booléen faisait lire les trois catalogues entiers à
    // chaque affichage de l'accueil.
    expect(ACCUEIL).toContain('aUneGrilleActive(prismaCadre(e.slug))')
    expect(ACCUEIL).not.toContain('grilleActive(prismaCadre')
  })

  it('l’aperçu des estimations est borné en base, pas en mémoire', () => {
    /*
      `.slice(0, 5)` après un `findMany` sans borne désérialisait tout le
      dossier. Le tri étant fait en base, la coupe l'est aussi : `take` rend
      exactement les mêmes lignes.
    */
    expect(ACCUEIL).toContain('listerEstimations(db, {}, LIGNES_PAR_PANNEAU)')
    expect(ESTIMATIONS).toContain('...(limite !== undefined && { take: limite })')

    // La coupe reste légitime dans `panneau()`, qui réunit trois dossiers avant
    // de trancher à cinq. C'est ici, après une lecture déjà bornée, qu'elle
    // était du gaspillage.
    const bloc = ACCUEIL.slice(ACCUEIL.indexOf('export async function dernieresEstimations'))
    expect(bloc.slice(0, 900)).not.toContain('.slice(')
  })
})

describe('Aucune écriture sur un chemin de lecture', () => {
  it('les paramètres de paie se lisent', () => {
    /*
      C'était un `upsert`, qui créait la ligne à la première consultation — donc
      une écriture sur le chemin d'affichage de la grille, l'écran le plus
      ouvert du module. Une écriture coûte un journal, un verrou de ligne, et
      Neon ne peut jamais la servir depuis un réplica.
    */
    // Le commentaire de la fonction CITE `upsert` pour dire ce qu'elle n'est
    // plus : le scanner tel quel reviendrait à punir sa documentation.
    const sansCommentaires = HEURES.replace(/\/\*[\s\S]*?\*\//g, '')
    const bloc = sansCommentaires.slice(sansCommentaires.indexOf('export const parametresPaie'))
    expect(bloc.slice(0, 600)).toContain('findUnique')
    expect(bloc.slice(0, 600)).not.toContain('upsert')
  })

  it('l’appel est dédoublonné dans un même rendu', () => {
    // Les deux écrans du module l'attendent, et la fiche d'un employé le
    // demande une seconde fois.
    expect(HEURES).toContain('export const parametresPaie = cache(')
  })

  it('les défauts du code ne divergent pas de ceux du schéma', () => {
    /*
      La ligne `global` n'existe pas tant que personne n'a enregistré : il faut
      bien nommer les valeurs quelque part. Ce contrôle est ce qui empêche cette
      copie de devenir un second réglage, cach dans le code — HEU-7 et HEU-9
      exigent qu'ils restent modifiables sans déploiement.
    */
    const nombre = (motif: RegExp) => Number(SCHEMA_HEURES.match(motif)?.[1])

    expect(nombre(/seuilSupplementaires\s+Decimal[^\n]*@default\(([\d.]+)\)/)).toBe(40)
    expect(nombre(/majoration\s+Decimal[^\n]*@default\(([\d.]+)\)/)).toBe(1.5)
    expect(nombre(/joursPeriode\s+Int\s+@default\((\d+)\)/)).toBe(14)

    expect(HEURES).toContain('seuilCentiemes: 4000')
    expect(HEURES).toContain('majorationCentiemes: 150')
    expect(HEURES).toContain('joursPeriode: 14')
  })
})

describe('Un seul rendu par mutation', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    Un Server Action qui a revalidé fait DÉJÀ re-rendre la route.

    Next vide alors tout le cache client et re-rend depuis la racine. Le
    `router.refresh()` qui suivait déclenchait un SECOND rendu complet, jeté sur
    le premier — c'est-à-dire le double du coût sur le geste le plus fréquent de
    l'application : enregistrer.

    Toutes les actions du produit appellent `revalidatePath` sur la route qui
    les héberge ; le CRM et les estimations le font même en portée `layout`.
    ─────────────────────────────────────────────────────────────────────────
  */
  const CIBLES = [
    'src/components/admin/dialogue-utilisateur.tsx',
    'src/components/admin/editeur-grille.tsx',
    'src/components/admin/formulaire-organisation.tsx',
    'src/components/admin/formulaire-paie.tsx',
    'src/components/admin/tableau-utilisateurs.tsx',
    'src/components/calculateur/actions-estimation.tsx',
    'src/components/calculateur/calculette.tsx',
    'src/components/crm/bouton-supprimer-client.tsx',
    'src/components/crm/carte-relance.tsx',
    'src/components/crm/dialogue-client.tsx',
    'src/components/crm/formulaire-interaction.tsx',
    'src/components/crm/selecteur-statut.tsx',
    'src/components/crm/tableau-corbeille.tsx',
    'src/components/cv/dialogue-deplacer.tsx',
    'src/components/cv/gestion-categories.tsx',
    'src/components/cv/tableau-corbeille.tsx',
    'src/components/cv/tableau-fichiers.tsx',
    'src/components/heures/formulaire-employe.tsx',
    'src/components/heures/grille-heures.tsx',
  ]

  it('aucun rafraîchissement manuel après un Server Action', () => {
    const coupables = CIBLES.filter((c) => lire(c).includes('router.refresh()'))
    expect(coupables).toEqual([])
  })

  it('les trois exceptions gardent le leur, et elles seules', () => {
    /*
      Deux ne passent pas par un Server Action : la connexion appelle `signIn`
      de Better Auth, et l'avertissement de session prolonge la session par le
      client d'authentification. Les deux téléversements passent par une route,
      dont la réponse ne revalide rien.
    */
    for (const chemin of [
      'src/components/auth/formulaire-connexion.tsx',
      'src/components/layout/avertissement-session.tsx',
      'src/components/cv/bouton-depot.tsx',
      'src/components/admin/logo-organisation.tsx',
    ]) {
      expect(lire(chemin), chemin).toContain('router.refresh()')
    }
  })

  it('chaque action revalide la route qui l’héberge', () => {
    // C'est ce qui rend le rafraîchissement manuel inutile. Une action qui ne
    // revaliderait rien laisserait son écran figé.
    for (const nom of ['crm', 'cv', 'heures', 'admin', 'estimations']) {
      const source = lire(`src/lib/actions/${nom}.ts`)
      expect(source, nom).toContain('revalidatePath')
    }
  })
})

describe('Le cache du routeur client', () => {
  const CONFIG = lire('next.config.ts')
  const SAISIE = lire('src/app/(app)/heures/page.tsx')

  it('un délai est accordé aux routes dynamiques', () => {
    /*
      Toutes les routes de `(app)` lisent la session dans leur layout : elles
      sont dynamiques, et le défaut de `dynamic` est ZÉRO. Quitter un écran et y
      revenir refaisait le rendu serveur complet.

      Le délai ne peut jamais montrer à quelqu'un ses PROPRES données périmées :
      ses actions vident le cache par `revalidatePath`.
    */
    expect(CONFIG).toContain('staleTimes: { dynamic: 30 }')
  })

  it('le suivi des heures s’en exclut', () => {
    // C'est le seul écran où deux personnes travaillent en même temps sur les
    // mêmes lignes : la seconde écraserait la première en croyant remplir un
    // trou. L'export est refusé dans un layout, il doit rester sur la page.
    expect(SAISIE).toContain('export const unstable_dynamicStaleTime = 0')
    expect(lire('src/app/(app)/heures/employes/page.tsx')).toContain(
      'export const unstable_dynamicStaleTime = 0',
    )
  })

  it('la session est relue du cookie, pour une fenêtre bornée', () => {
    /*
      ARBITRAGE DE SÉCURITÉ, pas optimisation neutre : une session révoquée ou
      un compte suspendu restent valides pendant la fenêtre. Trente secondes
      plutôt que les cinq minutes usuelles, précisément pour la borner.
    */
    expect(lire('src/lib/auth.ts')).toContain('cookieCache: {')
  })
})

describe('Le titre n’attend pas les données', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    Une frontière de suspension par bloc coûteux.

    Sans elle, `await` en tête de page fait attendre le TITRE derrière la plus
    lente d'une trentaine de requêtes — sur une base distante, une seconde
    d'écran vide avant le premier mot.

    `fallback={null}` : la barre de chargement du haut couvre déjà l'attente, et
    un squelette ferait clignoter des blocs qui n'existent peut-être pas — une
    tuile à zéro ne s'affiche jamais.
    ─────────────────────────────────────────────────────────────────────────
  */
  const ACCUEIL_PAGE = lire('src/app/(app)/accueil/page.tsx')
  const CRM_PAGE = lire('src/app/(app)/crm/page.tsx')

  it('le titre est rendu avant toute lecture', () => {
    for (const [nom, source] of [
      ['accueil', ACCUEIL_PAGE],
      ['crm', CRM_PAGE],
    ] as const) {
      expect(source, nom).toContain('<Suspense fallback={null}>')
      expect(source.indexOf('<h1'), nom).toBeLessThan(source.indexOf('<Suspense'))
    }
  })

  it('chaque bloc suspendu refait la garde', () => {
    /*
      C'est l'invariant à ne pas casser : un composant rendu séparément de sa
      page n'a AUCUNE garantie que la garde ait eu lieu. `sessionCourante` est
      mémorisée par requête — le second appel ne coûte pas d'aller-retour.
    */
    const blocsDe = (source: string) =>
      [...source.matchAll(/async function (Bloc\w+)/g)].map((m) => ({
        nom: m[1],
        /*
          Le corps sans ses commentaires : la garde doit être la PREMIÈRE
          instruction, mais un bloc de commentaire qui l'explique peut la
          précéder de vingt lignes.
        */
        corps: source
          .slice(m.index, m.index + 1200)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .slice(0, 300),
      }))

    const blocs = [...blocsDe(ACCUEIL_PAGE), ...blocsDe(CRM_PAGE)]

    expect(blocs.length).toBeGreaterThan(0)
    for (const { nom, corps } of blocs) {
      // N'importe laquelle des gardes de `lib/guards.ts` — session, module ou
      // permission d'écran. Ce qui compte est qu'il y en ait une.
      expect(corps, nom).toMatch(/await require\w+\(/)
    }
  })
})

describe('Le cache client ne survit pas à la déconnexion', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    Révoquer la session ne suffit PAS à fermer la porte.

    Le navigateur garde les charges utiles des écrans déjà visités — trente
    secondes, accordées dans `next.config.ts`. Elles ont été rendues par un
    serveur qui avait la session : revenir sur l'accueil après la déconnexion
    les affichait telles quelles, sans jamais redemander au serveur.
    L'utilisateur se voyait toujours connecté, avec ses données à l'écran.

    C'est le prix caché du délai de cache, et il ne se paie qu'ici : partout
    ailleurs, une action revalide et Next vide le cache de lui-même.
    ─────────────────────────────────────────────────────────────────────────
  */
  const DECONNEXION = lire('src/lib/session-actions.ts')

  it('la déconnexion revalide l’arborescence entière', () => {
    // La portée `layout` sur `/` est le seul geste qui atteigne les écrans
    // qu'on ne visite pas en sortant.
    expect(DECONNEXION).toContain("revalidatePath('/', 'layout')")
  })

  it('elle le fait AVANT la redirection', () => {
    // `redirect` interrompt la fonction en levant : tout ce qui le suit est
    // du code mort.
    expect(DECONNEXION.indexOf("revalidatePath('/', 'layout')")).toBeLessThan(
      DECONNEXION.indexOf("redirect('/')"),
    )
  })

  it('et après la révocation, pas avant', () => {
    // Vider le cache d'une session encore valide n'aurait servi à rien : le
    // rendu suivant l'aurait repeuplé avec les mêmes données.
    expect(DECONNEXION.indexOf('auth.api.signOut')).toBeLessThan(
      DECONNEXION.indexOf("revalidatePath('/', 'layout')"),
    )
  })
})

describe('Les tris chauds sont couverts par un index', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    Le motif est le même partout : l'écran FILTRE puis ORDONNE.

    Un index qui s'arrête au filtre laisse Postgres trier le résultat entier
    avant de le couper à cinq lignes. Sur trois clients, il ignore l'index et
    parcourt la table — ces index ne changent donc rien aujourd'hui. Ils sont
    posés pour le jour où les tables auront grossi, et ce jour-là personne ne
    relira la couche de données pour comprendre pourquoi un écran rame.
    ─────────────────────────────────────────────────────────────────────────
  */
  const SCHEMA = (nom: string) => lire(`prisma/schema/${nom}.prisma`)

  it('le CRM couvre ses deux tris chronologiques', () => {
    // Les cinq derniers clients ouverts, les interactions récentes.
    expect(SCHEMA('crm')).toContain('@@index([entrepriseSlug, createdAt])')
    expect(SCHEMA('crm')).toContain('@@index([entrepriseSlug, date])')
  })

  it('le calculateur couvre la liste et les échéances', () => {
    expect(SCHEMA('calculateur')).toContain('@@index([entrepriseSlug, deletedAt, createdAt])')
    expect(SCHEMA('calculateur')).toContain('@@index([entrepriseSlug, statut, valideJusquau])')
  })

  it('le journal porte la date dans chacun de ses index', () => {
    /*
      C'est la seule table du produit qui grossit sans plafond : rien ne
      l'élague, et c'est voulu — un journal qu'on purge n'est plus une preuve.
      Ses filtres s'accompagnent TOUJOURS d'un tri par date décroissante.
    */
    for (const colonne of ['userId', 'module', 'sensible']) {
      expect(SCHEMA('audit'), colonne).toContain(`@@index([${colonne}, createdAt])`)
    }
  })

  it('la migration existe et n’en supprime aucun', () => {
    /*
      Ajouter un index est sans risque ; en retirer un demande une certitude
      qu'une lecture du code seule ne donne pas. L'audit en a signalé cinq comme
      inutiles — ils restent.
    */
    const sql = lire('prisma/migrations/20260808010000_index_de_tri/migration.sql')

    // Sept instructions : deux au CRM, deux au calculateur, trois au journal —
    // ce dernier remplace la couverture de ses trois filtres.
    expect((sql.match(/^CREATE INDEX/gm) ?? []).length).toBe(7)
    expect(sql).not.toContain('DROP INDEX')
  })
})

describe('Aucun bloc suspendu ne reçoit son autorisation en propriété', () => {
  /*
    ─────────────────────────────────────────────────────────────────────────
    La forme faible du motif, et pourquoi elle compte même sans faille ouverte.

    Un composant rendu derrière une frontière de suspension n'a aucune garantie
    que la garde de sa page ait eu lieu. Recevoir le rôle — ou pire, un booléen
    d'autorisation déjà calculé — revient à laisser l'appelant trancher à la
    place de la garde.

    Ce n'est exploitable nulle part aujourd'hui : l'enfant reste rendu dans
    l'arbre de la même requête, il n'a pas d'identifiant HTTP propre. Mais c'est
    la forme que le produit a corrigée partout ailleurs, et une règle qui ne
    tient qu'à trois endroits sur quatre ne tient pas.
    ─────────────────────────────────────────────────────────────────────────
  */
  const ECRANS = [
    'src/app/(app)/accueil/page.tsx',
    'src/app/(app)/crm/page.tsx',
    'src/app/(app)/cv/page.tsx',
  ]

  it('chaque composant asynchrone d’un écran suspendu porte sa garde', () => {
    const coupables: string[] = []

    for (const chemin of ECRANS) {
      const source = lire(chemin)
      // Toutes les fonctions asynchrones du fichier, pas seulement celles
      // nommées `Bloc…` : `Liste` et `Appoint` échappaient au balayage.
      for (const m of source.matchAll(/\nasync function (\w+)/g)) {
        const corps = source
          .slice(m.index, m.index + 1500)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .slice(0, 300)
        if (!/await require\w+\(/.test(corps)) coupables.push(`${chemin} — ${m[1]}`)
      }
    }

    expect(coupables).toEqual([])
  })

  it('aucune autorisation ne traverse en propriété', () => {
    // `role={session.role}` et `admin={admin}` faisaient décider l'appelant.
    for (const chemin of ECRANS) {
      const source = lire(chemin)
      expect(source, chemin).not.toMatch(/\brole=\{session\.role\}/)
      expect(source, chemin).not.toMatch(/\badmin=\{admin\}/)
    }
  })
})

describe('Le rôle d’administrateur est nommé une seule fois', () => {
  it('aucun littéral hors de la matrice', () => {
    /*
      Quatre sites comparaient `role === 'admin'` à la main, tous pour la règle
      « il doit rester un administrateur actif ». La règle nomme légitimement un
      rôle — ce n'est pas une garde d'accès — mais quatre littéraux dispersés
      finissent par diverger.

      La requête de `lib/data/admin.ts` garde le sien : c'est une condition SQL,
      qui ne peut pas appeler une fonction TypeScript.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDeSrc()) {
      if (chemin === 'src/lib/permissions.ts') continue
      if (chemin === 'src/lib/data/admin.ts') continue
      const contenu = lire(chemin).replace(/\/\*[\s\S]*?\*\//g, '')
      if (/\brole === 'admin'/.test(contenu)) coupables.push(chemin)
    }

    expect(coupables).toEqual([])
  })

  it('la fonction accepte une colonne texte', () => {
    // Le rôle d'un compte lu en base est une chaîne, éventuellement nulle : la
    // règle doit pouvoir s'y poser sans le valider d'abord.
    expect(lire('src/lib/permissions.ts')).toContain(
      'export function estAdministrateur(role: Role | string | null)',
    )
  })
})

/** Liste récursive des fichiers TypeScript de `src`. */
function fichiersDeSrc(): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    for (const e of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${e.name}`
      if (e.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.ts') || chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir('src')
  return sortie
}

describe('Les deux cibles de déploiement coexistent', () => {
  const CONFIG = lire('next.config.ts')

  it('`standalone` est posé partout SAUF sur Vercel', () => {
    /*
      ─────────────────────────────────────────────────────────────────────────
      Vercel trace les dépendances lui-même et attend `next-server.js.nft.json`
      à la fin du build. `standalone` produit à la place un serveur autonome dans
      `.next/standalone` et n'émet pas ce fichier : l'étape `onBuildComplete` de
      Vercel s'arrête sur un ENOENT, et le déploiement échoue.

      La cible du projet reste un VPS avec Coolify, qui a besoin de
      `standalone` — un essai sur Vercel n'a pas à le payer.
      ─────────────────────────────────────────────────────────────────────────
    */
    expect(CONFIG).toContain("process.env.VERCEL ? {} : { output: 'standalone' as const }")
  })

  it('la condition lit la variable que Vercel pose, pas une autre', () => {
    // `VERCEL` vaut « 1 » dans leurs conteneurs de construction, jamais ailleurs.
    // `NODE_ENV` ou `CI` seraient vrais chez Coolify aussi.
    expect(CONFIG).toContain('process.env.VERCEL')
    expect(CONFIG).not.toMatch(/output:\s*'standalone'\s*,/)
  })
})
