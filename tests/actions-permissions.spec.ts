import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PERMISSIONS, ROLES, aPermission, type Permission, type Role } from '@/lib/permissions'

/**
 * Quelle permission protège quelle action — le trou que laissait la matrice.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `tests/permissions.spec.ts` prouve que le rôle « recrutement » n'a pas
 * `cv:supprimer`. Il ne prouve pas que l'action `supprimerFichier` exige
 * `cv:supprimer`.
 *
 * Une action de suppression déclarée `permission: 'cv:lire'` passerait
 * aujourd'hui la totalité de la suite : la matrice serait intacte, la fabrique
 * ferait son travail, le journal serait alimenté — et la recruteuse pourrait
 * effacer un dossier.
 *
 * Ce fichier attache donc chaque action à la permission que le cahier des
 * charges lui assigne, puis en déduit, rôle par rôle, qui peut l'appeler. Trois
 * rôles multipliés par trente-cinq actions : les assertions sont générées, la
 * table est écrite à la main.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'analyse est statique : `lib/actions/` est `'use server'` et tire Prisma,
 * Better Auth et le stockage. Le test lit le texte source, comme les autres
 * gardes du projet.
 */

const DOSSIER = join(process.cwd(), 'src', 'lib', 'actions')

type Attendu = {
  fichier: string
  permission: Permission
  /** Rôles autorisés à appeler l'action, lus du cahier des charges. */
  roles: readonly Role[]
  /** Geste à surveiller au journal : destruction, changement de droits, réécriture d'un registre clos. */
  sensible?: true
}

const ADMIN_SEUL: readonly Role[] = ['admin']
const AVEC_RECRUTEMENT: readonly Role[] = ['admin', 'recrutement']
const AVEC_HEURES: readonly Role[] = ['admin', 'heures']

/**
 * Écrite depuis le cahier des charges, jamais recopiée de `lib/actions/`.
 * La mettre à jour doit être un geste délibéré.
 */
