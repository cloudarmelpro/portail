import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Mise en page du calculateur — la bande de tête, les deux commutateurs, la
 * colonne de contenu et les écrans d'attente.
 *
 * Les sources sont LUES plutôt qu'exécutées : le layout tire les gardes, qui
 * tirent Prisma et Better Auth — les importer ici échouerait au chargement. Les
 * autres tests de mise en page du projet procèdent de même.
 */
const lire = (chemin: string) =>
  readFileSync(join(process.cwd(), chemin.split('/').join(sep)), 'utf8')

const SHELL = lire('src/components/layout/shell.tsx')
const LAYOUT = lire('src/app/(app)/calculateur/[entreprise]/layout.tsx')
const ONGLETS = lire('src/components/calculateur/entete-module.tsx')
const CALCULETTE = lire('src/components/calculateur/calculette.tsx')
const TABLEAU = lire('src/components/calculateur/tableau-estimations.tsx')
const DOCUMENT = lire('src/components/calculateur/document-estimation.tsx')
const ACTIONS = lire('src/components/calculateur/actions-estimation.tsx')

const PAGE_RACINE = lire('src/app/(app)/calculateur/page.tsx')
const PAGE_CALCUL = lire('src/app/(app)/calculateur/[entreprise]/page.tsx')
const PAGE_LISTE = lire('src/app/(app)/calculateur/[entreprise]/estimations/page.tsx')
const PAGE_DOCUMENT = lire('src/app/(app)/calculateur/[entreprise]/estimations/[id]/page.tsx')

/** Les trois écrans qui partagent la colonne de contenu. */
const ECRANS_CADRES = [
  'src/app/(app)/calculateur/[entreprise]/page.tsx',
  'src/app/(app)/calculateur/[entreprise]/estimations/page.tsx',
  'src/app/(app)/calculateur/[entreprise]/estimations/[id]/page.tsx',
]

const CHARGEMENTS = [
  'src/app/(app)/calculateur/loading.tsx',
  'src/app/(app)/calculateur/[entreprise]/loading.tsx',
  'src/app/(app)/calculateur/[entreprise]/estimations/loading.tsx',
]

/** Habillage de l'élément courant, commun aux deux niveaux — et aux autres modules. */
const COURANT = 'border-border bg-raised text-ink border font-medium'
/** Le filet transparent garde aux inactifs la hauteur et l'axe de l'actif. */
const INACTIF = 'text-ink2 hover:text-ink border border-transparent'

/** Tous les fichiers du module — composants et écrans. */
function fichiersDuModule(): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(process.cwd(), dossier.split('/').join(sep)), {
      withFileTypes: true,
    })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.tsx') || chemin.endsWith('.ts')) sortie.push(chemin)
    }
  }

  parcourir('src/components/calculateur')
  parcourir('src/app/(app)/calculateur')
  return sortie
}

describe('La bande de tête traverse le panneau', () => {
  it('vit dans le layout, donc identique aux écrans du dossier', () => {
    expect(LAYOUT).toContain('BANDE_PLEINE')
    expect(LAYOUT).toContain('<OngletsCalculateur')
  })

  it('remonte au bord du contenu et pose son filet en bas', () => {
    /*
      La bande annule le rembourrage HAUT de `main`, déclaré dans
      `components/layout/shell.tsx`. Rien à la lecture ne relie les deux fichiers :
      sans ce contrôle, une retouche du rembourrage détache la bande du haut du
      panneau, ou la fait déborder par-dessus.
    */
    const principal = SHELL.slice(SHELL.indexOf('<main'), SHELL.indexOf('{children}'))
    const haut = principal.match(/\bpt-([\d.]+)\b/)
    expect(haut, 'le rembourrage haut de `main`').not.toBeNull()
    expect(LAYOUT).toContain(`-mt-${haut?.[1]}`)
    expect(LAYOUT).toContain('border-b')
  })

  it('ne porte aucun titre : il change d’un écran à l’autre', () => {
    expect(LAYOUT).not.toContain('<h1')
  })

  it('valide le slug avant d’en faire quoi que ce soit', () => {
    expect(LAYOUT.indexOf('requireModule(')).toBeLessThan(LAYOUT.indexOf('requireEntreprise('))
    expect(LAYOUT.indexOf('requireEntreprise(')).toBeLessThan(LAYOUT.indexOf('actif={slug}'))
  })

  it('chaque écran revalide le slug pour son compte', () => {
    // Un layout ne protège pas ce qui est rendu en dessous s'il est contourné.
    for (const chemin of ECRANS_CADRES) {
      const source = lire(chemin)
      expect(source.indexOf('requireEntreprise('), chemin).toBeLessThan(
        source.indexOf('prismaCadre('),
      )
    }
  })
})

