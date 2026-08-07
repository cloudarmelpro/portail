import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  changerRoleSchema,
  enregistrerGrilleSchema,
  filtresJournalSchema,
  inviterUtilisateurSchema,
  parametresPaieSchema,
  prixSchema,
  suspendreCompteSchema,
} from '@/lib/validations/admin'

/**
 * Module d'administration — ADM-1 à ADM-4.
 *
 * Deux volets. Le premier exécute les schémas, qui sont du code pur. Le second
 * lit les sources : `lib/data/` est marqué `server-only` et `lib/actions/` tire
 * Prisma et Better Auth — les importer ici échouerait au chargement. Les autres
 * tests de garde du projet procèdent de la même façon.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const ACTIONS = lire('src/lib/actions/admin.ts')
const DATA = lire('src/lib/data/admin.ts')
const EXPORT_CSV = lire('src/app/(app)/admin/journal/export/route.ts')

describe('Saisie des prix — TR-8', () => {
  it('accepte la virgule décimale et les espaces de milliers', () => {
    expect(prixSchema.parse('11,75')).toBe('11.75')
    expect(prixSchema.parse('1 234,50')).toBe('1234.50')
    expect(prixSchema.parse('12')).toBe('12')
  })

  it('refuse au-delà de deux décimales', () => {
    expect(prixSchema.safeParse('12,345').success).toBe(false)
  })

  it('refuse ce qui n’est pas un montant', () => {
    for (const valeur of ['', 'gratuit', '-4', '1.2.3']) {
      expect(prixSchema.safeParse(valeur).success, valeur).toBe(false)
    }
  })

  it('reste une chaîne de bout en bout', () => {
    // Un passage par `number` perdrait le cent que `Decimal` existe pour garder.
    expect(typeof prixSchema.parse('11,75')).toBe('string')
  })
})

describe('Comptes — ADM-1', () => {
  it('ramène le courriel en minuscules', () => {
    expect(
      inviterUtilisateurSchema.parse({
        nom: 'Camille Roy',
        courriel: '  Camille.ROY@Exemple.CA ',
        role: 'heures',
      }).courriel,
    ).toBe('camille.roy@exemple.ca')

    expect(changerRoleSchema.parse({ courriel: 'A@B.CA', role: 'admin' }).courriel).toBe('a@b.ca')
  })

  it('refuse un rôle inconnu de la matrice', () => {
    expect(changerRoleSchema.safeParse({ courriel: 'a@b.ca', role: 'super' }).success).toBe(false)
  })

  it('exige un motif de suspension', () => {
    expect(suspendreCompteSchema.safeParse({ courriel: 'a@b.ca', motif: ' ' }).success).toBe(false)
    expect(suspendreCompteSchema.safeParse({ courriel: 'a@b.ca', motif: 'Départ' }).success).toBe(
      true,
    )
  })
})

describe('Grilles de tarifs — ADM-2 et ADM-3', () => {
  const produit = { nom: 'Pavé uni', unite: 'm²', prixUnitaire: '12,50', actif: true }

  it('n’accepte que les trois entreprises connues', () => {
    expect(
      enregistrerGrilleSchema.safeParse({
        entreprise: 'paysagement',
        produits: [produit],
        depuisNumero: 0,
      }).success,
    ).toBe(true)

    expect(
      enregistrerGrilleSchema.safeParse({
        entreprise: 'concurrent',
        produits: [produit],
        depuisNumero: 0,
      }).success,
    ).toBe(false)
  })

  it('exige le numéro de la version éditée', () => {
    // Sans lui, deux onglets publieraient chacun par-dessus l'autre.
    expect(
      enregistrerGrilleSchema.safeParse({ entreprise: 'paysagement', produits: [produit] }).success,
    ).toBe(false)
  })

  it('passe par la fabrique cloisonnée', () => {
    expect(ACTIONS).toMatch(/export const enregistrerGrille = createActionCloisonnee\(/)
  })

  it('écrit sous le libellé de la section 19', () => {
    expect(ACTIONS).toContain('Publication d’une grille de tarifs')
  })

  it('reçoit le client cadré, jamais le client global', () => {
    const bloc = DATA.slice(
      DATA.indexOf('export async function publierGrille'),
      DATA.indexOf('export type FiltresJournal'),
    )
    expect(bloc).toContain('db: PrismaCadre')
    expect(bloc).not.toMatch(/\bprisma\.[a-z]/)
  })

  it('ne modifie jamais une grille en place', () => {
    // Une nouvelle version est créée ; l'ancienne est seulement désactivée.
    expect(DATA).toMatch(/tx\.grilleTarifs\.create\(/)
    expect(DATA).not.toMatch(/grilleTarifs\.update\(\{[\s\S]{0,120}prixUnitaire/)
  })
})

describe('Écarts figés — ADM-3', () => {
  it('la colonne est renseignée à l’enregistrement, jamais recalculée', () => {
    const bloc = DATA.slice(DATA.indexOf('export async function publierGrille'))
    expect(bloc).toContain('const ecarts = calculerEcarts(')
    expect(bloc).toMatch(/data: cadre\(\{[\s\S]{0,200}ecarts,/)
  })

  it('refuse de publier une version sans écart', () => {
    expect(DATA).toContain("if (ecarts.length === 0) return { etat: 'inchangee' }")
  })

  it('la première version porte « Version initiale »', () => {
    expect(DATA).toContain("if (precedents === null) return ['Version initiale']")
  })
})

describe('Un compte n’est jamais supprimé — ADM-1', () => {
  it('aucune action ne supprime un utilisateur', () => {
    // Une suppression ferait disparaître l'auteur des entrées du journal.
    expect(ACTIONS).not.toContain('removeUser')
    expect(ACTIONS).not.toMatch(/user\.delete/)
  })

  it('la suspension et le changement de rôle sont marqués sensibles', () => {
    for (const action of ['suspendreCompte', 'changerRole', 'reactiverCompte']) {
      const bloc = ACTIONS.slice(ACTIONS.indexOf(`export const ${action} =`))
      expect(bloc.slice(0, 600), action).toContain('sensible: true')
    }
  })

  it('refuse à un administrateur de se suspendre lui-même', () => {
    const bloc = ACTIONS.slice(ACTIONS.indexOf('export const suspendreCompte ='))
    expect(bloc).toContain('entree.courriel === session.courriel.toLowerCase()')
    // `ErreurMetier` et non `ErreurAcces` : la permission est acquise, c'est la
    // règle qui refuse. Le message doit atteindre l'écran pour dire quoi faire.
    expect(bloc).toContain('ErreurMetier')
  })

  it('refuse à un administrateur de retirer son propre rôle', () => {
    const bloc = ACTIONS.slice(
      ACTIONS.indexOf('export const changerRole ='),
      ACTIONS.indexOf('export const suspendreCompte ='),
    )
    expect(bloc).toContain('entree.courriel === session.courriel.toLowerCase()')
    expect(bloc).toContain("entree.role !== 'admin'")
  })

  it('refuse de retirer le dernier administrateur actif', () => {
    expect(ACTIONS).toContain('refuserSiDernierAdministrateur')
    expect(DATA).toContain('export async function compterAdministrateursActifs')
  })
})

describe('Journal d’audit — ADM-4', () => {
  it('reste transverse : jamais de client cadré', () => {
    const bloc = DATA.slice(
      DATA.indexOf('export type FiltresJournal'),
      DATA.indexOf('export type ParametresPaieVue'),
    )
    expect(bloc).not.toContain('PrismaCadre')
    expect(bloc).toContain('prisma.auditLog.findMany')
  })

  it('n’écrit rien : la fabrique d’actions alimente le journal', () => {
    expect(DATA).not.toMatch(/auditLog\.(create|update|delete)/)
  })

  it('filtre par utilisateur, module, période et actions sensibles', () => {
    const f = filtresJournalSchema.parse({
      utilisateur: 'usr_1',
      module: 'cv',
      du: '2026-01-01',
      au: '2026-01-31',
      sensible: '1',
      page: '3',
    })
    expect(f).toEqual({
      utilisateur: 'usr_1',
      module: 'cv',
      du: '2026-01-01',
      au: '2026-01-31',
      sensible: true,
      page: 3,
    })
  })

  it('ignore un filtre illisible plutôt que de casser l’écran', () => {
    const f = filtresJournalSchema.parse({ module: 'comptabilite', du: 'hier', page: 'x' })
    expect(f.module).toBeUndefined()
    expect(f.du).toBeUndefined()
    expect(f.page).toBeUndefined()
    expect(f.sensible).toBe(false)
  })
})

describe('Export CSV du journal — ADM-4', () => {
  it('commence par la marque d’ordre des octets', () => {
    // Sans elle, Excel lit le fichier en page de code locale et massacre les accents.
    expect(EXPORT_CSV).toContain("const BOM = '\\u{FEFF}'")
    expect(EXPORT_CSV).toContain('`${BOM}${corps}')
  })

  it('vérifie la permission lui-même', () => {
    // Une route ne traverse aucun layout : la garde d'affichage ne la protège pas.
    expect(EXPORT_CSV).toContain('sessionCourante()')
    expect(EXPORT_CSV).toContain("aPermission(session.role, 'admin:journal')")
  })

  it('neutralise les cellules interprétables comme des formules', () => {
    expect(EXPORT_CSV).toMatch(/\/\^\[=\+\\-@\]\//)
  })
})

describe('Paramètres de paie — HEU-7 et HEU-9', () => {
  it('refuse une majoration inférieure à 1', () => {
    const base = { seuilSupplementaires: '40', joursPeriode: 14, version: 0 }
    expect(parametresPaieSchema.safeParse({ ...base, majoration: '0,5' }).success).toBe(false)
    expect(parametresPaieSchema.safeParse({ ...base, majoration: '1,5' }).success).toBe(true)
  })

  it('refuse un seuil nul', () => {
    expect(
      parametresPaieSchema.safeParse({
        seuilSupplementaires: '0',
        majoration: '1,5',
        joursPeriode: 14,
        version: 0,
      }).success,
    ).toBe(false)
  })

  it('exige la version pour refuser un écrasement silencieux — TR-10', () => {
    expect(
      parametresPaieSchema.safeParse({
        seuilSupplementaires: '40',
        majoration: '1,5',
        joursPeriode: 14,
      }).success,
    ).toBe(false)
  })

  it('est réservé à l’administrateur', () => {
    const bloc = ACTIONS.slice(ACTIONS.indexOf('export const enregistrerParametresDePaie ='))
    expect(bloc).toContain("permission: 'heures:parametres'")
  })
})

describe('Aucun appel Prisma hors de lib/data — invariant n°2', () => {
  const ECRANS = [
    'src/app/(app)/admin/utilisateurs/page.tsx',
    'src/app/(app)/admin/tarifs/page.tsx',
    'src/app/(app)/admin/journal/page.tsx',
    'src/app/(app)/admin/paie/page.tsx',
    'src/app/(app)/admin/journal/export/route.ts',
  ]

  it.each(ECRANS)('%s ne parle pas à Prisma', (chemin) => {
    const source = lire(chemin)
    // `prismaCadre` reste permis : il fabrique le client cadré, il n'interroge rien.
    expect(source).not.toMatch(/\bprisma\.[a-z]/)
  })

  it('lib/data/admin.ts est marqué server-only', () => {
    expect(DATA.trimStart().startsWith("import 'server-only'")).toBe(true)
  })
})

describe('Écran des comptes — mise en page', () => {
  const ENTETE = lire('src/components/admin/en-tete-admin.tsx')
  // `BANDE_PLEINE` a quitté l'administration pour `shared/` : le CRM en a
  // besoin, et rien dans cette classe n'est propre à l'administration.
  const BANDE = lire('src/components/shared/bande-pleine.ts')
  const ONGLETS = lire('src/components/admin/onglets-admin.tsx')
  const SHELL = lire('src/components/layout/shell.tsx')
  const PAGE = lire('src/app/(app)/admin/utilisateurs/page.tsx')

  it('la bande traverse le PANNEAU, pas seulement le contenu', () => {
    /*
      Des marges négatives n'y suffisaient pas : elles annulent le rembourrage
      de `main`, mais `main` est aussi plafonné à 1250 px et centré. Au-delà, il
      restait une gouttière de chaque côté — le filet s'arrêtait à 150 px des
      bords, et la bande flottait au lieu de séparer.

      `100cqw` mesure le panneau ; encore faut-il que le panneau soit déclaré
      conteneur, ce qui se fait dans un AUTRE fichier. Sans lui, l'unité se
      rabat silencieusement sur le plus proche ancêtre conteneur, ou sur rien.
    */
    expect(BANDE).toContain('w-[100cqw]')
    expect(BANDE).toContain('ml-[calc(50%_-_50cqw)]')
    expect(SHELL).toMatch(/@container/)
  })

  it('un seul axe pour le fil d’Ariane, les bandes et le contenu', () => {
    /*
      Deux éléments dans deux fichiers doivent partir de la même verticale : les
      bandes de l'administration et `main`. Ils ont divergé deux fois — d'abord
      de huit pixels, quand un palier a bougé d'un côté seulement ; puis de la
      gouttière entière, quand la bande s'est mise à se mesurer depuis le bord du
      PANNEAU alors que `main` se mesure depuis le sien.

      La bande porte du CHROME : sa place est au bord du panneau, et son
      rembourrage doit valoir celui de `main` palier par palier.
    */
    const principal = SHELL.slice(SHELL.indexOf('<main'), SHELL.indexOf('{children}'))

    for (const palier of ['4', '6', '8'] as const) {
      const variante = palier === '4' ? '' : palier === '6' ? 'md:' : 'xl:'
      const classe = `${variante}px-${palier}`
      expect(BANDE, `bande ${classe}`).toContain(classe)
      expect(principal, `main ${classe}`).toContain(classe)
    }
  })

  it('la bande remonte jusqu’au haut du contenu', () => {
    /*
      La bande doit annuler le rembourrage HAUT de `main`, déclaré dans un autre
      fichier. Rien à la lecture ne relie les deux : sans ce contrôle, une
      retouche du rembourrage détache la bande du haut du panneau, ou la fait
      déborder par-dessus.
    */
    const principal = SHELL.slice(SHELL.indexOf('<main'), SHELL.indexOf('{children}'))
    const haut = principal.match(/\bpt-([\d.]+)\b/)
    expect(haut, 'le rembourrage haut de `main`').not.toBeNull()
    expect(ENTETE).toContain(`-mt-${haut?.[1]}`)

    // Un seul palier : `main` n'en déclare plus qu'un, la bande non plus.
    expect(principal).not.toMatch(/\bmd:py-/)
    expect(ENTETE).not.toContain('md:-mt-')
  })

  it('le titre reste dans le document même s’il ne s’affiche plus', () => {
    /*
      Une page sans `h1` ne se parcourt pas par les titres, et c'est le premier
      moyen de navigation d'un lecteur d'écran. Le contrôle segmenté nomme la
      section à l'œil ; il ne remplace pas un titre de page.
    */
    expect(ENTETE).toMatch(/<h1 className="truncate[^"]*">\{titre\}<\/h1>/)
    expect(ENTETE).toContain('aria-label="Fil d’Ariane"')
  })

  it('la section courante est un bouton, les autres du texte', () => {
    /*
      Ni onglets soulignés, ni cinq segments dans un rail gris : une seule boîte
      à l'écran, celle où l'on est. Le rail donnait cinq boîtes pour une seule
      section courante, et l'œil devait chercher laquelle était surélevée.

      Le filet transparent des inactifs n'est pas décoratif : il leur garde la
      hauteur et l'axe de l'actif, sans quoi les cinq se décalent d'un pixel au
      changement de section.
    */
    expect(ONGLETS).not.toMatch(/border-b-2/)
    expect(ONGLETS).not.toContain('bg-hover inline-flex')
    // Le fond et le filet suffisent : l'ombre faisait flotter la section
    // courante au-dessus de la bande, sur un autre plan que ses voisines.
    expect(ONGLETS).not.toContain('shadow-menu')
    /*
      `border-input` et non `border-border` : ce filet IDENTIFIE l'état actif,
      donc il doit tenir 3:1. Mesuré à 3,18:1 sur le rail en clair et 4,10:1 en
      sombre, contre 1,24 et 1,26 pour le filet décoratif.
    */
    expect(ONGLETS).toContain('border-input bg-raised text-ink border font-medium')
    expect(ONGLETS).toContain('border border-transparent')
    // `aria-current` porte l'état pour qui ne voit ni le fond ni l'ombre.
    expect(ONGLETS).toContain("aria-current={actif ? 'page' : undefined}")
  })

  it('le choix d’entreprise suit la même règle', () => {
    // Trois pilules identiques ne disaient pas laquelle était retenue.
    const CHOIX = lire('src/components/admin/choix-entreprise.tsx')
    expect(CHOIX).toContain('border-border bg-raised text-ink')
    expect(CHOIX).toContain('border border-transparent')
    expect(CHOIX).not.toMatch(/border-border text-ink2/)
    // La pastille reste sur les trois : repère d'identité, pas état.
    expect(CHOIX.match(/backgroundColor: `var\(\$\{e\.jeton\}\)`/g)).toHaveLength(1)
  })

  it('les chiffres portent sur tous les comptes, jamais sur le résultat filtré', () => {
    /*
      Calculés sur `retenus`, ils deviendraient un second résultat de recherche :
      « 1 administrateur » cesserait d'être vrai pendant qu'on cherche quelqu'un
      d'autre.
    */
    const bloc = PAGE.slice(PAGE.indexOf('const chiffres'), PAGE.indexOf('const filtre'))
    expect(bloc).not.toContain('retenus')
    expect(bloc.match(/utilisateurs\.filter/g)?.length).toBe(3)
  })

  it('la recherche ignore les accents', () => {
    // Sans cela, elle échoue précisément sur les noms d'ici : « bedard » doit
    // trouver « Bédard ».
    expect(PAGE).toMatch(/replace\(\/\\p\{Diacritic\}\/gu, ''\)/)
  })

  it('la recherche vit dans l’URL', () => {
    // Une vue filtrée se partage, se met en signet et survit à un rechargement.
    const RECHERCHE = lire('src/components/admin/recherche-utilisateurs.tsx')
    expect(RECHERCHE).toContain('router.replace')
    expect(PAGE).toContain('await searchParams')
  })
})

