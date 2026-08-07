import { readFileSync, readdirSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODULES, PERMISSIONS, type Permission } from '@/lib/permissions'

/**
 * Les gardes des écrans et des routes — ce que la fabrique d'actions ne couvre
 * pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Trois surfaces d'entrée, trois régimes différents.
 *
 * 1. Les Server Actions passent par `lib/safe-action.ts` — couvert ailleurs.
 * 2. Les PAGES sont protégées par le layout de leur module. Un layout qui
 *    exigerait le mauvais module — copier-coller — laisserait un module ouvert
 *    sans qu'aucun test existant ne s'en aperçoive.
 * 3. Les ROUTE HANDLERS ne traversent AUCUN layout. Chacun doit refaire à la
 *    main session puis permission. Un `route.ts` ajouté sans garde est un point
 *    d'entrée HTTP nu.
 *
 * L'export CSV du journal est le seul de ces trois régimes déjà testé
 * (`admin.spec.ts`). Ce fichier couvre les autres, et surtout ceux à venir : la
 * table est fermée des deux côtés.
 * ─────────────────────────────────────────────────────────────────────────
 */

const APP = join(process.cwd(), 'src', 'app')

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin.split('/').join(sep)), 'utf8')
}

/** Chemins relatifs POSIX de tous les fichiers de `src/app` répondant au filtre. */
function fichiers(filtre: (nom: string) => boolean, racine = APP): string[] {
  const trouves: string[] = []
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const complet = join(racine, entree.name)
    if (entree.isDirectory()) trouves.push(...fichiers(filtre, complet))
    else if (filtre(entree.name)) {
      trouves.push(posix.join('src/app', relative(APP, complet).split(sep).join('/')))
    }
  }
  return trouves.sort()
}

/* ══════════════════════════════════════════════════════════════════
   Route handlers — aucun layout ne les protège
   ══════════════════════════════════════════════════════════════════ */

/**
 * Permissions exigées par chaque route, écrites depuis le cahier des charges.
 * `null` désigne la seule route légitimement ouverte.
 */
const ROUTES: Readonly<Record<string, readonly Permission[] | null>> = {
  // C'est par là qu'on obtient une session : l'exclure est la condition pour
  // pouvoir se connecter. Le proxy l'exclut aussi de son filtre.
  'src/app/api/auth/[...all]/route.ts': null,

  /**
   * TR-3 — aucun fichier n'est servi par une adresse directe. La route distingue
   * l'aperçu du téléchargement : CV-5 ouvre l'aperçu à qui peut lire, CV-8 réserve
   * le téléchargement à qui peut télécharger.
   */
  'src/app/api/cv/[id]/telecharger/route.ts': ['cv:lire', 'cv:telecharger'],

  /**
   * TR-11 — la palette de commandes atteint tout écran, client, employé,
   * fichier ou estimation « dans les limites du rôle ». Une famille par
   * permission de lecture : la recruteuse n'obtient que les fichiers de CV, et
   * les trois autres tables ne sont même pas interrogées.
   */
  'src/app/api/recherche/route.ts': ['crm:lire', 'heures:lire', 'cv:lire', 'calculateur:lire'],

  // HEU-11 — l'export reprend ce que la grille affiche : même permission.
  'src/app/(app)/heures/export/route.ts': ['heures:lire'],

  // ADM-4 — le journal est réservé à l'administrateur.
  'src/app/(app)/admin/journal/export/route.ts': ['admin:journal'],

  // EST-14 — export QuickBooks : une lecture du calculateur.
  'src/app/(app)/calculateur/[entreprise]/estimations/csv/route.ts': ['calculateur:lire'],

  /**
   * EST-10 — le PDF d'une estimation, composé par le serveur.
   *
   * Même permission que l'écran qui l'affiche : le document ne montre rien de
   * plus que la fiche. La route vérifie en outre le slug d'entreprise, puis
   * passe par le client cadré — un identifiant d'un autre dossier ne répond pas.
   */
  'src/app/(app)/calculateur/[entreprise]/estimations/[id]/pdf/route.ts': ['calculateur:lire'],

  /**
   * Entretien périodique — CV-9, la purge de la corbeille.
   *
   * `null` parce qu'il n'y a PAS d'utilisateur : un planificateur l'appelle,
   * sans session ni rôle. Exiger une permission n'aurait aucun sens ; en
   * inventer une reviendrait à créer un compte de service, c'est-à-dire un
   * compte de plus à protéger.
   *
   * Elle ne s'ouvre pas pour autant : jeton partagé, comparaison à longueur
   * constante, et 404 — jamais 403 — quand il manque ou ne correspond pas. Sans
   * `ENTRETIEN_SECRET` configuré, la route n'existe pas.
   *
   * Le bloc de tests ci-dessous vérifie ces trois points pour elle, à la place
   * du contrôle de session qui ne s'applique pas.
   */
  'src/app/api/entretien/route.ts': null,
}

