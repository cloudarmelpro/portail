import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Fiche client — les écarts assumés avec le gabarit, et ceux qui n'en sont pas.
 *
 * L'analyse est statique : la page est un Server Component qui interroge la
 * base derrière `server-only`, et le rendre ici échouerait au chargement. Les
 * règles vérifiées sont toutes des règles de SURFACE — elles se lisent dans le
 * texte source, et c'est précisément là qu'elles se perdent : chacune a déjà
 * disparu une fois d'un écran sans que rien ne tombe.
 */

const lire = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), 'utf8')

const RACINE = ['src', 'app', '(app)', 'crm', '[entreprise]', 'clients', '[client]']
const PAGE = lire(...RACINE, 'page.tsx')
const CHARGEMENT = lire(...RACINE, 'loading.tsx')
const CHRONOLOGIE = lire('src', 'components', 'crm', 'chronologie.tsx')
const STATUT = lire('src', 'components', 'crm', 'selecteur-statut.tsx')
const INTERACTION = lire('src', 'components', 'crm', 'formulaire-interaction.tsx')

/** Retire les commentaires : un exemple commenté n'est pas du code rendu. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('Le nom du client reste le titre visible de la fiche', () => {
  /**
   * C'est l'écart assumé avec le reste du gabarit, où le titre passe en
   * `sr-only` parce qu'un contrôle segmenté nomme déjà la section. Ici, le fil
   * d'Ariane dit « CRM / Clients » — la SECTION — et `config/fil-ariane.ts` s'en
   * remet explicitement à ce titre pour dire de QUI il s'agit. Le passer en
   * `sr-only` rendrait la fiche anonyme sans qu'aucun test ne tombe.
   */
  it('porte le nom en H1, à la mesure des titres de page', () => {
    expect(PAGE).toMatch(/<h1[^>]*text-\[30px\][^>]*>\{fiche\.nom\}<\/h1>/)
  })

  it('ne le masque pas', () => {
    const titre = PAGE.match(/<h1[^>]*>/)?.[0] ?? ''
    expect(titre).not.toContain('sr-only')
  })
})

describe('La fiche n’emprunte au gabarit que ce qui s’y applique', () => {
  it('resserre son contenu comme les écrans de l’administration', () => {
    expect(PAGE).toContain('xl:mx-24')
  })

  it('n’affiche aucune bande de chiffres — elle n’a rien à compter', () => {
    // Quatre tuiles au-dessus d'une fiche compteraient les lignes de sa propre
    // chronologie : un nombre que l'on voit déjà en la faisant défiler.
    expect(PAGE).not.toContain('BandeChiffres')
    expect(PAGE).not.toContain('bande-chiffres')
  })

  it('borne la largeur des blocs où l’on lit du texte', () => {
    expect(PAGE).toMatch(/max-w-\[\d{3}px\]/)
  })
})

describe('Le statut se lit à un seul endroit', () => {
  /**
   * La pilule de statut siégeait à deux centimètres du sélecteur qui le porte.
   * Deux affichages d'une même valeur obligent à comparer avant de croire l'un
   * des deux — et l'un des deux est un contrôle, donc susceptible d'être en
   * attente d'application.
   */
  it('aucune pastille de statut sur la fiche', () => {
    expect(PAGE).not.toContain('badge-statut')
    expect(PAGE).not.toContain('BadgeStatut')
  })

  it('le sélecteur reste un contrôle, et porte le menu du produit', () => {
    expect(STATUT).toContain("from '@/components/shared/choix'")
    expect(sansCommentaires(STATUT)).not.toMatch(/<select\b/)
  })
})

describe('CRM-5 — le chemin de clôture est intact', () => {
  /**
   * Le motif est exigé par le schéma, `crm.spec.ts` le vérifie. Ce qui se perd
   * en refondant un écran, c'est la CONFIRMATION : un `onChoisir` qui
   * appliquerait directement ferait clore un dossier d'un seul clic, et le
   * schéma, lui, n'y verrait qu'un motif vide à refuser plus tard.
   */
  it('un statut fermé ouvre la confirmation au lieu de s’appliquer', () => {
    expect(sansCommentaires(STATUT)).toMatch(/FERMES\.includes\(choix\)\)\s*setAConfirmer\(choix\)/)
  })

  it('la confirmation reste impossible sans motif', () => {
    expect(STATUT).toContain('disabled={motif.trim().length === 0}')
  })

  it('le choix n’est jamais appliqué par le seul fait de le sélectionner', () => {
    // `onChoisir` ne fait que retenir : rien n'appelle l'action depuis la liste.
    const corps = sansCommentaires(STATUT)
    const onChoisir = corps.slice(corps.indexOf('onChoisir={'), corps.indexOf('/>'))
    expect(onChoisir).not.toContain('appliquer')
  })
})