describe('Les deux niveaux suivent la même règle de commutateur', () => {
  it('l’élément courant est un pavé, les autres sont du texte', () => {
    const courants = ONGLETS.match(new RegExp(COURANT, 'g')) ?? []
    const inactifs = ONGLETS.match(new RegExp(INACTIF, 'g')) ?? []

    // Un habillage par niveau : le dossier d'entreprise, puis la vue.
    expect(courants).toHaveLength(2)
    expect(inactifs).toHaveLength(2)
  })

  it('n’enferme pas le groupe dans un rail ni la vue dans un onglet souligné', () => {
    expect(ONGLETS).not.toContain('border-b-2')
    expect(ONGLETS).not.toContain('-mb-px')
    expect(ONGLETS).not.toContain('bg-hover2')
    expect(ONGLETS).toContain('rounded-[9px] px-3')
    expect(ONGLETS).toContain('rounded-[8px] px-3')
  })

  it('ne fait flotter aucun des deux au-dessus de la bande', () => {
    expect(ONGLETS).not.toContain('shadow')
  })

  it('déclare l’élément courant aux technologies d’assistance', () => {
    const marques = ONGLETS.match(/aria-current=/g) ?? []
    expect(marques).toHaveLength(2)
  })

  it('nomme chaque niveau', () => {
    expect(ONGLETS).toContain('aria-label="Entreprise"')
    expect(ONGLETS).toContain('aria-label="Vue"')
  })

  it('la vue est passée en propriété, jamais déduite de l’adresse', () => {
    /*
      Chaque page SAIT quelle vue elle est. La déduire de `usePathname` ouvrirait
      un écart entre ce que l'URL dit et ce que l'écran affiche — et rendrait le
      commutateur client là où il n'a pas besoin de l'être.
    */
    expect(PAGE_CALCUL).toContain('<OngletsVue slug={slug} vue="nouvelle" />')
    expect(PAGE_LISTE).toContain('<OngletsVue slug={slug} vue="liste" />')
  })
})

describe('La pastille d’entreprise', () => {
  it('reste sur les trois, active ou non, avec le nom écrit à côté', () => {
    const bande = ONGLETS.slice(
      ONGLETS.indexOf('aria-label="Entreprise"'),
      ONGLETS.indexOf('</nav>'),
    )
    expect(bande).toContain('size-2 shrink-0 rounded-full')
    expect(bande).toContain('{e.nom}')
    // Une seule pastille rendue, sans condition : c'est un repère d'identité,
    // pas un état.
    expect(bande).not.toMatch(/courant\s*(\?|&&)[^\n]*size-2/)
  })

  it('la rangée de choix d’entreprise porte la couleur en pastille', () => {
    /*
      Filet de 3 px ou pastille de 8 px : la section 19 autorise les deux. Une
      rangée n'a pas de flanc où poser un filet — c'est donc la pastille, avec
      le nom écrit juste à côté, qui porte seul l'information.
    */
    expect(PAGE_RACINE).toContain('size-2 shrink-0 rounded-full')
    expect(PAGE_RACINE).toContain('principal={e.nom}')
  })

  it('aucune teinte d’entreprise ne peint un texte ni une surface', () => {
    for (const chemin of fichiersDuModule()) {
      // Le document imprimé pose un filet de 3 px : c'est un fond, pas un texte.
      const sansFond = lire(chemin).replaceAll('backgroundColor', '')
      expect(sansFond, chemin).not.toContain('olor: `var(${')
    }
  })
})

