/**
 * Amorçage d'une base de TEST — trois comptes, un par rôle, plus le minimum
 * pour que les écrans ne soient pas vides.
 *
 *   node --env-file=.env.test scripts/amorcer-tests.mjs --confirmer
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce script n'est PAS `creer-admin.mjs`.
 *
 * Celui-là refuse délibérément de poser un mot de passe : en production, un mot
 * de passe créé au terminal transiterait par un historique de commandes. Le
 * compte est créé vide et son titulaire passe par « mot de passe oublié ».
 *
 * Un parcours de bout en bout ne peut pas faire cela : il lui faut des
 * identifiants connus. D'où ce second script, réservé à une base jetable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ADDITIF par défaut : il n'efface RIEN.
 *
 * La première version supprimait le contenu de toutes les tables, ce qui
 * l'obligeait à refuser toute base contenant un compte étranger — donc la base
 * de développement, donc la seule disponible.
 *
 * Or les parcours n'ont besoin que d'une chose : que les trois comptes
 * existent et soient connectables. Ils naviguent et vérifient des accès ; ils
 * ne comptent pas les lignes. Effacer était un besoin supposé, pas un besoin
 * réel — et cela aurait coûté le compte administrateur du développeur et le CV
 * qu'il avait déposé pour valider le stockage.
 *
 * Les données d'exemple ne sont ajoutées que dans les tables VIDES : relancer
 * le script ne duplique donc rien.
 *
 * `--reinitialiser` reste disponible pour une base réellement jetable. Il est
 * explicite, il n'est pas le défaut, et il dit ce qu'il fait.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { hashPassword } from 'better-auth/crypto'

/** Mot de passe unique pour les trois comptes. Douze caractères minimum. */
const MOT_DE_PASSE = 'Portail-Test-2026'

const COMPTES = [
  { role: 'admin', nom: 'Test Administrateur', courriel: 'admin@test.portail' },
  { role: 'recrutement', nom: 'Test Recrutement', courriel: 'recrutement@test.portail' },
  { role: 'heures', nom: 'Test Heures', courriel: 'heures@test.portail' },
]

/** Les six catégories du CV-2. `scripts/amorcer-categories-cv.mjs` fait foi. */
const CATEGORIES = [
  'Développeur',
  'Monteur vidéo',
  'Gérant',
  'Gestionnaire de résultat',
  'Designer',
  'Support client',
]

const EMPLOYES = [
  { nom: 'Marc Tremblay', entrepriseSlug: 'paysagement', tauxHoraire: '26.50' },
  { nom: 'Julie Gagnon', entrepriseSlug: 'paysagement', tauxHoraire: '24.00' },
  { nom: 'Karine Lavoie', entrepriseSlug: 'developpement', tauxHoraire: '52.00' },
  { nom: 'Antoine Girard', entrepriseSlug: 'staff', tauxHoraire: null },
]

const CLIENTS = [
  { entrepriseSlug: 'paysagement', type: 'particulier', nom: 'Luc Bédard', statut: 'prospect' },
  {
    entrepriseSlug: 'paysagement',
    type: 'entreprise',
    nom: 'Condos du Ruisseau',
    statut: 'contacte',
  },
  {
    entrepriseSlug: 'developpement',
    type: 'entreprise',
    nom: 'Clinique dentaire Ste-Foy',
    statut: 'soumission_envoyee',
  },
]

const PRODUITS = {
  paysagement: [
    ['Pose de tourbe', 'pi²', '1.85'],
    ['Pavé uni', 'pi²', '12.50'],
  ],
  developpement: [
    ['Développement front-end', 'heure', '95.00'],
    ['Conception UX', 'heure', '85.00'],
  ],
  staff: [['Développeur intermédiaire', 'poste-mois', '9500.00']],
}

const id = () => randomBytes(16).toString('hex')

