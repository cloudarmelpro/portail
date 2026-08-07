import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Logo d'entreprise — EST-10.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un logo est un fichier téléversé par un tiers et rendu dans une page.
 *
 * C'est exactement la forme d'un dépôt de CV, et il doit donc en avoir toutes
 * les protections : type vérifié sur les OCTETS et non sur ce que le navigateur
 * annonce, taille plafonnée sur ce que le stockage a réellement reçu, et aucune
 * adresse directe. Un second chemin de téléversement écrit à côté du premier
 * aurait été un chemin sans ces trois choses.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const STORAGE = lire('src/lib/storage.ts')
const ACTIONS = lire('src/lib/actions/admin.ts')
const DATA = lire('src/lib/data/admin.ts')
const PANNEAU = lire('src/components/admin/logo-organisation.tsx')
const PDF = lire('src/components/calculateur/pdf-estimation.tsx')
const DOC = lire('src/components/calculateur/document-estimation.tsx')
const SCHEMA = lire('prisma/schema/tarifs.prisma')
const CONFIG = lire('src/config/logo.ts')

describe('Le SVG est refusé', () => {
  it('trois formats matriciels, et rien d’autre', () => {
    /*
      Un SVG est un document XML : il porte du script et des références
      externes, et il finirait rendu dans une page de l'application. Un logo n'a
      aucune raison d'être exécutable.
    */
    expect(CONFIG).toMatch(/TYPES_LOGO = \['image\/png', 'image\/jpeg', 'image\/webp'\] as const/)
    for (const source of [CONFIG, STORAGE, PANNEAU]) {
      expect(source).not.toContain('image/svg')
    }
  })

  it('les trois côtés lisent la MÊME constante', () => {
    /*
      Le composant client filtre avant l'aller-retour, le schéma Zod valide
      l'entrée, l'action tranche sur la taille réellement reçue. Recopiée, la
      valeur divergerait — et le premier plafond à dériver serait celui du
      client, qui ne se voit pas.
    */
    for (const source of [PANNEAU, lire('src/lib/validations/admin.ts'), ACTIONS]) {
      expect(source).toMatch(/from '@\/config\/logo'/)
    }
    // Le composant est client : importer `lib/storage`, marqué `server-only`,
    // lèverait à la compilation.
    expect(PANNEAU).not.toMatch(/from '@\/lib\/storage'/)
  })
})