describe('Changer de dossier conserve la vue', () => {
  it('reconduit la liste, jamais l’estimation ouverte', () => {
    // Un identifiant d'estimation n'a aucun sens dans une autre entreprise, et
    // l'y transporter produirait l'écran que le cloisonnement doit empêcher.
    expect(ONGLETS).toContain(
      "const vue = chemin.startsWith(`/calculateur/${actif}/estimations`) ? '/estimations' : ''",
    )
    expect(ONGLETS).toContain('href={`/calculateur/${e.slug}${vue}`}')
    expect(ONGLETS).not.toContain('chemin.replace')
  })
})

describe('Une seule colonne de contenu pour les trois écrans', () => {
  it('elle est écrite une fois et importée par chacun', () => {
    /*
      Le commutateur de vue vit dans cette colonne : deux écrans qui ne la
      mesureraient pas pareil feraient sauter les onglets au moment précis où
      l'on passe de l'un à l'autre. La mesure est donc portée par un seul
      fichier — rien à la lecture ne relierait trois chaînes identiques.
    */
    for (const chemin of ECRANS_CADRES) {
      const source = lire(chemin)
      expect(source, chemin).toContain(
        "import { COLONNE_CONTENU } from '@/components/calculateur/mise-en-page'",
      )
      expect(source, chemin).not.toMatch(/\bmx-24\b/)
    }
  })

  it('le retrait latéral ne commence qu’au-delà de la disposition à deux colonnes', () => {
    /*
      À 1280 px, la calculette pose déjà la saisie et le total côte à côte : les
      192 px de marges du CRM y prendraient la moitié du sélecteur de service.
      Les deux valeurs sont liées et vivent dans deux fichiers.
    */
    expect(lire('src/components/calculateur/mise-en-page.ts')).toContain('2xl:mx-24')
    expect(CALCULETTE).toContain('xl:grid-cols-[minmax(0,1fr)_340px]')
  })

  it('le titre reste dans le document même quand il ne s’affiche pas', () => {
    // Une page sans `h1` ne se parcourt pas par les titres, premier moyen de
    // navigation d'un lecteur d'écran.
    expect(PAGE_CALCUL).toContain('<h1 className="sr-only">Nouvelle estimation</h1>')
    expect(PAGE_LISTE).toContain('<h1 className="sr-only">Estimations</h1>')
    // Le document, lui, porte son numéro : il ne se lit nulle part ailleurs.
    expect(PAGE_DOCUMENT).toContain('{estimation.reference}')
  })
})

describe('Les écrans d’attente ne sont plus des squelettes', () => {
  it('chaque `loading.tsx` ne rend que la barre de chargement', () => {
    /*
      Un squelette promet une forme : autant de lignes, autant de colonnes. Quand
      le contenu arrive et ne correspond pas, la page saute. Ils ont tous été
      remplacés par le trait du haut — et un `loading.tsx` qui redessinerait la
      bande du layout la doublerait, puisqu'il s'affiche À L'INTÉRIEUR de lui.
    */
    for (const chemin of CHARGEMENTS) {
      const source = lire(chemin)
      expect(source, chemin).toContain('<BarreChargement />')
      expect(source, chemin).not.toContain('Squelette')
      expect(source, chemin).not.toContain('Bloc')
      expect(source, chemin).not.toContain('OngletsCalculateur')
    }
  })
})

