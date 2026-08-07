'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Info, Lock, Mail } from 'lucide-react'
import { BasculeMotDePasse } from '@/components/auth/bascule-mot-de-passe'
import { BoutonAuth } from '@/components/auth/bouton-auth'
import { ChampAuth } from '@/components/auth/champ-auth'
import { EnteteAuth } from '@/components/auth/entete-auth'
import { MessageErreurAuth } from '@/components/auth/message-erreur-auth'
import { NoteAuth } from '@/components/auth/note-auth'
import { signIn } from '@/lib/auth-client'
import { connexionSchema } from '@/lib/validations/auth'

type Etat = 'repos' | 'chargement' | 'refuse' | 'trop-tentatives'

/**
 * Écran de connexion — la racine « / ».
 *
 * C'est TOUTE la façade du produit : un visiteur non authentifié ne voit rien
 * d'autre, et les trois utilisateurs le voient chaque jour.
 */
export function FormulaireConnexion({ sessionExpiree }: { sessionExpiree: boolean }) {
  const router = useRouter()
  const [etat, setEtat] = useState<Etat>('repos')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [motDePasseVisible, setMotDePasseVisible] = useState(false)

  const verrouille = etat === 'chargement' || etat === 'trop-tentatives'
  const refuse = etat === 'refuse'

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const donnees = new FormData(evenement.currentTarget)
    const analyse = connexionSchema.safeParse({
      courriel: donnees.get('courriel'),
      motDePasse: donnees.get('motDePasse'),
    })

    if (!analyse.success) {
      const champs: Record<string, string> = {}
      for (const p of analyse.error.issues) champs[String(p.path[0])] = p.message
      setErreurs(champs)
      return
    }

    setErreurs({})
    setEtat('chargement')

    const { error } = await signIn.email({
      email: analyse.data.courriel,
      password: analyse.data.motDePasse,
      rememberMe: donnees.get('rester') === 'on',
    })

    if (error) {
      // 429 : la limite de tentatives a été atteinte.
      setEtat(error.status === 429 ? 'trop-tentatives' : 'refuse')
      return
    }

    router.push('/accueil')
    router.refresh()
  }

  return (
    <>
      <EnteteAuth
        surtitre="Trois entreprises."
        titre="Un seul accès."
        sousTitre="Connectez-vous pour accéder à vos modules de travail."
      />

      <div className="mt-7 flex flex-col gap-4">
        {sessionExpiree && (
          <NoteAuth icone={Info}>Votre session a expiré. Reconnectez-vous.</NoteAuth>
        )}

        <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
          <ChampAuth
            identifiant="courriel"
            name="courriel"
            type="email"
            libelle="Courriel"
            exemple="vous@exemple.ca"
            icone={Mail}
            autoComplete="username"
            // Le focus arrive ici au chargement : l'utilisateur tape sans cliquer.
            autoFocus
            disabled={verrouille}
            erreur={refuse || Boolean(erreurs.courriel)}
            // `refuse` teinte les deux champs : sans `aria-invalid`, le refus ne
            // serait porté que par la couleur pour qui ne voit pas le filet.
            aria-invalid={refuse || Boolean(erreurs.courriel)}
            aria-describedby={erreurs.courriel ? 'erreur-courriel' : undefined}
          />
          {erreurs.courriel && (
            <MessageErreurAuth id="erreur-courriel">{erreurs.courriel}</MessageErreurAuth>
          )}

          <ChampAuth
            identifiant="motDePasse"
            name="motDePasse"
            type={motDePasseVisible ? 'text' : 'password'}
            libelle="Mot de passe"
            exemple="Votre mot de passe"
            icone={Lock}
            autoComplete="current-password"
            disabled={verrouille}
            erreur={refuse || Boolean(erreurs.motDePasse)}
            aria-invalid={refuse || Boolean(erreurs.motDePasse)}
            aria-describedby={erreurs.motDePasse ? 'erreur-mdp' : undefined}
            suffixe={
              <BasculeMotDePasse
                visible={motDePasseVisible}
                onBasculer={() => setMotDePasseVisible((v) => !v)}
              />
            }
          />
          {erreurs.motDePasse && (
            <MessageErreurAuth id="erreur-mdp">{erreurs.motDePasse}</MessageErreurAuth>
          )}

          {/*
            Le message est RIGOUREUSEMENT identique que le courriel existe ou non,
            que le compte soit suspendu ou l'origine refusée. Un message différent
            permettrait de découvrir quelles adresses ont un compte.
          */}
          {refuse && <MessageErreurAuth>Courriel ou mot de passe incorrect.</MessageErreurAuth>}
          {etat === 'trop-tentatives' && (
            <MessageErreurAuth>Trop de tentatives. Réessayez dans 5 minutes.</MessageErreurAuth>
          )}

          <div className="mt-1 flex items-center gap-3">
            {/* Le rembourrage vertical compensé porte la cible à 44 px sans écarter la rangée. */}
            <label
              htmlFor="rester"
              className="-my-[13px] flex min-w-0 flex-1 cursor-pointer items-center gap-[7px] py-[13px]"
            >
              <span className="relative flex size-[18px] shrink-0 items-center justify-center">
                <input
                  id="rester"
                  name="rester"
                  type="checkbox"
                  defaultChecked
                  disabled={verrouille}
                  className="border-border-strong checked:bg-action checked:border-action hover:border-ink3 peer size-[18px] cursor-pointer appearance-none rounded-[6px] border transition-colors duration-[120ms]"
                />
                <Check
                  className="text-action-ink pointer-events-none absolute size-[11px] opacity-0 peer-checked:opacity-100"
                  strokeWidth={3.5}
                  aria-hidden
                />
              </span>
              <span className="text-ink2 text-[13px] leading-[18px]">Rester connecté</span>
            </label>

            <Link
              href="/mot-de-passe-oublie"
              className="text-ink2 hover:text-ink -my-[13px] py-[13px] text-[13px] leading-[18px] whitespace-nowrap underline-offset-4 transition-colors duration-150 hover:underline"
            >
              Mot de passe oublié
            </Link>
          </div>

          <BoutonAuth
            type="submit"
            disabled={verrouille}
            chargement={etat === 'chargement'}
            annonceChargement="Connexion en cours"
          >
            Se connecter
          </BoutonAuth>
        </form>
      </div>
    </>
  )
}
