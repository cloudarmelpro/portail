import { readFileSync, readdirSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Habillage du suivi des heures — ce que la relecture ne rattrape pas.
 *
 * Les sources sont LUES plutôt qu'exécutées : les pages tirent les gardes, qui
 * tirent Prisma et Better Auth — les importer ici échouerait au chargement. Les
 * autres tests de mise en page du projet procèdent de même.
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const LAYOUT = lire('src/app/(app)/heures/layout.tsx')
const CHARGEMENT = lire('src/app/(app)/heures/loading.tsx')
const ONGLETS = lire('src/components/heures/onglets-heures.tsx')
const SAISIE = lire('src/app/(app)/heures/page.tsx')
const EMPLOYES = lire('src/app/(app)/heures/employes/page.tsx')
const FICHE = lire('src/app/(app)/heures/employes/[id]/page.tsx')
const GRILLE = lire('src/components/heures/grille-heures.tsx')
const FORMULAIRE = lire('src/components/heures/formulaire-employe.tsx')
const DETAIL = lire('src/components/heures/detail-saisies.tsx')
const CORRECTIONS = lire('src/components/heures/historique-corrections.tsx')
const TABLEAU_PARTAGE = lire('src/components/shared/tableau.tsx')

/** Habillage de l'élément courant, commun au CRM et à l'administration. */
const COURANT = 'border-border bg-raised text-ink border font-medium'
/** Le filet transparent garde à l'inactif la hauteur et l'axe de l'actif. */
const INACTIF = 'text-ink2 hover:text-ink border border-transparent'

/** Tous les fichiers du module — écrans et composants. */
function fichiersDu(racine: string): string[] {
  const sortie: string[] = []
  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = posix.join(dossier, entree.name)
      if (entree.isDirectory()) parcourir(chemin)
      else if (/\.tsx?$/.test(entree.name)) sortie.push(chemin)
    }
  }
  parcourir(racine)
  return sortie
}

const MODULE = [...fichiersDu('src/app/(app)/heures'), ...fichiersDu('src/components/heures')]

describe('Le commutateur de vue suit la règle des autres modules', () => {
  it('la vue courante est un bouton, l’autre est du texte', () => {
    expect(ONGLETS).toContain(COURANT)
    expect(ONGLETS).toContain(INACTIF)
  })

  it('ni rail gris derrière le groupe, ni onglet souligné, ni ombre', () => {
    /*
      Le filet de 2 px sous l'onglet actif se lisait comme le bord d'un panneau :
      il promettait un contenu attaché juste en dessous, alors que l'écran change
      entièrement.
    */
    expect(ONGLETS).not.toContain('border-b-2')
    expect(ONGLETS).not.toContain('-mb-px')
    expect(ONGLETS).not.toContain('bg-hover2')
    expect(ONGLETS).not.toContain('shadow')
  })

  it('déclare la vue courante aux technologies d’assistance et nomme le groupe', () => {
    expect(ONGLETS).toContain("aria-current={actif ? 'page' : undefined}")
    expect(ONGLETS).toContain('aria-label="Vue"')
  })

  it('la fiche d’un employé reste sous « Employés »', () => {
    /*
      `/heures` préfixe TOUT le module : un `startsWith` sur lui allumerait les
      deux onglets à la fois sur `/heures/employes/<id>`. C'est l'autre onglet
      qui décide, et la saisie est son complément.
    */
    expect(ONGLETS).toContain("chemin.startsWith('/heures/employes')")
    expect(ONGLETS).not.toContain("chemin.startsWith('/heures/')")
  })
})