describe('Aucun contrôle natif dans le module', () => {
  it('ni liste déroulante du système, ni champ de date du système', () => {
    /*
      Un `<select>` natif porte le style de Windows ou de macOS ; un
      `<input type="date">` y affiche `mm/dd/yyyy`, l'ordre AMÉRICAIN, sur un
      produit québécois.
    */
    for (const chemin of fichiersDuModule()) {
      const source = lire(chemin)
      expect(source, chemin).not.toContain('<select')
      expect(source, chemin).not.toContain('type="date"')
    }
  })

  it('le service se choisit par le contrôle dessiné du produit, en gabarit de champ', () => {
    expect(CALCULETTE).toContain("import { Choix } from '@/components/shared/choix'")
    expect(CALCULETTE).toContain('parDefaut="Choisir un service…"')
    expect(CALCULETTE).toContain('champ')
  })

  it('le premier sélecteur prend le focus à l’ouverture', () => {
    /*
      EST-1 — on calcule en parlant au téléphone. `autoFocus` ne peut plus le
      faire : la cible de focus est le déclencheur d'un menu dessiné, et c'est
      l'effet qui le place, comme après l'ajout d'une ligne.
    */
    expect(CALCULETTE).toContain('const aFocaliser = useRef<number | null>(0)')
    expect(CALCULETTE).toContain('document.getElementById(`calculateur-service-${')
  })
})

describe('Un seul bouton noir par écran', () => {
  it('la calculette n’en garde qu’un : celui qui enregistre', () => {
    const boutons = CALCULETTE.match(/<Bouton\b/g) ?? []
    const secondaires = CALCULETTE.match(/variante="secondaire"/g) ?? []
    expect(boutons).toHaveLength(2)
    expect(secondaires).toHaveLength(1)
    expect(CALCULETTE).toContain('Enregistrer au dossier client')
  })

  it('le document n’en pose AUCUN', () => {
    /*
      La section 19 range « Exporter en PDF » parmi les boutons à filet, et le
      seul bouton principal du module est « Enregistrer au dossier client », qui
      n'est pas sur cet écran. Un écran sans bouton noir est normal : celui-ci ne
      fait que montrer un document déjà écrit.

      `classesBouton()` sans argument est la variante principale.
    */
    expect(ACTIONS).not.toMatch(/classesBouton\(\)/)
    expect(ACTIONS).toContain('Exporter en PDF')
  })

  it('la liste n’en pose aucun : son seul geste noir est celui de l’état vide', () => {
    expect(PAGE_LISTE).toContain("classesBouton({ variante: 'secondaire' })")
    expect(PAGE_LISTE).not.toMatch(/classesBouton\(\)/)
  })
})

describe('Les montants se lisent en colonne', () => {
  it('chaque colonne de chiffres du tableau est déclarée comme telle', () => {
    // `chiffres` pose la chasse tabulaire et interdit le retour à la ligne.
    const cellules = TABLEAU.match(/chiffres/g) ?? []
    // Numéro, date, montant, validité — et la carte du téléphone.
    expect(cellules.length).toBeGreaterThanOrEqual(4)
  })

  it('le total en direct garde des chiffres proportionnels', () => {
    /*
      Section 19 : les grands nombres ISOLÉS gardent les chiffres
      proportionnels ; la chasse tabulaire est faite pour les colonnes. Le total
      de la calculette est le seul nombre de 30 px du module.
    */
    const bloc = CALCULETTE.slice(CALCULETTE.indexOf('Grand nombre isolé'))
    expect(bloc.slice(0, 300)).toContain('text-[30px]')
    expect(bloc.slice(0, 300)).not.toContain('tabular-nums')
  })

  it('les ajustements se saisissent en chiffres tabulaires', () => {
    // Quatre champs alignés à droite : sans chasse fixe, les décimales dansent.
    const champ = CALCULETTE.slice(CALCULETTE.indexOf('const CHAMP ='))
    expect(champ.slice(0, 260)).toContain('tabular-nums')
  })
})

describe('L’écran et le document disent la même chose', () => {
  it('la ventilation porte les mêmes libellés des deux côtés', () => {
    /*
      Le récapitulatif en direct et le devis remis au client sont écrits dans
      deux fichiers, et le second part chez le client. « Sous-total » d'un côté
      et « Total partiel » de l'autre ne se verrait qu'une fois le devis parti.
    */
    for (const libelle of ['Sous-total', 'Frais de déplacement', 'Rabais']) {
      expect(CALCULETTE, libelle).toContain(`libelle="${libelle}"`)
      expect(DOCUMENT, libelle).toContain(`libelle="${libelle}"`)
    }

    // Le total est le seul à ne pas passer par la ligne de ventilation : il est
    // écrit en clair des deux côtés.
    expect(CALCULETTE).toContain('font-semibold">Total</span>')
    expect(DOCUMENT).toContain('font-semibold">Total</span>')
  })

  it('les deux taux s’écrivent avec le même formateur', () => {
    for (const source of [CALCULETTE, DOCUMENT]) {
      expect(source).toContain('TPS (${formaterPourcentage(')
      expect(source).toContain('TVQ (${formaterPourcentage(')
    }
  })
})

