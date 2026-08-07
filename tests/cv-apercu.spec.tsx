// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ApercuCv } from '@/components/cv/apercu-cv'
import type { LigneFichier } from '@/components/cv/tableau-fichiers'

/**
 * Aperçu d'un CV — exigence CV-5.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Deux pannes distinctes, toutes deux silencieuses.
 *
 * 1. Un DOCX n'a aucun rendu natif. Un cadre vide se lit comme une panne : la
 *    recruteuse recharge, réessaie, puis conclut que l'outil est cassé.
 *
 * 2. Le visualiseur PDF intégré s'attribue le focus dès qu'il a fini de
 *    charger. Un événement clavier né dans un `iframe` ne remonte JAMAIS au
 *    document parent : les flèches partaient défiler le PDF, et la navigation
 *    précédent/suivant du CV-5 cessait de répondre sans que rien ne le dise.
 * ─────────────────────────────────────────────────────────────────────────
 */

const BASE: LigneFichier = {
  id: 'f1',
  nom: 'Miora R.pdf',
  taille: 240 * 1024,
  typeMime: 'application/pdf',
  deposeLe: '3 août 2026',
  deposeParNom: 'Test Recrutement',
  echeance: null,
  version: 0,
  categories: [],
}

function afficher(fichier: Partial<LigneFichier> = {}, actions: Partial<Actions> = {}) {
  const gestes: Actions = {
    onPrecedent: vi.fn(),
    onSuivant: vi.fn(),
    onFermer: vi.fn(),
    onReclasser: vi.fn(),
    onSupprimer: vi.fn(),
    ...actions,
  }

  render(
    <ApercuCv
      fichier={{ ...BASE, ...fichier }}
      position={1}
      total={3}
      peutTelecharger
      peutSupprimer
      peutReclasser
      {...gestes}
    />,
  )

  return gestes
}

type Actions = {
  onPrecedent: () => void
  onSuivant: () => void
  onFermer: () => void
  onReclasser: () => void
  onSupprimer: () => void
}

describe('Aperçu — document Word', () => {
  afterEach(cleanup)

  it('nomme le fichier, son format et sa taille plutôt que d’afficher un cadre vide', () => {
    afficher({
      nom: 'Rakoto Andry.docx',
      taille: 87 * 1024,
      typeMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    expect(screen.getByText('Aperçu indisponible')).toBeDefined()
    // Deux fois : l'en-tête de l'aperçu, et la fiche du document.
    expect(screen.getAllByText('Rakoto Andry.docx')).toHaveLength(2)
    expect(screen.getByText('DOCX — 87 Ko')).toBeDefined()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('mène au téléchargement, seule façon de consulter le document', () => {
    afficher({
      nom: 'Rakoto Andry.doc',
      typeMime: 'application/msword',
      taille: 3 * 1024 * 1024,
    })

    expect(screen.getByText('DOC — 3.0 Mo')).toBeDefined()
    const liens = screen.getAllByRole('link', { name: 'Télécharger' })
    expect(liens.length).toBeGreaterThan(0)
    expect(liens[0].getAttribute('href')).toBe('/api/cv/f1/telecharger')
  })

  it('ne montre aucun bouton de téléchargement à qui n’y a pas droit', () => {
    render(
      <ApercuCv
        fichier={{ ...BASE, typeMime: 'application/msword' }}
        position={1}
        total={1}
        peutTelecharger={false}
        peutSupprimer={false}
        peutReclasser={false}
        onPrecedent={vi.fn()}
        onSuivant={vi.fn()}
        onFermer={vi.fn()}
        onReclasser={vi.fn()}
        onSupprimer={vi.fn()}
      />,
    )

    expect(screen.queryByRole('link', { name: 'Télécharger' })).toBeNull()
  })
})

describe('Aperçu — le clavier reste à la liste', () => {
  afterEach(cleanup)

  it('donne le focus à l’aperçu, pas à la ligne restée derrière le voile', () => {
    afficher()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('parcourt la liste aux flèches', () => {
    const gestes = afficher()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(gestes.onSuivant).toHaveBeenCalledTimes(1)
    expect(gestes.onPrecedent).toHaveBeenCalledTimes(1)
    expect(gestes.onFermer).toHaveBeenCalledTimes(1)
  })

  it('tient le cadre PDF hors du parcours de tabulation', () => {
    // Une tabulation qui entre dans le visualiseur n'en ressort plus.
    afficher()
    expect(document.querySelector('iframe')?.getAttribute('tabindex')).toBe('-1')
  })

  it('reprend le focus que le visualiseur s’est attribué tout seul', () => {
    afficher()
    const cadre = document.querySelector('iframe')
    expect(cadre).not.toBeNull()

    cadre?.focus()
    expect(document.activeElement).toBe(cadre)

    // Le passage du focus dans un cadre de la page fait perdre le focus à la
    // fenêtre parente : c'est le seul signal disponible.
    fireEvent.blur(window)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('le rend au bouton qui l’avait, pas au dialogue', () => {
    afficher()
    const suivant = screen.getByRole('button', { name: 'Fichier suivant' })
    suivant.focus()

    document.querySelector('iframe')?.focus()
    fireEvent.blur(window)

    expect(document.activeElement).toBe(suivant)
  })

  it('le laisse au visualiseur dès que l’utilisateur le lui donne', () => {
    afficher()
    const cadre = document.querySelector('iframe')

    fireEvent.pointerDown(cadre?.parentElement as HTMLElement)
    cadre?.focus()
    fireEvent.blur(window)

    expect(document.activeElement).toBe(cadre)
  })
})
