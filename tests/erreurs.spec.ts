import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ErreurAcces, ErreurMetier, estErreurAcces, estErreurMetier } from '@/lib/erreurs'

/**
 * Deux canaux d'erreur, et un test qui empêche le troisième de réapparaître.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le défaut que ce fichier surveille.
 *
 * La fabrique d'actions remplace le message de toute erreur inattendue par
 * « Une erreur est survenue. Réessayez. » — c'est juste : le message d'une panne
 * peut nommer une table ou une contrainte.
 *
 * Mais un `throw new Error('Rechargez la page avant de recommencer.')` dans un
 * traitement tombe dans ce filet. La donnée est protégée, l'utilisateur ne sait
 * pas pourquoi, réessaie à l'identique, et échoue à nouveau. Le contrôle de
 * concurrence perd tout effet utile sans rien signaler.
 *
 * Le défaut est resté invisible dans `lib/actions/cv.ts` pendant tout le
 * développement du module : il n'apparaît que si deux onglets modifient le même
 * fichier. D'où ce test, qui le rend impossible à réintroduire.
 * ─────────────────────────────────────────────────────────────────────────
 */

const DOSSIER = join(process.cwd(), 'src', 'lib', 'actions')

function fichiers(): string[] {
  return readdirSync(DOSSIER).filter((f) => f.endsWith('.ts'))
}

/** Retire commentaires et chaînes — un exemple en commentaire n'est pas du code. */
function nettoyer(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

describe('Canaux d’erreur', () => {
  it('un refus métier se reconnaît après sérialisation', () => {
    // Next perd la chaîne de prototypes entre serveur et client : la
    // reconnaissance porte sur le code, pas sur `instanceof`.
    const serialise = JSON.parse(JSON.stringify({ code: 'REFUS_METIER', message: 'Non.' }))
    expect(estErreurMetier(serialise)).toBe(true)
    expect(estErreurMetier(new ErreurMetier('Non.'))).toBe(true)
  })

  it('les deux canaux ne se confondent pas', () => {
    expect(estErreurMetier(new ErreurAcces())).toBe(false)
    expect(estErreurAcces(new ErreurMetier('Non.'))).toBe(false)
    expect(estErreurMetier(new Error('panne'))).toBe(false)
    expect(estErreurMetier(null)).toBe(false)
  })

  it('un refus métier conserve son message et son champ', () => {
    const e = new ErreurMetier('Un compte existe déjà pour cette adresse.', 'courriel')
    expect(e.message).toBe('Un compte existe déjà pour cette adresse.')
    expect(e.champ).toBe('courriel')
  })
})

describe('Aucun refus métier levé en Error nu', () => {
  describe.each(fichiers())('%s', (fichier) => {
    const code = nettoyer(readFileSync(join(DOSSIER, fichier), 'utf8'))

    it('ne lève ni Error ni ErreurAcces pour un refus métier', () => {
      /*
        `ErreurAcces` reste légitime dans les gardes de `lib/guards.ts`, jamais
        dans le traitement d'une action : à ce stade la permission est déjà
        vérifiée par la fabrique. L'y trouver signale un contournement — c'est
        exactement ce que l'agent Administration avait fait, en le signalant.
      */
      const nus = [...code.matchAll(/throw\s+new\s+(Error|ErreurAcces)\s*\(/g)].map(
        (m) => m[1] as string,
      )

      expect(
        nus,
        `${fichier} : un refus métier doit lever ErreurMetier — sinon son message est avalé par la fabrique. Trouvé : ${nus.join(', ')}`,
      ).toEqual([])
    })
  })
})

describe('La fabrique laisse bien passer le message', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'lib', 'safe-action.ts'), 'utf8')

  it('les deux fabriques reconnaissent ErreurMetier', () => {
    // Deux occurrences : `createAction` et `createActionCloisonnee`. Une seule
    // signifierait qu'une des deux avale encore les messages.
    const passages = [...source.matchAll(/instanceof\s+ErreurMetier/g)]
    expect(passages).toHaveLength(2)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un Error nu levé dans une action', () => {
    const faux = nettoyer(`
      handler() { throw new Error('Rechargez la page.') }
    `)
    const nus = [...faux.matchAll(/throw\s+new\s+(Error|ErreurAcces)\s*\(/g)].map((m) => m[1])
    expect(nus).toEqual(['Error'])
  })
})
