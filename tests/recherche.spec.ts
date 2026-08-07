import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReponseRecherche } from '@/lib/data/recherche'
import type { Role } from '@/lib/permissions'

/**
 * Palette de commandes — exigence TR-11.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * « Dans les limites du rôle » ne se vérifie pas à l'écran.
 *
 * La route ne traverse aucun layout : elle est appelable directement, avec
 * n'importe quel terme. Masquer les résultats côté palette laisserait le point
 * d'entrée ouvert. Ce fichier vérifie donc la seule chose qui compte : qu'une
 * famille refusée n'est PAS INTERROGÉE — pas qu'elle est rendue vide.
 *
 * Les fonctions de `lib/data/recherche.ts` sont remplacées par des espions.
 * Elles ne peuvent de toute façon pas être importées ici — `server-only` — et
 * ce n'est pas leur contenu qu'on teste, c'est le fait qu'on les appelle ou non.
 * La matrice de permissions, elle, reste la vraie : c'est la source unique.
 * ─────────────────────────────────────────────────────────────────────────
 */

vi.mock('server-only', () => ({}))

const espions = vi.hoisted(() => ({
  sessionCourante: vi.fn(),
  prismaCadre: vi.fn(),
  chercherClients: vi.fn(),
  chercherEmployes: vi.fn(),
  chercherFichiersCv: vi.fn(),
  chercherEstimations: vi.fn(),
}))

vi.mock('@/lib/guards', () => ({ sessionCourante: espions.sessionCourante }))
vi.mock('@/lib/prisma', () => ({ prismaCadre: espions.prismaCadre }))
vi.mock('@/lib/data/recherche', () => ({
  TERME_MINIMUM: 2,
  MAX_PAR_FAMILLE: 5,
  chercherClients: espions.chercherClients,
  chercherEmployes: espions.chercherEmployes,
  chercherFichiersCv: espions.chercherFichiersCv,
  chercherEstimations: espions.chercherEstimations,
}))

const { GET } = await import('@/app/api/recherche/route')
const { PLAFONDS } = await import('@/lib/rate-limit')

const LECTURES = [
  espions.chercherClients,
  espions.chercherEmployes,
  espions.chercherFichiersCv,
  espions.chercherEstimations,
]

/**
 * Un identifiant neuf par session : le compteur de débit est réel et vit dans
 * le module. Deux tests partageant un identifiant se videraient mutuellement
 * leur quota.
 */
let numero = 0
function connecter(role: Role): void {
  numero += 1
  espions.sessionCourante.mockResolvedValue({
    userId: `essai-${numero}`,
    nom: 'Personne d’essai',
    courriel: 'essai@exemple.ca',
    role,
  })
}

async function chercher(terme: string) {
  const reponse = await GET(new Request(`http://localhost/api/recherche?q=${terme}`))
  return { statut: reponse.status, reponse, corps: (await reponse.json()) as ReponseRecherche }
}

beforeEach(() => {
  vi.clearAllMocks()
  espions.prismaCadre.mockImplementation((slug: string) => ({ slug }))
  for (const lecture of LECTURES) lecture.mockResolvedValue([])
})

/* ══════════════════════════════════════════════════════════════════
   Ce que la route refuse
   ══════════════════════════════════════════════════════════════════ */

describe('Sans session', () => {
  it('refuse, et ne consulte aucune table', async () => {
    espions.sessionCourante.mockResolvedValue(null)

    const reponse = await GET(new Request('http://localhost/api/recherche?q=tremblay'))

    expect(reponse.status).toBe(401)
    for (const lecture of LECTURES) expect(lecture).not.toHaveBeenCalled()
  })
})

describe('Terme trop court', () => {
  it('ne cherche rien sous deux caractères', async () => {
    connecter('admin')
    const { statut, corps } = await chercher('a')

    expect(statut).toBe(200)
    expect(corps).toEqual({ clients: [], employes: [], fichiers: [], estimations: [] })
    for (const lecture of LECTURES) expect(lecture).not.toHaveBeenCalled()
  })

  it('ne cherche rien non plus sur des espaces', async () => {
    connecter('admin')
    const { corps } = await chercher('%20%20%20')

    expect(corps.clients).toEqual([])
    for (const lecture of LECTURES) expect(lecture).not.toHaveBeenCalled()
  })
})

/* ══════════════════════════════════════════════════════════════════
   Les limites du rôle — famille par famille
   ══════════════════════════════════════════════════════════════════ */

