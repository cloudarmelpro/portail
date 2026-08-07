import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Écran des coordonnées d'entreprise — EST-10, mise en page.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce qu'on vérifie ici n'est visible sur aucun rendu.
 *
 * Un gabarit d'administration tenu à la main dérive d'un écran à l'autre, une
 * clé de remontage manquante ne se voit qu'en changeant d'entreprise, et un
 * squelette ne se regarde jamais assez longtemps pour qu'on remarque qu'il
 * annonce autre chose que la page.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/admin/organisation/page.tsx')
const FORMULAIRE = lire('src/components/admin/formulaire-organisation.tsx')
const LOGO = lire('src/components/admin/logo-organisation.tsx')

describe('Le gabarit d’administration', () => {
  it('la bande ne porte que le contrôle segmenté', () => {
    // Le titre y est en `sr-only` : le fil d'Ariane de l'en-tête le nomme déjà.
    expect(PAGE).toContain('<EnTeteAdmin titre="Organisation" />')
  })

  it('les cinq écrans partent du même axe que le chrome', () => {
    /*
      Le contenu était resserré de 96 px de chaque côté sous les bandes, qui
      elles vont d'un bord à l'autre. Deux axes pour un même écran : le fil
      d'Ariane commençait à gauche, le tableau presque cent pixels plus loin.

      Le resserrement est levé partout à la fois. Le lever sur un seul écran
      aurait déplacé le problème au passage d'un onglet à l'autre, où il se voit
      encore mieux — la bande ne bouge pas, le contenu saute.
    */
    for (const ecran of [
      'src/app/(app)/admin/utilisateurs/page.tsx',
      'src/app/(app)/admin/tarifs/page.tsx',
      'src/app/(app)/admin/journal/page.tsx',
      'src/app/(app)/admin/paie/page.tsx',
      'src/app/(app)/admin/organisation/page.tsx',
    ]) {
      expect(lire(ecran), ecran).toContain('<div className="mt-10">')
      expect(lire(ecran), ecran).not.toContain('xl:mx-24')
    }
  })

  it('aucune bande de chiffres', () => {
    /*
      Trois coordonnées et un logo ne sont pas des statistiques. Répétées
      au-dessus des champs, elles se liraient deux fois — et divergeraient de la
      valeur enregistrée dès la première frappe.
    */
    expect(PAGE).not.toContain('BandeChiffres')
  })
})

describe('Changer d’entreprise ne transporte pas la saisie', () => {
  it('les deux blocs se remontent sur le slug', () => {
    /*
      Même position dans l'arbre d'une entreprise à l'autre : sans clé, React
      garde l'état des champs, et l'enregistrement écrit les coordonnées de
      Paysagement sous le nom de Développement web.
    */
    expect(PAGE).toMatch(/<FormulaireOrganisation\s+key=\{slug\}/)
    expect(PAGE).toMatch(/<LogoOrganisation\s+key=\{slug\}/)
  })
})

describe('Le bandeau prévient sans crier', () => {
  it('ce n’est pas une erreur', () => {
    // Des coordonnées vides sont un travail qui reste à faire. Le rouge est
    // réservé à ce qui vient d'échouer.
    expect(PAGE).not.toContain('text-critical')
    expect(PAGE).not.toContain('border-critical')
  })

  it('la couleur d’état ne va qu’à l’icône, jamais au fond ni au texte', () => {
    // `--warning` mesure moins de 3:1 sur `--surface` : il ne peut porter ni
    // texte, ni surface.
    expect(PAGE).toContain('<AlertTriangle className="text-warning')
    expect(PAGE).not.toMatch(/bg-(warning|serious|good|critical)/)
  })

  it('l’icône est accompagnée d’un mot', () => {
    expect(PAGE).toContain('Coordonnées à compléter')
  })
})

describe('Un seul bouton noir par écran', () => {
  it('« Enregistrer » est le seul, les gestes du logo portent un filet', () => {
    expect(FORMULAIRE.match(/<Bouton\b/g)).toHaveLength(1)
    expect(FORMULAIRE).not.toContain('variante=')
    expect(LOGO.match(/variante="secondaire"/g)).toHaveLength(2)
    expect(LOGO).not.toMatch(/variante="principale"/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un bloc rendu sans clé d’entreprise', () => {
    const faux = '<FormulaireOrganisation entreprise={slug}'
    expect(/<FormulaireOrganisation\s+key=\{slug\}/.test(faux)).toBe(false)
  })

  it('détecte une couleur d’état passée en surface', () => {
    const faux = 'className="bg-warning text-ink"'
    expect(/bg-(warning|serious|good|critical)/.test(faux)).toBe(true)
  })
})

describe('L’avertissement dit la vérité sur le document', () => {
  /*
    La page recopiait la condition : `!raisonSociale || !adresse || !telephone`.
    Elle comptait donc la raison sociale, que le document remplace pourtant par
    le nom de l'entreprise. Une seule des trois manquante et le bandeau
    annonçait une mention qui n'apparaissait nulle part — on apprend vite à ne
    plus lire un bandeau qui se trompe.
  */
  it('la page appelle `composerEntete`, elle ne réinvente pas la condition', () => {
    expect(PAGE).toContain("from '@/components/calculateur/entete-document'")
    expect(PAGE).toContain('entete.aCompleter')
  })

  it('aucune condition écrite à la main sur les trois champs', () => {
    expect(PAGE).not.toMatch(/!o\.raisonSociale\s*\|\|\s*!o\.adresse/)
  })

  it('la raison sociale manquante se dit, mais comme une note', () => {
    // Elle ne produit aucune mention sur le document : l'annoncer comme un
    // manque enverrait corriger quelque chose qui n'est pas cassé.
    expect(PAGE).toContain('sansRaisonSociale')
    expect(PAGE).toContain('Rien n’est manquant sur le document.')
  })
})
