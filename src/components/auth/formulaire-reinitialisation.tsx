'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { BasculeMotDePasse } from '@/components/auth/bascule-mot-de-passe'
import { BoutonAuth, classesBoutonAuth } from '@/components/auth/bouton-auth'
import { ChampAuth } from '@/components/auth/champ-auth'
import { EnteteAuth } from '@/components/auth/entete-auth'
import { LienRetourConnexion } from '@/components/auth/lien-retour-connexion'
import { MessageErreurAuth } from '@/components/auth/message-erreur-auth'
import { resetPassword } from '@/lib/auth-client'
import { reinitialisationSchema } from '@/lib/validations/auth'
import { notifier } from '@/lib/toast'

type Etat = 'repos' | 'chargement' | 'lien-invalide'

/**
 * Réinitialisation et première activation de compte empruntent le même chemin.
 *
 * L'écran reprend le gabarit des deux autres — même en-tête, même colonne de
 * 400 px, mêmes champs de 56 px, même bouton.
 */
export function FormulaireReinitialisation({ jeton }: { jeton: string | null }) {
  const router = useRouter()
  const [etat, setEtat] = useState<Etat>(jeton ? 'repos' : 'lien-invalide')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState(false)

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (!jeton) return

    const donnees = new FormData(evenement.currentTarget)
    const analyse = reinitialisationSchema.safeParse({
      motDePasse: donnees.get('motDePasse'),
      confirmation: donnees.get('confirmation'),
    })

    if (!analyse.success) {
      const champs: Record<string, string> = {}
      for (const p of analyse.error.issues) champs[String(p.path[0])] = p.message
      setErreurs(champs)
      return
    }

    setErreurs({})
    setEtat('chargement')

    const { error } = await resetPassword({ newPassword: analyse.data.motDePasse, token: jeton })

    if (error) {
      // Un jeton expiré ou déjà utilisé aboutit ici : le dire clairement évite
      // que l'utilisateur ressaie indéfiniment le même lien.
      setEtat('lien-invalide')
      return
    }

    notifier.succes('Mot de passe défini. Connectez-vous.')
    router.push('/')
  }

  if (etat === 'lien-invalide') {
    return (
      <>
        <EnteteAuth
          titre="Ce lien n’est plus valide"
          sousTitre="Les liens expirent après une heure et ne servent qu’une fois. Demandez-en un nouveau."
        />

        <div className="mt-7">
          <Link href="/mot-de-passe-oublie" className={classesBoutonAuth()}>
            Demander un nouveau lien
          </Link>
        </div>

        <LienRetourConnexion />
      </>
    )
  }

  return (
    <>
      <EnteteAuth
        surtitre="Choisir"
        titre="un mot de passe"
        sousTitre="Au moins douze caractères. Choisissez une phrase que vous seul retenez."
      />

      <div className="mt-7 flex flex-col gap-4">
        <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
          <ChampAuth
            identifiant="motDePasse"
            name="motDePasse"
            type={visible ? 'text' : 'password'}
            libelle="Nouveau mot de passe"
            icone={Lock}
            autoComplete="new-password"
            autoFocus
            disabled={etat === 'chargement'}
            erreur={Boolean(erreurs.motDePasse)}
            aria-invalid={Boolean(erreurs.motDePasse)}
            aria-describedby={erreurs.motDePasse ? 'erreur-mdp' : undefined}
            suffixe={
              <BasculeMotDePasse visible={visible} onBasculer={() => setVisible((v) => !v)} />
            }
          />
          {erreurs.motDePasse && (
            <MessageErreurAuth id="erreur-mdp">{erreurs.motDePasse}</MessageErreurAuth>
          )}

          {/*
            La bascule d'affichage n'est PAS répétée ici : elle commande les deux
            champs à la fois, et deux yeux côte à côte laisseraient croire qu'ils
            se règlent séparément.
          */}
          <ChampAuth
            identifiant="confirmation"
            name="confirmation"
            type={visible ? 'text' : 'password'}
            libelle="Confirmer le mot de passe"
            icone={Lock}
            autoComplete="new-password"
            disabled={etat === 'chargement'}
            erreur={Boolean(erreurs.confirmation)}
            aria-invalid={Boolean(erreurs.confirmation)}
            aria-describedby={erreurs.confirmation ? 'erreur-confirmation' : undefined}
          />
          {erreurs.confirmation && (
            <MessageErreurAuth id="erreur-confirmation">{erreurs.confirmation}</MessageErreurAuth>
          )}

          <BoutonAuth
            type="submit"
            chargement={etat === 'chargement'}
            annonceChargement="Enregistrement en cours"
          >
            Enregistrer
          </BoutonAuth>
        </form>
      </div>

      <LienRetourConnexion />
    </>
  )
}
