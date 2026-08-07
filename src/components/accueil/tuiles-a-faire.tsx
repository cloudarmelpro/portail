import { CartesChiffres, type CarteChiffre } from '@/components/shared/cartes-chiffres'
import { ICONE_MODULE } from '@/components/layout/icones'
import type { Tuile } from '@/lib/data/accueil'

/**
 * Ce qui attend l'utilisateur, en tête d'accueil.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * La carte vit dans `shared/cartes-chiffres.tsx`, où l'écran des employés la
 * partage. Ce fichier ne décide plus que de ce qui la remplit : l'icône du
 * module, et le lien vers l'écran où le travail se fait.
 *
 * Chaque tuile EST un lien. Un décompte qui annonce du travail et ne mène nulle
 * part oblige à retrouver l'écran soi-même, et le compte est alors plus
 * agaçant qu'utile.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function TuilesAFaire({ tuiles }: { tuiles: Tuile[] }) {
  if (tuiles.length === 0) return null

  const cartes: CarteChiffre[] = tuiles.map((t) => ({
    cle: t.cle,
    libelle: t.libelle,
    valeur: String(t.valeur),
    icone: ICONE_MODULE[t.module],
    href: t.href,
  }))

  return (
    <section aria-labelledby="a-faire" className="mt-4">
      <h2
        id="a-faire"
        className="text-ink3 text-[11px] leading-3.25 font-medium tracking-[0.02em] uppercase"
      >
        À faire
      </h2>

      <div className="mt-3">
        <CartesChiffres cartes={cartes} />
      </div>
    </section>
  )
}
