'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton } from '@/components/shared/bouton'
import { authClient } from '@/lib/auth-client'

/** Deux minutes avant l'échéance — architecture.MD, section 19. */
const PREAVIS_MS = 2 * 60 * 1000

/**
 * Avertissement d'expiration de session.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi cet écran existe.
 *
 * Le cahier des charges exige une déconnexion automatique après inactivité
 * (GEN-4). Mal faite, c'est une redirection brutale qui efface un formulaire à
 * moitié rempli — et c'est le premier motif de rejet d'un outil interne.
 *
 * Bien faite, c'est un avertissement deux minutes avant, avec la possibilité de
 * prolonger d'un clic.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function AvertissementSession() {
  const router = useRouter()
  const { data } = authClient.useSession()
  const [restantMs, setRestantMs] = useState<number | null>(null)

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * L'échéance doit venir du SERVEUR, pas seulement de l'atome de session.
   *
   * `useSession()` ne se recharge qu'au montage, sur signal d'authentification
   * ou au retour de focus de l'onglet — jamais sur une navigation interne. Or le
   * `Shell` vit dans le layout : il ne se remonte pas. L'échéance affichée
   * vieillissait donc pendant qu'`updateAge` la repoussait côté serveur à chaque
   * requête.
   *
   * Deux conséquences, toutes deux observées :
   *
   *   — un avertissement FAUX au bout de deux heures d'onglet ouvert, suivi
   *     d'une redirection qui arrache l'utilisateur à sa grille à moitié
   *     remplie, alors que sa session était parfaitement valide ;
   *   — un bouton « Rester connecté » qui ne réparait rien : il prolongeait bien
   *     la session côté serveur, mais `/get-session` ne figure pas parmi les
   *     signaux qui rafraîchissent l'atome. L'échéance locale restait la même,
   *     et la boîte reparaissait la seconde suivante.
   *
   * D'où cette échéance locale, qui prend le pas sur celle de l'atome dès qu'on
   * a une valeur plus récente. Et surtout : on ne redirige plus sans avoir
   * REDEMANDÉ au serveur. Le seul cas où l'on doit couper est celui où il
   * répond que la session n'existe plus.
   * ─────────────────────────────────────────────────────────────────────────
   */
  const [echeanceLocale, setEcheanceLocale] = useState<number | null>(null)

  const depuisAtome = data?.session?.expiresAt ? new Date(data.session.expiresAt).getTime() : null

  // La plus tardive des deux fait foi — une échéance ne recule jamais.
  const fin = Math.max(echeanceLocale ?? 0, depuisAtome ?? 0) || null

  /** Relit la session et retourne sa nouvelle échéance, ou `null` si close. */
  async function relireEcheance(): Promise<number | null> {
    const r = await authClient.getSession({ query: { disableCookieCache: true } })
    const brut = r?.data?.session?.expiresAt
    if (!brut) return null

    const quand = new Date(brut).getTime()
    setEcheanceLocale(quand)
    return quand
  }

  useEffect(() => {
    if (!fin) return

    /**
     * Tout se joue dans l'intervalle, sans appel immédiat : un `setState`
     * synchrone dans un effet déclenche des rendus en cascade. La seconde de
     * latence au montage est imperceptible.
     */
    const minuterie = setInterval(() => {
      const restant = fin - Date.now()

      if (restant <= 0) {
        clearInterval(minuterie)

        // Dernière vérification avant de couper : l'utilisateur a pu rester
        // actif dans un autre onglet, auquel cas le serveur a déjà repoussé
        // l'échéance et il n'y a rien à interrompre.
        void relireEcheance().then((quand) => {
          if (quand && quand > Date.now()) {
            setRestantMs(null)
            return
          }
          // Le paramètre déclenche la bannière « Votre session a expiré ».
          router.push('/?expiree=1')
        })
        return
      }

      setRestantMs(restant <= PREAVIS_MS ? restant : null)
    }, 1000)

    return () => clearInterval(minuterie)
  }, [fin, router])

  async function prolonger() {
    // Lire la session suffit à la prolonger côté serveur (`updateAge`) — mais il
    // faut RÉCUPÉRER la nouvelle échéance, sans quoi le compte à rebours
    // continue de courir contre l'ancienne.
    const quand = await relireEcheance()
    if (quand) setRestantMs(null)
    router.refresh()
  }

  if (restantMs === null) return null

  const minutes = Math.floor(restantMs / 60000)
  const secondes = Math.floor((restantMs % 60000) / 1000)

  return (
    <Dialog open onOpenChange={() => undefined}>
      <ContenuDialogue boutonFermer={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-5 shrink-0" aria-hidden />
            Votre session va expirer
          </DialogTitle>
          <DialogDescription>
            Il reste{' '}
            <span className="text-ink font-medium tabular-nums">
              {minutes}:{String(secondes).padStart(2, '0')}
            </span>
            . Prolongez pour ne rien perdre de votre travail en cours.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Bouton onClick={prolonger}>Rester connecté</Bouton>
        </DialogFooter>
      </ContenuDialogue>
    </Dialog>
  )
}
