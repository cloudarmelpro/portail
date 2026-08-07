import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aujourdHui, enIso, jour, jourOuNull, lundiDe, resoudreSemaine } from '@/lib/domaine/heures'

/**
 * Sélecteur de période de la grille — exigence HEU-6.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La semaine affichée vit dans l'URL, et l'URL n'est pas de confiance.
 *
 * Elle est lisible, modifiable à la main, collée dans un courriel, rejouée par
 * le bouton « retour ». Ce qui en revient doit donc toujours donner une semaine
 * — jamais une exception, jamais une date décalée en silence, jamais une semaine
 * à venir qui n'a rien à montrer.
 *
 * Le décalage silencieux est le cas insidieux : « 2026-02-31 » passe le motif de
 * date, mais `Date.UTC` la reporte au 3 mars. L'écran ouvrirait alors une autre
 * semaine que celle demandée — donc une autre clé de brouillon (TR-13), et une
 * saisie en cours qui semble s'être volatilisée.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (...chemin: string[]) => readFileSync(join(process.cwd(), ...chemin), 'utf8')

const SOURCE_PAGE = lire('src', 'app', '(app)', 'heures', 'page.tsx')
const SOURCE_NAV = lire('src', 'components', 'heures', 'navigation-semaine.tsx')
const SOURCE_GRILLE = lire('src', 'components', 'heures', 'grille-heures.tsx')

/** Un jeudi. Sa semaine commence le lundi 3 août 2026. */
const REFERENCE = jour('2026-08-06')
const LUNDI_COURANT = '2026-08-03'

describe('Résolution de la semaine demandée', () => {
  it('sans paramètre, la semaine courante', () => {
    expect(enIso(resoudreSemaine(undefined, REFERENCE))).toBe(LUNDI_COURANT)
  })

  it('un jour quelconque ouvre le lundi de SA semaine', () => {
    // Un lien partagé peut porter n'importe quel jour : c'est la semaine qui
    // s'affiche, pas le jour.
    expect(enIso(resoudreSemaine('2026-07-30', REFERENCE))).toBe('2026-07-27')
    expect(enIso(resoudreSemaine('2026-07-27', REFERENCE))).toBe('2026-07-27')
    expect(enIso(resoudreSemaine('2026-08-02', REFERENCE))).toBe('2026-07-27')
  })

  it('une semaine passée s’ouvre telle quelle — c’est l’objet de HEU-6', () => {
    expect(enIso(resoudreSemaine('2026-01-12', REFERENCE))).toBe('2026-01-12')
    expect(enIso(resoudreSemaine('2019-03-15', REFERENCE))).toBe('2019-03-11')
  })

  it('une semaine à venir se replie sur la semaine courante', () => {
    // Rien n'y a été travaillé, et l'écriture y serait de toute façon refusée.
    expect(enIso(resoudreSemaine('2026-08-10', REFERENCE))).toBe(LUNDI_COURANT)
    expect(enIso(resoudreSemaine('2031-01-01', REFERENCE))).toBe(LUNDI_COURANT)
  })

  it('le dimanche de la semaine courante n’est pas « à venir »', () => {
    // Frontière : le 9 août est un dimanche, dernier jour de la semaine du 3.
    expect(enIso(resoudreSemaine('2026-08-09', REFERENCE))).toBe(LUNDI_COURANT)
  })

  it('une date qui n’existe pas se replie, elle ne se décale pas', () => {
    expect(enIso(resoudreSemaine('2026-02-31', REFERENCE))).toBe(LUNDI_COURANT)
    expect(enIso(resoudreSemaine('2026-13-01', REFERENCE))).toBe(LUNDI_COURANT)
    expect(enIso(resoudreSemaine('2025-02-29', REFERENCE))).toBe(LUNDI_COURANT)
  })

  it('un paramètre répété donne un tableau, pas une chaîne', () => {
    // `?semaine=a&semaine=b` — la signature l'admet, le repli doit le couvrir.
    expect(enIso(resoudreSemaine(['2026-01-12', '2026-01-19'], REFERENCE))).toBe(LUNDI_COURANT)
  })

  it('aucune valeur ne fait lever d’exception', () => {
    const douteuses = [
      '',
      ' ',
      'la-semaine-derniere',
      '2026-8-3',
      '2026/08/03',
      '03-08-2026',
      '2026-08-03T00:00:00Z',
      '0000-00-00',
      '99999999',
      '../../etc/passwd',
      "2026-08-03'; DROP TABLE saisie_jour;--",
      '2026-08-03\n',
    ]
    for (const v of douteuses) {
      expect(() => resoudreSemaine(v, REFERENCE), `« ${v} » a levé`).not.toThrow()
      expect(enIso(resoudreSemaine(v, REFERENCE))).toBe(LUNDI_COURANT)
    }
  })

  it('le lundi rendu est un point fixe : le lien qu’il produit rouvre la même semaine', () => {
    /*
      La navigation fabrique ses liens à partir du lundi résolu. Sans ce point
      fixe, « précédente » puis « suivante » ne ramènerait pas au point de
      départ, et l'historique du navigateur dériverait d'un jour à chaque pas.
    */
    for (const v of ['2026-07-30', '2026-02-31', undefined, '2031-01-01']) {
      const premier = resoudreSemaine(v, REFERENCE)
      expect(enIso(resoudreSemaine(enIso(premier), REFERENCE))).toBe(enIso(premier))
    }
  })
})

