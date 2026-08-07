import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les trois écrans d'authentification tiennent en un seul gabarit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le défaut que ce fichier surveille.
 *
 * Connexion, mot de passe oublié et réinitialisation ont été écrits l'un après
 * l'autre, chacun redéclarant son titre, ses marges et sa forme d'erreur. Les
 * trois se ressemblaient sans être identiques : le message de succès du second
 * était un filet fin, celui du troisième un titre de 38 px, et la pilule
 * « Accès réservé » de la section 19 n'existait sur aucun.
 *
 * Rien ne le signalait, parce qu'on ne voit jamais deux de ces écrans en même
 * temps. C'est exactement le genre d'écart qui ne se corrige qu'une fois, et
 * qui revient au prochain écran ajouté.
 * ─────────────────────────────────────────────────────────────────────────
 */

const AUTH = join('src', 'components', 'auth')

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const FORMULAIRES = [
  join(AUTH, 'formulaire-connexion.tsx'),
  join(AUTH, 'formulaire-mot-de-passe-oublie.tsx'),
  join(AUTH, 'formulaire-reinitialisation.tsx'),
]

/** Retire commentaires et chaînes : un exemple commenté n'est pas du code. */
function nettoyer(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function fichiersAuth(): string[] {
  return readdirSync(join(process.cwd(), AUTH))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(AUTH, f))
}

describe('Le gabarit des écrans d’authentification', () => {
  it('la pilule « Accès réservé » de la section 19 existe', () => {
    // Elle est listée depuis le premier jour et n'avait jamais été posée.
    expect(lire(join(AUTH, 'entete-auth.tsx'))).toContain('Accès réservé')
  })

  it.each(FORMULAIRES)('%s passe par EnteteAuth', (chemin) => {
    const source = nettoyer(lire(chemin))
    expect(source, 'l’en-tête doit venir du gabarit partagé').toContain('EnteteAuth')
    expect(source, 'un titre redéclaré sur place fait diverger les trois écrans').not.toMatch(
      /<h1[\s>]/,
    )
  })

  it.each(FORMULAIRES)('%s annonce son attente sans changer la largeur du bouton', (chemin) => {
    /*
      Sans `annonceChargement`, `Bouton` AJOUTE le témoin au libellé au lieu de
      le remplacer : le bouton s'élargit au moment précis où l'on attend, et le
      libellé « en cours » de la section 19 ne paraît jamais.
    */
    const source = nettoyer(lire(chemin))

    for (const bloc of source.split('<BoutonAuth').slice(1)) {
      const attributs = bloc.slice(0, bloc.indexOf('>'))
      expect(attributs, `BoutonAuth sans annonceChargement dans ${chemin}`).toContain(
        'annonceChargement',
      )
    }
  })
})

describe('Un seul bouton noir par écran d’authentification', () => {
  it('tout le noir passe par bouton-auth.tsx', () => {
    /*
      Chaque écran n'a qu'une action. La garantie ne tient pas au comptage mais
      à la porte unique : si un formulaire importait `Bouton` en direct, il
      pourrait poser un second noir sans que rien ne le voie.
    */
    const coupables = fichiersAuth().filter((chemin) => {
      if (chemin.endsWith('bouton-auth.tsx')) return false
      return /from '@\/components\/shared\/bouton'/.test(nettoyer(lire(chemin)))
    })

    expect(coupables).toEqual([])
  })
})

describe('Les contrôles des écrans d’authentification sont dessinés', () => {
  it('aucun `<select>` natif', () => {
    // Un select natif porte la flèche et la liste du SYSTÈME, pas du produit.
    const coupables = fichiersAuth().filter((chemin) => /<select[\s>]/.test(nettoyer(lire(chemin))))
    expect(coupables).toEqual([])
  })

  it('aucune couleur écrite à la main', () => {
    // Section 19 : tout passe par les jetons, y compris sur l'écran que le
    // client voit le plus souvent.
    const coupables: string[] = []

    for (const chemin of [...fichiersAuth(), join('src', 'app', '(auth)', 'layout.tsx')]) {
      const trouve = nettoyer(lire(chemin)).match(/#[0-9a-fA-F]{3,8}\b/)
      if (trouve) coupables.push(`${chemin} — ${trouve[0]}`)
    }

    expect(coupables).toEqual([])
  })

  it('la bascule d’affichage du mot de passe n’est écrite qu’une fois', () => {
    // Deux écrans la portent ; recopiée, elle perdait sa cible tactile de 44 px
    // sur l'un des deux.
    const source = lire(join(AUTH, 'bascule-mot-de-passe.tsx'))
    expect(source).toContain('Afficher le mot de passe')
    expect(source).toContain('Masquer le mot de passe')

    for (const chemin of FORMULAIRES) {
      expect(nettoyer(lire(chemin)), `${chemin} redessine la bascule`).not.toContain(
        'Afficher le mot de passe',
      )
    }
  })
})

describe('Le test peut échouer', () => {
  it('repère un BoutonAuth sans annonce', () => {
    const faux = `<BoutonAuth type="submit" chargement={x}>Se connecter</BoutonAuth>`
    const attributs = faux
      .split('<BoutonAuth')[1]!
      .slice(0, faux.split('<BoutonAuth')[1]!.indexOf('>'))
    expect(attributs.includes('annonceChargement')).toBe(false)
  })

  it('repère une couleur écrite à la main', () => {
    expect(/#[0-9a-fA-F]{3,8}\b/.test('className="bg-[#0b0b0b]"')).toBe(true)
    expect(/#[0-9a-fA-F]{3,8}\b/.test('className="bg-surface text-[15px]"')).toBe(false)
  })
})
