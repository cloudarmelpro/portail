import { FormulaireReinitialisation } from '@/components/auth/formulaire-reinitialisation'

/**
 * Cible du lien reçu par courriel — réinitialisation et première activation de
 * compte empruntent le même chemin.
 */
export default async function PageReinitialisation({
  searchParams,
}: PageProps<'/reinitialiser-mot-de-passe'>) {
  const params = await searchParams
  const jeton = typeof params.token === 'string' ? params.token : null
  return <FormulaireReinitialisation jeton={jeton} />
}