const ROUTES_TROUVEES = fichiers((n) => n === 'route.ts')

describe('Routes HTTP — chacune se garde elle-même', () => {
  it('le balayage trouve bien des routes', () => {
    expect(ROUTES_TROUVEES.length).toBeGreaterThan(0)
  })

  it('aucune route n’échappe à la table', () => {
    // Une route ajoutée sans décision d'accès tombe ici, avant la revue.
    const inconnues = ROUTES_TROUVEES.filter((r) => !(r in ROUTES))
    expect(
      inconnues,
      `Routes sans permission déclarée dans ce test — ${inconnues.join(', ')}`,
    ).toEqual([])
  })

  it('aucune entrée de la table ne désigne une route disparue', () => {
    const fantomes = Object.keys(ROUTES).filter((r) => !ROUTES_TROUVEES.includes(r))
    expect(fantomes, `Routes déclarées mais absentes — ${fantomes.join(', ')}`).toEqual([])
  })

  for (const [chemin, permissions] of Object.entries(ROUTES)) {
    if (permissions === null) continue

    describe(chemin, () => {
      const source = lire(chemin)

      it('vérifie la session avant toute chose', () => {
        expect(source).toMatch(/sessionCourante\(\)|requireSession\(\)/)
      })

      it('refuse sans session, avant de regarder le rôle', () => {
        const iSession = source.search(/sessionCourante\(\)|requireSession\(\)/)
        const iPermission = source.indexOf('aPermission(')
        expect(iSession).toBeGreaterThanOrEqual(0)
        if (iPermission !== -1) expect(iSession).toBeLessThan(iPermission)
      })

      it.each(permissions)('exige %s', (permission) => {
        expect(source).toContain(`'${permission}'`)
      })

      it('n’exige aucune permission hors de celles prévues', () => {
        const citees = PERMISSIONS.filter((p) => source.includes(`'${p}'`))
        expect(citees.slice().sort()).toEqual(permissions.slice().sort())
      })

      it('ne consulte pas la base avant d’avoir tranché', () => {
        /**
         * Une lecture placée avant le contrôle révélerait déjà quelque chose —
         * ne serait-ce que par le temps de réponse — et journaliserait un accès
         * qui n'a pas eu lieu.
         */
        const iPermission = source.indexOf('aPermission(')
        const iData = source.search(/await\s+\w*(?:ParId|Pour\w+|lister\w+)\(/)
        if (iData !== -1 && iPermission !== -1) expect(iPermission).toBeLessThan(iData)
      })
    })
  }
})

/* ══════════════════════════════════════════════════════════════════
   Layouts de module
   ══════════════════════════════════════════════════════════════════ */

describe('Layouts de module — le bon module, pas un voisin', () => {
  /**
   * `requireModule('cv')` recopié dans le layout des heures ouvrirait le suivi
   * des heures à la recruteuse. Rien d'autre dans la suite ne le verrait : la
   * matrice serait intacte et les actions correctement gardées, seul l'affichage
   * fuirait — jusqu'au premier export.
   */
  const AVEC_LAYOUT = MODULES.filter((m) => m !== 'admin' || true)

  it.each(AVEC_LAYOUT)('(app)/%s/layout.tsx exige son propre module', (module) => {
    const source = lire(`src/app/(app)/${module}/layout.tsx`)
    expect(source).toContain(`requireModule('${module}')`)

    // Et aucun autre : un second appel masquerait le premier.
    const autres = MODULES.filter((m) => m !== module).filter((m) =>
      source.includes(`requireModule('${m}')`),
    )
    expect(autres, `Le layout de ${module} exige aussi ${autres.join(', ')}`).toEqual([])
  })

  it('chaque module de la matrice a son layout gardé', () => {
    const sansGarde = MODULES.filter((m) => {
      try {
        return !lire(`src/app/(app)/${m}/layout.tsx`).includes('requireModule(')
      } catch {
        return true
      }
    })
    expect(sansGarde, `Modules sans layout gardé — ${sansGarde.join(', ')}`).toEqual([])
  })

  it('le layout de (app) exige une session', () => {
    expect(lire('src/app/(app)/layout.tsx')).toContain('requireSession()')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Écrans exigeant plus que l'accès au module
   ══════════════════════════════════════════════════════════════════ */

describe('Écrans d’administration — la permission fine, pas seulement le module', () => {
  /**
   * Le layout d'administration n'exige que le module. Chaque écran porte ensuite
   * sa propre permission : `admin:tarifs` n'est pas `admin:journal`, et l'écran
   * de paie relève de `heures:parametres` — une permission d'un AUTRE module,
   * que seul l'administrateur détient.
   */
  const ECRANS: Readonly<Record<string, Permission>> = {
    'src/app/(app)/admin/utilisateurs/page.tsx': 'admin:utilisateurs',
    'src/app/(app)/admin/tarifs/page.tsx': 'admin:tarifs',
    'src/app/(app)/admin/journal/page.tsx': 'admin:journal',
    'src/app/(app)/admin/paie/page.tsx': 'heures:parametres',
    // EST-10 — les coordonnées portées par le document client.
    'src/app/(app)/admin/organisation/page.tsx': 'admin:organisation',
  }

  it('la table couvre tous les écrans d’administration', () => {
    const pages = fichiers((n) => n === 'page.tsx', join(APP, '(app)', 'admin')).filter(
      (p) => p !== 'src/app/(app)/admin/page.tsx',
    )
    expect(pages.slice().sort()).toEqual(Object.keys(ECRANS).sort())
  })

  it.each(Object.entries(ECRANS))('%s exige %s', (chemin, permission) => {
    /*
      `requirePermissionEcran` et non `requirePermission` : la première appelle
      `notFound()`, la seconde lève `ErreurAcces` pour la fabrique d'actions.
      En production, une erreur levée pendant le rendu est assainie par Next —
      le refus s'affichait alors comme une panne générique. Les écrans doivent
      donc employer la variante d'écran, et ce test l'impose.
    */
    expect(lire(chemin)).toContain(`requirePermissionEcran('${permission}')`)
  })

  it('aucun écran n’emploie la garde réservée à la fabrique', () => {
    for (const chemin of Object.keys(ECRANS)) {
      const source = lire(chemin)
      expect(
        /\brequirePermission\(/.test(source),
        `${chemin} : \`requirePermission\` lève une erreur que la production assainit.`,
      ).toBe(false)
    }
  })

  it('l’écran d’accueil de l’administration se contente du module', () => {
    // Il ne montre que des liens ; chaque destination se garde elle-même.
    const source = lire('src/app/(app)/admin/page.tsx')
    expect(source).not.toContain('prisma.')
  })
})

describe('Écrans réservés dans un module par ailleurs partagé', () => {
  it('la corbeille et l’échéance des CV sont réservées à qui peut supprimer', () => {
    /**
     * CV-8, CV-9 et CV-10 : la recruteuse a le module `cv`, donc le layout la
     * laisse passer. Sans ce contrôle, elle atteindrait les deux vues par simple
     * saisie d'URL — GEN-3 : un écran inaccessible n'apparaît nulle part.
     *
     * Les deux ne sont plus des écrans mais des vues du même tableau. Le refus
     * n'est donc pas un `notFound()` : la vue demandée retombe sur « Tous les
     * CV », ce qui ne confirme ni n'infirme rien et laisse l'écran utilisable.
     */
    const source = lire('src/app/(app)/cv/page.tsx')
    expect(source).toContain("aPermission(session.role, 'cv:supprimer')")
    expect(source).toContain('VUES_RESERVEES.includes(demande)')
    expect(source).toContain("estVueCv(demande) && (!reservee || admin) ? demande : 'tous'")
  })

  it('les deux anciennes routes ne gardent plus rien elles-mêmes', () => {
    // Elles ne font que reconduire vers l'écran unique : y remettre un contrôle
    // ferait une seconde règle à tenir à jour, et c'est ainsi qu'elles divergent.
    for (const chemin of [
      'src/app/(app)/cv/corbeille/page.tsx',
      'src/app/(app)/cv/[categorie]/page.tsx',
    ]) {
      const source = lire(chemin)
      expect(source, chemin).toContain('redirect(')
      expect(source, chemin).toContain("requireModule('cv')")
    }
  })
})

/* ══════════════════════════════════════════════════════════════════
   Slug d'entreprise — il vient de l'URL
   ══════════════════════════════════════════════════════════════════ */

describe('Tout écran cloisonné valide le slug avant de cadrer', () => {
  /**
   * Le slug est saisi par l'utilisateur : il n'a aucune valeur de preuve.
   * `prismaCadre` lève sur un slug inconnu — mais l'écran serait alors une panne,
   * pas un refus. `crm.spec.ts` couvre les quatre écrans du CRM ; ce contrôle
   * balaie tout ce qui porte le segment `[entreprise]`, calculateur et tarifs
   * compris.
   */
  const CADRES = fichiers((n) => n === 'page.tsx' || n === 'route.ts').filter((c) =>
    lire(c).includes('prismaCadre('),
  )

  /** Le slug vient de la requête — donc de l'utilisateur. */
  const CLOISONNES = CADRES.filter((c) => /\bparams\b|\bsearchParams\b/.test(lire(c)))

  /** Le slug vient de la constante des trois entreprises — rien à valider. */
  const CONSTANTS = CADRES.filter((c) => !CLOISONNES.includes(c))

  it('des écrans cloisonnés sont bien trouvés', () => {
    expect(CADRES.length).toBeGreaterThan(4)
    expect(CLOISONNES.length).toBeGreaterThan(3)
  })

  it.each(CONSTANTS)('%s ne cadre que sur la liste des entreprises connues', (chemin) => {
    /**
     * Ces écrans montrent les trois dossiers côte à côte : le slug vient de
     * `ENTREPRISES`, jamais de l'URL. Le jour où l'un d'eux lirait un paramètre,
     * il basculerait dans le groupe ci-dessous et devrait valider.
     */
    const source = lire(chemin)
    expect(source).toContain('ENTREPRISES')
    expect(source).toMatch(/prismaCadre\(e\.slug\)|prismaCadre\(entreprise\.slug\)/)
  })

  it.each(CLOISONNES)('%s valide le slug avant prismaCadre', (chemin) => {
    const source = lire(chemin)
    const iValidation = source.search(/requireEntreprise\(|estEntreprise\(/)
    const iCadre = source.indexOf('prismaCadre(')

    expect(iValidation, `${chemin} n'a aucune validation de slug`).toBeGreaterThanOrEqual(0)
    expect(iValidation, `${chemin} cadre avant de valider`).toBeLessThan(iCadre)
  })
})

/* ══════════════════════════════════════════════════════════════════
   Proxy — redirection de confort, jamais une garde
   ══════════════════════════════════════════════════════════════════ */

describe('Proxy — la liste des chemins publics colle au groupe (auth)', () => {
  const PROXY = lire('src/proxy.ts')

  /** Chemins déclarés publics dans le proxy. */
  const publiques = new Set(
    (/const PUBLIQUES = \[([\s\S]*?)\]/.exec(PROXY)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean),
  )

  /** Pages réellement présentes dans le groupe `(auth)`. */
  const pagesAuth = fichiers((n) => n === 'page.tsx', join(APP, '(auth)')).map((c) => {
    const segments = c.replace('src/app/(auth)', '').replace('/page.tsx', '')
    return segments === '' ? '/' : segments
  })

  it('la lecture du proxy fonctionne', () => {
    expect(publiques.size).toBeGreaterThan(0)
    expect(pagesAuth.length).toBeGreaterThan(0)
  })

  it('aucun chemin public ne correspond à un écran protégé', () => {
    // GEN-2 : il n'existe aucune page publique hors du groupe (auth).
    const intrus = [...publiques].filter((p) => !pagesAuth.includes(p))
    expect(intrus, `Chemins déclarés publics sans page (auth) — ${intrus.join(', ')}`).toEqual([])
  })

  it('aucune page du groupe (auth) n’est laissée derrière la redirection', () => {
    // L'oubli inverse rendrait l'écran de mot de passe oublié inatteignable.
    const oubliees = pagesAuth.filter((p) => !publiques.has(p))
    expect(oubliees, `Pages (auth) absentes de PUBLIQUES — ${oubliees.join(', ')}`).toEqual([])
  })

  it('le fichier s’appelle proxy.ts et rien d’autre', () => {
    expect(() => lire('src/middleware.ts')).toThrow()
    expect(PROXY).toContain('export function proxy(')
  })

  it('le proxy n’essaie pas de tenir lieu de contrôle d’accès', () => {
    // Il ne consulte ni la base ni les rôles : la vraie garde est ailleurs.
    expect(PROXY).not.toContain('aPermission')
    expect(PROXY).not.toContain('@/lib/prisma')
  })
})

describe('Le test peut échouer', () => {
  it('détecte un layout qui exigerait le mauvais module', () => {
    const faux = `export default async function Layout() { await requireModule('cv') }`
    const autres = MODULES.filter((m) => m !== 'heures').filter((m) =>
      faux.includes(`requireModule('${m}')`),
    )
    expect(autres).toEqual(['cv'])
  })

  it('détecte une route sans garde', () => {
    const faux = `export async function GET() { return Response.json(await tout()) }`
    expect(/sessionCourante\(\)|requireSession\(\)/.test(faux)).toBe(false)
  })

  it('détecte un écran qui cadre avant de valider', () => {
    const faux = `const db = prismaCadre(entreprise)\nconst slug = await requireEntreprise(entreprise)`
    expect(faux.search(/requireEntreprise\(/)).toBeGreaterThan(faux.indexOf('prismaCadre('))
  })

  it('lit réellement les sources', () => {
    expect(ROUTES_TROUVEES).toContain('src/app/(app)/heures/export/route.ts')
    expect(lire('src/app/(app)/cv/layout.tsx')).toContain('requireModule')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Route d'entretien — pas d'utilisateur, donc d'autres garanties
   ══════════════════════════════════════════════════════════════════ */

describe('Purge de la corbeille — CV-9', () => {
  const source = lire('src/app/api/entretien/route.ts')

  it('n’existe pas sans jeton configuré', () => {
    // Un point d'entrée destructeur ne doit pas être joignable sur une
    // installation qui ne l'a pas explicitement activé.
    expect(source).toContain('ENTRETIEN_SECRET')
    expect(source).toMatch(/if \(!attendu\) return new NextResponse\(null, \{ status: 404 \}\)/)
  })

  it('répond 404 et jamais 403', () => {
    // 403 confirmerait que la route existe, donc qu'un jeton la déverrouille.
    expect(source).toContain('status: 404')
    expect(source).not.toContain('status: 403')
  })

  it('compare le jeton à longueur constante', () => {
    /*
      La durée d'une comparaison de chaînes ordinaire dépend du premier
      caractère qui diffère. Mesurée sur un réseau, elle permet de retrouver un
      jeton caractère par caractère.
    */
    expect(source).toContain('memeJeton')
    const fonction = source.slice(source.indexOf('function memeJeton'))
    expect(fonction).toContain('^')
    expect(fonction).not.toMatch(/return a === b/)
  })

  it('supprime l’objet AVANT la ligne', () => {
    /*
      Dans l'autre ordre, un échec au stockage laisserait un objet que plus
      aucune ligne ne désigne : introuvable, et impossible à effacer. Ici,
      l'échec laisse la ligne et la passe suivante réessaie.
    */
    const boucle = source.slice(source.indexOf('for (const f of expires)'))
    expect(boucle.indexOf('supprimerObjet')).toBeLessThan(boucle.indexOf('effacerFichier'))
  })

  it('journalise la purge', () => {
    // TR-5 : c'est une destruction définitive de renseignements personnels.
    expect(source).toContain('journaliser')
    expect(source).toContain('sensible: true')
  })
})

describe('La corbeille ne cache rien', () => {
  it('listerCorbeille ne borne pas à trente jours', () => {
    /*
      Le filtre `gte: seuilCorbeille()` faisait qu'au 31e jour un fichier
      quittait l'écran SANS avoir été effacé : plus aucun moyen de l'atteindre,
      ni pour le restaurer ni pour le purger, alors qu'il restait en base et
      dans le seau. La règle des trente jours appartient à la purge, pas à
      l'affichage.
    */
    const data = lire('src/lib/data/cv.ts')
    const bloc = data.slice(
      data.indexOf('export async function listerCorbeille'),
      data.indexOf('export async function fichiersExpires'),
    )
    expect(bloc).toContain('deletedAt: { not: null }')
    expect(bloc).not.toContain('seuilCorbeille()')
  })
})