describe('La chronologie est un fil, pas une grille', () => {
  it('se rend en liste ordonnée et n’emprunte rien au tableau', () => {
    expect(CHRONOLOGIE).toContain('<ol')
    expect(CHRONOLOGIE).not.toContain('@/components/shared/tableau')
    expect(sansCommentaires(CHRONOLOGIE)).not.toMatch(/<t(able|body|head|r|d|h)\b/)
  })

  it('relie ses entrées par un filet continu', () => {
    expect(CHRONOLOGIE).toContain('bg-border w-px flex-1')
  })

  it('écrit le type de l’interaction à côté de son icône', () => {
    // L'icône seule porterait l'information — section 19.
    expect(CHRONOLOGIE).toContain('LIBELLE_TYPE_INTERACTION[e.type]')
  })
})

describe('Le tableau des estimations bat la mesure du produit', () => {
  it('passe par le tableau unique plutôt que par une liste dessinée à part', () => {
    expect(PAGE).toContain("from '@/components/shared/tableau'")
  })

  it('ses cellules sont en 13 px et discrètes', () => {
    expect(PAGE).toContain("const CELLULE = 'text-[13px]'")

    const cellules = PAGE.match(/<CelluleTableau[^>]*>/g) ?? []
    expect(cellules.length).toBeGreaterThan(3)
    for (const c of cellules) {
      expect(c, c).toContain('discret')
      expect(c, c).toContain('className={CELLULE}')
    }
  })

  it('écrit le statut de l’estimation, sans pastille', () => {
    expect(PAGE).toContain('LIBELLE_STATUT_ESTIMATION[e.statut]')
  })
})

describe('Un seul bouton noir sur la fiche', () => {
  it('la variante principale n’est déclarée qu’une fois', () => {
    const corps = sansCommentaires(PAGE)
    const noirs = corps.match(/variante: 'principale'|variante="principale"/g) ?? []
    expect(noirs).toHaveLength(1)
  })

  it('aucun bouton ne surcharge sa hauteur ni son rayon', () => {
    // `Bouton` et `classesBouton` portent le gabarit — 36 px, `rounded-xl`.
    for (const [nom, source] of [
      ['page', PAGE],
      ['formulaire-interaction', INTERACTION],
      ['selecteur-statut', STATUT],
    ] as const) {
      const boutons = sansCommentaires(source).match(/<Bouton[\s\S]{0,220}?>/g) ?? []
      for (const b of boutons) {
        expect(b, `${nom} — ${b}`).not.toMatch(/className="[^"]*\b(h-\d|rounded-)/)
      }
    }
  })
})

describe('Les libellés visibles viennent de la section 19', () => {
  it('les champs de l’interaction portent les noms du document', () => {
    for (const libelle of [
      'Type d’interaction',
      'Date de l’interaction',
      'Résumé',
      'Prochaine action',
    ]) {
      expect(INTERACTION, libelle).toContain(libelle)
    }
  })

  it('l’apostrophe est courbe partout dans les chaînes de la fiche', () => {
    // U+2019, jamais U+0027 — section 19. La droite ne se distingue pas à la
    // relecture, et une seule suffit à faire diverger deux écrans.
    for (const [nom, source] of [
      ['page', PAGE],
      ['loading', CHARGEMENT],
      ['chronologie', CHRONOLOGIE],
    ] as const) {
      const fautives = sansCommentaires(source)
        .split('\n')
        .filter((l) => /(^|>)[^<>]*\p{L}'\p{L}/u.test(l))
      expect(fautives, `${nom} — ${fautives.join(' | ')}`).toEqual([])
    }
  })
})