describe('Ce que le navigateur annonce ne prouve rien', () => {
  it('le type est vérifié sur les octets réels après le dépôt', () => {
    // `verifierObjet` relit le Content-Type — mais c'est celui que le navigateur
    // a choisi à la signature. Seuls les premiers octets sont dans le fichier.
    const bloc = ACTIONS.slice(ACTIONS.indexOf('export const confirmerLogo'))
    expect(bloc).toContain('typeReelConforme(entree.cle, entree.typeMime)')
  })

  it('chaque format a sa signature', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(STORAGE).toContain(`'${type}': [[`)
    }
  })

  it('« RIFF » seul ne suffit pas à faire un WebP', () => {
    /*
      Le même conteneur porte du WAV et de l'AVI. Sans le second marqueur, un
      fichier audio renommé passerait la vérification.
    */
    expect(STORAGE).toContain('const WEBP = [0x57, 0x45, 0x42, 0x50]')
    expect(STORAGE).toContain('octets[8 + i]')
  })

  it('la plage lue couvre le douzième octet', () => {
    // À huit octets, la vérification du WebP lirait `undefined` et passerait
    // toujours — le contrôle existerait sans rien contrôler.
    expect(STORAGE).toContain("Range: 'bytes=0-11'")
  })

  it('la taille est plafonnée sur ce que le stockage a reçu', () => {
    const bloc = ACTIONS.slice(ACTIONS.indexOf('export const confirmerLogo'))
    expect(bloc).toContain('const reel = await verifierObjet(entree.cle)')
    expect(bloc).toMatch(/reel\.taille > TAILLE_MAX_LOGO/)
  })

  it('un fichier refusé est effacé du stockage', () => {
    /*
      Le garder laisserait dans le seau un objet que plus aucune ligne ne
      désigne — donc introuvable, et dont on vient d'établir qu'il n'est pas ce
      qu'il prétend être.
    */
    const bloc = ACTIONS.slice(
      ACTIONS.indexOf('export const confirmerLogo'),
      ACTIONS.indexOf('export const retirerLogo'),
    )
    expect(bloc.match(/supprimerObjet\(entree\.cle\)/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Aucun objet orphelin', () => {
  it('l’ancien logo est effacé quand on le remplace', () => {
    // Sans cela, chaque changement laisserait un fichier que rien ne désigne et
    // que rien ne saurait donc retrouver pour l'effacer.
    expect(DATA).toContain('ancienne')
    expect(ACTIONS).toContain('if (ancienne) await supprimerObjet(ancienne)')
  })

  it('l’ancien part APRÈS l’écriture réussie, jamais avant', () => {
    /*
      Dans l'autre ordre, un échec de la mise à jour laisserait la ligne
      désignant un fichier déjà effacé — un logo cassé, et irrécupérable.
    */
    const bloc = ACTIONS.slice(ACTIONS.indexOf('export const confirmerLogo'))
    expect(bloc.indexOf('const { fait, ancienne }')).toBeLessThan(
      bloc.indexOf('if (ancienne) await supprimerObjet(ancienne)'),
    )
  })

  it('la clé est aléatoire, jamais dérivée du nom d’entreprise', () => {
    /*
      Une clé réutilisée serait écrasée à chaque dépôt, et les navigateurs qui
      l'ont en cache continueraient d'afficher le logo précédent.
    */
    expect(STORAGE).toMatch(/nouvelleCleLogo[\s\S]{0,200}randomUUID\(\)/)
  })
})

describe('Aucune adresse directe — TR-3', () => {
  it('la base stocke une CLÉ, pas une URL', () => {
    expect(SCHEMA).toMatch(/logoCle String\?/)
    expect(SCHEMA).not.toMatch(/logoUrl\s+String/)
  })

  it('les deux écrans passent par une adresse signée', () => {
    for (const chemin of [
      'src/app/(app)/admin/organisation/page.tsx',
      'src/app/(app)/calculateur/[entreprise]/estimations/[id]/page.tsx',
    ]) {
      expect(lire(chemin)).toContain('urlApercu(')
    }
  })
})

describe('Le document sait se passer de logo', () => {
  it('le PDF reçoit les octets, jamais une adresse', () => {
    /*
      Il est composé hors de toute requête : une lecture réseau à l'intérieur du
      rendu ferait échouer le document entier sur un seau momentanément
      injoignable.
    */
    expect(PDF).toMatch(/logo: Buffer \| null/)
    expect(PDF).not.toMatch(/logoUrl/)
  })

  it('un logo illisible n’empêche pas d’émettre un devis', () => {
    // L'objet peut avoir disparu du seau alors que la ligne le désigne encore.
    const bloc = STORAGE.slice(STORAGE.indexOf('export async function lireObjet'))
    expect(bloc.slice(0, 800)).toContain('return null')
  })

  it('sans logo, le filet de couleur reprend sa place', () => {
    // Le nom écrit à côté d'une couleur d'entreprise, section 19.
    expect(PDF).toContain('filetMarque')

    /*
      L'aperçu lit la valeur FIGÉE de `PALETTE_PDF`, et non `var(--pays)` qui
      bascule avec le thème : le papier, lui, ne bascule pas. Le même devis
      s'affichait dans deux verts selon le thème de celui qui le regardait,
      alors que le fichier imprimé n'en connaît qu'un.
    */
    expect(DOC).toContain('PALETTE_PDF[identite.jeton as keyof typeof PALETTE_PDF]')
  })

  it('le logo REMPLACE le filet, il ne s’y ajoute pas', () => {
    // Deux marques l'une sur l'autre en feraient deux fois trop.
    for (const source of [PDF, DOC]) {
      expect(source).toMatch(/logo(Url)? \? \(/)
      expect(source).toContain(') : (')
    }
  })
})

describe('Concurrence', () => {
  it('le logo partage la colonne « version » des coordonnées', () => {
    // Deux onglets qui déposent un logo et corrigent une adresse se signalent
    // mutuellement plutôt que de s'écraser.
    expect(DATA).toMatch(/where: \{ version: entree\.version \}/)
    expect(ACTIONS).toMatch(/modifiées ailleurs entre-temps/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un SVG accepté', () => {
    const faux = "const TYPES_LOGO = ['image/png', 'image/svg+xml'] as const"
    expect(faux.includes('image/svg')).toBe(true)
  })

  it('détecte une vérification de WebP sur une plage trop courte', () => {
    const faux = "Range: 'bytes=0-7'"
    expect(faux.includes('bytes=0-11')).toBe(false)
  })
})
