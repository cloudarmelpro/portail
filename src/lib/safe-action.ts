import 'server-only'
import { z } from 'zod'
import { journaliser, journaliserRefus } from '@/lib/audit'
import { ErreurAcces, requirePermission, sessionCourante, type SessionApp } from '@/lib/guards'
import { ErreurMetier } from '@/lib/erreurs'
import { moduleDe, type Permission } from '@/lib/permissions'
import { prismaCadre, type PrismaCadre } from '@/lib/prisma'
import { estEntreprise, type EntrepriseSlug } from '@/config/entreprises'

/**
 * Fabrique de Server Actions.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * INVARIANT N°1 DU PROJET — aucun Server Action n'est écrit à la main.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un Server Action ne traverse pas les layouts. Il est exposé comme un point
 * d'entrée HTTP autonome : quiconque connaît son identifiant peut l'appeler
 * directement, sans jamais charger la page correspondante. Un layout qui vérifie
 * le rôle ne protège **que l'affichage**, jamais la mutation.
 *
 * La règle « chaque action commence par une vérification de permission » est
 * juste — et c'est exactement le genre de règle qu'on respecte trois semaines
 * puis qu'on oublie un vendredi soir.
 *
 * Cette fabrique rend l'oubli **impossible** plutôt qu'interdit : le traitement
 * ne reçoit jamais de données non validées, et ne s'exécute jamais sans session
 * vérifiée. Il est inatteignable autrement.
 *
 * `tests/actions-garde.spec.ts` parcourt `lib/actions/` et échoue si une fonction
 * exportée ne passe pas par ici.
 */

/**
 * Journalise une action refusée — ADM-4.
 *
 * La session est relue : `requirePermission` lève sans la rendre. L'appel n'a
 * lieu que sur le chemin refusé, et l'entrée validée n'existe pas encore à ce
 * stade — la permission est vérifiée avant la validation, délibérément. Ce qui
 * est consigné est donc la porte poussée, pas ce qu'on voulait en faire.
 */
async function journaliserActionRefusee(permission: Permission): Promise<void> {
  const s = await sessionCourante()
  if (!s) return

  await journaliserRefus({
    userId: s.userId,
    utilisateurNom: s.nom,
    module: moduleDe(permission),
    entite: permission,
  })
}

export type Resultat<T> =
  { ok: true; donnees: T } | { ok: false; erreur: string; champs?: Record<string, string[]> }

type Contexte = {
  session: SessionApp
  entreprise?: EntrepriseSlug
}

type Config<S extends z.ZodType, T> = {
  /** Permission exigée. Détermine aussi le module inscrit au journal. */
  permission: Permission
  /** Schéma d'entrée. Le traitement ne voit que des données validées. */
  schema: S
  /** Libellé journalisé — repris de la section 19, pas inventé. */
  action: string
  /** Marque les actions à surveiller : suppression de CV, changement de rôle. */
  sensible?: boolean
  /** Désigne l'entité concernée dans le journal, à partir de l'entrée validée. */
  entite?: (entree: z.infer<S>) => string | null
  handler: (entree: z.infer<S>, ctx: Contexte) => Promise<T>
}

export function createAction<S extends z.ZodType, T>(config: Config<S, T>) {
  return async function action(entreeBrute: unknown): Promise<Resultat<T>> {
    // 1. Permission — AVANT toute chose, y compris la validation.
    let session: SessionApp
    try {
      session = await requirePermission(config.permission)
    } catch (e) {
      if (e instanceof ErreurAcces) {
        await journaliserActionRefusee(config.permission)
        return { ok: false, erreur: e.message }
      }
      throw e
    }

    // 2. Validation. Le traitement ne verra jamais de données non validées.
    const analyse = config.schema.safeParse(entreeBrute)
    if (!analyse.success) {
      const champs: Record<string, string[]> = {}
      for (const p of analyse.error.issues) {
        const cle = p.path.join('.') || '_'
        ;(champs[cle] ??= []).push(p.message)
      }
      return { ok: false, erreur: 'Certains champs sont invalides.', champs }
    }
    const entree = analyse.data as z.infer<S>

    // 3. Traitement.
    let donnees: T
    try {
      donnees = await config.handler(entree, { session })
    } catch (e) {
      if (e instanceof ErreurAcces) return { ok: false, erreur: e.message }
      // Un refus métier porte un message écrit POUR l'utilisateur : il passe.
      // Tout le reste est une panne, dont le message peut nommer une table ou
      // une contrainte — il reste au journal du serveur.
      if (e instanceof ErreurMetier) {
        return e.champ
          ? { ok: false, erreur: e.message, champs: { [e.champ]: [e.message] } }
          : { ok: false, erreur: e.message }
      }
      console.error(`[action] ${config.action}`, e)
      return { ok: false, erreur: 'Une erreur est survenue. Réessayez.' }
    }

    // 4. Journal — après succès, et jamais oublié puisqu'il est ici.
    await journaliser({
      userId: session.userId,
      utilisateurNom: session.nom,
      action: config.action,
      module: moduleDe(config.permission),
      entite: config.entite?.(entree) ?? null,
      sensible: config.sensible,
    })

    return { ok: true, donnees }
  }
}

