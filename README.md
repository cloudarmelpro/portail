# Portail

Application web interne pour un client au Québec exploitant trois entreprises —
Paysagement, Développement web, Staff augmentation.

Quatre modules : CRM, banque de CV, suivi des heures, calculateur d'estimations.
Trois rôles, trois utilisateurs, cloisonnement par entreprise.

Les documents qui font autorité vivent dans `docs/` : `cahier-des-charges.MD`
pour le quoi, `architecture.MD` pour le comment — le système de design est en
section 19 — et `technologies.MD` pour la raison de chaque choix de pile.

## Démarrer

```bash
npm install
cp .env.example .env     # puis remplir — voir « Variables » plus bas
npx prisma migrate deploy
npm run dev
```

Le tout premier compte administrateur ne peut pas se créer depuis l'interface :
l'inscription libre est interdite (GEN-5), et il n'y a personne pour ouvrir le
premier compte. D'où un script d'amorçage, qui refuse de s'exécuter si un
administrateur existe déjà.

```bash
node --env-file=.env scripts/creer-admin.mjs "Nom Complet" adresse@domaine.ca
```

Il ne définit **aucun mot de passe** : un mot de passe créé en ligne de commande
transiterait par l'historique du terminal. Le compte se complète par « Mot de
passe oublié ? » sur l'écran de connexion.

Les comptes suivants se créent depuis `/admin/utilisateurs`, où ils sont
journalisés.

## Commandes

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run verifier` — types, lint et tests d'un coup
- `npm run e2e` — parcours Playwright

Six scripts de vérification, tous en lecture seule sauf mention contraire :
`check-db`, `check-schema`, `check-email`, `check-storage`, `check-cors`. Chacun
s'exécute par `node --env-file=.env scripts/<nom>.mjs` et explique ce qu'il
attend quand il échoue.

## Variables d'environnement

Seize variables, toutes validées par `src/lib/env.ts` **au démarrage** : une
valeur manquante ou mal formée empêche l'application de se lancer, plutôt que de
la faire échouer trois jours plus tard en pleine utilisation.

`.env.example` les documente une par une. Deux pièges à connaître.

**Les chaînes Neon.** `DATABASE_URL` est celle **avec pool**, employée par
l'application ; `DIRECT_URL` est la directe, exigée par Prisma Migrate. Dans les
deux, remplacer `sslmode=require` par `sslmode=verify-full` : le pilote `pg`
traite aujourd'hui `require` comme `verify-full`, mais à partir de sa version 9
il adoptera la sémantique libpq — chiffrer **sans** vérifier l'identité du
serveur, donc exposé à une interception.

**Les deux adresses publiques.** `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL`
doivent porter l'adresse réelle en production, jamais `localhost`. La première
porte la validation d'origine ; la seconde, les liens des courriels — un lien de
réinitialisation vers `localhost` ne mène nulle part.

## Déploiement

La cible est un VPS Hostinger avec Coolify. `output: 'standalone'` produit un
serveur Node minimal dans `.next/standalone` — **copier `.next/static` et
`public/` dedans**, Next ne le fait pas.

La sortie est conditionnelle : sur Vercel, `standalone` fait échouer l'étape
`onBuildComplete`, qui attend un fichier de traçage que ce mode n'émet pas. Les
deux cibles sont donc servies sans qu'on ait à choisir.

Trois choses à ne pas oublier, chacune invisible tant qu'elle manque.

**Le domaine Resend.** Avec le domaine d'essai `resend.dev`, Resend n'accepte
d'envoyer qu'à l'adresse du titulaire du compte : toute invitation vers un autre
destinataire est refusée. Vérifier un domaine, puis renseigner `RESEND_FROM`
avec une adresse de ce domaine.

**Le cron d'entretien.** `POST /api/entretien`, protégé par `ENTRETIEN_SECRET`,
une fois par jour. Il est le seul appelant de l'expiration des estimations et de
la purge de la corbeille des CV : sans lui, les listes grossissent sans fin.

**Des bases séparées.** Le développement et la production ne doivent pas
partager une base : `scripts/amorcer-tests.mjs` écrit des comptes d'essai, et
une erreur de fichier d'environnement suffirait à les poser sur les données du
client.

## Le principe directeur

> Une règle qui dépend de la mémoire du développeur n'est pas une architecture.

Les garanties de sécurité ne sont pas des conventions : ce sont des contraintes
que la structure du code rend impossibles à contourner. Là où c'est impossible,
un test le vérifie — d'où les quelque mille six cents contrôles, dont beaucoup
lisent les sources plutôt que d'exécuter du code.

Les trois invariants : aucun Server Action hors de `createAction`, aucun appel
Prisma hors de `lib/data/`, `lib/permissions.ts` comme source unique des rôles.
