/**
 * Amorçage du premier compte administrateur.
 *
 * Lancer :  node --env-file=.env scripts/creer-admin.mjs "Nom Complet" adresse@domaine.ca
 *
 * Un TROISIÈME argument, facultatif, pose un mot de passe :
 *            node --env-file=.env scripts/creer-admin.mjs "Nom" adr@dom.ca "MotDePasse"
 *
 * À n'employer qu'en développement. En production, laisser le compte sans mot
 * de passe et passer par le courriel : un mot de passe donné ici reste dans
 * l'historique du terminal, où personne ne pense à aller l'effacer.
 *
 * Il n'est PAS écrit dans ce fichier, et il ne doit jamais l'être : le dépôt est
 * public, et un mot de passe d'administrateur y resterait pour toujours —
 * l'effacer d'un commit ultérieur ne le retire pas de l'historique.
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
import { hashPassword } from 'better-auth/crypto'

const [nom, courriel, motDePasse] = process.argv.slice(2)

if (!nom || !courriel) {
  console.error(
    '\n  Usage : node --env-file=.env scripts/creer-admin.mjs "Nom Complet" adresse@domaine.ca\n',
  )
  process.exit(1)
}
if (motDePasse !== undefined && motDePasse.length < 12) {
  // Le même plancher que `minPasswordLength` dans `lib/auth.ts` : un compte
  // amorcé ici ne doit pas être plus faible qu'un compte créé depuis l'écran.
  console.error('\n  Le mot de passe doit faire au moins douze caractères.\n')
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
     values ($1, $2, $3, $4, 'admin', false, $5, $5)`,
    [id, nom, courriel, motDePasse !== undefined, maintenant],
  )

  /*
    La ligne `account` n'existe que si un mot de passe est donné.

    Son ABSENCE porte une information : `lib/auth.ts` s'en sert pour distinguer
    l'invitation d'un nouveau venu de la réinitialisation d'un compte connu. Un
    compte sans identifiants n'est jamais entré ; il reçoit donc un courriel
    d'invitation, et non un « réinitialisez votre mot de passe » pour un mot de
    passe qu'il n'a jamais eu.

    `emailVerified` suit la même logique : vrai seulement si le compte est
    utilisable tout de suite, sans passer par le courriel.
  */
  if (motDePasse !== undefined) {
    await client.query(
      `insert into account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
       values ($1, $2, $2, 'credential', $3, $4, $4)`,
      [randomBytes(16).toString('hex'), id, await hashPassword(motDePasse), maintenant],
    )
  }

  console.log(`
  ✓ Compte administrateur créé.

     Nom      ${nom}
     Courriel ${courriel}
`)

  if (motDePasse === undefined) {
    console.log(`  Aucun mot de passe n'a été défini — c'est volontaire : un mot de passe créé
  ici transiterait par un terminal et un historique de commandes.

  Prochaine étape : « Mot de passe oublié ? » sur l'écran de connexion, avec
  cette adresse. Le lien reçu par courriel permet de définir le mot de passe.
`)
  } else {
    console.log(`  Un mot de passe a été posé : le compte est utilisable immédiatement.

  Il figure désormais dans l'historique de votre terminal. En développement
  c'est sans conséquence ; sur une base qui portera de vraies données, changez-le
  depuis l'écran de connexion et effacez la ligne de commande.
`)
  }
} finally {
  await client.end()
}
