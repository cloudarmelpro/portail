import 'server-only'
import { headers } from 'next/headers'
import { getIp } from 'better-auth/api'
import { configurationIp } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import type { Module } from '@/lib/permissions'
import { PLAFONDS, limiter } from '@/lib/rate-limit'
import type { EntrepriseSlug } from '@/config/entreprises'

/**
 * Journal d'audit.
 *
 * Appelé **par la fabrique d'actions**, donc jamais oublié sur une mutation.
 *
 * Les seuls appels directs légitimes sont ceux qui ne passent pas par un Server
 * Action : la connexion et l'échec de connexion (`lib/auth.ts`), la déconnexion
 * (`lib/session-actions.ts`), les refus d'accès (`lib/guards.ts` et
 * `lib/safe-action.ts`), le téléchargement d'un CV et l'export d'une période
 * d'heures — deux routes qui font SORTIR des données nominatives.
 *
 * Exigences TR-5 et ADM-4 : toute opération modifiant des données est
 * journalisée, ainsi que toute consultation ou tout téléchargement de CV, les
 * ouvertures de session et les tentatives refusées.
 *
 * Rien de ce qui sert à s'authentifier n'entre ici — ni mot de passe, ni jeton,
 * ni en-tête d'autorisation, même tronqué.
 */

export type EntreeAudit = {
  userId: string | null
  utilisateurNom: string
  action: string
  module: Module
  entite?: string | null
  entrepriseSlug?: EntrepriseSlug | null
  /** Téléchargement et suppression de CV, changement de rôle, refus d'accès. */
  sensible?: boolean
}

/**
 * Libellés hors fabrique. Ils sont lus des mois plus tard : un même geste porte
 * toujours la même chaîne, d'où ces constantes plutôt qu'un littéral par site.
 */
export const ACTION_CONNEXION = 'Connexion'
export const ACTION_ECHEC_CONNEXION = 'Échec de connexion'
export const ACTION_REFUS = 'Refus d’accès'

/**
 * Adresse d'origine.
 *
 * `getIp` de Better Auth, et non une seconde implémentation : le limiteur de
 * connexion compte les tentatives par adresse avec cette fonction-là, et deux
 * façons de la déterminer divergeraient — c'est le journal qui aurait tort.
 *
 * L'entrée la plus à GAUCHE de `x-forwarded-for` est fournie par le client :
 * la résolution part de la droite et s'arrête au premier saut qui n'est pas un
 * proxy de confiance. D'où `PROXYS_DE_CONFIANCE` — voir `lib/env.ts`.
 */
async function adresseIp(): Promise<string | null> {
  const entrants = await headers()

  // Recopie plutôt que passage direct : `ReadonlyHeaders` n'est pas un `Headers`
  // pour le compilateur, et seuls les en-têtes configurés doivent être lus.
  const retenus = new Headers()
  for (const nom of configurationIp.ipAddressHeaders) {
    const valeur = entrants.get(nom)
    if (valeur) retenus.set(nom, valeur)
  }

  return getIp(retenus, { advanced: { ipAddress: configurationIp } })
}

export async function journaliser(entree: EntreeAudit): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entree.userId,
        utilisateurNom: entree.utilisateurNom,
        action: entree.action,
        module: entree.module,
        entite: entree.entite ?? null,
        entrepriseSlug: entree.entrepriseSlug ?? null,
        sensible: entree.sensible ?? false,
        ip: await adresseIp(),
      },
    })
  } catch (e) {
    /**
     * Un échec d'écriture du journal ne doit jamais annuler l'opération métier :
     * la gérante perdrait sa saisie d'heures parce qu'une table de log est
     * indisponible. On trace l'incident et on laisse passer.
     *
     * Le revers assumé : une opération peut exister sans trace. Si cela devenait
     * inacceptable — audit réglementaire —, il faudrait au contraire faire
     * échouer l'opération, et ce commentaire deviendrait le point de départ.
     */
    console.error('[audit] écriture impossible', e)
  }
}

/**
 * Plafond anti-rafale des refus.
 *
 * Un écran interdit produit DEUX refus par rendu — le layout du module puis la
 * page —, et rien n'empêche de recharger en boucle.
 */
const PLAFOND_REFUS = PLAFONDS.refusAcces

/**
 * Journalise un refus d'accès — ADM-4.
 *
 * Écrit une trace et RIEN d'autre : l'appelant rend exactement la même réponse
 * qu'avant, `notFound()` compris. Un refus qui se distingue d'une page absente
 * dirait à qui tâtonne ce qui existe derrière.
 */
export async function journaliserRefus(refus: {
  userId: string
  utilisateurNom: string
  module: Module
  /** Ce qui a été demandé : permission, slug d'entreprise. `null` pour un module. */
  entite?: string | null
}): Promise<void> {
  const cle = `refus:${refus.userId}:${refus.module}:${refus.entite ?? ''}`

  if (!limiter(cle, PLAFOND_REFUS.max, PLAFOND_REFUS.fenetreSecondes).autorise) {
    // Le refus écarté ne disparaît pas sans bruit : la rafale elle-même est le
    // signal, et la table ne doit pas être le seul endroit où le voir.
    console.warn('[audit] refus non journalisé — rafale', cle)
    return
  }

  await journaliser({
    userId: refus.userId,
    utilisateurNom: refus.utilisateurNom,
    action: ACTION_REFUS,
    module: refus.module,
    entite: refus.entite ?? null,
    // Le filtre « actions sensibles » du journal sert la revue de sécurité :
    // une tentative refusée y a plus sa place qu'une suppression réussie.
    sensible: true,
  })
}