describe('Le rôle borne ce qui est INTERROGÉ, pas seulement ce qui est rendu', () => {
  it('la recruteuse n’obtient que les fichiers de CV', async () => {
    connecter('recrutement')
    const { corps } = await chercher('tremblay')

    expect(espions.chercherFichiersCv).toHaveBeenCalled()

    // Ni client, ni employé, ni estimation : aucune requête n'est même émise.
    expect(espions.chercherClients).not.toHaveBeenCalled()
    expect(espions.chercherEmployes).not.toHaveBeenCalled()
    expect(espions.chercherEstimations).not.toHaveBeenCalled()
    expect(espions.prismaCadre).not.toHaveBeenCalled()

    expect(corps.clients).toEqual([])
    expect(corps.employes).toEqual([])
    expect(corps.estimations).toEqual([])
  })

  it('la gestion des heures n’obtient que les employés', async () => {
    connecter('heures')
    const { corps } = await chercher('tremblay')

    expect(espions.chercherEmployes).toHaveBeenCalled()
    expect(espions.chercherClients).not.toHaveBeenCalled()
    expect(espions.chercherFichiersCv).not.toHaveBeenCalled()
    expect(espions.chercherEstimations).not.toHaveBeenCalled()

    expect(corps.clients).toEqual([])
    expect(corps.fichiers).toEqual([])
    expect(corps.estimations).toEqual([])
  })

  it('l’administrateur atteint les quatre familles', async () => {
    connecter('admin')
    await chercher('tremblay')

    for (const lecture of LECTURES) expect(lecture).toHaveBeenCalled()
  })
})

/* ══════════════════════════════════════════════════════════════════
   Cloisonnement — trois entreprises, trois requêtes
   ══════════════════════════════════════════════════════════════════ */

describe('Clients et estimations restent cloisonnés', () => {
  beforeEach(() => {
    espions.chercherClients.mockImplementation(async (db: { slug: string }) => [
      { id: `client-${db.slug}`, nom: 'Tremblay' },
    ])
    espions.chercherEstimations.mockImplementation(async (db: { slug: string }) => [
      { id: `estimation-${db.slug}`, reference: 'PAY-2026-014' },
    ])
  })

  it('interroge les trois entreprises, chacune par son client cadré', async () => {
    connecter('admin')
    await chercher('tremblay')

    const slugs = espions.prismaCadre.mock.calls.map(([slug]) => slug)
    expect(slugs).toContain('paysagement')
    expect(slugs).toContain('developpement')
    expect(slugs).toContain('staff')

    expect(espions.chercherClients).toHaveBeenCalledTimes(3)
    expect(espions.chercherEstimations).toHaveBeenCalledTimes(3)
  })

  it('dit de quelle entreprise vient chaque résultat', async () => {
    /*
      Sans cette mention, deux clients homonymes de deux dossiers différents
      sont indistinguables — et l'un des deux mène à la mauvaise fiche.
    */
    connecter('admin')
    const { corps } = await chercher('tremblay')

    expect(corps.clients.map((c) => c.entreprise).sort()).toEqual([
      'Développement web',
      'Paysagement',
      'Staff augmentation',
    ])
    expect(corps.clients.map((c) => c.href)).toContain(
      '/crm/paysagement/clients/client-paysagement',
    )
    expect(corps.estimations.every((e) => Boolean(e.entreprise))).toBe(true)
  })

  it('l’employé, lui, n’est pas cloisonné', async () => {
    // HEU-2 : la grille présente les employés des trois entreprises en une vue.
    espions.chercherEmployes.mockResolvedValue([{ id: 'employe-1', nom: 'Tremblay' }])
    connecter('admin')
    const { corps } = await chercher('tremblay')

    expect(espions.chercherEmployes).toHaveBeenCalledTimes(1)
    expect(corps.employes).toEqual([
      { id: 'employe-1', libelle: 'Tremblay', href: '/heures/employes/employe-1' },
    ])
  })
})

/* ══════════════════════════════════════════════════════════════════
   Plafonds
   ══════════════════════════════════════════════════════════════════ */

describe('Les résultats sont plafonnés', () => {
  it('rend cinq clients au maximum, toutes entreprises confondues', async () => {
    espions.chercherClients.mockImplementation(async (db: { slug: string }) =>
      Array.from({ length: 5 }, (_, i) => ({
        id: `${db.slug}-${i}`,
        nom: `Client ${db.slug} ${i}`,
      })),
    )
    connecter('admin')
    const { corps } = await chercher('client')

    expect(corps.clients).toHaveLength(5)
  })
})

describe('Le débit est plafonné', () => {
  it('refuse au-delà du plafond, avec le délai de reprise', async () => {
    connecter('admin')

    for (let i = 0; i < PLAFONDS.recherche.max; i++) {
      const { statut } = await chercher('tremblay')
      expect(statut, `appel ${i + 1}`).toBe(200)
    }

    const { statut, reponse } = await chercher('tremblay')
    expect(statut).toBe(429)
    expect(reponse.headers.get('Retry-After')).toBeTruthy()
  })

  it('le plafond ne se remplit pas sur un terme trop court', async () => {
    // Une frappe qui ne touche pas la base ne doit pas consommer le quota.
    connecter('admin')

    for (let i = 0; i < PLAFONDS.recherche.max + 5; i++) await chercher('a')

    const { statut } = await chercher('tremblay')
    expect(statut).toBe(200)
  })
})