describe('Le compteur d’estimations n’est écrit qu’une fois', () => {
  it('les deux écrans qui le rendent lisent la même fonction', () => {
    // Deux copies auraient fini par décliner le zéro d'un côté seulement.
    for (const source of [PAGE_RACINE, PAGE_LISTE]) {
      expect(source).toContain(
        "import { compteEstimations } from '@/components/calculateur/format'",
      )
    }
  })

  it('il décline le zéro et le singulier', () => {
    const FORMAT = lire('src/components/calculateur/format.ts')
    expect(FORMAT).toContain("return 'Aucune estimation'")
    expect(FORMAT).toContain("'1 estimation'")
    expect(FORMAT).toContain('${n} estimations')
  })
})

describe('L’état vide de la liste suit la section 19', () => {
  it('un titre sans point final, puis un message qui dit quoi faire', () => {
    expect(PAGE_LISTE).toContain('titre="Aucune estimation enregistrée"')
    expect(PAGE_LISTE).toContain('Calculez une estimation, puis enregistrez-la au dossier d’un')
    expect(PAGE_LISTE).toContain('Retirez le filtre ou créez une nouvelle estimation.')
  })

  it('le filtre actif s’annonce avec une icône ET un mot, et se retire', () => {
    expect(PAGE_LISTE).toContain('Estimations expirant sous 7 jours')
    expect(PAGE_LISTE).toContain('aria-label="Retirer le filtre"')
    // La couleur ne va qu'à l'icône : `--serious` mesure 2,55:1 sur --surface.
    expect(PAGE_LISTE).toContain('text-serious-texte size-3.5')
  })
})

describe('Le choix d’entreprise reprend le gabarit du CRM', () => {
  it('des rangées en creux, et non trois cartes', () => {
    /*
      Les cartes portaient chacune un pavé d'illustration de 218 px pour dire
      une seule chose : le nom du dossier. Beaucoup de hauteur pour un choix
      entre trois valeurs connues — et le troisième passait sous la ligne de
      flottaison sur un portable.
    */
    expect(PAGE_RACINE).toContain('<ListeCreux titre="Dossiers">')
    expect(PAGE_RACINE).toContain('<RangeeCreux')
    expect(PAGE_RACINE).not.toContain('h-[218px]')
  })

  it('ce qui périme passe avant où aller', () => {
    // La réponse à « quel dossier » dépend souvent de ce qui presse.
    expect(PAGE_RACINE).toContain('const panneaux = [expirantes, recentes]')
    expect(PAGE_RACINE.indexOf('<PanneauDonnees')).toBeLessThan(
      PAGE_RACINE.indexOf('<ListeCreux titre="Dossiers">'),
    )
  })

  it('les panneaux additionnent trois lectures cadrées', () => {
    /*
      Il n'existe volontairement aucune requête « tous dossiers confondus » dans
      ce module. Les deux panneaux n'y dérogent pas : ils passent par le volet
      partagé, qui lit dossier par dossier avec le client cadé.
    */
    const DONNEES = lire('src/lib/data/accueil.ts')
    for (const fonction of ['dernieresEstimations', 'estimationsExpirantes']) {
      const bloc = DONNEES.slice(DONNEES.indexOf(`export async function ${fonction}`))
      expect(bloc.slice(0, 900), fonction).toContain('surLesTroisDossiers')
      expect(bloc.slice(0, 900), fonction).not.toMatch(/\bprisma\.[a-z]/)
    }
  })
})
