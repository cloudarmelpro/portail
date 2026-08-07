'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Sauvegarde automatique des saisies en cours — exigence TR-13.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce que ça évite.
 *
 * Une grille d'heures compte soixante cellules, une estimation quinze lignes,
 * une fiche client huit champs. Rien ne les retenait : une session expirée, un
 * onglet fermé par mégarde, un rechargement, et tout était à refaire. C'est le
 * premier motif d'abandon d'un outil interne — on retourne à Excel, qui, lui,
 * n'a jamais rien perdu.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi le navigateur, et sous quelles conditions.
 *
 * Un brouillon serveur demanderait une table, une action et un cycle de vie
 * pour une donnée qui ne vaut que quelques minutes. `localStorage` suffit — mais
 * il survit à la déconnexion, et un brouillon contient des noms d'employés et
 * des heures travaillées. Sur un poste partagé, ce serait un renseignement
 * personnel laissé en clair pour l'utilisateur suivant.
 *
 * D'où deux règles qui ne sont pas négociables :
 *   · la clé porte l'identifiant de l'utilisateur — un brouillon n'est jamais
 *     proposé à quelqu'un d'autre ;
 *   · `purgerBrouillons()` est appelée à la déconnexion.
 * ─────────────────────────────────────────────────────────────────────────
 */

const PREFIXE = 'portail:brouillon'

/** Un brouillon plus vieux que cela n'est plus proposé : le contexte a changé. */
const PEREMPTION_MS = 24 * 60 * 60 * 1000

type Enveloppe<T> = { a: number; v: T }

function cleComplete(userId: string, forme: string): string {
  return `${PREFIXE}:${userId}:${forme}`
}

/**
 * Efface tous les brouillons, quel que soit leur propriétaire.
 *
 * Appelée à la déconnexion. Volontairement large : sur un poste partagé, le
 * brouillon d'un collègue n'a rien à faire là non plus.
 */
export function purgerBrouillons(): void {
  if (typeof window === 'undefined') return

  try {
    const aRetirer: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const cle = window.localStorage.key(i)
      if (cle?.startsWith(PREFIXE)) aRetirer.push(cle)
    }
    for (const cle of aRetirer) window.localStorage.removeItem(cle)
  } catch {
    // Mode privé, quota plein, stockage désactivé : un brouillon est un confort,
    // jamais une condition de fonctionnement.
  }
}

/**
 * Retient une valeur de formulaire entre deux visites.
 *
 * Retourne le brouillon trouvé au montage — `null` s'il n'y en a pas — ainsi que
 * les deux gestes qui comptent : enregistrer, et oublier une fois la donnée
 * réellement partie au serveur.
 *
 * L'écriture est différée : sans cela, chaque frappe touche le disque.
 */
export function useBrouillon<T>(
  userId: string,
  forme: string,
  delaiMs = 800,
): {
  brouillon: T | null
  enregistrer: (valeur: T) => void
  oublier: () => void
} {
  const cle = cleComplete(userId, forme)

  /*
    Lu UNE fois, à l'initialisation de l'état. Le relire dans un effet
    provoquerait un rendu de plus, et surtout ferait clignoter le formulaire :
    vide au premier rendu, rempli au second.
  */
  const [brouillon] = useState<T | null>(() => {
    if (typeof window === 'undefined') return null

    try {
      const brut = window.localStorage.getItem(cle)
      if (!brut) return null

      const enveloppe = JSON.parse(brut) as Enveloppe<T>
      if (Date.now() - enveloppe.a > PEREMPTION_MS) {
        window.localStorage.removeItem(cle)
        return null
      }
      return enveloppe.v
    } catch {
      return null
    }
  })

  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enregistrer = useCallback(
    (valeur: T) => {
      if (minuterie.current) clearTimeout(minuterie.current)
      minuterie.current = setTimeout(() => {
        try {
          const enveloppe: Enveloppe<T> = { a: Date.now(), v: valeur }
          window.localStorage.setItem(cle, JSON.stringify(enveloppe))
        } catch {
          // Quota dépassé ou stockage refusé : on n'interrompt pas la saisie.
        }
      }, delaiMs)
    },
    [cle, delaiMs],
  )

  const oublier = useCallback(() => {
    if (minuterie.current) clearTimeout(minuterie.current)
    try {
      window.localStorage.removeItem(cle)
    } catch {
      /* voir ci-dessus */
    }
  }, [cle])

  // L'écriture différée en attente ne doit pas survivre au démontage : elle
  // réécrirait un brouillon qu'`oublier` vient d'effacer après un enregistrement.
  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current)
    },
    [],
  )

  return { brouillon, enregistrer, oublier }
}