describe('La réponse ne se met pas en cache', () => {
  it('porte no-store', async () => {
    connecter('admin')
    const { reponse } = await chercher('tremblay')
    expect(reponse.headers.get('Cache-Control')).toContain('no-store')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Ce qui franchit la frontière — analyse statique
   ══════════════════════════════════════════════════════════════════ */

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), ...chemin.split('/')), 'utf8')
}

describe('Aucune donnée sensible dans les résultats', () => {
  const data = lire('src/lib/data/recherche.ts')

  /**
   * Un `select` est la seule porte de sortie de ce fichier. On les relit tous
   * plutôt que de chercher des mots interdits : une colonne ajoutée demain
   * portera un nom que personne n'aura pensé à interdire.
   */
  const AUTORISES = new Set(['id', 'nom', 'reference'])

  const selects = [...data.matchAll(/select:\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '')

  it('le balayage trouve bien des sélections', () => {
    expect(selects.length).toBeGreaterThan(3)
  })

  it.each(selects)('« %s » ne sort qu’un identifiant et un libellé', (bloc) => {
    const colonnes = [...bloc.matchAll(/(\w+)\s*:/g)].map((m) => m[1] as string)
    const interdites = colonnes.filter((c) => !AUTORISES.has(c))

    expect(
      interdites,
      `Colonnes hors du strict nécessaire — ${interdites.join(', ')}. Un montant, un taux
       horaire ou une clé de stockage ne franchit jamais cette frontière.`,
    ).toEqual([])
  })

  it('les fonctions cloisonnées reçoivent le client cadré, jamais le slug', () => {
    // Écrire la colonne d'entreprise à la main masquerait le jour où
    // l'extension de cloisonnement cesserait d'agir : voir lib/prisma.ts. Les
    // commentaires sont retirés, ils ont le droit de la NOMMER.
    const code = data.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain('entrepriseSlug')
    expect(code).toContain('db: PrismaCadre')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Côté palette
   ══════════════════════════════════════════════════════════════════ */

describe('La palette n’émet pas une requête par frappe', () => {
  const palette = lire('src/components/layout/palette-commandes.tsx')

  it('diffère la recherche', () => {
    expect(palette).toContain('setTimeout')
    expect(palette).toMatch(/DELAI_MS = 2\d\d/)
  })

  it('annule la requête précédente', () => {
    // Sans annulation, une réponse tardive écrase la plus récente.
    expect(palette).toContain('AbortController')
    expect(palette).toContain('signal.aborted')
  })

  it('applique le même plancher de deux caractères', () => {
    expect(palette).toContain('TERME_MINIMUM = 2')
  })

  it('garde la racine Command posée à la main', () => {
    /*
      `CommandDialog` du préréglage shadcn ne pose pas `CommandPrimitive.Root` :
      sans cette racine, le premier abonnement de cmdk lève
      « Cannot read properties of undefined (reading 'subscribe') » et la palette
      plante à l'ouverture.
    */
    expect(palette).toContain('<Command shouldFilter={false}>')
    expect(palette).toContain('</Command>')
  })

  it('ne filtre pas côté client ce que le serveur a filtré', () => {
    // cmdk masquerait une estimation trouvée par sa référence.
    expect(palette).toContain('shouldFilter={false}')
  })

  it('affiche l’état vide de la section 19', () => {
    expect(palette).toContain('Aucun résultat.')
  })

  it('n’emploie aucune couleur d’entreprise', () => {
    // Section 19 : le nom est écrit, la couleur n'est jamais une surface.
    expect(palette).not.toContain('jeton')
    expect(palette).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})

/* ══════════════════════════════════════════════════════════════════
   Le test peut échouer
   ══════════════════════════════════════════════════════════════════ */

describe('Le test peut échouer', () => {
  it('détecte une colonne sensible ajoutée à un select', () => {
    const faux = `select: { id: true, nom: true, tauxHoraire: true }`
    const bloc = /select:\s*\{([^}]*)\}/.exec(faux)?.[1] ?? ''
    const colonnes = [...bloc.matchAll(/(\w+)\s*:/g)].map((m) => m[1] as string)
    expect(colonnes).toContain('tauxHoraire')
  })

  it('détecte une famille interrogée sans permission', async () => {
    // Le contraire du test de rôle : si la recruteuse déclenchait la lecture des
    // clients, cette assertion tomberait.
    connecter('recrutement')
    await chercher('tremblay')
    expect(espions.chercherClients.mock.calls).toEqual([])
  })
})