async function principal() {
  if (!process.argv.includes('--confirmer')) {
    console.error(`
  Ce script ajoute trois comptes de test à la base visée.

  Relancez avec --confirmer, en pointant sur une base jetable :

    node --env-file=.env.test scripts/amorcer-tests.mjs --confirmer
`)
    return 1
  }

  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('\n  DIRECT_URL absente de l’environnement.\n')
    return 1
  }

  console.log(`\n  Base visée : ${new URL(url).host}\n`)

  const client = new pg.Client({ connectionString: url })
  await client.connect()

  try {
    const hache = await hashPassword(MOT_DE_PASSE)
    const maintenant = new Date()

    await client.query('begin')

    if (process.argv.includes('--reinitialiser')) {
      console.log('  --reinitialiser : effacement complet demandé.\n')
      // Ordre imposé par les clés étrangères.
      for (const table of [
        'ligne_estimation',
        'estimation',
        'sequence_estimation',
        'interaction',
        'client',
        'produit_tarif',
        'grille_tarifs',
        'correction_heures',
        'saisie_jour',
        'employe',
        'periode_paie',
        'account',
        'session',
        '"user"',
        'categorie_cv',
      ]) {
        await client.query(`delete from ${table}`)
      }
    }

    /** Ne crée que ce qui manque : relancer le script ne duplique rien. */
    const vide = async (table) =>
      (await client.query(`select count(*)::int n from ${table}`)).rows[0].n === 0

    for (const c of COMPTES) {
      const existant = await client.query('select id from "user" where email = $1', [c.courriel])
      if (existant.rowCount) {
        // Le mot de passe est réaligné : un compte de test dont on ignore les
        // identifiants ne sert à rien, et le réamorçage doit rester idempotent.
        await client.query(
          `update account set password = $1, "updatedAt" = $2
           where "userId" = $3 and "providerId" = 'credential'`,
          [hache, maintenant, existant.rows[0].id],
        )
        await client.query('update "user" set role = $1 where id = $2', [
          c.role,
          existant.rows[0].id,
        ])
        continue
      }

      const uid = id()
      await client.query(
        `insert into "user" (id, name, email, "emailVerified", role, banned, "createdAt", "updatedAt")
         values ($1, $2, $3, true, $4, false, $5, $5)`,
        [uid, c.nom, c.courriel, c.role, maintenant],
      )
      await client.query(
        `insert into account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         values ($1, $2, $3, 'credential', $4, $5, $5)`,
        [id(), uid, uid, hache, maintenant],
      )
    }

    /*
      Nom par nom, et non « si la table est vide » : la base de développement
      porte déjà quelques catégories créées à la main, ce qui suffisait à
      empêcher l'arrivée des six du CV-2. Aucune catégorie existante n'est
      renommée ni réordonnée.
    */
    const rang = await client.query('select coalesce(max(ordre), -1)::int as n from categorie_cv')
    let ordre = rang.rows[0].n + 1

    for (const nom of CATEGORIES) {
      const existante = await client.query('select 1 from categorie_cv where nom = $1', [nom])
      if (existante.rowCount) continue

      await client.query(
        `insert into categorie_cv (id, nom, ordre, "createdAt", "updatedAt")
         values ($1, $2, $3, $4, $4)`,
        [id(), nom, ordre, maintenant],
      )
      ordre += 1
    }

    if (await vide('employe')) for (const e of EMPLOYES) {
      await client.query(
        `insert into employe (id, nom, "entrepriseSlug", "tauxHoraire", actif, version, "createdAt", "updatedAt")
         values ($1, $2, $3, $4, true, 0, $5, $5)`,
        [id(), e.nom, e.entrepriseSlug, e.tauxHoraire, maintenant],
      )
    }

    if (await vide('client')) for (const c of CLIENTS) {
      await client.query(
        `insert into client (id, "entrepriseSlug", type, nom, statut, version, "createdAt", "updatedAt")
         values ($1, $2, $3::"TypeClient", $4, $5::"StatutClient", 0, $6, $6)`,
        [id(), c.entrepriseSlug, c.type, c.nom, c.statut, maintenant],
      )
    }

    if (await vide('grille_tarifs')) for (const [slug, produits] of Object.entries(PRODUITS)) {
      const grille = id()
      await client.query(
        `insert into grille_tarifs (id, "entrepriseSlug", numero, actif, ecarts, "creeParNom", "createdAt")
         values ($1, $2, 1, true, $3::text[], 'Amorçage', $4)`,
        [grille, slug, ['Version initiale'], maintenant],
      )
      for (const [index, [nom, unite, prix]] of produits.entries()) {
        await client.query(
          `insert into produit_tarif (id, "entrepriseSlug", "grilleId", nom, unite, "prixUnitaire", actif, ordre)
           values ($1, $2, $3, $4, $5, $6, true, $7)`,
          [id(), slug, grille, nom, unite, prix, index],
        )
      }
    }

    await client.query('commit')

    console.log(`  ✓ Base amorcée.

     ${COMPTES.map((c) => `${c.role.padEnd(12)} ${c.courriel}`).join('\n     ')}

     Mot de passe commun : ${MOT_DE_PASSE}

  ${CATEGORIES.length} catégories de CV · ${EMPLOYES.length} employés · ${CLIENTS.length} clients · 3 grilles de tarifs
`)
    return 0
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error('\n  ÉCHEC :', e.message, '\n')
    return 1
  } finally {
    await client.end()
  }
}

/**
 * `process.exitCode` plutôt que `process.exit()` : forcer la sortie avec une
 * connexion ouverte déclenche une assertion libuv sous Windows, et ferait passer
 * un amorçage réussi pour un plantage.
 */
process.exitCode = await principal()
