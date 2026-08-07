import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les tuiles « À faire » de l'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un décompte est une PERMISSION, pas un affichage.
 *
 * C'est le seul écran du produit qui parle des quatre modules à la fois, et
 * c'est donc le seul où une garde oubliée fuit vers tous les rôles d'un coup.
 * Masquer une tuile côté rendu ne suffirait pas : le nombre aurait déjà été lu
 * en base et transmis au navigateur, où il se lit dans la charge utile.
 *
 * La source est LUE plutôt qu'exécutée : `lib/data/` est marqué `server-only`
 * et tire Prisma, donc l'importer ici échouerait au chargement. Les autres
 * tests de garde du projet procèdent de même.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const DONNEES = lire('src/lib/data/accueil.ts')
const TUILES = lire('src/components/accueil/tuiles-a-faire.tsx')
const CARTES = lire('src/components/shared/cartes-chiffres.tsx')
const PAGE = lire('src/app/(app)/accueil/page.tsx')

describe('Chaque bloc est gardé avant sa requête', () => {
  it('les trois modules passent par `aPermission`', () => {
    // Le ternaire est dans le `Promise.all` : la branche non autorisée rend un
    // tableau vide sans qu'aucune requête ne parte.
    expect(DONNEES).toContain("aPermission(role, 'crm:lire') ? donneesCrm() : RIEN")
    expect(DONNEES).toContain("aPermission(role, 'cv:lire') ? voletCv(")
    expect(DONNEES).toContain("aPermission(role, 'heures:saisir') ? voletHeures() : RIEN")
  })

  it('la vue réservée du fonds de CV n’est comptée que pour qui l’ouvre', () => {
    /*
      « Plus de 24 mois » est réservée à `cv:supprimer` — CV-10. En compter le
      contenu pour un autre rôle afficherait un nombre menant à un écran refusé :
      l'utilisateur verrait qu'il y a quelque chose, et se ferait fermer la porte.
    */
    expect(DONNEES).toContain("aPermission(role, 'cv:supprimer')")
    expect(DONNEES).toMatch(/peutSupprimer \? compterAEcheance\(\) : Promise\.resolve\(0\)/)
  })

  it('le rôle est vérifié avant d’être passé', () => {
    // `requireSession` d'abord, `donneesAccueil` ensuite : la fonction décide
    // quoi interroger à partir du rôle, il lui faut donc un rôle déjà prouvé.
    expect(PAGE.indexOf('requireSession()')).toBeLessThan(PAGE.indexOf('donneesAccueil('))
  })
})

describe('Le cloisonnement tient jusque dans un total', () => {
  it('le CRM est lu dossier par dossier, par le client cadré', () => {
    /*
      Une requête unique aurait traversé les trois entreprises — exactement le
      bug que l'extension Prisma existe pour rendre impossible. Un total n'en
      est pas dispensé : il se compose de trois lectures cadrées.
    */
    expect(DONNEES).toContain('ENTREPRISES.map((e) => lire(prismaCadre(e.slug), e))')
    expect(DONNEES).toContain('surLesTroisDossiers')
  })

  it('aucun appel au client global pour les tables cloisonnées', () => {
    // `prisma.client` ou `prisma.estimation` ici ramènerait les trois dossiers
    // dans une seule requête, sans que rien ne le signale à la lecture.
    expect(DONNEES).not.toMatch(/\bprisma\.[a-z]/)
  })
})

describe('Ce qui est montré', () => {
  it('une tuile à zéro disparaît', () => {
    // « 0 relance échue » occupe la place d'une information et n'en porte
    // aucune. Rien à faire, rien à montrer.
    expect(DONNEES).toContain('.filter((t) => t.valeur > 0)')
  })

  it('la bande entière s’efface quand il n’y a rien', () => {
    // Sans cela, un titre « À faire » coifferait une grille vide.
    expect(TUILES).toContain('if (tuiles.length === 0) return null')
  })

  it('chaque tuile mène quelque part', () => {
    /*
      La carte est partagée avec l'écran des employés, où les chiffres n'ouvrent
      rien : elle ne devient un lien que si on lui en donne un. Les tuiles de
      l'accueil, elles, en donnent toujours un — un décompte qui annonce du
      travail et ne mène nulle part oblige à retrouver l'écran soi-même.
    */
    expect(TUILES).toContain('href: t.href')
    expect(CARTES).toContain('c.href ? (')
    expect(CARTES).toContain('<Link')
  })

  it('la TUILE du CRM mène au choix d’entreprise, pas à un seul dossier', () => {
    /*
      Le nombre porte sur les trois. Mener vers Paysagement aurait affiché une
      liste plus courte que la tuile qu'on vient de suivre — un écran qui
      dément le chiffre qui y menait.

      Les RANGÉES des panneaux, elles, mènent chacune à son dossier : une
      rangée ne porte qu'un client, et son entreprise est connue.
    */
    const bloc = DONNEES.slice(DONNEES.indexOf('export async function donneesCrm'))
    expect(bloc).toContain("href: '/crm'")
    expect(bloc).toContain('href: `/crm/${e.slug}/clients/${r.clientId}`')
  })

  it('les nombres sont en chasse tabulaire', () => {
    // Quatre tuiles côte à côte dont les chiffres n'ont pas la même largeur se
    // lisent comme quatre cadrages différents.
    expect(CARTES).toContain('tabular-nums')
  })
})