/* ══════════════════════════════════════════════════════════════════
   Actions cloisonnées — CRM, calculateur, grilles de tarifs
   ══════════════════════════════════════════════════════════════════ */

type ContexteCloisonne = {
  session: SessionApp
  entreprise: EntrepriseSlug
  /**
   * Client Prisma cadré. Le traitement ne reçoit QUE celui-ci : il n'a aucun
   * moyen d'écrire dans une autre entreprise, même en se trompant de where.
   */
  db: PrismaCadre
}

type ConfigCloisonnee<S extends z.ZodType, T> = {
  permission: Permission
  schema: S
  action: string
  sensible?: boolean
  entite?: (entree: z.infer<S>) => string | null
  /**
   * D'où vient le slug dans l'entrée validée. Champ OBLIGATOIRE, et c'est
   * volontaire : il n'existe pas de valeur par défaut raisonnable, et deviner
   * l'entreprise serait exactement la faute que le cloisonnement doit empêcher.
   */
  entrepriseDe: (entree: z.infer<S>) => string
  handler: (entree: z.infer<S>, ctx: ContexteCloisonne) => Promise<T>
}

/**
 * Fabrique des actions du CRM et du calculateur.
 *
 * Même chaîne que `createAction` — permission, validation, traitement, journal —
 * avec une étape de plus : le slug d'entreprise est revalidé, puis le traitement
 * reçoit un client Prisma **déjà cadré**.
 *
 * Le slug arrive du client, par l'URL ou un champ de formulaire. Il n'a donc
 * aucune valeur de preuve : un utilisateur peut poster n'importe quelle chaîne.
 * `estEntreprise` est la dernière barrière, et le journal consigne l'entreprise
 * effectivement retenue — pas celle qui a été demandée.
 */
export function createActionCloisonnee<S extends z.ZodType, T>(config: ConfigCloisonnee<S, T>) {
  return async function action(entreeBrute: unknown): Promise<Resultat<T>> {
    let session: SessionApp
    try {
      session = await requirePermission(config.permission)
    } catch (e) {
      if (e instanceof ErreurAcces) {
        await journaliserActionRefusee(config.permission)
        return { ok: false, erreur: e.message }
      }
      throw e
    }

    const analyse = config.schema.safeParse(entreeBrute)
    if (!analyse.success) {
      const champs: Record<string, string[]> = {}
      for (const p of analyse.error.issues) {
        const cle = p.path.join('.') || '_'
        ;(champs[cle] ??= []).push(p.message)
      }
      return { ok: false, erreur: 'Certains champs sont invalides.', champs }
    }
    const entree = analyse.data as z.infer<S>

    const slug = config.entrepriseDe(entree)
    if (!estEntreprise(slug)) return { ok: false, erreur: 'Accès refusé.' }

    let donnees: T
    try {
      donnees = await config.handler(entree, {
        session,
        entreprise: slug,
        db: prismaCadre(slug),
      })
    } catch (e) {
      if (e instanceof ErreurAcces) return { ok: false, erreur: e.message }
      // Un refus métier porte un message écrit POUR l'utilisateur : il passe.
      // Tout le reste est une panne, dont le message peut nommer une table ou
      // une contrainte — il reste au journal du serveur.
      if (e instanceof ErreurMetier) {
        return e.champ
          ? { ok: false, erreur: e.message, champs: { [e.champ]: [e.message] } }
          : { ok: false, erreur: e.message }
      }
      console.error(`[action] ${config.action}`, e)
      return { ok: false, erreur: 'Une erreur est survenue. Réessayez.' }
    }

    await journaliser({
      userId: session.userId,
      utilisateurNom: session.nom,
      action: config.action,
      module: moduleDe(config.permission),
      entite: config.entite?.(entree) ?? null,
      entrepriseSlug: slug,
      sensible: config.sensible,
    })

    return { ok: true, donnees }
  }
}