describe('La semaine courante se calcule au Québec, pas au fuseau du serveur', () => {
  /*
    Le dimanche soir est le moment où le défaut se voit. À 22 h à Montréal, le
    conteneur — en UTC — est déjà au lundi : il proposerait la semaine SUIVANTE
    à quelqu'un qui saisit encore la sienne, et le brouillon irait sous une autre
    clé.
  */
  const DIMANCHE_SOIR = new Date('2026-08-10T02:00:00Z')

  it('un dimanche soir reste dans la semaine qui s’achève', () => {
    expect(enIso(aujourdHui(DIMANCHE_SOIR))).toBe('2026-08-09')
    expect(enIso(resoudreSemaine(undefined, aujourdHui(DIMANCHE_SOIR)))).toBe(LUNDI_COURANT)
  })

  it('lu au fuseau du serveur, ce serait déjà la semaine suivante', () => {
    // Le contre-exemple : c'est bien un écart d'une semaine entière.
    const naif = jour(DIMANCHE_SOIR.toISOString().slice(0, 10))
    expect(enIso(lundiDe(naif))).toBe('2026-08-10')
  })

  it('le décalage n’est pas constant — l’heure avancée est prise en compte', () => {
    // Janvier : UTC−5. Juillet : UTC−4. Une soustraction en dur se tromperait
    // d'une heure la moitié de l'année, donc d'un jour une nuit sur deux.
    expect(enIso(aujourdHui(new Date('2026-01-05T04:30:00Z')))).toBe('2026-01-04')
    expect(enIso(aujourdHui(new Date('2026-07-06T03:30:00Z')))).toBe('2026-07-05')
  })

  it('le module des heures ne réécrit pas sa propre notion de « aujourd’hui »', () => {
    /*
      Deux implémentations jumelées de la règle du jour civil finissent toujours
      par diverger, et l'écart ne se lit qu'à la clôture d'une période. Elles
      viennent donc de `lib/domaine/dates.ts`, et de là seulement.
    */
    const domaine = lire('src', 'lib', 'domaine', 'heures.ts')
    expect(domaine).toMatch(/from '@\/lib\/domaine\/dates'/)
    expect(domaine).not.toMatch(/function aujourdHui\(/)
    expect(domaine).not.toMatch(/function ajouterJours\(/)
    expect(domaine).not.toContain('Intl.DateTimeFormat({')
    expect(domaine).not.toMatch(/timeZone: FUSEAU/)
  })
})

describe('Lecture stricte d’un jour venu d’une URL', () => {
  it('accepte un jour réel', () => {
    expect(jourOuNull('2026-08-03')).toEqual(jour('2026-08-03'))
    expect(jourOuNull('2024-02-29')).toEqual(jour('2024-02-29'))
  })

  it('refuse un jour que le calendrier ne porte pas', () => {
    expect(jourOuNull('2026-02-31')).toBeNull()
    expect(jourOuNull('2025-02-29')).toBeNull()
    expect(jourOuNull('2026-13-01')).toBeNull()
    expect(jourOuNull('2026-00-10')).toBeNull()
  })

  it('refuse tout ce qui n’est pas AAAA-MM-JJ', () => {
    for (const v of ['2026-8-3', '26-08-03', '2026-08-03 ', 'hier']) {
      expect(jourOuNull(v), `« ${v} » accepté`).toBeNull()
    }
  })
})

describe('L’écran pilote la période par l’URL, jamais par un état client', () => {
  it('la page attend le Promise de searchParams', () => {
    expect(SOURCE_PAGE).toMatch(/await props\.searchParams/)
  })

  it('la page passe par la résolution commune, sans refaire le repli', () => {
    expect(SOURCE_PAGE).toMatch(/const lundi = resoudreSemaine\(semaine, \w+\)/)
    // Un second motif de date recopié ici finirait par diverger de celui du
    // domaine — c'est ainsi que le repli devient inégal selon l'écran.
    expect(SOURCE_PAGE).not.toMatch(/\\d\{4\}-\\d\{2\}-\\d\{2\}/)
  })

  it('la navigation ne porte aucun état : c’est un composant serveur', () => {
    expect(SOURCE_NAV).not.toContain('use client')
    expect(SOURCE_NAV).not.toMatch(/\buseState\b|\buseRouter\b|onClick/)
  })

  it('elle navigue par liens — donc historique et partage fonctionnent', () => {
    expect(SOURCE_NAV).toMatch(/<Link\s+href=\{precedente\}/)
    expect(SOURCE_NAV).toMatch(/href=\{suivante\}/)
    expect(SOURCE_NAV).toMatch(/href=\{courante\}/)
  })

  it('les libellés sont ceux de la section 19', () => {
    expect(SOURCE_NAV).toContain('aria-label="Semaine précédente"')
    expect(SOURCE_NAV).toContain('aria-label="Semaine suivante"')
    expect(SOURCE_NAV).toContain('Cette semaine')
  })

  it('les cibles tactiles font 44 px sur téléphone', () => {
    expect(SOURCE_NAV).toMatch(/size-11/)
    expect(SOURCE_NAV).toMatch(/h-11/)
  })

  it('le sélecteur reste atteignable sans aucun employé actif', () => {
    /*
      Rendu à l'intérieur de la grille, il disparaissait avec elle : plus aucun
      employé actif, et les périodes passées devenaient inconsultables alors
      qu'elles contiennent les heures d'employés depuis désactivés.
    */
    /*
      Les commandes sont désormais rendues UNE fois, avant la branche, puis
      passées aux deux côtés : à la grille, qui les place à gauche de ses
      boutons, et à l'état vide, qui les rend seules. Deux appels séparés
      auraient divergé à la première retouche, et c'est le cas rare — celui sans
      employé — qui aurait gardé l'ancienne version.
    */
    const commandes = SOURCE_PAGE.indexOf('const commandes = (')
    const branche = SOURCE_PAGE.indexOf('employes.length === 0')
    expect(commandes).toBeGreaterThan(0)
    expect(commandes).toBeLessThan(branche)

    // Les deux branches les rendent : celle de l'état vide directement, celle de
    // la grille en propriété.
    const vide = SOURCE_PAGE.slice(branche, SOURCE_PAGE.indexOf(') : ('))
    expect(vide).toContain('{commandes}')
    expect(SOURCE_PAGE).toContain('enTete={commandes}')

    // La grille ne les CONNAÎT toujours pas : elle leur fait une place.
    expect(SOURCE_GRILLE).not.toContain('NavigationSemaine')
    expect(SOURCE_GRILLE).not.toContain('FiltresHeures')
  })

  it('la semaine suivante est fermée quand on est déjà sur la semaine courante', () => {
    // Sinon le lien mène à une semaine à venir, que la page replie aussitôt :
    // un pas en avant qui ne bouge pas est un défaut, pas une protection.
    expect(SOURCE_PAGE).toContain('suivante={estCourante ? null : lien(ajouterJours(lundi, 7))}')
    expect(SOURCE_NAV).toMatch(/suivante === null \? \(\s*<button type="button" disabled/)
  })
})

describe('La clé de brouillon suit la semaine affichée — TR-13', () => {
  it('la grille reçoit le lundi résolu, et rien d’autre', () => {
    expect(SOURCE_PAGE).toContain('debut={enIso(lundi)}')
    expect(SOURCE_PAGE).toContain('const lundi = resoudreSemaine(')
  })

  it('la clé du brouillon est bâtie sur ce même lundi', () => {
    /*
      Invariant réparti sur deux fichiers : la page choisit la semaine, la grille
      en fait la clé. Si la page renvoyait un lundi décalé — le report silencieux
      d'une date inexistante —, la saisie serait retenue sous une clé qui ne
      correspond à aucune semaine consultable.
    */
    expect(SOURCE_GRILLE).toMatch(/`heures:\$\{debut\}`/)
  })
})

describe('Le test peut échouer', () => {
  it('détecte un repli qui laisse passer une semaine à venir', () => {
    const sansRepli = (v: string) => lundiDe(jour(v))
    expect(enIso(sansRepli('2031-01-01'))).not.toBe(LUNDI_COURANT)
  })

  it('détecte le report silencieux d’une date inexistante', () => {
    // C'est exactement ce que faisait l'écran avant : « 2026-02-31 » ouvrait la
    // semaine du 2 mars sans que rien ne le signale.
    expect(enIso(jour('2026-02-31'))).toBe('2026-03-03')
  })
})
