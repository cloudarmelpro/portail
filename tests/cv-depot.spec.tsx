// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * Dépôt par lot — exigence CV-6, «&nbsp;affectation des catégories au lot&nbsp;».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le classement ne peut pas se décider après coup.
 *
 * L'envoi commence dès le premier fichier et il n'existe aucun écran pour
 * revenir sur un lot entier : reclasser vingt CV un à un après le dépôt, c'est
 * vingt dialogues. Le choix se fait donc AVANT l'envoi, et il s'applique à tous
 * les fichiers du lot.
 *
 * Depuis «&nbsp;Tous les CV&nbsp;» il n'y a pas de dossier courant : rien n'est
 * préselectionné, et l'écran dit où ira le lot faute de choix — «&nbsp;Non classé&nbsp;»
 * reste un dossier légitime (CV-4), pas un accident.
 * ─────────────────────────────────────────────────────────────────────────
 */

const espions = vi.hoisted(() => ({
  preparer: vi.fn(),
  confirmer: vi.fn(),
  rafraichir: vi.fn(),
  succes: vi.fn(),
  erreur: vi.fn(),
}))

vi.mock('@/lib/actions/cv', () => ({
  preparerTeleversement: espions.preparer,
  confirmerTeleversement: espions.confirmer,
}))

vi.mock('@/lib/toast', () => ({
  notifier: { succes: espions.succes, erreur: espions.erreur },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: espions.rafraichir }),
}))

/*
  Le dialogue de shadcn passe par un portail et une animation : le remplacer par
  des balises inertes garde le test sur ce qu'il vérifie — le lot et ses
  catégories — plutôt que sur le cycle d'ouverture d'une modale.
*/
type Enfants = { children?: ReactNode; className?: string }

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: Enfants) => <div>{children}</div>,
  DialogTrigger: ({ children, className }: Enfants) => (
    <button className={className}>{children}</button>
  ),
  DialogHeader: ({ children }: Enfants) => <div>{children}</div>,
  DialogFooter: ({ children }: Enfants) => <div>{children}</div>,
  DialogTitle: ({ children }: Enfants) => <h2>{children}</h2>,
  DialogDescription: ({ children }: Enfants) => <p>{children}</p>,
}))

vi.mock('@/components/shared/contenu-dialogue', () => ({
  ContenuDialogue: ({ children }: Enfants) => <div>{children}</div>,
}))

const { BoutonDepot } = await import('@/components/cv/bouton-depot')

const CATEGORIES = [
  { id: 'c1', nom: 'Développeur' },
  { id: 'c2', nom: 'Monteur vidéo' },
  { id: 'c3', nom: 'Support client' },
]

const PDF = 'application/pdf'

function fichier(nom: string, octets = 1024): File {
  const f = new File(['x'], nom, { type: PDF })
  Object.defineProperty(f, 'size', { value: octets })
  return f
}

/** `input.files` est en lecture seule : `fireEvent.change` ne peut pas l'écrire. */
function choisir(...fichiers: File[]) {
  const champ = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(champ, 'files', { value: fichiers, configurable: true })
  fireEvent.change(champ)
}

const cocher = (nom: string) => fireEvent.click(screen.getByLabelText(nom))
const deposer = () => fireEvent.click(screen.getByRole('button', { name: 'Déposer' }))

describe('Dépôt par lot — le choix des catégories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    espions.preparer.mockResolvedValue({ ok: true, donnees: { cle: 'cv/x.pdf', url: 'https://s' } })
    espions.confirmer.mockResolvedValue({ ok: true, donnees: { fichierId: 'f1' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('préselectionne le dossier ouvert', () => {
    render(<BoutonDepot categorieId="c2" categories={CATEGORIES} />)

    expect((screen.getByLabelText('Monteur vidéo') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Développeur') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByText('1 catégorie sélectionnée.')).toBeDefined()
  })

  it('ne préselectionne rien depuis « Tous les CV », et dit où ira le lot', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    for (const c of CATEGORIES) {
      expect((screen.getByLabelText(c.nom) as HTMLInputElement).checked).toBe(false)
    }
    expect(screen.getByText('Aucune catégorie : le fichier ira dans « Non classé ».')).toBeDefined()
  })

  it('applique les catégories choisies à TOUS les fichiers du lot', async () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    choisir(fichier('a.pdf'), fichier('b.pdf'), fichier('c.pdf'))
    cocher('Développeur')
    cocher('Support client')
    deposer()

    await waitFor(() => expect(espions.confirmer).toHaveBeenCalledTimes(3))

    for (const appel of espions.confirmer.mock.calls) {
      expect(appel[0].categorieIds).toEqual(['c1', 'c3'])
    }
    expect(espions.confirmer.mock.calls.map((a) => a[0].nom)).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  it('depuis un dossier, le lot part dans ce dossier sans autre geste', async () => {
    render(<BoutonDepot categorieId="c2" categories={CATEGORIES} />)

    choisir(fichier('a.pdf'))
    deposer()

    await waitFor(() => expect(espions.confirmer).toHaveBeenCalledTimes(1))
    expect(espions.confirmer.mock.calls[0][0].categorieIds).toEqual(['c2'])
  })

  it('laisse décocher le dossier courant pour déposer sans classement', async () => {
    render(<BoutonDepot categorieId="c2" categories={CATEGORIES} />)

    choisir(fichier('a.pdf'))
    cocher('Monteur vidéo')
    deposer()

    await waitFor(() => expect(espions.confirmer).toHaveBeenCalledTimes(1))
    expect(espions.confirmer.mock.calls[0][0].categorieIds).toEqual([])
  })
})

describe('Dépôt par lot — la constitution du lot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    espions.preparer.mockResolvedValue({ ok: true, donnees: { cle: 'cv/x.pdf', url: 'https://s' } })
    espions.confirmer.mockResolvedValue({ ok: true, donnees: { fichierId: 'f1' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('n’envoie rien tant que le lot est vide', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    expect((screen.getByRole('button', { name: 'Déposer' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(espions.preparer).not.toHaveBeenCalled()
  })

  it('n’envoie rien au moment du choix des fichiers — le classement vient avant', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    choisir(fichier('a.pdf'))

    expect(espions.preparer).not.toHaveBeenCalled()
    expect(screen.getByText('a.pdf')).toBeDefined()
  })

  it('refuse un format non accepté en le nommant', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    const image = new File(['x'], 'photo.png', { type: 'image/png' })
    choisir(image)

    expect(espions.erreur).toHaveBeenCalledWith(
      '« photo.png » — formats acceptés : PDF, DOC et DOCX.',
    )
  })

  it('refuse un fichier trop lourd en le nommant', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    choisir(fichier('gros.pdf', 11 * 1024 * 1024))

    expect(espions.erreur).toHaveBeenCalledWith('« gros.pdf » dépasse 10 Mo.')
  })

  it('ne compte pas deux fois le même fichier glissé deux fois', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    choisir(fichier('a.pdf'))
    choisir(fichier('a.pdf'))

    expect(screen.getAllByText('a.pdf')).toHaveLength(1)
  })

  it('accorde la mention du dossier de repli au nombre de fichiers', () => {
    render(<BoutonDepot categories={CATEGORIES} />)

    choisir(fichier('a.pdf'), fichier('b.pdf'))

    expect(
      screen.getByText('Aucune catégorie : les fichiers iront dans « Non classé ».'),
    ).toBeDefined()
  })
})
