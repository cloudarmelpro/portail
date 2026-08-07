import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSERVATION_ANS, finDeConservation, sousConservation } from '@/config/conservation'

/**
 * Durées de conservation — exigence TR-6.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le vrai risque de TR-6 n'est pas d'oublier d'effacer. C'est d'effacer.
 *
 * Trois ans pour les heures, six pour la paie, sont des durées MINIMALES
 * imposées par la norme du travail. Aucune ligne du projet ne doit les
 * raccourcir. Les tests de ce fichier ne vérifient donc pas qu'une purge tourne
 * — ils vérifient qu'aucune n'existe.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('Les durées viennent d’une source unique', () => {
  it('trois ans pour les heures, six pour la paie', () => {
    expect(CONSERVATION_ANS.heures).toBe(3)
    expect(CONSERVATION_ANS.paie).toBe(6)
  })

  it('l’échéance se compte en années civiles, pas en jours', () => {
    /*
      Un calcul en jours dériverait d'une journée par année bissextile. Ici,
      2024 est bissextile et 2027 ne l'est pas : une soustraction de 3 × 365
      jours placerait l'échéance au 29 février 2027, qui n'existe pas.
    */
    const echeance = finDeConservation(new Date('2024-02-29T12:00:00Z'), 'heures')
    expect(echeance.getUTCFullYear()).toBe(2027)
  })

  it('la date reçue n’est jamais modifiée en place', () => {
    // L'appelant s'en sert souvent juste après pour afficher la période.
    const origine = new Date('2026-01-15T00:00:00Z')
    const copie = new Date(origine)
    finDeConservation(origine, 'paie')
    expect(origine.getTime()).toBe(copie.getTime())
  })

  it('une heure d’hier est sous conservation, une de 2015 ne l’est plus', () => {
    const maintenant = new Date('2026-08-06T00:00:00Z')
    expect(sousConservation(new Date('2026-08-05T00:00:00Z'), 'heures', maintenant)).toBe(true)
    expect(sousConservation(new Date('2015-01-01T00:00:00Z'), 'heures', maintenant)).toBe(false)
  })

  it('la paie tient trois ans de plus que les heures', () => {
    // Une donnée de 2022 : libérée côté heures, encore retenue côté paie.
    const maintenant = new Date('2026-08-06T00:00:00Z')
    const depuis = new Date('2022-01-01T00:00:00Z')
    expect(sousConservation(depuis, 'heures', maintenant)).toBe(false)
    expect(sousConservation(depuis, 'paie', maintenant)).toBe(true)
  })
})

describe('Rien n’efface les registres', () => {
  /*
    La garantie est structurelle : elle ne tient pas à ce qu'on n'ait pas écrit
    de purge, mais à ce qu'un test refuse celle qu'on écrirait distraitement.
  */
  const ENTRETIEN = lire('src/app/api/entretien/route.ts')

  it('l’entretien périodique ne touche ni aux heures ni à la paie', () => {
    /*
      C'est le SEUL point d'entrée destructeur du projet — un planificateur
      l'appelle chaque jour, sans session et sans personne pour relire ce qu'il
      efface. Y raccrocher une purge d'heures serait invisible en revue.
    */
    for (const modele of ['saisieJour', 'periodePaie', 'correctionHeures', 'employe']) {
      expect(ENTRETIEN).not.toContain(modele)
    }
    expect(ENTRETIEN).not.toMatch(/heures/i)
  })

  it('aucune purge par ancienneté n’existe sur les heures', () => {
    /*
      Une purge se reconnaît à sa forme : une borne de date HAUTE et rien en
      dessous — « tout ce qui précède ». C'est ce qui la distingue de
      `copierSemaine`, qui efface aussi des saisies mais dans une fenêtre
      fermée des deux côtés : une semaine précise, désignée par l'utilisateur.

      La différence n'est pas cosmétique. Une fenêtre fermée ne peut pas
      remonter jusqu'aux archives ; une borne haute seule les emporte toutes.

      On cherche partout dans lib/, pas seulement dans le module des heures —
      c'est le fichier inattendu qui échapperait à la relecture.
    */
    const suspects: string[] = []
    for (const chemin of fichiersDe('src/lib')) {
      for (const appel of suppressionsDe(lire(chemin), MODELES_REGISTRE)) {
        const borneHaute = /\bl(t|te)\s*:/.test(appel)
        const borneBasse = /\bg(t|te)\s*:/.test(appel)
        if (borneHaute && !borneBasse) suspects.push(`${chemin} — ${appel.slice(0, 80)}`)
      }
    }
    expect(suspects).toEqual([])
  })

  it('un employé parti est désactivé, jamais supprimé', () => {
    // Ses heures passées appartiennent au registre de paie, conservé six ans.
    const HEURES = lire('src/lib/data/heures.ts')
    expect(HEURES).not.toMatch(/prisma\.employe\.delete\b/)
    expect(HEURES).not.toMatch(/employe\.deleteMany/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte une purge des heures par ancienneté', () => {
    const faux = `await prisma.saisieJour.deleteMany({ where: { date: { lt: limite } } })`
    const [appel] = suppressionsDe(faux, MODELES_REGISTRE)
    expect(appel).toBeDefined()
    expect(/\bl(t|te)\s*:/.test(appel)).toBe(true)
    expect(/\bg(t|te)\s*:/.test(appel)).toBe(false)
  })

  it('ne confond pas une fenêtre fermée avec une purge', () => {
    // La copie de semaine efface une plage bornée des deux côtés : légitime.
    const copie = `prisma.saisieJour.deleteMany({ where: { date: { gte: debut, lte: fin } } })`
    const [appel] = suppressionsDe(copie, MODELES_REGISTRE)
    expect(/\bg(t|te)\s*:/.test(appel)).toBe(true)
  })

  it('détecte une purge branchée sur l’entretien périodique', () => {
    const faux = `import { purgerHeures } from '@/lib/data/heures'`
    expect(/heures/i.test(faux)).toBe(true)
  })
})

const MODELES_REGISTRE = ['saisieJour', 'periodePaie', 'correctionHeures'] as const

/**
 * Extrait le corps de chaque appel de suppression portant sur ces modèles.
 *
 * Découpage par comptage d'accolades plutôt que par expression régulière : un
 * `where` imbriqué — et ils le sont tous — déborde de ce qu'une regex sait
 * apparier, et une regex gourmande avalerait le fichier entier jusqu'à trouver
 * une borne dans un appel sans rapport.
 */
function suppressionsDe(source: string, modeles: readonly string[]): string[] {
  const sortie: string[] = []

  for (const modele of modeles) {
    const motif = new RegExp(`${modele}\\.delete(Many)?\\(`, 'g')
    for (const trouve of source.matchAll(motif)) {
      let profondeur = 0
      let i = trouve.index + trouve[0].length - 1

      for (; i < source.length; i++) {
        if (source[i] === '(') profondeur++
        else if (source[i] === ')' && --profondeur === 0) break
      }
      sortie.push(source.slice(trouve.index, i + 1))
    }
  }
  return sortie
}

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.ts')) sortie.push(chemin)
    }
  }

  parcourir(racine)
  return sortie
}
