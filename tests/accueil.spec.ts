import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLES } from '@/lib/permissions'
import { navigationDe } from '@/config/navigation'

/**
 * L'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cet écran a déjà été inatteignable, et personne ne s'en est aperçu.
 *
 * `/accueil` était un `redirect()` vers le premier module autorisé. Le bouton
 * « Retour à l'accueil » des pages d'erreur y menait, l'adresse rebondissait
 * aussitôt, et l'accueil n'existait que dans les libellés. Une redirection ne
 * casse rien : elle emmène ailleurs, ce qui ne ressemble pas à une panne.
 *
 * C'est aussi la destination de la marque, seul chemin de retour depuis
 * n'importe quel module — aucune entrée de menu ne la désigne, puisque
 * l'accueil n'est pas un module.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

const PAGE = lire('src/app/(app)/accueil/page.tsx')
const BARRE = lire('src/components/layout/barre-laterale.tsx')

describe('L’écran existe', () => {
  it('ne redirige pas vers un module', () => {
    /*
      Le seul `redirect` toléré est celui du rôle sans aucun module — un cas qui
      ne devrait pas exister, et qui renvoie à la connexion, pas à un module.
    */
    const redirections = [...PAGE.matchAll(/redirect\((.*?)\)/g)].map((m) => m[1])
    expect(redirections).toEqual(["'/'"])
  })
})

describe('Les cartes suivent la matrice de permissions', () => {
  it('la page les dérive de `navigationDe`, comme le menu', () => {
    // Recopier une liste de modules ici la ferait diverger du menu latéral le
    // jour où un rôle change.
    expect(PAGE).toContain('navigationDe(session.role)')
  })

  it('chaque rôle a au moins une carte, et chacune une phrase', () => {
    for (const role of ROLES) {
      const entrees = navigationDe(role)
      expect(entrees.length, role).toBeGreaterThan(0)
      for (const e of entrees) {
        expect(e.description, `${role} → ${e.module}`).toMatch(/\.$/)
      }
    }
  })
})

describe('La marque y mène', () => {
  it('le bloc de marque est un lien vers /accueil', () => {
    expect(BARRE).toMatch(/<Link\s+href="\/accueil"/)
  })

  it('le nom du produit n’est plus un simple texte', () => {
    // Avant, la pastille et le nom étaient deux `<span>` inertes : rien ne
    // ramenait à l'accueil depuis un module.
    expect(BARRE).not.toMatch(/<span\s+aria-label=\{siteConfig\.nom\}/)
  })
})
