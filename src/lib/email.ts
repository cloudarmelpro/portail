import 'server-only'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { siteConfig } from '@/config/site'

/**
 * Envoi de courriels — Resend.
 *
 * Deux usages seulement : l'invitation d'un compte et la réinitialisation de mot
 * de passe. L'application n'envoie rien d'autre — pas de notification, pas de
 * relance automatique.
 *
 * En développement sans clé, le lien est écrit dans la console plutôt que de
 * faire échouer l'opération : on peut ainsi dérouler tout le parcours de
 * connexion sans compte Resend.
 */

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

type Courriel = {
  a: string
  sujet: string
  html: string
  texte: string
}

async function envoyer({ a, sujet, html, texte }: Courriel): Promise<void> {
  if (!resend) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY absente : impossible d’envoyer un courriel.')
    }
    console.info(
      `\n[courriel — non envoyé, clé absente]\n  à      ${a}\n  sujet  ${sujet}\n\n${texte}\n`,
    )
    return
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: a,
    subject: sujet,
    html,
    text: texte,
  })

  if (error) throw new Error(`Envoi impossible : ${error.message}`)
}

/**
 * Gabarit commun.
 *
 * Styles en ligne et couleurs en dur : un client de messagerie n'a accès ni à
 * nos feuilles de style ni à nos variables CSS. Ce sont les seules couleurs
 * écrites en dehors de `globals.css`, et elles reprennent les jetons de document
 * imprimé — un courriel se lit comme du papier, toujours clair.
 */
function gabarit({
  titre,
  corps,
  lien,
  libelleLien,
}: {
  titre: string
  corps: string
  lien: string
  libelleLien: string
}): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:32px 16px;background:#f9f9f7;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#111111">
  <table role="presentation" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #ececec;border-radius:16px;border-collapse:separate">
    <tr><td style="padding:40px">
      <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em">${siteConfig.nom}</div>
      <h1 style="margin:24px 0 0;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-0.01em">${titre}</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:22px;color:#4a4a4a">${corps}</p>
      <a href="${lien}" style="display:inline-block;margin-top:24px;padding:11px 20px;background:#0b0b0b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:500">${libelleLien}</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:18px;color:#6b6b6b">
        Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>
        <span style="color:#4a4a4a;word-break:break-all">${lien}</span>
      </p>
      <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #ececec;font-size:11px;line-height:16px;color:#6b6b6b">
        Ce lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
      </p>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Échappement du texte inséré dans le gabarit HTML.
 *
 * Le nom vient d'un champ libre de l'administration — cent vingt caractères,
 * aucun caractère interdit. Il était interpolé brut dans un document qui QUITTE
 * le système : un `<a>` glissé dans un nom d'utilisateur partait tel quel dans
 * la boîte du destinataire, sous notre nom d'expéditeur.
 *
 * Le rôle est un enum et n'en avait pas besoin ; il passe par la même porte,
 * pour qu'il n'y ait pas deux règles à retenir. La version texte, elle, n'est
 * pas du balisage et n'est pas échappée.
 */
function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function envoyerReinitialisation(options: {
  a: string
  nom: string
  lien: string
}): Promise<void> {
  await envoyer({
    a: options.a,
    sujet: `${siteConfig.nom} — réinitialisation de votre mot de passe`,
    html: gabarit({
      titre: 'Réinitialiser votre mot de passe',
      corps: `Bonjour ${echapper(options.nom)}, vous pouvez définir un nouveau mot de passe en suivant ce lien.`,
      lien: options.lien,
      libelleLien: 'Définir un mot de passe',
    }),
    texte: `Bonjour ${options.nom},\n\nDéfinissez un nouveau mot de passe : ${options.lien}\n\nCe lien expire dans une heure.`,
  })
}

export async function envoyerInvitation(options: {
  a: string
  nom: string
  lien: string
  role: string
}): Promise<void> {
  await envoyer({
    a: options.a,
    sujet: `${siteConfig.nom} — votre accès`,
    html: gabarit({
      titre: 'Votre accès a été créé',
      corps: `Bonjour ${echapper(options.nom)}, un accès vient d’être créé pour vous avec le rôle « ${echapper(options.role)} ». Choisissez votre mot de passe pour commencer.`,
      lien: options.lien,
      libelleLien: 'Choisir mon mot de passe',
    }),
    texte: `Bonjour ${options.nom},\n\nUn accès vient d'être créé pour vous (rôle : ${options.role}).\nChoisissez votre mot de passe : ${options.lien}`,
  })
}
