// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Mail } from 'lucide-react'
import { ChampAuth } from '@/components/auth/champ-auth'

/**
 * L'étiquette flottante ne remplace pas le `<label>`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le texte visible du champ change avec son état : « vous@exemple.ca » au
 * repos, « Courriel » dès qu'il sert. S'il était le `<label>`, le nom
 * accessible du champ changerait avec lui — un lecteur d'écran annoncerait
 * « vous@exemple.ca, zone de saisie » sur un formulaire vide.
 *
 * Le `<label>` associé reste donc dans le DOM, invariable, et le texte
 * flottant est décoratif. Les parcours Playwright s'appuient sur la même
 * association : `getByLabel('Courriel')` sur un champ vide.
 * ─────────────────────────────────────────────────────────────────────────
 */
describe('Champ à étiquette flottante', () => {
  // La suite tourne sans fichier d'amorçage : le nettoyage automatique de
  // Testing Library n'est pas branché, et les rendus s'empileraient.
  afterEach(cleanup)

  it('garde son nom accessible au repos, quand l’étiquette montre l’exemple', () => {
    render(
      <ChampAuth
        identifiant="courriel"
        name="courriel"
        libelle="Courriel"
        exemple="vous@exemple.ca"
        icone={Mail}
      />,
    )

    expect(screen.getByText('vous@exemple.ca')).toBeDefined()
    expect(screen.getByLabelText('Courriel').getAttribute('name')).toBe('courriel')
  })

  it('fait remonter l’étiquette dès le focus', () => {
    render(
      <ChampAuth
        identifiant="courriel"
        name="courriel"
        libelle="Courriel"
        exemple="vous@exemple.ca"
        icone={Mail}
      />,
    )

    fireEvent.focus(screen.getByLabelText('Courriel'))
    expect(screen.queryByText('vous@exemple.ca')).toBeNull()
  })

  it('la laisse haute tant que le champ porte une valeur', () => {
    render(<ChampAuth identifiant="courriel" name="courriel" libelle="Courriel" icone={Mail} />)

    const champ = screen.getByLabelText('Courriel')
    fireEvent.input(champ, { target: { value: 'a@b.ca' } })
    fireEvent.blur(champ)
    // Sans valeur, l'étiquette redescendrait par-dessus le texte saisi.
    expect(screen.getAllByText('Courriel').length).toBe(2)
  })
})
