import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les deux flèches du produit — celles fournies par le client.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elles remplacent `chevron-left`, `chevron-right`, `arrow-left` et
 * `arrow-right` PARTOUT. Un seul oubli se voit : deux flèches de dessins
 * différents sur le même écran.
 *
 * Deux pièges méritaient chacun leur garde.
 *
 * Les fichiers de `public/icons/` portent des noms INVERSÉS — `Left.svg`
 * contient la flèche qui pointe à droite, son identifiant interne le dit
 * lui-même. Les reprendre par leur nom aurait mis « suivant » sur le bouton
 * « précédent », sur toute l'application d'un coup.
 *
 * Et leur cadre est PLAT, 15,7 × 8,7, là où Lucide est carré : `size-*` les
 * étire. C'est la largeur seule qui les dimensionne.
 * ─────────────────────────────────────────────────────────────────────────
 */

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

/** Les commentaires NOMMENT les icônes proscrites pour expliquer pourquoi. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const COMPOSANT = lire('src/components/shared/fleches.tsx')

/** Ce qui désigne la gauche ou la droite, et n'a donc plus sa place. */
const PROSCRITES =
  /\b(ChevronLeft|ChevronRight|ArrowLeft|ArrowRight|ChevronsLeft|ChevronsRight|MoveLeft|MoveRight|ArrowBigLeft|ArrowBigRight|CornerDownLeft)\b/

describe('Le sens vient du tracé, pas du nom du fichier', () => {
  it('la flèche gauche pointe bien à gauche', () => {
    /*
      Le tracé part de la pointe. `FlecheGauche` commence à droite du cadre et
      finit en x=0 : la pointe est à gauche. C'est le contenu de
      `public/icons/Right.svg` — dont le nom annonce l'inverse.
    */
    const tracé = /polygon points="([^"]+)"/.exec(COMPOSANT.split('FlecheGauche')[1] ?? '')?.[1]
    expect(tracé).toBeDefined()
    expect(tracé).toContain('15.699,3.854')
    expect(tracé).toContain('0,4.354')
  })

  it('la flèche droite pointe bien à droite', () => {
    const tracé = /polygon points="([^"]+)"/.exec(COMPOSANT.split('FlecheDroite')[1] ?? '')?.[1]
    expect(tracé).toBeDefined()
    expect(tracé).toContain('15.698,4.353')
  })

  it('les deux tracés diffèrent', () => {
    // Une copie-collée aurait donné deux flèches identiques, et l'erreur ne se
    // verrait que sur le bouton « précédent ».
    const tracés = [...COMPOSANT.matchAll(/polygon points="([^"]+)"/g)].map((m) => m[1])
    expect(tracés).toHaveLength(2)
    expect(tracés[0]).not.toBe(tracés[1])
  })
})

describe('Elles se comportent comme les icônes du produit', () => {
  it('elles suivent la couleur du texte', () => {
    // Servies par une balise `<img>` depuis `public/`, elles resteraient noires
    // en thème sombre et demanderaient une requête réseau pour quinze pixels.
    expect(COMPOSANT).toContain('fill="currentColor"')
    // Le commentaire d'en-tête CITE `public/icons/` pour expliquer d'où vient
    // le tracé : le scanner tel quel reviendrait à punir sa documentation.
    expect(sansCommentaires(COMPOSANT)).not.toContain('/icons/')
  })

  it('elles sont décoratives par défaut', () => {
    expect(COMPOSANT).toContain('aria-hidden')
  })
})

describe('Aucune icône directionnelle de Lucide ne subsiste', () => {
  it('nulle part dans `src/`, hors du préréglage shadcn', () => {
    /*
      `components/ui/` vient de shadcn et ne se modifie pas à la main. Le
      calendrier y garde ses chevrons ; ils sont surchargés depuis
      `shared/choix-date.tsx`, par la propriété `components` que la copie étale
      après ses propres défauts.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      if (chemin.startsWith('src/components/ui/')) continue

      const contenu = sansCommentaires(lire(chemin))

      /*
        On parcourt TOUTES les déclarations, puis on filtre sur la provenance.
        Une expression qui ne vise que `from 'lucide-react'` part de l'import
        précédent et avale ses accolades : sur un fichier où `usePathname` est
        importé juste au-dessus des icônes, elle signalait `PanelLeft` à tort.
      */
      for (const bloc of contenu.matchAll(/import \{([^}]*)\} from '([^']+)'/g)) {
        if (bloc[2] !== 'lucide-react') continue
        if (PROSCRITES.test(bloc[1] ?? '')) coupables.push(chemin)
      }
    }

    expect(coupables).toEqual([])
  })

  it('le calendrier prend les flèches du produit', () => {
    const source = lire('src/components/shared/choix-date.tsx')
    expect(source).toContain('FlecheGauche')
    expect(source).toContain('FlecheDroite')
    // `ChevronDown` reste : il ouvre le sélecteur de mois.
    expect(source).toContain('ChevronDown')
  })
})

