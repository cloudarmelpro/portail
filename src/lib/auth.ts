import 'server-only'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { admin } from 'better-auth/plugins'
import { ACTION_CONNEXION, ACTION_ECHEC_CONNEXION, journaliser } from '@/lib/audit'
import { envoyerInvitation, envoyerReinitialisation } from '@/lib/email'
import { configurationIp, env } from '@/lib/env'
import { LIBELLE_ROLE, estRole } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

/**
 * Configuration de Better Auth.
 *
 * Deux réglages portent des exigences du cahier des charges, et ne doivent pas
 * être touchés sans relire GEN-4 et GEN-5.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,

    /**
     * GEN-5 — il n'existe AUCUNE inscription libre. Seul l'administrateur crée
     * les comptes, depuis /admin/utilisateurs. Réactiver ceci ouvrirait
     * l'application à quiconque connaît son adresse.
     */
    disableSignUp: true,

    minPasswordLength: 12,

    /**
     * Le lien expire dans une heure — la durée annoncée dans le courriel.
     * Les deux valeurs doivent rester cohérentes : voir `lib/email.ts`.
     */
    resetPasswordTokenExpiresIn: 60 * 60,

    /**
     * ─────────────────────────────────────────────────────────────────────
     * Deux courriels, un seul parcours.
     *
     * L'invitation d'un nouvel employé réutilise délibérément le mécanisme de
     * réinitialisation : un seul chemin à tester, un seul à maintenir, et le
     * mot de passe ne transite jamais par une conversation. Mais le texte, lui,
     * ne peut pas être le même — recevoir « réinitialisez votre mot de passe »
     * pour un compte qu'on n'a jamais eu est déroutant, et ressemble assez à
     * une tentative d'hameçonnage pour qu'on n'y clique pas.
     *
     * La distinction ne demande aucun indicateur à transporter : elle est déjà
     * dans la base. `inviterUtilisateur` crée le compte SANS mot de passe, donc
     * sans ligne `Account` de type « credential ». Son absence signifie
     * exactement « cette personne n'est jamais entrée ».
     * ─────────────────────────────────────────────────────────────────────
     */
    async sendResetPassword({ user, url }) {
      // Un seul aller-retour : le rôle n'est pas porté par l'objet que Better
      // Auth transmet ici, et il faut de toute façon interroger les comptes.
      const compte = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          accounts: { where: { providerId: 'credential' }, select: { id: true }, take: 1 },
        },
      })

      const jamaisEntre = compte !== null && compte.accounts.length === 0

      if (!jamaisEntre) {
        await envoyerReinitialisation({ a: user.email, nom: user.name, lien: url })
        return
      }

      await envoyerInvitation({
        a: user.email,
        nom: user.name,
        lien: url,
        role: estRole(compte.role) ? LIBELLE_ROLE[compte.role] : 'Utilisateur',
      })
    },
  },

  databaseHooks: {
    session: {
      create: {
        /**
         * Horodate la dernière connexion sur le compte — exigence ADM-1, colonne
         * « Dernière connexion » de la section 19 — et consigne l'ouverture de
         * session au journal d'audit (ADM-4).
         *
         * L'écriture est isolée : une panne ici ne doit pas empêcher quelqu'un
         * d'entrer. Une date manquante est un désagrément, une connexion refusée
         * est un arrêt de travail. `journaliser` avale déjà ses propres pannes ;
         * ce `try` couvre la mise à jour du compte.
         */
        async after(session) {
          let nom: string | null = null
          try {
            const compte = await prisma.user.update({
              where: { id: session.userId },
              data: { derniereConnexionLe: new Date() },
              select: { name: true },
            })
            nom = compte.name
          } catch (e) {
            console.error('[auth] dernière connexion non horodatée', e)
          }

          // Sans nom, l'entrée ne désignerait personne : mieux vaut la trace du
          // compte que rien, et `userId` reste exploitable par le filtre.
          await journaliser({
            userId: session.userId,
            utilisateurNom: nom ?? session.userId,
            action: ACTION_CONNEXION,
            module: 'admin',
          })
        },
      },
    },
  },

  /**
   * Échec de connexion — ADM-4.
   *
   * Better Auth n'expose aucun point d'accroche dédié à l'échec : quand le
   * point d'entrée lève une `APIError`, le répartiteur la range dans
   * `ctx.context.returned` et exécute quand même les crochets d'après. C'est le
   * seul endroit d'où l'on voit une tentative refusée — identifiants faux,
   * compte suspendu, adresse mal formée.
   *
   * Ce crochet ne modifie RIEN : il n'écrit pas de réponse, et TR-4 tient — le
   * message reste identique que le compte existe ou non.
   */
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return
      if (!isAPIError(ctx.context.returned)) return

      const courriel = courrielTente(ctx.body)
      if (!courriel) return

      try {
        await journaliser({
          // Aucun compte n'est authentifié : la relation reste vide, et l'adresse
          // ESSAYÉE tient lieu d'auteur. Le mot de passe, lui, n'est jamais lu.
          userId: null,
          utilisateurNom: courriel,
          action: ACTION_ECHEC_CONNEXION,
          module: 'admin',
          sensible: true,
        })
      } catch (e) {
        // Une exception ici remonterait au répartiteur et casserait la réponse :
        // un journal muet vaut mieux qu'une page de connexion en panne.
        console.error('[auth] échec de connexion non journalisé', e)
      }
    }),
  },

  session: {
    /**
     * GEN-4 — deux heures d'inactivité. Trente minutes serait plus strict mais
     * franchement pénible au quotidien ; deux heures protège du poste laissé
     * ouvert sans transformer l'outil en corvée. Un avertissement s'affiche
     * deux minutes avant échéance.
     */
    expiresIn: 60 * 60 * 2,
    updateAge: 60 * 15,

    /**
     * La session est relue depuis le COOKIE pendant trente secondes.
     *
     * ──────────────────────────────────────────────────────────────────
     * C'est un ARBITRAGE DE SÉCURITÉ, pas une optimisation neutre.
     *
     * Sans lui, chaque requête — page, Server Action, route API — lit la session
     * en base, et c'est la PREMIÈRE lecture : tout le reste attend derrière elle.
     * Sur une base distante, c'est un aller-retour ajouté à chaque navigation.
     *
     * Ce qu'on accepte en échange : une session révoquée ou un compte suspendu
     * restent valides jusqu'à trente secondes. Cela touche ADM-1 (suspension) et
     * GEN-4 (expiration). Trente secondes plutôt que les cinq minutes usuelles
     * précisément pour bornér cette fenêtre : suspendre un compte reste un geste
     * dont l'effet se vérifie dans la minute.
     *
     * Le RÔLE, lui, N'EST PAS retardé — mais il l'était, et la première rédaction
     * de ce commentaire affirmait le contraire sans l'avoir vérifié.
     * `sessionCourante` lit le rôle sur l'objet utilisateur servi par ce cache :
     * rétrograder quelqu'un ne lui retirait ses droits qu'au bout de la fenêtre.
     * C'est la `version` ci-dessous qui ferme cette dimension, et la suspension
     * avec elle.
     *
     * Reste donc différée la seule RÉVOCATION d'une session — se déconnecter
     * ailleurs. Ce n'est pas un geste d'urgence dans un outil à trois personnes ;
     * si ça le devenait, c'est ce réglage qu'il faudrait retirer, pas contourner.
     * ──────────────────────────────────────────────────────────────────
     */
    cookieCache: {
      enabled: true,
      maxAge: 30,

      /**
       * La version FERME la fenêtre sur la dimension permission.
       *
       * Sans elle, rétrograder quelqu'un ne lui retirait ses droits qu'au bout de
       * trente secondes — y compris pour une mutation, la fabrique d'actions
       * lisant la même session. Le scénario n'est pas théorique : un
       * administrateur écarté, l'onglet encore ouvert, pouvait se re-promouvoir
       * et se réactiver avant que le retrait ne prenne effet. Les deux gestes
       * auraient été journalisés ; aucun n'aurait été refusé.
       *
       * Better Auth compare cette chaîne à celle inscrite dans le cookie : dès
       * qu'elles diffèrent, le cookie est tenu pour périmé et la session est
       * relue en base. Le gain de performance est conservé pour tout le reste.
       *
       * `banned` y figure aussi : c'est ce que pose `banUser`, donc une
       * suspension se propage par le même chemin.
       */
      version: (_session, user) =>
        `${(user as { role?: unknown }).role}:${(user as { banned?: unknown }).banned ?? false}`,
    },
  },

  advanced: {
    // L'application est mono-domaine : rien ne justifie d'assouplir SameSite.
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
    },

    /**
     * Sans proxys de confiance déclarés, Better Auth renonce à lire
     * `x-forwarded-for` dès qu'il porte plus d'une entrée, et le limiteur
     * ci-dessous retombe sur UN seau par chemin, commun à tout le monde : cinq
     * essais manqués mettent alors les trois utilisateurs dehors. Un tiers peut
     * provoquer cela en envoyant son propre `X-Forwarded-For`.
     *
     * Le même objet sert au journal d'audit — voir `lib/env.ts`.
     */
    ipAddress: configurationIp,
  },

  /**
   * TR-2 — limitation des tentatives de connexion.
   *
   * Le nom de domaine devient public dès l'émission du certificat SSL : la page
   * de connexion sera visitée par des robots dans les heures qui suivent la mise
   * en ligne. Sans cette limite, elle est une cible de force brute ouverte.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 300, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
      '/reset-password': { window: 300, max: 5 },
    },
  },

  plugins: [
    admin({
      /**
       * Le rôle est une chaîne côté Better Auth ; les valeurs autorisées vivent
       * dans `lib/permissions.ts`, source unique du système de rôles.
       */
      adminRoles: ['admin'],
      defaultRole: 'recrutement',
    }),

    /**
     * ──────────────────────────────────────────────────────────────────
     * SANS LUI, LA DÉCONNEXION NE FERMAIT RIEN.
     *
     * `auth.api.*` appelé dans un Server Action produit ses `Set-Cookie` dans une
     * réponse interne à Better Auth. Rien ne les recopie vers la réponse que Next
     * renvoie au navigateur : ce plugin est ce pont. Il est INDISPENSABLE dès
     * qu'une action serveur touche à la session — et `seDeconnecter` le fait.
     *
     * Le défaut est resté invisible tant qu'il n'y avait pas de cache de session :
     * le cookie survivait à la déconnexion, mais la session avait été révoquée en
     * base, donc la requête suivante ne trouvait rien et l'utilisateur était
     * sorti. Avec `cookieCache`, ce cookie signé est cru sur parole pendant trente
     * secondes SANS lecture en base : on restait connecté, même après
     * actualisation. Le cache n'a pas créé le trou, il l'a rendu praticable.
     *
     * DERNIER de la liste, obligatoirement. Better Auth avertit lui-même si un
     * plugin placé après déclare un `hooks.after` : ses cookies ne seraient pas
     * transmis. `tests/auth-cookies.spec.ts` en fait une règle.
     * ──────────────────────────────────────────────────────────────────
     */
    nextCookies(),
  ],
})

/**
 * Adresse d'une tentative de connexion, extraite du corps de la requête.
 *
 * Ce corps porte AUSSI le mot de passe : on n'y prend que `email`, jamais
 * l'objet entier. La valeur est écrite par un anonyme — tronquée, donc, sinon la
 * longueur d'une entrée de journal serait à sa main.
 */
function courrielTente(corps: unknown): string | null {
  if (typeof corps !== 'object' || corps === null) return null
  const valeur = (corps as { email?: unknown }).email
  if (typeof valeur !== 'string') return null

  const propre = valeur.trim().toLowerCase().slice(0, 120)
  return propre.length > 0 ? propre : null
}

export type SessionBetterAuth = typeof auth.$Infer.Session
