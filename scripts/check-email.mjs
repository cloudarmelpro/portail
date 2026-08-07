/**
 * Vérification de l'envoi de courriels — Resend.
 *
 * Contrôle seul (aucun envoi) :
 *   node --env-file=.env scripts/check-email.mjs
 *
 * Envoi réel d'un message d'essai :
 *   node --env-file=.env scripts/check-email.mjs --envoyer vous@exemple.ca
 *
 * L'envoi exige un destinataire explicite : un courriel part vers l'extérieur,
 * il ne doit jamais se déclencher par simple exécution du script.
 */

const cle = process.env.RESEND_API_KEY?.trim()
const expediteur = process.env.RESEND_FROM?.trim() ?? 'Portail <onboarding@resend.dev>'

const args = process.argv.slice(2)
const indexEnvoi = args.indexOf('--envoyer')
const destinataire = indexEnvoi >= 0 ? args[indexEnvoi + 1] : null

if (!cle) {
  console.error(`
  ÉCHEC — RESEND_API_KEY absente de .env

  Sans elle, lib/email.ts écrit le lien dans la console en développement, mais
  ÉCHOUE en production : un utilisateur ne pourrait pas définir son mot de passe.
`)
  process.exit(1)
}

console.log('\n  Configuration')
console.log(`     clé          ${cle.slice(0, 6)}…${cle.slice(-4)}`)
console.log(`     expéditeur   ${expediteur}`)

async function resend(chemin) {
  const r = await fetch(`https://api.resend.com${chemin}`, {
    headers: { Authorization: `Bearer ${cle}` },
  })
  return { statut: r.status, corps: await r.json().catch(() => null) }
}

// 1. La clé est-elle valide ?
const domaines = await resend('/domains')

if (domaines.statut === 401) {
  console.error('\n  ✗ Clé refusée (401). Vérifiez RESEND_API_KEY.\n')
  process.exit(1)
}
if (domaines.statut >= 400) {
  console.error(`\n  ✗ Resend a répondu ${domaines.statut}.`, domaines.corps, '\n')
  process.exit(1)
}
console.log('\n  ✓ Clé valide')

// 2. Le domaine de l'expéditeur est-il vérifié ?
const liste = domaines.corps?.data ?? []
const domaineExpediteur = expediteur.match(/@([^>\s]+)/)?.[1]

console.log('\n  Domaines déclarés')
if (!liste.length) {
  console.log('     aucun')
} else {
  for (const d of liste) {
    const ok = d.status === 'verified'
    console.log(`     ${ok ? '✓' : '✗'} ${d.name}  (${d.status}, ${d.region})`)
  }
}

const verifie = liste.some((d) => d.name === domaineExpediteur && d.status === 'verified')
const estBacASable = domaineExpediteur === 'resend.dev'

if (estBacASable) {
  console.log(`
  ⚠ L'expéditeur utilise le domaine d'essai « resend.dev ».

     Resend n'accepte alors d'envoyer QU'À l'adresse du titulaire du compte.
     Tout autre destinataire est refusé — y compris les comptes créés depuis
     /admin/utilisateurs.

     Pour la production : vérifier un domaine dans Resend, puis renseigner
     RESEND_FROM avec une adresse de ce domaine.`)
} else if (!verifie) {
  console.log(`
  ✗ Le domaine « ${domaineExpediteur} » n'est pas vérifié dans Resend.
     Les envois seront refusés.`)
} else {
  console.log(`\n  ✓ Domaine « ${domaineExpediteur} » vérifié`)
}

// 3. Envoi réel, uniquement sur demande explicite.
if (!destinataire) {
  console.log(`
  Aucun envoi effectué. Pour tester réellement :
     node --env-file=.env scripts/check-email.mjs --envoyer vous@exemple.ca
`)
  process.exit(verifie || estBacASable ? 0 : 1)
}

console.log(`\n  Envoi d'essai vers ${destinataire}…`)

const envoi = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: expediteur,
    to: destinataire,
    subject: 'Portail — essai de configuration',
    text: "Si vous lisez ce message, l'envoi de courriels est opérationnel.",
  }),
})

const reponse = await envoi.json().catch(() => null)

if (!envoi.ok) {
  console.error(`\n  ✗ Envoi refusé (${envoi.status}) :`, reponse?.message ?? reponse, '\n')
  process.exit(1)
}

console.log(`\n  ✓ Message envoyé — identifiant ${reponse?.id}\n`)
