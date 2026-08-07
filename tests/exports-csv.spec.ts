import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tout export CSV neutralise les formules.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Une cellule commençant par `=`, `+`, `-` ou `@` est une FORMULE pour Excel,
 * LibreOffice et Google Sheets. Elle s'exécute à l'ouverture du fichier.
 *
 * Les valeurs exportées viennent des utilisateurs : nom de client saisi dans le
 * CRM, libellé de service d'une grille de tarifs, entité inscrite au journal.
 * Le fichier part ensuite chez le comptable, qui n'a aucune raison de s'en
 * méfier — c'est un export de son propre outil.
 *
 * Les guillemets ne protègent PAS : Excel les retire et interprète ce qu'ils
 * contenaient. Seul un préfixe — apostrophe ou espace — désamorce.
 *
 * Deux exports CSV ont été écrits séparément par deux agents. L'un traitait le
 * cas, l'autre non, et rien ne le signalait. Ce test vaut pour le troisième.
 * ─────────────────────────────────────────────────────────────────────────
 */

const RACINE = join(process.cwd(), 'src', 'app')

/** Toutes les routes du dépôt, quel que soit leur groupe. */
function routes(dossier: string, trouvees: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree)
    if (statSync(complet).isDirectory()) routes(complet, trouvees)
    else if (entree === 'route.ts') trouvees.push(complet)
  }
  return trouvees
}

/**
 * Une route est un export CSV si elle annonce ce type de contenu. On ne se fie
 * pas au nom du fichier : `heures/export/route.ts` ne contient pas « csv ».
 */
function produitDuCsv(source: string): boolean {
  return /text\/csv/.test(source)
}

const exportsCsv = routes(RACINE)
  .map((chemin) => ({ chemin, source: readFileSync(chemin, 'utf8') }))
  .filter(({ source }) => produitDuCsv(source))

/** Chemin lisible, relatif à `src/`, pour les messages d'échec. */
function court(chemin: string): string {
  return chemin
    .slice(chemin.indexOf(`src${join('/')}`) >= 0 ? 0 : 0)
    .replace(process.cwd() + '\\', '')
    .replace(process.cwd() + '/', '')
}

describe('Exports CSV — neutralisation des formules', () => {
  it('le balayage trouve bien des exports', () => {
    // Sans cette vérification, une erreur de détection rendrait tous les
    // contrôles suivants vacuement vrais.
    expect(
      exportsCsv.length,
      'Aucune route text/csv trouvée — le balayage est-il correct ?',
    ).toBeGreaterThan(0)
  })

  describe.each(exportsCsv.map((e) => [court(e.chemin), e.source] as const))(
    '%s',
    (chemin, source) => {
      it('désamorce les cellules commençant par = + - ou @', () => {
        /*
          On cherche la classe de caractères, pas une implémentation précise :
          le test doit accepter une autre façon correcte de désamorcer, et
          refuser l'absence de tout traitement.
        */
        const desamorce = /\[\s*=\s*\+\s*\\?-\s*@\s*\]|\[=\+\\?-@\]|\[=\+@\\?-\]/.test(
          source.replace(/\s+/g, ''),
        )

        expect(
          desamorce,
          `${chemin} : aucune neutralisation des formules. Une valeur saisie par un utilisateur et commençant par « = » s'exécutera à l'ouverture du fichier.`,
        ).toBe(true)
      })

      it('écrit un BOM UTF-8', () => {
        /*
          Sans BOM, Excel lit le fichier en codage système : « Développement »
          devient « DÃ©veloppement » sur tous les postes francophones.

          Les deux notations de l'échappement Unicode sont acceptées — `﻿`
          et `\u{FEFF}` —, ainsi que le caractère lui-même. Refuser une écriture
          correcte ferait de ce test une préférence de style.
        */
        const bom = /\\u\{?FEFF\}?/i.test(source) || source.includes('﻿')
        expect(bom, `${chemin} : BOM UTF-8 absent`).toBe(true)
      })
    },
  )
})

describe('Le test peut échouer', () => {
  it('détecte un échappement qui ignore les formules', () => {
    const faux = `
      function cellule(valeur) {
        return /[";\\n]/.test(valeur) ? '"' + valeur.replace(/"/g, '""') + '"' : valeur
      }
    `
    const desamorce = /\[\s*=\s*\+\s*\\?-\s*@\s*\]|\[=\+\\?-@\]|\[=\+@\\?-\]/.test(
      faux.replace(/\s+/g, ''),
    )
    expect(desamorce).toBe(false)
  })

  it('reconnaît la forme employée dans le dépôt', () => {
    const bon = `const sur = /^[=+\\-@]/.test(valeur) ? "'" + valeur : valeur`
    const desamorce = /\[\s*=\s*\+\s*\\?-\s*@\s*\]|\[=\+\\?-@\]|\[=\+@\\?-\]/.test(
      bon.replace(/\s+/g, ''),
    )
    expect(desamorce).toBe(true)
  })
})

/* ══════════════════════════════════════════════════════════════════
   Export QuickBooks — EST-14
   ══════════════════════════════════════════════════════════════════ */

describe('Export QuickBooks — le fichier totalise le montant émis', () => {
  const ROUTE = join(
    process.cwd(),
    'src',
    'app',
    '(app)',
    'calculateur',
    '[entreprise]',
    'estimations',
    'csv',
    'route.ts',
  )
  const source = readFileSync(ROUTE, 'utf8')
  const DATA = readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'estimations.ts'), 'utf8')

  it('écrit une ligne pour l’écart entre le sous-total et les lignes', () => {
    /*
      Sans elle, la somme importée diffère du montant que le client a reçu dès
      qu'il y a des frais, une majoration ou un rabais — et l'écart est
      invisible : le fichier a l'air complet, seul le total ne correspond plus.
    */
    expect(source).toContain('sommeLignes')
    expect(source).toMatch(/estimation\.sousTotal - sommeLignes/)
  })

  it('n’essaie pas de reconstituer l’arithmétique du domaine', () => {
    /*
      Recalculer chaque ajustement obligerait à refaire l'ordre d'application,
      les assiettes et les arrondis de `lib/domaine/estimation.ts` — et à
      diverger en silence le jour où l'un des deux change. L'écart, lui, est
      juste par construction.
    */
    expect(source).not.toMatch(/majorationPct\s*\)\s*\/\s*100/)
    expect(source).not.toContain('arrondirCent(')
  })

  it('emploie le point décimal, pas la virgule', () => {
    // QuickBooks attend un point. « 1234,5 » y est rejeté, ou lu comme 12345.
    const fonction = source.slice(source.indexOf('function nombreCsv'))
    expect(fonction.slice(0, 300)).toContain('toFixed(2)')
    expect(fonction.slice(0, 300)).not.toMatch(/replace\('\.', ','\)/)
  })

  it('n’exporte que les estimations transmises et abouties', () => {
    /*
      Brouillons, refusées et expirées ne doivent pas partir en facturation :
      reprendre le fichier créerait des documents pour des estimations que le
      client a refusées, ou qu'il n'a jamais vues.
    */
    const bloc = DATA.slice(DATA.indexOf('export async function estimationsPourExport'))
    expect(bloc.slice(0, 1200)).toMatch(/statut: \{ in: \['envoye', 'accepte'\] \}/)
  })
})

describe('Le test peut échouer — export QuickBooks', () => {
  it('détecte une virgule décimale', () => {
    const faux = `function nombreCsv(v) { return String(v).replace('.', ',') }`
    expect(faux).toMatch(/replace\('\.', ','\)/)
  })
})
