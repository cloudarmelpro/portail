import { connection } from 'next/server'
import { FormulaireMotDePasseOublie } from '@/components/auth/formulaire-mot-de-passe-oublie'

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Rendue à la demande, et ce n'est pas un réglage de performance.
 *
 * Next appose le nonce de la CSP pendant le rendu SERVEUR, à partir de l'en-tête
 * posé par `proxy.ts`. Une page pré-rendue au build n'a vu ni requête ni
 * en-tête : son HTML ne porte aucun nonce, et `script-src 'strict-dynamic'`
 * bloque alors tous ses scripts.
 *
 * L'écran resterait affiché — le HTML vient du serveur — mais le formulaire ne
 * réagirait plus. C'est la page de quelqu'un qui ne peut déjà plus entrer ; elle
 * ne peut pas être celle qui casse.
 *
 * `connection()` déclare la dépendance à la requête. Le coût est nul : il n'y a
 * rien à mettre en cache sur un formulaire vide.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default async function PageMotDePasseOublie() {
  await connection()
  return <FormulaireMotDePasseOublie />
}
