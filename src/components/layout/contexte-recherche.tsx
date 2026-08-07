'use client'

import { createContext, useContext } from 'react'

/**
 * Ouverture de la palette de commandes, depuis n'importe où.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'état d'ouverture vit dans le shell, et il doit y rester.
 *
 * C'est lui qui écoute ⌘K, lui qui rend la palette, et lui qui la partage avec
 * le déclencheur de la barre latérale. Le dupliquer dans un second composant
 * ferait deux vérités : la palette ouverte d'un côté, fermée de l'autre.
 *
 * Le contexte ne transporte donc que le GESTE, jamais l'état. Un écran peut
 * demander l'ouverture ; aucun ne peut savoir si elle est ouverte, ce dont
 * aucun n'a besoin.
 * ─────────────────────────────────────────────────────────────────────────
 */
const Contexte = createContext<(() => void) | null>(null)

export function FournisseurRecherche({
  ouvrir,
  children,
}: {
  ouvrir: () => void
  children: React.ReactNode
}) {
  return <Contexte.Provider value={ouvrir}>{children}</Contexte.Provider>
}

/**
 * Lève si le fournisseur manque, plutôt que de rendre un bouton inerte : un
 * champ de recherche qui n'ouvre rien est le genre de panne qu'on ne remarque
 * qu'en production.
 */
export function useOuvrirRecherche(): () => void {
  const ouvrir = useContext(Contexte)
  if (!ouvrir) {
    throw new Error('useOuvrirRecherche exige <FournisseurRecherche>, posé par le shell.')
  }
  return ouvrir
}
