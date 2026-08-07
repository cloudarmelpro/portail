import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Sauvegarde des saisies en cours — TR-13, et ce qu'elle ne doit pas coûter.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un brouillon contient des noms d'employés et des heures travaillées.
 *
 * Il vit dans le navigateur, donc il SURVIT à la déconnexion. Sur un poste
 * partagé — et une gérante qui saisit des heures travaille rarement sur une
 * machine à elle —, une grille à moitié remplie resterait lisible par la
 * personne suivante.
 *
 * Deux règles rendent cela impossible, et ce fichier les tient : la clé porte
 * l'identifiant de l'utilisateur, et la déconnexion purge tout.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const LIB = lire('src/lib/brouillon.ts')
const MENU = lire('src/components/layout/menu-utilisateur.tsx')
const GRILLE = lire('src/components/heures/grille-heures.tsx')
const CALC = lire('src/components/calculateur/calculette.tsx')
const PAGE_CALC = lire('src/app/(app)/calculateur/[entreprise]/page.tsx')

describe('Confidentialité des brouillons', () => {
  it('la clé porte l’identifiant de l’utilisateur', () => {
    // Sans lui, le brouillon d'une personne serait proposé à la suivante.
    expect(LIB).toMatch(/function cleComplete\(userId: string/)
    expect(LIB).toMatch(/\$\{PREFIXE\}:\$\{userId\}/)
  })

  it('la déconnexion purge tous les brouillons', () => {
    expect(LIB).toContain('export function purgerBrouillons')
    expect(MENU).toContain('purgerBrouillons()')
  })

  it('la purge part AVANT la requête de déconnexion', () => {
    // `onSubmit` s'exécute avant l'action serveur, et ne l'empêche pas.
    expect(MENU).toMatch(/action=\{seDeconnecter\} onSubmit=\{\(\) => purgerBrouillons\(\)\}/)
  })

  it('un brouillon périme au bout d’un jour', () => {
    // Reproposer une saisie d'il y a trois semaines n'aide personne : le
    // contexte a changé, et l'utilisateur ne la reconnaîtrait pas.
    expect(LIB).toContain('PEREMPTION_MS')
    expect(LIB).toMatch(/24 \* 60 \* 60 \* 1000/)
  })

  it('l’indisponibilité du stockage n’interrompt jamais la saisie', () => {
    /*
      Mode privé, quota plein, stockage refusé par la politique du navigateur :
      un brouillon est un confort. Le faire échouer bruyamment ferait perdre la
      saisie qu'il devait protéger.
    */
    const catches = LIB.match(/catch\s*\{/g) ?? []
    expect(catches.length).toBeGreaterThanOrEqual(4)
  })
})

describe('La grille des heures retient sa saisie', () => {
  it('le brouillon est propre à la semaine affichée', () => {
    // Une clé commune déverserait les heures d'une semaine dans une autre.
    expect(GRILLE).toMatch(
      /useBrouillon<Record<string, string>>\(\s*utilisateurId,\s*`heures:\$\{debut\}`/,
    )
  })

  it('chaque frappe alimente le brouillon', () => {
    const bloc = GRILLE.slice(GRILLE.indexOf('function changer('))
    expect(bloc.slice(0, 500)).toContain('retenir(suivantes)')
  })

  it('l’enregistrement réussi l’efface', () => {
    // Le garder ferait reproposer une saisie déjà partie au serveur.
    const bloc = GRILLE.slice(GRILLE.indexOf('function apresEcriture('))
    expect(bloc.slice(0, 500)).toContain('oublier()')
  })

  it('la reprise est annoncée à l’utilisateur', () => {
    // Retrouver des chiffres sans savoir d'où ils viennent, ni s'ils sont
    // enregistrés, est pire que de les avoir perdus.
    expect(GRILLE).toContain('brouillonRepris')
    expect(GRILLE).toContain('Saisie en cours reprise')
  })
})

describe('La calculette retient son estimation', () => {
  it('le brouillon distingue l’entreprise et l’origine d’une copie', () => {
    // Une clé commune mêlerait un devis de Paysagement à un devis de Dev web,
    // et une copie en cours à l'estimation neuve ouverte à côté.
    expect(CALC).toMatch(
      /useBrouillon<BrouillonCalcul>\(utilisateurId, `calcul:\$\{slug\}:\$\{origine\?\.id \?\? 'neuf'\}`\)/,
    )
  })

  it('le brouillon fournit les valeurs INITIALES, pas un second rendu', () => {
    /*
      Le lire dans un effet ferait clignoter le formulaire — vide, puis rempli —
      et écraserait une frappe partie entre les deux rendus.
    */
    expect(CALC).toMatch(/brouillonInitial\?\.lignes \?\?/)
    expect(CALC).toMatch(/brouillonInitial\?\.fraisDeplacement \?\?/)
    expect(CALC).toMatch(/brouillonInitial\?\.rabaisPct \?\?/)
  })

  it('les cinq états alimentent le brouillon', () => {
    // Un seul oubli dans la liste de dépendances, et l'un des cinq champs ne
    // serait jamais retenu — sans que rien ne le signale.
    expect(CALC).toMatch(
      /retenir\(\{ lignes, fraisDeplacement, majorationPct, rabaisMontant, rabaisPct \}\)/,
    )
    for (const etat of [
      'lignes',
      'fraisDeplacement',
      'majorationPct',
      'rabaisMontant',
      'rabaisPct',
    ]) {
      expect(CALC).toMatch(new RegExp(`\\}, \\[vierge,[^\\]]*\\b${etat}\\b`))
    }
  })

  it('un formulaire vierge ne crée pas de brouillon', () => {
    // Sinon, ouvrir l'écran sans rien y faire ferait annoncer une « saisie
    // reprise » à la visite suivante.
    expect(CALC).toMatch(/if \(vierge\) return/)
  })

  it('l’enregistrement réussi l’efface', () => {
    const bloc = CALC.slice(CALC.indexOf('function reinitialiser('))
    expect(bloc.slice(0, 200)).toContain('oublier()')
    // `traiter` passe par `reinitialiser` : c'est le seul chemin de succès.
    const traiter = CALC.slice(CALC.indexOf('function traiter('))
    expect(traiter.slice(0, 600)).toContain('reinitialiser()')
  })

  it('la reprise est annoncée à l’utilisateur', () => {
    expect(CALC).toContain('brouillonRepris')
    expect(CALC).toContain('Calcul en cours repris')
  })

  it('la page transmet l’identifiant de l’utilisateur', () => {
    // Sans lui, `useBrouillon` recevrait `undefined` et toutes les personnes
    // partageraient la même clé.
    expect(PAGE_CALC).toContain('utilisateurId={session.userId}')
  })
})

describe('Le test peut échouer', () => {
  it('détecte une clé sans identifiant d’utilisateur', () => {
    const faux = 'const cle = `portail:brouillon:${forme}`'
    expect(/\$\{PREFIXE\}:\$\{userId\}/.test(faux)).toBe(false)
  })

  it('détecte un état absent des dépendances de l’effet', () => {
    const faux = '}, [vierge, lignes, fraisDeplacement, retenir])'
    expect(/\}, \[vierge,[^\]]*\brabaisPct\b/.test(faux)).toBe(false)
  })
})

describe('Ce qui est délibérément SANS brouillon', () => {
  it('la fiche client, parce que c’est une modale', () => {
    /*
      Une modale de création et de modification partagent le même formulaire.
      Un brouillon y serait restauré à la réouverture — c'est-à-dire le plus
      souvent POUR UN AUTRE CLIENT : on ouvrirait « Nouveau client » et on y
      trouverait le nom du précédent, à demi effacé.

      Et le cas que TR-13 vise n'existe pas ici : on ne perd pas huit champs
      courts par accident, on ferme une modale volontairement. Le rechargement
      de page, lui, ferme la modale de toute façon.

      Ce test existe pour que l'omission reste un choix, et non un oubli.
    */
    const dialogue = lire('src/components/crm/dialogue-client.tsx')
    expect(dialogue).not.toContain('useBrouillon')
  })
})
