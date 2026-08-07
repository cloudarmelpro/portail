import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { composerEntete } from '@/components/calculateur/entete-document'
import { ventilerEmis } from '@/lib/domaine/estimation'
import type { EstimationDocument } from '@/lib/data/estimations'

/**
 * Le document remis au client — exigence EST-10.
 *
 * Deux rendus produisent le même papier : l'aperçu HTML imprimable et le PDF
 * composé par le serveur. Ce fichier tient ce qu'ils PARTAGENT — la ventilation
 * des montants, l'en-tête, la palette — parce que c'est là qu'une divergence ne
 * se verrait qu'une fois le devis parti chez le client.
 *
 * `server-only` : `pdf-estimation.tsx` en est marqué, l'importer tel quel
 * échouerait au chargement.
 */
vi.mock('server-only', () => ({}))

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/* ══════════════════════════════════════════════════════════════════
   Ventilation d'une estimation ÉMISE
   ══════════════════════════════════════════════════════════════════ */

describe('Ventilation des montants enregistrés', () => {
  it('déduit le sous-total des lignes, la majoration et le rabais', () => {
    // 1000 de lignes + 100 de frais = 1100 ; + 10 % = 110 ; sous-total émis 1102
    // ⇒ le rabais vaut nécessairement 108.
    const v = ventilerEmis({
      lignes: [{ sousTotal: 600 }, { sousTotal: 400 }],
      fraisDeplacement: 100,
      majorationPct: 10,
      sousTotal: 1102,
    })

    expect(v.sousTotalLignes).toBe(1000)
    expect(v.majoration).toBe(110)
    expect(v.rabais).toBe(108)
  })

  it('ne rend aucun rabais quand il n’y en a pas', () => {
    const v = ventilerEmis({
      lignes: [{ sousTotal: 250 }],
      fraisDeplacement: 0,
      majorationPct: 0,
      sousTotal: 250,
    })
    expect(v.rabais).toBe(0)
    expect(v.majoration).toBe(0)
  })

  it('la ventilation s’additionne TOUJOURS jusqu’au sous-total émis', () => {
    /*
      C'est l'invariant du document : le client additionne les lignes du papier.
      Le rabais est un ÉCART, pas une reconstitution des deux rabais saisis —
      une reconstitution referait l'arithmétique du domaine et pourrait en
      diverger sans que rien ne le signale.
    */
    const cas = [
      { lignes: [{ sousTotal: 33.33 }], fraisDeplacement: 12.5, majorationPct: 7.25 },
      { lignes: [{ sousTotal: 0.01 }], fraisDeplacement: 0, majorationPct: 100 },
      {
        lignes: [{ sousTotal: 999.99 }, { sousTotal: 0.02 }],
        fraisDeplacement: 45,
        majorationPct: 0,
      },
    ]

    for (const c of cas) {
      const sousTotal = 500
      const v = ventilerEmis({ ...c, sousTotal })
      const recompose = v.sousTotalLignes + c.fraisDeplacement + v.majoration - v.rabais
      expect(Math.abs(recompose - sousTotal)).toBeLessThan(0.005)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════
   En-tête — logo, raison sociale, coordonnées partielles
   ══════════════════════════════════════════════════════════════════ */

describe('En-tête du document', () => {
  const vide = { raisonSociale: '', adresse: '', telephone: '' }

  it('sans raison sociale, le nom de l’entreprise porte le filet de couleur', () => {
    const e = composerEntete('paysagement', vide)
    expect(e.titre).toBe('Paysagement')
    // Pas de sur-titre : il répéterait le nom juste en dessous.
    expect(e.nommerEntreprise).toBe(false)
  })

  it('une raison sociale distincte fait écrire le nom de l’entreprise à côté du filet', () => {
    /*
      Section 19 : une couleur d'entreprise n'apparaît jamais sans son nom écrit.
      « 9123-4567 Québec inc. » ne dit pas de quelle entreprise il s'agit — le
      filet resterait la seule information, et la couleur serait alors seule.
    */
    const e = composerEntete('staff', { ...vide, raisonSociale: '9123-4567 Québec inc.' })
    expect(e.titre).toBe('9123-4567 Québec inc.')
    expect(e.nommerEntreprise).toBe(true)
    expect(e.nomEntreprise).toBe('Staff augmentation')
  })

  it('une raison sociale identique au nom ne l’écrit pas deux fois', () => {
    const e = composerEntete('developpement', { ...vide, raisonSociale: 'Développement web' })
    expect(e.nommerEntreprise).toBe(false)
  })

  it('les deux coordonnées présentes se joignent, sans bandeau', () => {
    const e = composerEntete('paysagement', {
      raisonSociale: 'Les Jardins du Nord',
      adresse: '12 rue Principale, Québec',
      telephone: '418 555 0142',
    })
    expect(e.coordonnees).toBe('12 rue Principale, Québec · 418 555 0142')
    expect(e.aCompleter).toBe(false)
  })

  it('une coordonnée saisie reste affichée quand l’autre manque', () => {
    /*
      Le bandeau était en tout-ou-rien : une adresse saisie disparaissait du
      document entier parce que le téléphone était encore vide. On perdait la
      donnée vraie pour signaler celle qui manque.
    */
    const e = composerEntete('paysagement', {
      ...vide,
      adresse: '12 rue Principale, Québec',
    })
    expect(e.coordonnees).toBe('12 rue Principale, Québec')
    expect(e.aCompleter).toBe(true)
  })

  it('aucune coordonnée ne laisse pas de ligne fantôme', () => {
    const e = composerEntete('paysagement', vide)
    // `null`, et non chaîne vide : le rendu ne doit pas produire de bloc vide
    // entre le nom et le bandeau.
    expect(e.coordonnees).toBeNull()
    expect(e.aCompleter).toBe(true)
  })

  it('des champs blancs valent des champs vides', () => {
    const e = composerEntete('paysagement', {
      raisonSociale: '   ',
      adresse: '  ',
      telephone: '\t',
    })
    expect(e.titre).toBe('Paysagement')
    expect(e.coordonnees).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════
   Palette du PDF — doublon tenu par le test
   ══════════════════════════════════════════════════════════════════ */

describe('La palette du PDF suit globals.css', () => {
  /*
    Le PDF est composé hors du navigateur : il n'a pas de feuille de style, donc
    aucun moyen de lire une variable CSS. Les valeurs sont recopiées, et ce test
    est la seule chose qui empêche les deux de dériver — un jeton corrigé dans
    globals.css sans report ici donnerait deux documents de couleurs différentes
    pour la même estimation.
  */
  let racine = ''

  beforeAll(() => {
    const css = lire('src/app/globals.css')
    const debut = css.indexOf(':root {')
    // Le bloc `.dark` redéfinit --pays, --dev et --staff : s'arrêter avant lui.
    racine = css.slice(debut, css.indexOf('.dark {'))
    expect(debut).toBeGreaterThanOrEqual(0)
  })

  it('chaque couleur du PDF vaut celle du jeton correspondant', async () => {
    const { PALETTE_PDF } = await import('@/components/calculateur/pdf-estimation')

    for (const [jeton, valeur] of Object.entries(PALETTE_PDF)) {
      const trouve = new RegExp(`${jeton}:\\s*(#[0-9a-fA-F]{3,8});`).exec(racine)
      expect(trouve, `Jeton ${jeton} introuvable dans le :root de globals.css`).not.toBeNull()
      expect(trouve?.[1]?.toLowerCase(), `${jeton} a dérivé`).toBe(valeur)
    }
  })

  it('couvre les quatre jetons de document et les trois entreprises', async () => {
    const { PALETTE_PDF } = await import('@/components/calculateur/pdf-estimation')
    expect(Object.keys(PALETTE_PDF).sort()).toEqual(
      ['--dev', '--pays', '--pdf-ink', '--pdf-ink2', '--pdf-paper', '--pdf-rule', '--staff'].sort(),
    )
  })

  it('le test peut échouer', () => {
    const faux = ':root { --pdf-ink: #000000; }'
    expect(/--pdf-ink:\s*(#[0-9a-fA-F]{3,8});/.exec(faux)?.[1]).not.toBe('#111111')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Rendu du PDF
   ══════════════════════════════════════════════════════════════════ */

function estimation(partiel: Partial<EstimationDocument> = {}): EstimationDocument {
  return {
    id: 'est-1',
    reference: 'PAY-2026-014',
    statut: 'envoye',
    version: 1,
    date: new Date('2026-08-03T14:00:00.000Z'),
    emiseLe: new Date('2026-08-03T14:05:00.000Z'),
    valideJusquau: new Date('2026-09-02T00:00:00.000Z'),
    origineId: null,
    creeParNom: 'Cédric Lévesque',
    client: {
      id: 'cli-1',
      nom: 'Coopérative de l’Île',
      telephone: '418 555 0142',
      adresse: '12 rue Principale, Québec',
    },
    lignes: [
      {
        designation: 'Tonte de pelouse',
        unite: 'm²',
        prixUnitaire: 0.45,
        quantite: 2000,
        sousTotal: 900,
      },
      { designation: 'Élagage', unite: 'heure', prixUnitaire: 85, quantite: 4, sousTotal: 340 },
    ],
    fraisDeplacement: 60,
    majorationPct: 0,
    rabaisMontant: 100,
    rabaisPct: 0,
    sousTotal: 1200,
    tps: 60,
    tvq: 119.7,
    total: 1379.7,
    tauxTps: 0.05,
    tauxTvq: 0.09975,
    ...partiel,
  }
}

describe('Rendu du PDF', () => {
  it('produit un fichier PDF valide', async () => {
    const { rendreEstimationPdf } = await import('@/components/calculateur/pdf-estimation')

    const octets = await rendreEstimationPdf({
      slug: 'paysagement',
      estimation: estimation(),
      organisation: {
        raisonSociale: 'Les Jardins du Nord',
        adresse: '12 rue Principale, Québec',
        telephone: '418 555 0142',
      },
      logo: null,
    })

    expect(Buffer.from(octets).subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(octets.byteLength).toBeGreaterThan(1000)
  }, 20_000)

  it('se rend aussi sans client, sans coordonnées et sans ligne', async () => {
    /*
      Les trois absences arrivent réellement : une estimation dont le client a
      été retiré du dossier, une organisation jamais renseignée, une estimation
      vidée de ses lignes. Aucune ne doit faire échouer l'export — le devis reste
      le seul document que le client a reçu.
    */
    const { rendreEstimationPdf } = await import('@/components/calculateur/pdf-estimation')

    const octets = await rendreEstimationPdf({
      slug: 'staff',
      estimation: estimation({ client: null, lignes: [], valideJusquau: null }),
      organisation: { raisonSociale: '', adresse: '', telephone: '' },
      logo: null,
    })

    expect(Buffer.from(octets).subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 20_000)

  it('nomme le fichier par la référence de l’estimation', async () => {
    const { nomFichierPdf } = await import('@/components/calculateur/pdf-estimation')
    expect(nomFichierPdf('PAY-2026-014')).toBe('PAY-2026-014.pdf')
  })
})

/* ══════════════════════════════════════════════════════════════════
   Route d'export — analyse statique
   ══════════════════════════════════════════════════════════════════ */

describe('La route d’export PDF', () => {
  const ROUTE = lire('src/app/(app)/calculateur/[entreprise]/estimations/[id]/pdf/route.ts')

  it('exige une session PUIS la permission de lecture', () => {
    /*
      Une route n'est pas traversée par les layouts : quiconque connaît l'URL
      l'appelle directement. Le devis porte le nom du client, son adresse et ses
      montants — c'est une fuite complète de dossier.
    */
    const avant = ROUTE.slice(0, ROUTE.indexOf('estimationParId(db, id)'))
    expect(avant).toContain('sessionCourante()')
    expect(avant).toContain("aPermission(session.role, 'calculateur:lire')")
    expect(avant.indexOf('sessionCourante()')).toBeLessThan(
      avant.indexOf("aPermission(session.role, 'calculateur:lire')"),
    )
  })

  it('revalide le slug d’entreprise avant d’ouvrir la base', () => {
    // Il vient de l'URL : il n'a aucune valeur de preuve tant qu'il n'est pas
    // reconnu par `config/entreprises.ts`.
    const avant = ROUTE.slice(0, ROUTE.indexOf('prismaCadre('))
    expect(avant).toContain('estEntreprise(entreprise)')
  })

  it('lit l’estimation par le client CADRÉ, jamais par son seul identifiant', () => {
    expect(ROUTE).toContain('prismaCadre(entreprise)')
    expect(ROUTE).toContain('estimationParId(db, id)')
  })

  it('n’est jamais mise en cache', () => {
    // Un devis appartient à un dossier : un intermédiaire qui le garderait le
    // servirait à la requête suivante, entreprise comprise.
    expect(ROUTE).toContain("'Cache-Control': 'no-store, max-age=0'")
  })

  it('ne contient aucun appel Prisma direct', () => {
    expect(ROUTE).not.toMatch(/\bdb\.[a-z]/)
  })
})