describe('Le commutateur de vue vit dans l’en-tête de chaque écran', () => {
  /*
    Il vivait dans une bande pleine largeur, portée par le layout. Elle coûtait
    une rangée et un filet pour deux mots, au-dessus d'un titre qui nommait déjà
    l'écran — et elle mettait le commutateur AVANT le titre dans l'ordre de
    lecture, alors qu'il répond à « et l'autre vue ? », une question qu'on ne se
    pose qu'après avoir vu où l'on est.

    Le prix, assumé : chaque écran le rend lui-même, donc il est redessiné à
    chaque navigation entre les deux vues.
  */
  it('le layout ne porte plus que la garde', () => {
    expect(LAYOUT).not.toContain('BANDE_PLEINE')
    expect(LAYOUT).not.toContain('OngletsHeures')
    expect(LAYOUT).toContain("requireModule('heures')")
  })

  it('les deux écrans le rendent, à droite de leur titre', () => {
    for (const [nom, source] of [
      ['saisie', SAISIE],
      ['employes', EMPLOYES],
    ] as const) {
      expect(source, nom).toContain('<OngletsHeures />')
      expect(source.indexOf('<h1'), nom).toBeLessThan(source.indexOf('<OngletsHeures />'))
    }
  })
})

describe('Chaque écran garde son titre, visible ou non', () => {
  it('les deux listes le montrent — plus aucune bande ne les nomme', () => {
    /*
      Les deux titres étaient en `sr-only` : la bande pleine largeur nommait
      l'écran à leur place. Elle a disparu, et ils redeviennent visibles — comme
      sur l'accueil et l'entrée du CRM, dont ces écrans reprennent l'en-tête.
    */
    const grand = /<h1 className="[^"]*text-\[30px\][^"]*">\s*([^<\s][^<]*?)\s*<\/h1>/

    expect(SAISIE.match(grand)?.[1]).toBe('Suivi des heures')
    expect(EMPLOYES.match(grand)?.[1]).toBe('Employés')

    expect(SAISIE).not.toContain('sr-only">Suivi des heures')
    expect(EMPLOYES).not.toContain('sr-only">Employés')
  })

  it('la fiche montre le sien : le nom de l’employé ne se lit nulle part ailleurs', () => {
    expect(FICHE).toContain('text-[30px] leading-9 font-semibold tracking-[-0.02em]">{employe.nom}')
  })
})

describe('L’attente est une barre, plus un squelette', () => {
  it('`loading.tsx` rend la barre partagée et rien d’autre', () => {
    expect(CHARGEMENT).toContain("from '@/components/shared/barre-chargement'")
    expect(CHARGEMENT).toContain('<BarreChargement />')
    expect(CHARGEMENT).not.toMatch(/Squelette|Bloc\b/)
  })

  it('il ne redessine pas la bande du layout, qui est déjà à l’écran', () => {
    // `loading.tsx` s'affiche À L'INTÉRIEUR du layout de son segment.
    expect(CHARGEMENT).not.toContain('OngletsHeures')
    expect(CHARGEMENT).not.toContain('-mt-5')
  })
})

describe('Aucun contrôle du système ne subsiste', () => {
  it.each(MODULE)('%s n’emploie ni `<select>` ni champ de date natif', (chemin) => {
    const source = lire(chemin)
    /*
      Un `<select>` porte le style du SYSTÈME, et `<input type="date">` affiche
      `mm/dd/yyyy` — l'ordre AMÉRICAIN, imposé par la locale du navigateur. Sur
      un produit québécois, c'est une invitation à lire le 6 août comme un
      8 juin.
    */
    expect(source).not.toMatch(/<select\b/)
    expect(source).not.toMatch(/type="date"/)
  })

  it('le rattachement d’un employé passe par le choix dessiné, sans entrée vide', () => {
    expect(FORMULAIRE).toContain("from '@/components/shared/choix'")
    // Pas d'entrée vide : une fiche est toujours rattachée à l'une des trois.
    expect(FORMULAIRE).not.toMatch(/parDefaut=/)
    expect(FORMULAIRE).toMatch(/\n\s+champ\n/)
  })

  it('la valeur choisie est tenue en état, jamais déposée dans `FormData`', () => {
    // Le déclencheur du choix n'est pas un champ de formulaire : `new FormData`
    // ne le verrait pas, et l'entreprise partirait vide.
    expect(FORMULAIRE).toContain('onChoisir={(v) => setEntrepriseSlug(')
    expect(FORMULAIRE).not.toContain('new FormData')
  })
})

