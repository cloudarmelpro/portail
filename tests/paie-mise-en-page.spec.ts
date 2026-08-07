import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Écran des paramètres de paie — gabarit d'administration et justesse de saisie.
 *
 * Les sources sont LUES plutôt qu'importées : la page tire `lib/data`, marqué
 * `server-only`, et le formulaire tire `lib/actions`, qui charge Prisma. Les
 * autres tests de mise en page du projet procèdent de la même façon.
 */
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/admin/paie/page.tsx')
const FORMULAIRE = lire('src/components/admin/formulaire-paie.tsx')

/** Libellés de la section 19 — « Formulaires — champs, aides et exemples ». */
const ETIQUETTES = ['Seuil des heures supplémentaires', 'Majoration', 'Durée de la période de paie']

describe('Paramètres de paie — gabarit d’administration', () => {
  it('porte la bande de sections, sans actions à sa droite', () => {
    // Le titre reste dans le document en `sr-only` : c'est `EnTeteAdmin` qui le
    // pose. Rien à droite du contrôle segmenté — cet écran n'a pas d'action de
    // barre, son seul bouton est celui du formulaire.
    expect(PAGE).toContain('<EnTeteAdmin titre="Paramètres de paie" />')
    expect(PAGE).not.toContain('actions=')
  })

  it('part du même axe que le chrome, comme les quatre autres', () => {
    // Le contrôle d'ensemble vit dans `organisation.spec.ts` ; celui-ci ne
    // vérifie que ce qui est propre à cet écran.
    expect(PAGE).toContain('<div className="mt-10">')
    expect(PAGE).not.toContain('xl:mx-24')
  })

  it('n’affiche aucune bande de chiffres', () => {
    /*
      Les trois valeurs réglables SONT les champs, quelques pixels plus bas. Une
      bande les répéterait, et divergerait de l'enregistré dès la première frappe.
    */
    expect(PAGE).not.toContain('BandeChiffres')
  })

  it('borne la colonne de saisie', () => {
    // Une ligne de saisie étalée sur 1250 px ne se relit pas.
    expect(FORMULAIRE).toContain('max-w-[620px]')
  })
})

describe('Paramètres de paie — justesse de la saisie', () => {
  it('garde le seuil et la majoration en chaînes', () => {
    /*
      Une durée et un multiplicateur vont dans un `Decimal` : les convertir en
      nombre ici pour les reconvertir plus loin les ferait passer par un flottant.
    */
    expect(FORMULAIRE).not.toMatch(/Number\(\s*(valeurs\.)?(seuilSupplementaires|majoration)/)
    expect(FORMULAIRE).not.toMatch(/parseFloat|parseInt/)
  })

  it('renvoie la version reçue — TR-10', () => {
    // Sans elle, deux onglets s'écrasent en silence.
    expect(FORMULAIRE).toContain('version: parametres.version')
  })

  it('cible tactile de 44 px au doigt', () => {
    /*
      La mesure vient du gabarit partagé. Elle a vécu recopiée ici, avec un
      rayon de 9 px et une surface surélevée : d'un onglet à l'autre de la même
      bande, les champs changeaient de forme.
    */
    expect(FORMULAIRE).toContain("from '@/components/shared/gabarits'")
    expect(FORMULAIRE).toContain('cn(CHAMP,')
    expect(lire('src/components/shared/gabarits.ts')).toMatch(/h-11[^']*md:h-10/)
  })

  it('n’écrit que les libellés de la section 19', () => {
    for (const etiquette of ETIQUETTES) {
      expect(FORMULAIRE, etiquette).toContain(`libelle="${etiquette}"`)
    }

    for (const aide of [
      'Au-delà de ce nombre d’heures par semaine, la majoration s’applique.',
      'Multiplicateur appliqué au taux horaire au-delà du seuil.',
      'Nombre de jours couverts par une période.',
    ]) {
      expect(FORMULAIRE, aide).toContain(aide)
    }

    expect(FORMULAIRE).toContain('Paramètres enregistrés.')
  })
})

describe('Les champs se remettent à niveau après enregistrement', () => {
  /*
    `router.refresh()` renvoie les valeurs telles que la base les a retenues :
    « 1.5 » là où l'on a saisi « 1,5 ». L'état gardait la frappe, et on lisait
    donc à l'écran autre chose que ce qui était enregistré — la faute étant du
    côté de l'affichage, la dernière chose qu'on soupçonne.
  */
  const FORMULAIRE = lire('src/components/admin/formulaire-paie.tsx')
  const ORGANISATION = lire('src/components/admin/formulaire-organisation.tsx')

  it('les deux formulaires se resynchronisent sur la version', () => {
    for (const [nom, source] of [
      ['paie', FORMULAIRE],
      ['organisation', ORGANISATION],
    ] as const) {
      expect(source, nom).toContain('setVersionAffichee')
    }
  })

  it('l’ajustement se fait pendant le rendu, jamais dans un effet', () => {
    // Dans un `useEffect`, les champs afficheraient la frappe un tour de plus,
    // puis sauteraient — un clignotement à chaque enregistrement.
    for (const source of [FORMULAIRE, ORGANISATION]) {
      expect(source).not.toContain('useEffect')
    }
  })
})
