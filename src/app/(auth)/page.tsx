import { FormulaireConnexion } from '@/components/auth/formulaire-connexion'

/**
 * La racine « / » EST l'écran de connexion.
 *
 * Il n'existe aucune page de présentation : décision du client, inscrite en
 * GEN-2 du cahier des charges. Un visiteur non authentifié n'a rien à lire,
 * seulement un formulaire.
 */
export default async function PageConnexion({ searchParams }: PageProps<'/'>) {
  // `searchParams` est une Promise dans cette version de Next.
  const params = await searchParams
  return <FormulaireConnexion sessionExpiree={params.expiree === '1'} />
}
