'use client'

import { useState } from 'react'
import { CheckCircle2, Mail } from 'lucide-react'
import { BoutonAuth } from '@/components/auth/bouton-auth'
import { ChampAuth } from '@/components/auth/champ-auth'
import { EnteteAuth } from '@/components/auth/entete-auth'
import { LienRetourConnexion } from '@/components/auth/lien-retour-connexion'
import { MessageErreurAuth } from '@/components/auth/message-erreur-auth'
import { NoteAuth } from '@/components/auth/note-auth'
import { requestPasswordReset } from '@/lib/auth-client'
import { motDePasseOublieSchema } from '@/lib/validations/auth'

type Etat = 'repos' | 'chargement' | 'envoye'

export function FormulaireMotDePasseOublie() {
  const [etat, setEtat] = useState<Etat>('repos')
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const courriel = new FormData(evenement.currentTarget).get('courriel')
    const analyse = motDePasseOublieSchema.safeParse({ courriel })

    if (!analyse.success) {
      setErreur(analyse.error.issues[0]?.message ?? null)
      return
    }

    setErreur(null)
    setEtat('chargement')

    await requestPasswordReset({
      email: analyse.data.courriel,
      redirectTo: '/reinitialiser-mot-de-passe',
    })

    /**
     * L'état passe à « envoyé » quelle que soit l'issue réelle, et le message
     * est identique dans tous les cas — même raison que sur l'écran de
     * connexion : distinguer les adresses connues des inconnues révélerait qui
     * possède un compte.
     */
    setEtat('envoye')
  }

  return (
    <>
      <EnteteAuth
        surtitre="Mot de passe"
        titre="oublié"
        sousTitre="Saisissez votre courriel. Vous recevrez un lien pour définir un nouveau mot de passe."
      />

      <div className="mt-7 flex flex-col gap-4">
        {etat === 'envoye' ? (
          <NoteAuth icone={CheckCircle2} ton="succes">
            Si un compte existe pour cette adresse, un courriel vient d’être envoyé.
          </NoteAuth>
        ) : (
          <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
            <ChampAuth
              identifiant="courriel"
              name="courriel"
              type="email"
              libelle="Courriel"
              exemple="vous@exemple.ca"
              icone={Mail}
              autoComplete="username"
              autoFocus
              disabled={etat === 'chargement'}
              erreur={Boolean(erreur)}
              aria-invalid={Boolean(erreur)}
              aria-describedby={erreur ? 'erreur-courriel' : undefined}
            />
            {erreur && <MessageErreurAuth id="erreur-courriel">{erreur}</MessageErreurAuth>}

            <BoutonAuth
              type="submit"
              chargement={etat === 'chargement'}
              annonceChargement="Envoi en cours"
            >
              Envoyer le lien
            </BoutonAuth>
          </form>
        )}
      </div>

      <LienRetourConnexion />
    </>
  )
}