describe('Les panneaux', () => {
  const PANNEAU = lire('src/components/shared/panneau-donnees.tsx')

  it('sont gardés comme les tuiles, avant leur requête', () => {
    // Ce n'est pas parce qu'un décompte est autorisé que son CONTENU l'est :
    // un nombre ne nomme personne, cinq lignes nomment cinq clients.
    // Tuiles et panneaux sortent du MÊME volet : une seule garde les couvre,
    // et il n'y a donc pas de chemin par lequel l'une passerait sans l'autre.
    expect(DONNEES).toContain('tuiles: volets.flatMap((v) => v.tuiles)')
    expect(DONNEES).toContain('panneaux: volets.flatMap((v) => v.panneaux)')
  })

  it('le CRM y est encore lu dossier par dossier', () => {
    const bloc = DONNEES.slice(DONNEES.indexOf('export async function donneesCrm'))
    expect(bloc).toContain('surLesTroisDossiers')
    expect(bloc).not.toMatch(/\bprisma\.[a-z]/)
  })

  it('ne montrent que cinq lignes', () => {
    /*
      Au-delà, un aperçu devient une seconde version de l'écran du module —
      qu'il faudrait garder d'accord avec lui, tri compris. Le lien du coin est
      la réponse à « et les autres ? ».
    */
    expect(DONNEES).toContain('const LIGNES_PAR_PANNEAU = 5')
    expect(DONNEES).toContain('.slice(0, LIGNES_PAR_PANNEAU)')
  })

  it('un panneau sans ligne s’efface', () => {
    // Un cadre vide sous un titre affirme qu'il devrait y avoir quelque chose.
    expect(DONNEES).toContain('.filter((p) => p.lignes.length > 0)')
  })

  it('l’ordre interne ne franchit pas la frontière', () => {
    // `tri` classe puis disparaît : le laisser passer exposerait un ordre
    // interne dans la charge utile, sans rien y faire. Le commentaire du
    // composant CITE le mot pour dire ce qu'il n'imite pas — d'où le décapage.
    expect(DONNEES).toMatch(/lignes: retenues\.map\(\(l\) => \(\{/)
    // Le composant CITE le mot dans ses commentaires — d'où le décapage — et
    // `Tableau` le contient : c'est `tri` comme VALEUR qui est interdit ici.
    expect(PANNEAU.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/tri/)
  })

  it('la forme se décide à l’appel, jamais dans les données', () => {
    /*
      Deux formes, et le choix n'est pas cosmétique. Nommer des colonnes, c'est
      affirmer que les lignes SE COMPARENT : même nature, même ordre, lues de
      haut en bas. La liste en creux dit l'inverse — on prend une ligne sans
      regarder les autres.

      Le choix vit donc dans l'écran, qui sait ce qu'il montre, et non dans
      `Panneau`, qui ne porte que des valeurs.
    */
    expect(PANNEAU).toContain('colonnes ? (')
    expect(PANNEAU).toContain('<ul')
    expect(DONNEES).not.toContain('colonnes')
  })

  it('en tableau, le lien est sur le nom et non sur la rangée', () => {
    // Un tableau se parcourt cellule par cellule : une rangée entièrement
    // cliquable y rend la sélection d'un texte impossible.
    const bloc = PANNEAU.slice(PANNEAU.indexOf('colonnes ? ('), PANNEAU.indexOf(') : ('))
    expect(bloc).toContain('<CelluleTableau')
    expect(bloc).not.toContain('<RangeeCreux')
  })

  it('la sortie est nommée par le module', () => {
    // « Voir tout » ne dit pas où l'on va ; le nom du module, si — et il vient
    // de `lib/permissions.ts`, donc il ne peut pas diverger du menu.
    expect(PANNEAU).toContain('LIBELLE_MODULE[panneau.module]')
  })
})

describe('Le volet de l’administration', () => {
  it('ses trois permissions restent distinctes', () => {
    /*
      `admin:journal` ne donne pas `admin:tarifs`. Les regrouper sous un seul
      « est administrateur » ferait de l'accueil le premier endroit où
      `lib/permissions.ts` cesse d'être la source unique — et le rôle
      d'administrateur n'est pas le seul qui puisse un jour en porter une.
    */
    const bloc = DONNEES.slice(DONNEES.indexOf('async function voletAdmin'))
    expect(bloc).toContain("aPermission(role, 'admin:utilisateurs')")
    expect(bloc).toContain("aPermission(role, 'admin:tarifs')")
    expect(bloc).toContain("aPermission(role, 'admin:journal')")
    expect(bloc).not.toMatch(/role === 'admin'/)
  })

  it('les grilles sont lues dossier par dossier', () => {
    const bloc = DONNEES.slice(DONNEES.indexOf('async function voletAdmin'))
    expect(bloc).toContain('ENTREPRISES.map((e) => aUneGrilleActive(prismaCadre(e.slug)))')
  })

  it('le journal n’affiche que les actions sensibles', () => {
    // L'accueil n'est pas un second journal : il signale ce qui mérite un
    // regard. Tout y déverser noierait la suspension d'un compte sous les
    // consultations de la journée.
    const bloc = DONNEES.slice(DONNEES.indexOf('async function voletAdmin'))
    expect(bloc).toContain('listerJournal({ sensible: true }')
  })
})

describe('Chaque rangée mène quelque part', () => {
  const PANNEAU = lire('src/components/shared/panneau-donnees.tsx')

  it('la flèche de fin de rangée n’est pas un ornement', () => {
    /*
      Le repère pose un chevron au bout de chaque rangée ; il promet une
      destination. `href` n'est donc pas facultatif du côté des données — une
      rangée sans cible retomberait sur celle du panneau plutôt que de porter
      une flèche morte.
    */
    expect(DONNEES).toMatch(/^ {2}href: string$/m)
    expect(PANNEAU).toContain('<FlecheDroite')
    expect(PANNEAU).toContain('href={l.href}')
  })

  it('les flèches du produit, pas un chevron de bibliothèque', () => {
    // Les tracés viennent du client — `public/icons`. Un `ChevronRight` de
    // `lucide-react` ici rouvrirait la divergence que ces fichiers ont fermée.
    expect(PANNEAU).toContain("from '@/components/shared/fleches'")
    expect(PANNEAU).not.toContain('lucide-react')
  })
})

describe('L’entrée du CRM reprend la lecture de l’accueil', () => {
  const CRM = lire('src/app/(app)/crm/page.tsx')

  it('elle ne recopie pas les trois lectures cadrées', () => {
    /*
      `donneesCrm` porte déjà le cloisonnement : une lecture par dossier, par le
      client cadé. Le recopier ici aurait rouvert la seule question qu'on ne
      veut pas voir posée deux fois — et la seconde copie aurait pu diverger de
      la première sans que rien ne le signale.
    */
    expect(CRM).toContain("from '@/lib/data/accueil'")
    expect(CRM).toContain('donneesCrm()')
    expect(CRM).not.toContain('relancesEchues')
    expect(CRM).not.toContain('soumissionsEnAttente')
  })

  it('elle n’affiche aucune tuile de comptage', () => {
    /*
      Les tuiles du CRM mènent à `/crm`, donc à cette page. Une tuile qui
      annonce du travail et mène à l'écran où l'on est déjà n'est pas un
      raccourci, c'est une impasse. Le compte est porté par l'en-tête de chaque
      panneau, où il ne promet pas une destination qu'il n'a pas.
    */
    expect(CRM).not.toContain('TuilesAFaire')
    expect(CRM).toContain('<PanneauDonnees')
  })

  it('ce qui attend passe avant où aller', () => {
    // La réponse à « quel dossier » dépend souvent de ce qui presse.
    expect(CRM.indexOf('<PanneauDonnees')).toBeLessThan(CRM.indexOf('<ListeCreux titre="Dossiers"'))
  })
})

describe('Les deux panneaux propres au CRM', () => {
  it('vivent hors de la lecture partagée avec l’accueil', () => {
    /*
      L'accueil parle de ce qui ATTEND ; ces deux-là de ce qui vient d'arriver.
      Les glisser dans `donneesCrm` y ajouterait deux panneaux qui n'appellent
      aucun geste, sur l'écran où l'on vient justement chercher quoi faire.
    */
    const volet = DONNEES.slice(
      DONNEES.indexOf('export async function donneesCrm'),
      DONNEES.indexOf('async function voletCv'),
    )
    expect(volet).not.toContain('derniersClients')
    expect(volet).not.toContain('dernieresInteractions')
  })

  it('lisent en base plutôt qu’en mémoire', () => {
    /*
      `listerClients` charge tout un dossier puis ordonne en mémoire : c'est le
      prix d'un tableau triable, pas celui d'un aperçu de cinq lignes. Trois
      dossiers entiers lus pour en montrer cinq.
    */
    const CRM_DATA = lire('src/lib/data/crm.ts')
    for (const fonction of ['derniersClients', 'dernieresInteractions']) {
      const bloc = CRM_DATA.slice(CRM_DATA.indexOf(`export async function ${fonction}`))
      expect(bloc.slice(0, 700), fonction).toContain('take: limite')
      expect(bloc.slice(0, 700), fonction).toContain('orderBy')
    }
  })

  it('lisent cinq lignes PAR DOSSIER pour en garder cinq', () => {
    /*
      Le plus récent des trois dossiers peut être le même trois fois. N'en lire
      que deux par dossier laisserait passer le quatrième du dossier le plus
      actif — un panneau incomplet sans que rien ne le signale.
    */
    expect(DONNEES).toContain('derniersClients(db, LIGNES_PAR_PANNEAU)')
    expect(DONNEES).toContain('dernieresInteractions(db, LIGNES_PAR_PANNEAU)')
  })

  it('une interaction ne survit pas à la suppression de son client', () => {
    // La fiche est en corbeille : la rangée mènerait à un écran refusé, et le
    // résumé nommerait quand même le client dans le panneau.
    const CRM_DATA = lire('src/lib/data/crm.ts')
    const bloc = CRM_DATA.slice(CRM_DATA.indexOf('export async function dernieresInteractions'))
    expect(bloc.slice(0, 400)).toContain('client: { deletedAt: null }')
  })

  it('ce qui presse passe avant ce qui s’est passé', () => {
    const CRM = lire('src/app/(app)/crm/page.tsx')
    expect(CRM).toContain('[...panneaux, interactions, derniers]')
  })
})

describe('Un panneau vide, selon l’écran', () => {
  const CRM = lire('src/app/(app)/crm/page.tsx')
  const CREUX = lire('src/components/shared/liste-creux.tsx')

  it('l’accueil l’efface, l’entrée du CRM le garde', () => {
    /*
      Deux écrans, deux questions. L'accueil répond à « qu'est-ce qui
      m'attend » : rien est une réponse complète, et un cadre vide affirmerait
      qu'il devrait y avoir quelque chose. L'entrée du CRM répond à « où en est
      le module » : une structure qui apparaît et disparaît selon les données se
      lit comme un écran différent à chaque visite, et sur une base neuve elle
      laisse une page nue qu'on prend pour une panne.
    */
    expect(DONNEES).toContain('.filter((p) => p.lignes.length > 0)')
    expect(CRM).toContain('const tous = [...panneaux, interactions, derniers]')
    expect(CRM).not.toContain('p.lignes.length > 0')
  })

  it('chaque panneau nomme son absence', () => {
    /*
      « Aucune relance échue » est une bonne nouvelle ; « Aucune donnée »
      ressemble à une panne. La phrase est donc obligatoire dans le type — on ne
      peut pas construire un panneau sans avoir décidé ce qu'il dit à vide.
    */
    expect(DONNEES).toMatch(/^ {2}vide: string$/m)
    for (const phrase of [
      'Aucune relance échue.',
      'Aucune soumission en attente.',
      'Aucune interaction consignée.',
      'Aucun CV déposé.',
      'Toute l’équipe a saisi sa semaine.',
    ]) {
      expect(DONNEES, phrase).toContain(phrase)
    }
  })

  it('la phrase prend la forme d’une rangée', () => {
    // Même fond, même rayon, même hauteur : deux panneaux côte à côte ne se
    // décalent pas parce que l'un est vide.
    const bloc = CREUX.slice(CREUX.indexOf('{vide ? ('))
    expect(bloc.slice(0, 400)).toContain('bg-raised')
    expect(bloc.slice(0, 400)).toContain('min-h-12')
    expect(bloc.slice(0, 400)).toContain('rounded-[10px]')
  })
})