describe('Écran des comptes — la rangée de filtres', () => {
  const COMPTES = lire('src/app/(app)/admin/utilisateurs/page.tsx')
  const FILTRE = lire('src/components/admin/filtre-suspendus.tsx')
  const RECHERCHE = lire('src/components/admin/recherche-utilisateurs.tsx')
  const INTERRUPTEUR = lire('src/components/shared/interrupteur.tsx')

  it('le champ porte un libellé visible, pas un remplaçant', () => {
    /*
      Le nom du champ vivait en `aria-label` : il n'existait que pour les
      lecteurs d'écran. Le remplaçant, lui, disparaît à la première frappe — et
      il disait ce qu'on peut taper, « Nom ou courriel », pas ce qu'on cherche.
    */
    expect(RECHERCHE).toContain('<label htmlFor="recherche-utilisateur"')
    expect(RECHERCHE).not.toContain('aria-label="Rechercher un utilisateur"')
    expect(RECHERCHE).toContain('placeholder="Nom ou courriel"')
  })

  it('l’interrupteur est allumé par défaut', () => {
    /*
      Un écran d'administration qui cache une partie des comptes sans le dire
      fait croire qu'un compte suspendu n'existe plus. Toute valeur autre que
      `0` — y compris une valeur bricolée à la main — rend la liste complète :
      l'erreur retombe du côté qui montre tout.
    */
    expect(FILTRE).toContain("params.get('suspendus') !== '0'")
    expect(COMPTES).toContain("requete.suspendus !== '0'")
  })

  it('l’état par défaut ne s’écrit pas dans l’adresse', () => {
    // Sans cela, `?suspendus=1` et l'absence de paramètre désigneraient la même
    // vue sous deux adresses — dont une seule reviendrait par un signet.
    expect(FILTRE).toContain("if (valeur) suivants.delete('suspendus')")
  })

  it('la bascule est visible dans ce que montre le tableau', () => {
    // Une commande dont on ne voit pas l'effet quand la liste ne change pas
    // passe pour morte. Le chemin au-dessus du tableau répond à la bascule.
    expect(COMPTES).toContain("{voirSuspendus ? 'tous' : 'actifs'}")
  })

  it('une liste vidée par la bascule se distingue d’une recherche vaine', () => {
    /*
      Deux absences, deux gestes pour en sortir : rallumer l'interrupteur, ou
      écrire autre chose. Un même écran vide pour les deux ferait chercher une
      faute d'orthographe là où il n'y en a pas.
    */
    expect(COMPTES).toContain('const masques = cherches.length - retenus.length')
    expect(COMPTES).toContain('masques > 0 ?')
  })

  it('le libellé de l’interrupteur est cliquable', () => {
    // `<button>` est étiquetable : `htmlFor` suffit, il double la cible de
    // pointage et dispense d'un `aria-label` qui pourrait diverger du mot écrit.
    expect(INTERRUPTEUR).toContain('<label htmlFor={id}')
    // Le commentaire du fichier CITE `aria-label` pour dire pourquoi il n'y en
    // a pas : le scanner tel quel reviendrait à punir sa documentation.
    expect(INTERRUPTEUR.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('aria-label')
  })
})

describe('Les sections passent par le contrôle segmenté de shadcn', () => {
  const ONGLETS_ADMIN = lire('src/components/admin/onglets-admin.tsx')

  it('l’habillage vient du composant, pas d’une copie', () => {
    expect(ONGLETS_ADMIN).toContain("from '@/components/ui/tabs'")
    expect(ONGLETS_ADMIN).toContain('<TabsList')
    expect(ONGLETS_ADMIN).toContain('<TabsTrigger')
  })

  it('ce qu’il porte reste des liens', () => {
    /*
      `render` remplace le `<button>` de la primitive par le `<Link>` de Next.
      Sans lui, chaque section deviendrait un bouton : plus d'adresse à copier,
      plus d'ouverture dans un nouvel onglet, plus de préchargement au survol,
      et le retour arrière ne reviendrait plus à la section précédente.
    */
    expect(ONGLETS_ADMIN).toContain('render={<Link href={o.href}')
  })

  it('le rail est creusé et la pastille active détachée', () => {
    /*
      Le rail vient du variant par défaut de shadcn. Il ne porte que 4 % de
      noir : l'ombre douce que le composant pose sur l'onglet actif n'y détache
      presque rien. La pastille est donc blanche ET filetée — c'est justement
      là qu'il faut voir du premier coup laquelle des cinq sections est ouverte.

      Le rembourrage creuse le rail, sinon la pastille toucherait ses bords et
      le rail passerait pour son propre filet. Le rayon intérieur vaut
      l'extérieur moins ce rembourrage — égaux, l'angle du dedans paraîtrait
      plus dur que celui du dehors à la même courbure.
    */
    expect(ONGLETS_ADMIN).toContain('rounded-[9px] p-0.5')
    expect(ONGLETS_ADMIN).toContain('rounded-[6px]')
    expect(ONGLETS_ADMIN).toContain('border-input bg-raised text-ink border font-medium')
    // Le variant `line` retire le rail : il ne doit plus être demandé.
    expect(ONGLETS_ADMIN).not.toContain('variant="line"')
  })

  it('la hauteur du rail est imposée à celle du variant', () => {
    /*
      shadcn déclare la sienne sous une VARIANTE —
      `group-data-horizontal/tabs:h-8`. Un `h-9` écrit ici a beau venir après,
      il perd : le sélecteur de la variante est plus spécifique. Le rail restait
      à 32 px et la pastille à 24, et toute retouche de hauteur restait sans effet
      — sans rien lever, sans rien souligner. Seule l'importance renverse.
    */
    expect(ONGLETS_ADMIN).toContain('h-10!')
  })

  it('le rail ne montre aucune barre de défilement', () => {
    /*
      Le composant pose le trait du variant souligné en `::after`, à 5 px SOUS
      l'onglet. Dans un rail qui défile, il déborde en hauteur : la barre
      verticale apparaît, elle mange de la largeur, et la barre horizontale
      suit. Deux barres autour de cinq mots.

      `overflow-y-hidden` ferme la même porte par l'autre bout : dès qu'un axe
      vaut `auto`, l'axe `visible` se résout lui aussi en `auto`.
    */
    expect(ONGLETS_ADMIN).toContain('after:hidden')
    expect(ONGLETS_ADMIN).toContain('overflow-x-auto overflow-y-hidden')
  })
})
