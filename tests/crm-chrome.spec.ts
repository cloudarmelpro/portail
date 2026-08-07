import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Chrome du CRM — la bande de tête et ses deux niveaux de navigation.
 *
 * Les sources sont LUES plutôt qu'exécutées : le layout tire les gardes, qui
 * tirent Prisma et Better Auth — l'importer ici échouerait au chargement. Les
 * autres tests de mise en page du projet procèdent de même.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const SHELL = lire('src/components/layout/shell.tsx')
const LAYOUT = lire('src/app/(app)/crm/[entreprise]/layout.tsx')
const ONGLETS = lire('src/components/crm/onglets-crm.tsx')

/** Habillage de l'élément courant, commun aux deux niveaux — et à l'administration. */
const COURANT = 'border-border bg-raised text-ink border font-medium'
/** Le filet transparent garde aux inactifs la hauteur et l'axe de l'actif. */
const INACTIF = 'text-ink2 hover:text-ink border border-transparent'

describe('La bande de tête traverse le panneau', () => {
  it('vit dans le layout, donc identique aux trois vues du dossier', () => {
    expect(LAYOUT).toContain('BANDE_PLEINE')
    expect(LAYOUT).toContain('<OngletsCrm')
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

  it('ne porte aucun titre : il change d’une vue à l’autre', () => {
    expect(LAYOUT).not.toContain('<h1')
  })

  it('valide le slug avant d’en faire quoi que ce soit', () => {
    expect(LAYOUT.indexOf('requireModule(')).toBeLessThan(LAYOUT.indexOf('requireEntreprise('))
    expect(LAYOUT.indexOf('requireEntreprise(')).toBeLessThan(LAYOUT.indexOf('actif={slug}'))
  })
})

describe('Les deux niveaux suivent la même règle de commutateur', () => {
  it('l’élément courant est un bouton, les autres sont du texte', () => {
    const courants = ONGLETS.match(new RegExp(COURANT, 'g')) ?? []
    const inactifs = ONGLETS.match(new RegExp(INACTIF, 'g')) ?? []

    // Un habillage par niveau : le dossier d'entreprise, puis la vue.
    expect(courants).toHaveLength(2)
    expect(inactifs).toHaveLength(2)
  })

  it('n’enferme plus le groupe dans un rail ni la vue dans un onglet souligné', () => {
    expect(ONGLETS).not.toContain('border-b-2')
    expect(ONGLETS).not.toContain('-mb-px')
    // La pilule de la vue et sa surbrillance grise ont disparu ; `rounded-full`
    // ne subsiste que sur la pastille de 8 px.
    expect(ONGLETS).not.toContain('rounded-full px-3')
    expect(ONGLETS).not.toContain('bg-hover2')
    expect(ONGLETS).toContain('rounded-[9px] px-3')
    expect(ONGLETS).toContain('rounded-[8px] px-3')
  })

  it('ne fait flotter aucun des deux au-dessus de la bande', () => {
    // Le fond et le filet suffisent à désigner l'élément courant : l'ombre en
    // plus le placerait sur un autre plan que ses voisins.
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
})

describe('La pastille d’entreprise', () => {
  it('reste sur les trois, active ou non, avec le nom écrit à côté', () => {
    const lien = ONGLETS.slice(
      ONGLETS.indexOf('aria-label="Entreprise"'),
      ONGLETS.indexOf('</nav>'),
    )
    expect(lien).toContain('size-2 shrink-0 rounded-full')
    expect(lien).toContain('{e.nom}')
    // Une seule pastille rendue, sans condition : c'est un repère d'identité,
    // pas un état.
    expect(lien).not.toMatch(/courant\s*(\?|&&)[^\n]*size-2/)
  })

  it('n’emploie la couleur d’entreprise qu’en pastille, jamais en surface', () => {
    const teintes = ONGLETS.match(/var\(\$\{e\.jeton\}\)/g) ?? []
    expect(teintes).toHaveLength(1)
    expect(ONGLETS).not.toContain('color: `var(${e.jeton})`')
  })
})

describe('Changer de dossier conserve la vue', () => {
  it('reconduit clients et corbeille, jamais la fiche ouverte', () => {
    expect(ONGLETS).toContain(
      "const vue = surLesClients ? '/clients' : surLaCorbeille ? '/corbeille' : ''",
    )
    expect(ONGLETS).toContain('href={`/crm/${e.slug}${vue}`}')
    // Un identifiant de client n'a aucun sens dans une autre entreprise.
    expect(ONGLETS).not.toContain('chemin.replace')
  })

  it('n’offre les fiches supprimées qu’à qui peut supprimer', () => {
    expect(ONGLETS).toContain('{peutSupprimer && (')
    /*
      La permission a suivi le commutateur de vue : elle est lue par CHAQUE page,
      plus par le layout. C'est la page qui sait quelle vue elle est, et le
      layout n'a plus rien à en faire.
    */
    for (const page of [
      'src/app/(app)/crm/[entreprise]/page.tsx',
      'src/app/(app)/crm/[entreprise]/clients/page.tsx',
      'src/app/(app)/crm/[entreprise]/corbeille/page.tsx',
    ]) {
      expect(lire(page), page).toContain("aPermission(session.role, 'crm:supprimer')")
    }
  })
})