describe('Le gabarit de champ vient du fichier partagé', () => {
  it('plus aucune copie locale', () => {
    /*
      La mesure a vécu recopiée dans six fichiers. Elles ont divergé une fois —
      `h-10` d'un côté, `h-11` de l'autre — et l'écart ne se voyait qu'en ouvrant
      les deux dialogues à la suite.
    */
    expect(FORMULAIRE).toContain("from '@/components/shared/gabarits'")
    expect(FORMULAIRE).not.toMatch(/const CHAMP =/)
  })
})

describe('La grille bat la mesure du tableau du produit', () => {
  it('la grille est un CALENDRIER : des cases carrées, fermées', () => {
    /*
      Elle n'avait que des filets horizontaux — sept colonnes de chiffres sans
      séparation verticale, où l'œil devait suivre une ligne imaginaire pour
      rester dans le bon jour.

      88 px de côté : la largeur de la colonne. C'est ce qui la fait lire comme
      un calendrier plutôt que comme un tableau de nombres.
    */
    expect((GRILLE.match(/\bh-22\b/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(GRILLE).toContain('w-22')
    expect((GRILLE.match(/\bborder-r\b/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })

  it('le pied est plus bas que les cases, mais plus haut qu’une ligne', () => {
    /*
      Il ne porte aucune saisie : rien n'y justifie une case de 88 px, et trois
      rangées de cette hauteur feraient perdre les totaux de vue. Mais 44 px
      sous des cases de 88 le faisaient paraître écrasé — 56 px et un corps de
      15 le remettent au rythme de la grille.
    */
    expect((GRILLE.match(/\bh-14\b/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(GRILLE).toContain('Total de l’équipe')
  })

  it('l’en-tête porte le quantième en grand, pas un libellé de treize pixels', () => {
    /*
      Sept colonnes se distinguaient par « lun 3 » en treize pixels : on devait
      LIRE pour compter. Le nombre porte la lecture, et les trois lettres du
      jour et du mois l'accompagnent au palier « Micro » de la section 19, prévu
      nommément pour les en-têtes de colonne en majuscules.

      C'est le seul endroit du produit où la micro-majuscule revient : ailleurs
      elle privait de leurs ascendantes des mots qu'on relit tout le temps.
    */
    expect(GRILLE).toContain('text-[34px] leading-9 tabular-nums')
    expect(GRILLE).toContain('text-[11px] leading-[13px] tracking-[0.02em] uppercase')
    // L'en-tête est carré comme les cases : le quadrillage garde le même pas
    // d'un bout à l'autre.
    expect(GRILLE).not.toContain('h-16')

    /*
      Le bloc « mar / août » fait 30 px — la hauteur des CHIFFRES, pas celle de
      leur boîte de ligne, qui en fait 36. Étalées sur 36, les deux lignes
      dépassaient du nombre par le haut et par le bas.
    */
    expect(GRILLE).toContain('flex h-[30px] flex-col justify-between')
    expect(GRILLE).toContain('flex items-center gap-1.5')

    // Graisse NORMALE : c'est la taille qui fait ressortir le nombre, pas son
    // épaisseur — sept nombres gras se liraient comme sept titres.
    expect(GRILLE).toContain("j.aujourdhui ? 'text-ink font-semibold' : 'text-ink font-normal'")
  })

  it('le jour courant ne se signale pas par la seule couleur', () => {
    // Fond, encre pleine et `aria-current` ensemble — section 19.
    expect(GRILLE).toContain("aria-current={j.aujourdhui ? 'date' : undefined}")
    expect(GRILLE).toContain("j.aujourdhui && 'bg-hover'")
  })

  it('le cadre de la grille est à angles DROITS', () => {
    /*
      Les tableaux du produit portent un arrondi de 10 px ; celui-ci, non. Ses
      cases sont carrées et fermées sur leurs quatre côtés : un arrondi au
      pourtour rognerait les quatre cases des coins et casserait le quadrillage
      là où il doit être le plus net.
    */
    expect(TABLEAU_PARTAGE).toContain('border-border bg-raised overflow-x-auto rounded-[10px]')
    expect(GRILLE).toContain('border-border bg-raised hidden overflow-x-auto rounded-none border')
  })

  it('les en-têtes de jour sont ceux de la section 19 — « lun », pas « Lun »', () => {
    /*
      La forme est portée par la CONSTANTE, dans `lib/domaine/heures.ts`. Elle a
      d'abord été capitalisée, chaque appelant devant retirer la majuscule — et
      l'un d'eux finit toujours par l'oublier.
    */
    const domaine = lire('src/lib/domaine/heures.ts')
    expect(domaine).toContain("['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']")
    expect(SAISIE).not.toContain('toLowerCase()')
  })

  it('chaque colonne de chiffres porte la chasse tabulaire', () => {
    // C'est un module d'heures et de montants : une colonne proportionnelle y
    // fait danser les unités d'une ligne à l'autre.
    expect((GRILLE.match(/tabular-nums/g) ?? []).length).toBeGreaterThanOrEqual(6)
    expect(CORRECTIONS).toContain('tabular-nums')

    /*
      Le détail des saisies ne l'écrit pas : il passe par `chiffres` sur la
      cellule partagée, qui pose la chasse ET le non-retour à la ligne. Les deux
      bouts de l'invariant sont vérifiés ensemble — la marque ici, sa traduction
      là-bas.
    */
    expect((DETAIL.match(/chiffres/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(TABLEAU_PARTAGE).toContain("chiffres && 'whitespace-nowrap tabular-nums'")
  })
})

describe('Un seul bouton noir par écran', () => {
  it('la barre d’outils de la grille est entièrement secondaire', () => {
    /*
      Quatre boutons dans la grille, trois déclarés `secondaire` : le seul qui
      garde la variante par défaut — donc le noir — est « Enregistrer ».
      Compter les deux plutôt que les nommer laisse le test survivre à un
      déplacement, mais pas à un second noir.
    */
    expect((GRILLE.match(/<Bouton\b/g) ?? []).length).toBe(4)
    expect((GRILLE.match(/variante=/g) ?? []).length).toBe(3)
    expect(GRILLE).toContain("classesBouton({ variante: 'secondaire', taille: 'sm' })")
  })

  it('la fiche d’employé n’en porte aucun : « Modifier » est un bouton secondaire', () => {
    // Section 19 range « Modifier » parmi les boutons à filet. Une fiche est un
    // écran de lecture ; le noir y désignerait une action qu'on n'y vient pas
    // faire.
    expect(FORMULAIRE).toContain('<Bouton type="button" variante="secondaire" taille="sm"')
    expect(FICHE).not.toContain('principale')
  })
})

describe('Les chaînes sont celles de la section 19', () => {
  it('les deux états vides, au mot et à la ponctuation près', () => {
    expect(SAISIE).toContain('titre="Aucun employé actif"')
    expect(SAISIE).toContain(
      'message="Créez une fiche d’employé pour commencer la saisie des heures."',
    )
    expect(SAISIE).toContain("action={{ libelle: 'Employés', href: '/heures/employes' }}")

    expect(EMPLOYES).toContain('titre="Aucun employé"')
    expect(EMPLOYES).toContain(
      'message="Ajoutez une première fiche : nom, entreprise de rattachement et taux horaire."',
    )
  })

  it('les listes secondaires disent l’absence en une phrase, jamais en bloc', () => {
    /*
      Section 19, « Listes secondaires » : une seule phrase en `--ink3` à la
      place du tableau. `EtatVide` est fait pour le PREMIER usage, où il y a
      quelque chose à créer ; ici il n'y a rien à créer, seulement une période
      sans heure.
    */
    expect(DETAIL).toContain('Aucune heure saisie sur cette période.')
    expect(DETAIL).not.toContain('EtatVide')
    expect(CORRECTIONS).toContain('Aucune correction sur cette fiche.')
    expect(CORRECTIONS).not.toContain('EtatVide')
  })

  it('les signes doubles sont précédés d’une espace insécable', () => {
    // La règle la plus souvent oubliée du projet : elle ne se voit qu'au moment
    // où la fenêtre rétrécit et renvoie le deux-points seul à la ligne.
    expect(GRILLE).toContain('semaine&nbsp;: heures supplémentaires.')
    expect(FORMULAIRE).toContain(
      'Le taux horaire est facultatif&nbsp;: sans lui, seules les heures sont totalisées.',
    )
    expect(FICHE).toContain('Taux horaire&nbsp;:')
  })

  it('la confirmation nomme trois employés au maximum, puis compte le reste', () => {
    /*
      Section 19, « Énumérations tronquées ». La grille est l'un des deux
      exemples qu'elle donne : nommer les employés sans heures permet de
      distinguer un oubli d'une absence réelle, mais à quinze noms le message
      déborde de la modale et plus rien n'est lu.

      La forme est `et N autres`, sans virgule devant, et `et 1 autre` au
      singulier.
    */
    // La règle vit dans `lib/enumerer.ts`, mesurée par `tests/enumerer.spec.ts`.
    // Ici, on vérifie seulement que la grille y passe.
    expect(GRILLE).toContain("from '@/lib/enumerer'")
    expect(GRILLE).toContain('enumerer(')
    // La liste passe bien par le plafond, au lieu de se recoller à la main.
    expect(GRILLE).not.toContain(".join(', ')")
  })

  it('les quatre titres de section de la fiche sont rendus par la page', () => {
    /*
      Ils vivaient dans les composants, à trois mesures différentes. Les
      remonter ici les met à la même hauteur, au même endroit — et laisse les
      composants ne porter que leur contenu.
    */
    for (const titre of [
      'Heures par semaine — 8 dernières semaines',
      'Détail des saisies',
      'Historique des corrections',
      'Notes',
    ]) {
      expect(FICHE, titre).toContain(`>${titre}</h2>`)
    }
    expect(lire('src/components/heures/graphique-semaines.tsx')).not.toContain('<h3')
    expect(DETAIL).not.toContain('<h3')
    expect(CORRECTIONS).not.toContain('<h3')
  })
})

describe('Aucune couleur écrite à la main', () => {
  it.each(MODULE)('%s ne porte que des jetons', (chemin) => {
    const source = lire(chemin)
    expect(source, 'valeur hexadécimale').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source, 'valeur rgb ou hsl').not.toMatch(/\b(?:rgba?|hsla?)\(/)
  })

  it('la couleur d’entreprise reste une pastille de 8 px, avec le nom écrit à côté', () => {
    const pastille = lire('src/components/heures/pastille-entreprise.tsx')
    expect(pastille).toContain('size-2 shrink-0 rounded-full')
    expect(pastille).toContain('{e.nom}')
    // Jamais en fond de bloc, jamais en couleur de texte.
    expect(pastille).not.toContain('color: `var(${e.jeton})`')
  })
})

describe('La largeur du contenu suit ce qu’il contient', () => {
  it('les deux écrans de liste partent de l’axe du titre', () => {
    /*
      Le resserrement de 96 px existait sous une BANDE pleine largeur : il
      séparait le chrome du contenu. Les deux écrans n'ont plus de bande — leur
      titre et leur commutateur sont dans l'en-tête — et un contenu rentré sous
      un titre qui, lui, part du bord se lit comme un décalage.

      La grille ne l'était déjà pas : neuf colonnes sous ses 860 px partiraient
      en défilement horizontal une fois retranchées deux gouttières de 96 px, sur
      le seul écran du produit qui se remplit au clavier sans quitter la vue.
    */
    for (const [nom, source] of [
      ['saisie', SAISIE],
      ['employes', EMPLOYES],
    ] as const) {
      expect(source, nom).not.toContain('xl:mx-24')
    }

    // La fiche d'un employé garde le sien : c'est un formulaire, pas une liste.
    expect(FICHE).toContain('mt-8 xl:mx-24')
    expect(GRILLE).toContain('min-w-[860px]')
  })
})

describe('Le test peut échouer', () => {
  it('détecte un onglet actif redevenu un souligné', () => {
    const faux = 'border-ink text-ink -mb-px border-b-2 px-3 py-2.5'
    expect(faux.includes('border-b-2')).toBe(true)
    expect(faux.includes(COURANT)).toBe(false)
  })

  it('détecte un gabarit de champ qui a divergé', () => {
    const a = "const CHAMP =\n  'h-11 w-full rounded-[6px]'"
    const b = "const CHAMP =\n  'h-10 w-full rounded-[6px]'"
    const extraire = (s: string) => /const CHAMP =\s*\n?\s*'([^']+)'/.exec(s)?.[1] ?? null
    expect(extraire(a)).not.toBe(extraire(b))
  })

  it('lit réellement les sources', () => {
    expect(MODULE).toContain('src/components/heures/grille-heures.tsx')
    expect(MODULE).toContain('src/app/(app)/heures/employes/page.tsx')
    expect(relative(process.cwd(), join(process.cwd(), 'src')).split(sep)).toEqual(['src'])
  })
})

describe('Le filtre d’entreprise de la grille', () => {
  const FILTRE = lire('src/components/heures/filtres-heures.tsx')
  const COMMANDES = lire('src/components/heures/commandes-semaine.tsx')

  it('porte son libellé au-dessus du contrôle, pas dedans', () => {
    /*
      Le déclencheur d'un menu n'affiche qu'une valeur. « Toutes les
      entreprises » ne dit pas sur quoi il porte, et « Paysagement » encore
      moins : le mot au-dessus est ce qui rend la valeur lisible.

      La période de paie prend le même gabarit — deux blocs d'appoint côte à
      côte qui se liraient à deux échelles se compteraient pour deux niveaux.
    */
    const microCaps = /text-\[11px\][^'"]*uppercase|uppercase[^'"]*text-\[11px\]/
    expect(FILTRE).toMatch(microCaps)
    expect(COMMANDES).toContain('<FiltresHeures')

    /*
      La période de paie portait le même gabarit, à côté. Elle est devenue une
      PHRASE sous le titre : c'est le cadre dans lequel la semaine affichée se
      situe, pas une valeur à régler, et un libellé en micro-majuscules la
      faisait lire comme un second filtre.
    */
    expect(SAISIE).toContain('Période de paie : {libellePeriode(periode)}')
  })

  it('un slug inconnu montre les trois dossiers au lieu de lever', () => {
    // Le slug vient de l'URL. `estEntreprise` est le seul point où il devient
    // une valeur du produit ; sans lui, `?entreprise=x` viderait la grille en
    // laissant croire à une semaine sans saisie.
    expect(SAISIE).toContain('estEntreprise(entreprise) ? entreprise : null')
  })

  it('les totaux du pied portent sur ce qui est affiché', () => {
    /*
      Le filtre s'applique APRÈS la lecture, sur la liste, et la grille reçoit
      la liste filtrée. Filtrer dans la requête en laissant les totaux sur une
      seconde lecture non filtrée afficherait une somme dont aucune ligne
      visible ne rend compte — le défaut ne se voit que si l'on additionne.
    */
    expect(SAISIE).toMatch(/const employes = dossier\s*\?\s*tousEmployes\.filter/)
    expect(SAISIE).toContain('employes={employes.map')
  })

  it('le filtre survit au changement de semaine', () => {
    // Les flèches reconstruisent l'adresse. Sans report, reculer d'une semaine
    // rouvrirait les trois dossiers, en silence.
    expect(SAISIE).toMatch(/if \(dossier\) p\.set\('entreprise', dossier\)/)
  })

  it('le choix vit dans l’adresse, sans remonter la page', () => {
    expect(FILTRE).toContain('router.replace')
    expect(FILTRE).toContain('scroll: false')
  })
})

describe('La liste des employés est en rangées', () => {
  const LISTE = lire('src/components/heures/tableau-employes.tsx')

  it('des rangées posées sur le creux, plus un tableau', () => {
    // Le cadre blanc, les filets de ligne et les en-têtes cliquables ont disparu ;
    // restent des rangées blanches sur le fond gris.
    expect(LISTE).not.toContain('ColonneTableau')
    expect(LISTE).not.toContain('CelluleTableau')
    expect(LISTE).toContain('bg-raised')
  })

  it('une GRILLE, pour que l’en-tête ait à quoi s’aligner', () => {
    /*
      En boîte flexible, chaque rangée répartit la place selon SON contenu :
      « Paysagement » et « Staff augmentation » ne commencent pas au même
      endroit, et un en-tête n'aurait rien à quoi se caler.

      `minmax(0,1fr)` sur le nom : sans le zéro, la piste refuse de passer sous
      la largeur de son contenu, et un nom long pousse les colonnes suivantes
      hors du cadre au lieu d'être tronqué.
    */
    expect(LISTE).toContain('const COLONNES =')
    expect(LISTE).toContain('minmax(0,1fr)')

    /*
      Une seule déclaration, partagée par l'en-tête et les rangées. Deux gabarits
      de colonnes se désaccorderaient à la première retouche, et le décalage ne
      se verrait que sur les noms longs.
    */
    expect((LISTE.match(/const COLONNES =/g) ?? []).length).toBe(1)
    expect((LISTE.match(/cn\(COLONNES/g) ?? []).length).toBe(2)
  })

  it('l’en-tête réserve la colonne de la flèche', () => {
    // Sans elle, l'en-tête déborde de 14 px et « Total » ne tombe plus en face
    // des heures.
    expect(LISTE).toContain('La colonne de la flèche')
  })

  it('le tri par l’URL survit à la disparition des en-têtes', () => {
    // Les colonnes n'étaient que la façon de l'écrire. Une adresse mise en
    // signet continue de rendre la liste dans l'ordre demandé.
    expect(EMPLOYES).toContain('const triRetenu: Tri =')
    expect(EMPLOYES).toContain('lignes.sort(')
  })

  it('le taux absent ne s’écrit pas', () => {
    // HEU-8 : sans taux renseigné, aucun montant n'est affiché. Un « 0,00 $ »
    // se lirait comme un taux nul, ce qui n'est pas la même chose.
    expect(LISTE).toContain('e.tauxCents === null ? (')
  })

  it('le statut ne se montre que par exception', () => {
    // Une colonne entière de « Actif » ne portait rien : la pastille n'apparaît
    // que sur les fiches désactivées, là où l'exception se voit.
    expect(LISTE).toContain('!e.actif && <BadgeStatutEmploye')
  })

  it('l’état vide reste hors du creux', () => {
    // Une carte grise qui n'aurait rien à contenir affirmerait qu'il manque
    // quelque chose, alors qu'il n'y a simplement pas encore de fiche.
    expect(EMPLOYES.indexOf('<EtatVide')).toBeLessThan(EMPLOYES.indexOf('<ListeCreux'))
  })
})
