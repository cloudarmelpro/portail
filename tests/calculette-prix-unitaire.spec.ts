import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formaterPrixUnitaire } from '@/lib/domaine/estimation'

/**
 * EST-1 — le prix unitaire se lit DANS la ligne de saisie.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'estimation se compose pendant un appel téléphonique. Quand le client
 * demande le tarif, la réponse doit être sous les yeux : sans elle, il faut
 * quitter l'écran pour aller lire la grille, et l'appel s'arrête.
 *
 * Le récapitulatif latéral ne suffisait pas — il n'affiche une ligne qu'une fois
 * la quantité saisie, c'est-à-dire après le moment où le prix sert.
 * ─────────────────────────────────────────────────────────────────────────
 */

const CALC = readFileSync(
  join(process.cwd(), 'src', 'components', 'calculateur', 'calculette.tsx'),
  'utf8',
)

describe('Écriture d’un tarif', () => {
  /*
    L'insécable est ÉCRITE en échappement. `Intl` fr-CA la place devant le
    symbole, et une espace ordinaire dans l'attendu rendrait le test vert ou
    rouge selon l'éditeur qui l'a enregistré — les deux caractères se
    ressemblent trop pour être distingués à la relecture.
  */
  const NBSP = ' '

  it('porte le montant et son unité', () => {
    expect(formaterPrixUnitaire(45, 'm²')).toBe(`45,00${NBSP}$ / m²`)
  })

  it('donne toujours deux décimales', () => {
    expect(formaterPrixUnitaire(85, 'heure')).toBe(`85,00${NBSP}$ / heure`)
    expect(formaterPrixUnitaire(0.45, 'm²')).toBe(`0,45${NBSP}$ / m²`)
  })

  it('garde le montant d’un seul tenant', () => {
    // « 45,00 $ » ne peut pas se couper en fin de ligne, seule la barre le peut.
    expect(formaterPrixUnitaire(45, 'm²')).toContain(`45,00${NBSP}$`)
    expect(formaterPrixUnitaire(45, 'm²')).not.toContain('45,00 $')
  })

  it('écrit un tarif nul plutôt que rien', () => {
    // Un produit à 0 $ est une valeur — un service offert. Le masquer laisserait
    // croire qu'aucun prix n'est connu.
    expect(formaterPrixUnitaire(0, 'unité')).toBe(`0,00${NBSP}$ / unité`)
  })
})

describe('Le tarif apparaît dans la ligne de saisie', () => {
  it('vient du même calcul de ligne que le sous-total', () => {
    // `lignesCalcul` résout déjà le produit du catalogue ET la ligne figée :
    // recalculer le prix à côté ferait diverger l'affiché du facturé.
    expect(CALC).toMatch(/const tarif =\s*calcul && calcul\.designation/)
    expect(CALC).toContain('formaterPrixUnitaire(calcul.prixUnitaire, calcul.unite)')
  })

  it('couvre les lignes FIGÉES, qui n’ont pas de produitId', () => {
    /*
      Une ligne héritée d'une duplication — ou dont le produit a quitté le
      catalogue — porte son prix sur `figee`, sans `produitId`. Un test sur
      `produitId` laisserait ces lignes sans tarif : exactement celles d'une
      révision, le cas le plus fréquent du calculateur (EST-11).
    */
    const bloc = CALC.slice(CALC.indexOf('const tarif ='), CALC.indexOf('const tarif =') + 200)
    expect(bloc).not.toContain('produitId')
    expect(bloc).toContain('calcul.designation')
  })

  it('est en chiffres tabulaires', () => {
    const bloc = CALC.slice(CALC.indexOf('id={`calculateur-tarif-'))
    expect(bloc.slice(0, 300)).toContain('tabular-nums')
  })

  it('est rattaché au sélecteur pour le clavier', () => {
    /*
      Sans description, le tarif ne s'annonce jamais : il est posé à côté du
      contrôle, pas dedans. Il a d'abord été rattaché au champ de QUANTITÉ, faute
      de mieux — `Choix` n'acceptait aucune description. C'est le service qu'il
      décrit, et c'est le sélecteur qui le porte.
    */
    expect(CALC).toContain('decritPar={tarif ? `calculateur-tarif-${index}` : undefined}')
    expect(CALC).toContain('id={`calculateur-tarif-${index}`}')
  })

  it('n’occupe aucune place tant qu’aucun service n’est choisi', () => {
    // Une ligne vide sous chaque sélecteur ferait respirer la grille dans le
    // mauvais sens : l'écran est celui d'un appel, il est dense.
    expect(CALC).toContain('{tarif && (')
  })

  it('le test peut échouer', () => {
    const faux = 'const tarif = ligne.produitId ? prix : null'
    expect(/const tarif =\s*calcul && calcul\.designation/.test(faux)).toBe(false)
  })
})

describe('La ligne de saisie garde son ordre au clavier', () => {
  it('le réagencement mobile reste porté par des classes `order`', () => {
    /*
      La touche entrée enchaîne les lignes (EST-1) : le parcours au clavier suit
      le DOM. Envelopper le sélecteur pour y loger le tarif ne devait donc pas
      déplacer les éléments dans l'arbre — `order-*` réordonne à l'affichage
      seulement, et c'est l'enveloppe qui porte désormais l'ordre.
    */
    expect(CALC).toContain('<div className="order-1 flex min-w-0 flex-col gap-1 sm:order-none">')
    const select = CALC.slice(CALC.indexOf('id={`calculateur-service-${index}`}'))
    expect(select.slice(0, 900)).not.toContain('order-1')
  })
})