const ATTENDU: Readonly<Record<string, Attendu>> = {
  /* ── Banque de CV ─────────────────────────────────────────────── */
  // CV-6 : le dépôt appartient aux deux rôles autorisés.
  preparerTeleversement: { fichier: 'cv.ts', permission: 'cv:televerser', roles: AVEC_RECRUTEMENT },
  confirmerTeleversement: {
    fichier: 'cv.ts',
    permission: 'cv:televerser',
    roles: AVEC_RECRUTEMENT,
  },
  // CV-3 : reclasser, c'est poser une étiquette — le même geste que déposer.
  deplacerFichier: { fichier: 'cv.ts', permission: 'cv:televerser', roles: AVEC_RECRUTEMENT },
  // CV-8 : « la suppression est réservée à l'administrateur ».
  supprimerFichier: {
    fichier: 'cv.ts',
    permission: 'cv:supprimer',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  // CV-9 : qui peut vider la corbeille peut aussi en ressortir un dossier.
  restaurerFichier: { fichier: 'cv.ts', permission: 'cv:supprimer', roles: ADMIN_SEUL },
  purgerCorbeille: {
    fichier: 'cv.ts',
    permission: 'cv:supprimer',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  // CV-2 : « la liste est modifiable par l'administrateur ».
  creerCategorie: { fichier: 'cv.ts', permission: 'cv:categories', roles: ADMIN_SEUL },
  renommerCategorie: { fichier: 'cv.ts', permission: 'cv:categories', roles: ADMIN_SEUL },
  reordonnerCategories: { fichier: 'cv.ts', permission: 'cv:categories', roles: ADMIN_SEUL },
  supprimerCategorie: {
    fichier: 'cv.ts',
    permission: 'cv:categories',
    roles: ADMIN_SEUL,
    sensible: true,
  },

  /* ── Suivi des heures ─────────────────────────────────────────── */
  enregistrerSemaine: { fichier: 'heures.ts', permission: 'heures:saisir', roles: AVEC_HEURES },
  copierSemainePrecedente: {
    fichier: 'heures.ts',
    permission: 'heures:saisir',
    roles: AVEC_HEURES,
  },
  // HEU-10 : la clôture rend la grille en lecture seule.
  cloturerPeriode: {
    fichier: 'heures.ts',
    permission: 'heures:cloturer',
    roles: AVEC_HEURES,
    sensible: true,
  },
  // HEU-10 : écrire dans un registre clos laisse une trace nominative.
  corrigerSemaine: {
    fichier: 'heures.ts',
    permission: 'heures:corriger',
    roles: AVEC_HEURES,
    sensible: true,
  },
  // HEU-1 : la gérante embauche et fait la paie ; le taux horaire relève d'elle.
  creerEmploye: { fichier: 'heures.ts', permission: 'heures:employes', roles: AVEC_HEURES },
  modifierEmploye: { fichier: 'heures.ts', permission: 'heures:employes', roles: AVEC_HEURES },

  /* ── CRM — CRM-1 : « le module est réservé à l'administrateur » ── */
  creerClient: { fichier: 'crm.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },
  modifierClient: { fichier: 'crm.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },
  changerStatut: { fichier: 'crm.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },
  ajouterInteraction: { fichier: 'crm.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },
  planifierRelance: { fichier: 'crm.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },
  supprimerClient: {
    fichier: 'crm.ts',
    permission: 'crm:supprimer',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  // CRM-7 — « les enregistrements restent restaurables ». Même permission que
  // la suppression : qui peut retirer une fiche peut la remettre.
  restaurerClient: {
    fichier: 'crm.ts',
    permission: 'crm:supprimer',
    roles: ADMIN_SEUL,
    sensible: true,
  },

  /* ── Calculateur ──────────────────────────────────────────────── */
  enregistrerEstimation: {
    fichier: 'estimations.ts',
    permission: 'calculateur:ecrire',
    roles: ADMIN_SEUL,
  },
  dupliquerEstimation: {
    fichier: 'estimations.ts',
    permission: 'calculateur:ecrire',
    roles: ADMIN_SEUL,
  },
  emettreEstimation: {
    fichier: 'estimations.ts',
    permission: 'calculateur:ecrire',
    roles: ADMIN_SEUL,
  },
  changerStatutEstimation: {
    fichier: 'estimations.ts',
    permission: 'calculateur:ecrire',
    roles: ADMIN_SEUL,
  },
  /**
   * EST-7 — créer une fiche depuis le calculateur reste une écriture du CRM.
   * C'est la permission du module qui ÉCRIT qui décide, pas celle de l'écran
   * d'où l'on vient : `calculateur:ecrire` ouvrirait une porte dérobée vers le
   * CRM le jour où un rôle recevrait le calculateur sans le CRM.
   */
  creerClientRapide: { fichier: 'estimations.ts', permission: 'crm:ecrire', roles: ADMIN_SEUL },

  /* ── Administration ───────────────────────────────────────────── */
  // Le schéma accepte le rôle « admin » : inviter peut créer un administrateur.
  inviterUtilisateur: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  // Le courriel EST l'identifiant de connexion : le changer déplace l'accès.
  modifierUtilisateur: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  changerRole: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  suspendreCompte: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  reactiverCompte: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  reinitialiserMotDePasse: {
    fichier: 'admin.ts',
    permission: 'admin:utilisateurs',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  enregistrerGrille: { fichier: 'admin.ts', permission: 'admin:tarifs', roles: ADMIN_SEUL },
  /**
   * HEU-7 et HEU-9 — le seuil et la majoration suivent la norme du travail.
   * La gérante saisit les heures ; elle ne redéfinit pas la règle qui les paie.
   */
  enregistrerParametresDePaie: {
    fichier: 'admin.ts',
    permission: 'heures:parametres',
    roles: ADMIN_SEUL,
    sensible: true,
  },
  /**
   * EST-10 — raison sociale, adresse et téléphone imprimés sur le document remis
   * au client. Permission distincte de 'admin:tarifs' : ce ne sont pas des prix.
   */
  enregistrerOrganisationAction: {
    fichier: 'admin.ts',
    permission: 'admin:organisation',
    roles: ADMIN_SEUL,
  },

  /**
   * EST-10 — logo imprimé en en-tête du même document, donc même permission.
   *
   * `preparerLogo` forge une URL d'ÉCRITURE vers le stockage : c'est le seul de
   * ces trois appels qui donne un pouvoir en dehors de l'application, et il ne
   * doit pas être plus ouvert que celui qui l'utilise ensuite.
   */
  preparerLogo: { fichier: 'admin.ts', permission: 'admin:organisation', roles: ADMIN_SEUL },
  confirmerLogo: { fichier: 'admin.ts', permission: 'admin:organisation', roles: ADMIN_SEUL },
  retirerLogo: { fichier: 'admin.ts', permission: 'admin:organisation', roles: ADMIN_SEUL },
}

/* ══════════════════════════════════════════════════════════════════
   Lecture du source
   ══════════════════════════════════════════════════════════════════ */

type ActionLue = {
  nom: string
  fichier: string
  fabrique: string
  permission: string
  libelle: string | null
  sensible: boolean
  entrepriseDe: boolean
}

/** Le corps d'une définition s'arrête au premier `})` en début de ligne. */
const DEFINITION =
  /export\s+const\s+(\w+)\s*=\s*(createActionCloisonnee|createAction)\(\{([\s\S]*?)\n\}\)/g

function lireActions(): ActionLue[] {
  const lues: ActionLue[] = []

  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    for (const [, nom, fabrique, corps] of source.matchAll(DEFINITION)) {
      lues.push({
        nom: nom as string,
        fichier,
        fabrique: fabrique as string,
        permission: /permission:\s*'([^']+)'/.exec(corps as string)?.[1] ?? '',
        libelle: /\n\s*action:\s*'([^']+)'/.exec(corps as string)?.[1] ?? null,
        sensible: /\n\s*sensible:\s*true/.test(corps as string),
        entrepriseDe: /\n\s*entrepriseDe:/.test(corps as string),
      })
    }
  }

  return lues.sort((a, b) => a.nom.localeCompare(b.nom))
}

const ACTIONS = lireActions()
const PAR_NOM = new Map(ACTIONS.map((a) => [a.nom, a]))

describe('Le source est réellement lu', () => {
  it('chaque appel à une fabrique donne une action extraite', () => {
    /**
     * Si la découpe des blocs échouait, la table ci-dessous comparerait le vide
     * au vide et tout serait vert. On compte donc les appels aux fabriques dans
     * les fichiers bruts et on exige le même nombre.
     */
    let appels = 0
    for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(DOSSIER, fichier), 'utf8')
      appels += [...source.matchAll(/export\s+const\s+\w+\s*=\s*createAction(?:Cloisonnee)?\(/g)]
        .length
    }
    expect(ACTIONS).toHaveLength(appels)
    expect(ACTIONS.length).toBeGreaterThan(30)
  })

  it('chaque action extraite déclare une permission et un libellé de journal', () => {
    for (const a of ACTIONS) {
      expect(a.permission, `${a.fichier} : ${a.nom} sans permission`).not.toBe('')
      expect(a.libelle, `${a.fichier} : ${a.nom} sans libellé de journal`).not.toBeNull()
    }
  })
})

describe('La table et le code se recouvrent exactement', () => {
  it('aucune action du code n’échappe à la table', () => {
    // Une action ajoutée sans décision de permission tombe ici.
    const inconnues = ACTIONS.filter((a) => !(a.nom in ATTENDU)).map((a) => `${a.fichier}:${a.nom}`)
    expect(inconnues, `Actions non couvertes — ${inconnues.join(', ')}`).toEqual([])
  })

  it('aucune entrée de la table ne désigne une action disparue', () => {
    const fantomes = Object.keys(ATTENDU).filter((nom) => !PAR_NOM.has(nom))
    expect(fantomes, `Entrées sans action correspondante — ${fantomes.join(', ')}`).toEqual([])
  })

  it('chaque permission attendue existe dans la matrice', () => {
    for (const [nom, attendu] of Object.entries(ATTENDU)) {
      expect(PERMISSIONS, nom).toContain(attendu.permission)
    }
  })
})

describe('Chaque action exige la permission prévue', () => {
  for (const [nom, attendu] of Object.entries(ATTENDU)) {
    describe(nom, () => {
      it(`est déclarée dans lib/actions/${attendu.fichier}`, () => {
        expect(PAR_NOM.get(nom)?.fichier).toBe(attendu.fichier)
      })

      it(`exige ${attendu.permission}`, () => {
        expect(PAR_NOM.get(nom)?.permission).toBe(attendu.permission)
      })

      /**
       * Le contrôle qui compte : de la permission déclarée dans le code, on
       * déduit qui peut appeler l'action. Une permission trop large OU une
       * matrice élargie font tomber la même assertion.
       */
      for (const role of ROLES) {
        const autorise = attendu.roles.includes(role)
        it(`${autorise ? 'accessible à' : 'refusée à'} ${role}`, () => {
          const declaree = PAR_NOM.get(nom)?.permission as Permission
          expect(aPermission(role, declaree)).toBe(autorise)
        })
      }
    })
  }
})

describe('Gestes surveillés au journal', () => {
  it.each(Object.entries(ATTENDU).filter(([, a]) => a.sensible))(
    '%s est marquée sensible',
    (nom) => {
      expect(PAR_NOM.get(nom)?.sensible).toBe(true)
    },
  )

  it('aucune action n’est marquée sensible à l’insu de la table', () => {
    // La symétrie évite qu'une marque disparaisse sans que personne le décide.
    const surprises = ACTIONS.filter((a) => a.sensible && !ATTENDU[a.nom]?.sensible).map(
      (a) => a.nom,
    )
    expect(surprises, `Marquées sensibles hors table — ${surprises.join(', ')}`).toEqual([])
  })
})

describe('Invariants que la table ne peut pas relâcher', () => {
  /**
   * Ces deux contrôles ne dépendent pas de la table : ils tiendraient même si
   * quelqu'un « corrigeait » celle-ci pour faire passer le vert.
   */
  it('aucune mutation n’est protégée par une permission de lecture', () => {
    const fautives = ACTIONS.filter((a) => a.permission.endsWith(':lire')).map(
      (a) => `${a.fichier}:${a.nom} → ${a.permission}`,
    )
    expect(
      fautives,
      `Une action mute des données : elle ne peut pas se contenter d'une permission de lecture — ${fautives.join(', ')}`,
    ).toEqual([])
  })

  /**
   * Écarts connus, inscrits pour qu'ils restent visibles. La liste est exacte des
   * deux côtés : en réparer un fait tomber ce test, qui demande alors de retirer
   * l'entrée. C'est le prix pour qu'une dérogation ne s'installe pas en silence.
   */
  const DESTRUCTIONS_NON_SENSIBLES: string[] = [
    // Vide, et c'est le but. `supprimerCategorie` y figurait : elle effaçait la
    // catégorie pour de bon, contre TR-9, et n'apparaissait pas au filtre
    // « actions sensibles ». La catégorie porte maintenant `deletedAt` et
    // l'action est marquée — l'entrée est donc retirée, comme prévu.
  ]

  it('toute action dont le nom annonce une destruction est sensible', () => {
    const destructrices = ACTIONS.filter((a) =>
      /^(supprimer|purger|cloturer|suspendre)/.test(a.nom),
    )
    expect(
      destructrices.length,
      'Aucune action destructrice repérée — le nommage a-t-il changé ?',
    ).toBeGreaterThan(0)

    const oubliees = destructrices.filter((a) => !a.sensible).map((a) => a.nom)
    expect(
      oubliees,
      'Destructions non marquées sensibles. Marquez-la, ou inscrivez-la dans DESTRUCTIONS_NON_SENSIBLES avec sa raison.',
    ).toEqual(DESTRUCTIONS_NON_SENSIBLES)
  })

  it('toute action cloisonnée déclare d’où vient son entreprise', () => {
    const muettes = ACTIONS.filter(
      (a) => a.fabrique === 'createActionCloisonnee' && !a.entrepriseDe,
    ).map((a) => `${a.fichier}:${a.nom}`)
    expect(muettes, `Actions cloisonnées sans entrepriseDe — ${muettes.join(', ')}`).toEqual([])
  })

  it('aucune action cloisonnée ne vit hors d’un module cloisonné', () => {
    // Le cloisonnement porte sur le CRM, le calculateur et les grilles de tarifs.
    const MODULES_CLOISONNES = new Set(['crm', 'calculateur', 'admin'])
    const egarees = ACTIONS.filter(
      (a) =>
        a.fabrique === 'createActionCloisonnee' &&
        !MODULES_CLOISONNES.has(a.permission.split(':')[0] as string),
    ).map((a) => `${a.nom} → ${a.permission}`)
    expect(egarees, `Cloisonnement sur un module qui n'en a pas — ${egarees.join(', ')}`).toEqual(
      [],
    )
  })
})

describe('Le test peut échouer', () => {
  it('détecte une action protégée par une permission de lecture', () => {
    const faux = `export const supprimerTout = createAction({
  permission: 'cv:lire',
  schema: s,
  action: 'Suppression',
  handler,
})`
    const lue = [...faux.matchAll(DEFINITION)].map((m) => ({
      nom: m[1],
      permission: /permission:\s*'([^']+)'/.exec(m[3] as string)?.[1],
    }))
    expect(lue).toEqual([{ nom: 'supprimerTout', permission: 'cv:lire' }])
    expect(lue[0]?.permission?.endsWith(':lire')).toBe(true)
  })

  it('détecte une action qui ouvrirait un module à un rôle qui n’y a pas droit', () => {
    // Si `supprimerFichier` était déclarée `cv:televerser`, la recruteuse pourrait
    // l'appeler. L'assertion générée plus haut est exactement celle-ci.
    expect(aPermission('recrutement', 'cv:televerser')).toBe(true)
    expect(aPermission('recrutement', 'cv:supprimer')).toBe(false)
  })

  it('lit bien les marques de sensibilité', () => {
    expect(PAR_NOM.get('supprimerFichier')?.sensible).toBe(true)
    expect(PAR_NOM.get('creerEmploye')?.sensible).toBe(false)
  })
})
