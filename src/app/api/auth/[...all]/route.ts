import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

/**
 * Point d'entrée de Better Auth — connexion, déconnexion, session, mot de passe
 * oublié.
 *
 * `proxy.ts` laisse ce chemin passer sans session : c'est ici qu'on l'obtient.
 */

const handlers = toNextJsHandler(auth)

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Les opérations d'administration sont FERMÉES sur HTTP.
 *
 * Le plugin `admin()` de Better Auth publie une quinzaine de points d'entrée
 * sous `/api/auth/admin/*` : `remove-user`, `set-role`, `set-user-password`,
 * `impersonate-user`, `ban-user`… Ils contournent tout ce que le projet a
 * construit — permission fine, garde du dernier administrateur, refus de
 * l'auto-suspension, journal d'audit. `remove-user` SUPPRIME réellement un
 * compte, là où `lib/actions/admin.ts` garantit qu'un compte n'est jamais que
 * suspendu, précisément pour ne pas faire disparaître l'auteur des entrées du
 * journal.
 *
 * Un Server Action est protégé par la fabrique ; une route ne l'est pas. La
 * phrase « le journal est alimenté par la fabrique, donc jamais oublié » était
 * fausse tant que ce chemin restait ouvert.
 *
 * Les fermer ne coûte RIEN : nos actions appellent `auth.api.setRole`,
 * `auth.api.banUser`, `auth.api.createUser` en direct côté serveur, sans passer
 * par HTTP. Aucun appel du navigateur ne vise cet espace de noms.
 *
 * 404 et non 403 : un refus explicite confirmerait que la surface existe.
 * ─────────────────────────────────────────────────────────────────────────
 */
function administrationParHttp(requete: Request): boolean {
  return new URL(requete.url).pathname.includes('/api/auth/admin/')
}

const introuvable = () => new Response(null, { status: 404 })

export async function GET(requete: Request) {
  if (administrationParHttp(requete)) return introuvable()
  return handlers.GET(requete)
}

export async function POST(requete: Request) {
  if (administrationParHttp(requete)) return introuvable()
  return handlers.POST(requete)
}
