/**
 * Amorçage du premier compte administrateur.
 *
 * Lancer :  node --env-file=.env scripts/creer-admin.mjs "Nom Complet" adresse@domaine.ca
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi ce script existe.
 *
 * Le cahier des charges interdit l'inscription libre : seul l'administrateur
 * crée les comptes (GEN-5), et `disableSignUp: true` l'applique. Il n'y a donc
 * personne pour créer le tout premier compte depuis l'interface.
 *
 * C'est le genre d'oubli qui bloque une mise en production un vendredi soir.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le script refuse de s'exécuter si un administrateur existe déjà : il sert à
 * l'amorçage, pas à contourner l'écran de gestion des comptes.
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'

const [nom, courriel] = process.argv.slice(2)

if (!nom || !courriel) {
  console.error('\n  Usage : node --env-file=.env scripts/creer-admin.mjs "Nom Complet" adresse@domaine.ca\n')
  process.exit(1)
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
  console.error('\n  Adresse courriel invalide.\n')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL })
await client.connect()

try {
  const admins = await client.query(`select count(*)::int as n from "user" where role = 'admin'`)
  if (admins.rows[0].n > 0) {
    console.error(
      '\n  Un administrateur existe déjà. Créez les comptes suivants depuis /admin/utilisateurs.\n',
    )
    process.exit(1)
  }

  const existant = await client.query('select id from "user" where email = $1', [courriel])
  if (existant.rowCount) {
    console.error('\n  Un compte existe déjà pour cette adresse.\n')
    process.exit(1)
  }

  const id = randomBytes(16).toString('hex')
  const maintenant = new Date()

  await client.query(
    `insert into "user" (id, name, email, "emailVerified", role, banned, "createdAt", "updatedAt")
     values ($1, $2, $3, false, 'admin', false, $4, $4)`,
    [id, nom, courriel, maintenant],
  )

  console.log(`
  ✓ Compte administrateur créé.

     Nom      ${nom}
     Courriel ${courriel}

  Aucun mot de passe n'a été défini — c'est volontaire : un mot de passe créé
  ici transiterait par un terminal et un historique de commandes.

  Prochaine étape : « Mot de passe oublié ? » sur l'écran de connexion, avec
  cette adresse. Le lien reçu par courriel permet de définir le mot de passe.
`)
} finally {
  await client.end()
}