describe('Chaque flèche pointe du bon côté', () => {
  /*
    Le sens est la seule erreur que rien ne signale : le code compile, l'écran
    s'affiche, et la flèche « suivant » orne le bouton « précédent ». C'est
    exactement le piège que les noms inversés de `public/icons/` tendaient.
  */
  it('un lien de retour porte une flèche vers la gauche', () => {
    for (const chemin of [
      'src/app/(app)/crm/[entreprise]/clients/[client]/page.tsx',
      'src/app/(app)/heures/employes/[id]/page.tsx',
      'src/app/(app)/calculateur/[entreprise]/estimations/[id]/page.tsx',
      'src/components/auth/lien-retour-connexion.tsx',
    ]) {
      const source = sansCommentaires(lire(chemin))
      expect(source, chemin).toContain('<FlecheGauche')
      expect(source, chemin).not.toContain('<FlecheDroite')
    }
  })

  it('« Voir les N CV » et « ancienne → nouvelle » vont vers la droite', () => {
    for (const chemin of [
      'src/app/(app)/cv/page.tsx',
      'src/components/heures/historique-corrections.tsx',
    ]) {
      const source = sansCommentaires(lire(chemin))
      expect(source, chemin).toContain('<FlecheDroite')
      expect(source, chemin).not.toContain('<FlecheGauche')
    }
  })

  it('la pagination fait « précédent » à gauche', () => {
    /*
      Elle a existé en deux exemplaires, écrits séparément — le CRM et le journal
      d'audit. Le remplacement des chevrons a dû être fait deux fois, ce qui est
      la façon dont on découvre ce genre de dette : au deuxième passage. Il n'y
      en a plus qu'une.
    */
    const source = sansCommentaires(lire('src/components/shared/pagination.tsx'))
    expect(source).toMatch(/'precedent'\s*\?\s*FlecheGauche\s*:\s*FlecheDroite/)

    for (const chemin of [
      'src/app/(app)/crm/[entreprise]/clients/page.tsx',
      'src/app/(app)/admin/journal/page.tsx',
    ]) {
      expect(lire(chemin), chemin).toContain("from '@/components/shared/pagination'")
    }
  })

  it('la semaine précédente pointe à gauche, la suivante à droite', () => {
    const source = sansCommentaires(lire('src/components/heures/navigation-semaine.tsx'))
    expect(source).toMatch(/aria-label="Semaine précédente"[\s\S]{0,120}?<FlecheGauche/)

    for (const bloc of source.matchAll(/aria-label="Semaine suivante"[\s\S]{0,120}?<Fleche\w+/g)) {
      expect(bloc[0]).toMatch(/<FlecheDroite$/)
    }
  })
})

describe('La largeur seule les dimensionne', () => {
  it('aucune n’est posée avec `size-*`', () => {
    /*
      Le cadre est plat : `size-4` fixerait la hauteur à la largeur et
      écraserait la flèche. L'erreur ne lève rien et ne se voit qu'à l'écran.
    */
    const coupables: string[] = []

    for (const chemin of fichiersDe('src')) {
      const contenu = sansCommentaires(lire(chemin))
      for (const ligne of contenu.split('\n')) {
        if (!/<Fleche(Gauche|Droite)\b/.test(ligne)) continue
        if (/\bsize-\d/.test(ligne)) coupables.push(`${chemin} — ${ligne.trim().slice(0, 60)}`)
      }
    }

    expect(coupables).toEqual([])
  })
})

/** Liste récursive des fichiers TypeScript d'un dossier. */
function fichiersDe(racine: string): string[] {
  const sortie: string[] = []

  const parcourir = (dossier: string) => {
    if (dossier.startsWith('src/generated')) return
    for (const entree of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
      const chemin = `${dossier}/${entree.name}`
      if (entree.isDirectory()) parcourir(chemin)
      else if (chemin.endsWith('.ts') || chemin.endsWith('.tsx')) sortie.push(chemin)
    }
  }

  parcourir(racine)
  return sortie
}
