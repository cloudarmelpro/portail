# Technologies & outils — Application web (CRM / Banque de CV / Suivi des heures / Calculateur)

> Liste de référence **développement uniquement**.
> Ne contient ni analyse fonctionnelle, ni coûts, ni planification.
>
> **Orientation retenue : pile entièrement auto-hébergée.**
> Hébergement sur VPS Hostinger, aucune dépendance à un fournisseur externe payant,
> stockage objet compatible S3, portable d'un fournisseur à l'autre.

---

## 1. Prérequis machine (poste de développement)

- **Node.js 24 LTS** — runtime JavaScript, aligné sur la version du serveur
- **npm** — gestionnaire de paquets, livré avec Node. Un seul fichier de verrouillage,
  `package-lock.json` — pas de pnpm, pas de yarn
- **Git** — contrôle de version
- **VS Code** — éditeur
- **Docker Desktop** — construction et test local de l'image de l'application
- **Client SSH** — accès au VPS (OpenSSH inclus dans Windows)

**Extensions VS Code**

- Tailwind CSS IntelliSense — autocomplétion des classes utilitaires
- ESLint — signalement des erreurs en direct
- Prettier — formatage automatique
- Error Lens — erreurs affichées en ligne
- Pretty TypeScript Errors — erreurs TypeScript lisibles
- Docker — gestion des conteneurs depuis l'éditeur

---

## 2. Socle applicatif

- **Next.js 16** — `next` — framework applicatif : App Router, Server Components, Server Actions
  - Compilation en mode `output: 'standalone'`, obligatoire pour l'auto-hébergement
- **React 19** — `react`, `react-dom` — bibliothèque d'interface
- **TypeScript** — `typescript` — typage statique de bout en bout
- **sharp** — `sharp` — optimisation des images, requise en auto-hébergé (fournie automatiquement chez Vercel, pas ici)

---

## 3. Interface & design system

- **Tailwind CSS v4** — `tailwindcss` — jetons de design et styles utilitaires
- **shadcn/ui** — CLI `shadcn` — composants accessibles copiés dans le projet, donc entièrement modifiables
- **Radix UI** — `@radix-ui/*` — primitives accessibles sous-jacentes à shadcn
- **Motion** — `motion` — animations et micro-interactions
- **Lucide** — `lucide-react` — jeu d'icônes cohérent
- **Cal Sans** — police variable auto-hébergée, chargée par `next/font/local` — quatre
  graisses, axe de taille optique 8–45 pt, diacritiques françaises, licence SIL Open Font
  - Récupérer le `.woff2` variable depuis le dépôt officiel ; **ne pas** utiliser le paquet
    npm `cal-sans`, resté à l'ancienne coupe à une seule graisse
- **next-themes** — `next-themes` — mode clair / sombre
- **cmdk** — `cmdk` — palette de commandes (⌘K)
- **Sonner** — `sonner` — notifications toast
- **tailwind-merge** et **clsx** — `tailwind-merge`, `clsx` — composition propre des classes conditionnelles

---

## 4. Données

- **Neon** — PostgreSQL infogéré, externe au VPS
- **Prisma ORM** — `prisma` (outil de développement) et `@prisma/client` (client d'accès)
- **Prisma Migrate** — inclus — migrations versionnées, générées depuis le schéma
- **Prisma Studio** — inclus — interface visuelle d'exploration et d'édition de la base

### Fraîcheur des données — mise au point

L'ORM ne joue **aucun rôle** dans le fait que l'interface se mette à jour sans rechargement.
Prisma comme Drizzle ne font qu'exécuter des requêtes SQL et rendre le résultat. Ni l'un
ni l'autre ne surveille la base ni ne pousse quoi que ce soit vers le navigateur.

Trois niveaux à ne pas confondre :

- **L'utilisateur agit, son écran se met à jour** — assuré par les **Server Actions de
  Next.js** avec `revalidatePath`. Couvre l'essentiel du besoin réel de l'application.
- **Les données se réactualisent au retour sur l'onglet** — assuré par **TanStack Query**
  (section 7), via la revalidation au focus.
- **Voir en direct les modifications faites par un autre utilisateur** — exigerait de
  l'interrogation périodique, du SSE ou des WebSockets.

> **Le troisième niveau n'est pas retenu.** Les trois utilisateurs travaillent chacun dans
> un module distinct : Cédric sur le CRM et le calculateur, la recruteuse sur les CV, la
> gérante sur les heures. Personne n'édite jamais les mêmes données simultanément.
> Ajouter du temps réel serait de la complexité sans bénéfice perceptible.

---

## 5. Authentification & autorisation

- **Better Auth** — `better-auth` — solution auto-hébergée, stockée dans votre propre base

> **Licence et coût — vérifié.** La bibliothèque est sous licence **MIT**, en version
> stable (branche 1.x). Elle s'installe par npm, tourne dans l'application et écrit dans
> la base Neon : aucun compte externe, aucun coût par utilisateur.
>
> La page de tarifs visible sur le site concerne un **produit distinct et optionnel**
> (`dash.better-auth.com` : tableau de bord hébergé, journaux d'audit gérés, détection de
> menaces). Il n'est pas utilisé ici — ces fonctions sont couvertes par le journal d'audit
> en base et `lib/rate-limit.ts`, voir `architecture.MD`.

Fournit d'origine ce qu'exige le cahier des charges :

- Connexion par courriel et mot de passe, avec hachage sécurisé
- Sessions avec expiration automatique après inactivité
- **Module admin** — création, modification, suppression et suspension de comptes réservées à l'administrateur
- **Rôles et permissions** — admin, recruteuse, gérante
- Réinitialisation de mot de passe oublié
- Authentification à deux facteurs

Paquets complémentaires :

- `better-auth/adapters/prisma` — connexion à la base PostgreSQL via Prisma

---

## 6. Stockage de fichiers (CV)

- **Cloudflare R2** — bucket privé, indication de localisation `enam` (est de l'Amérique du Nord)
- `@aws-sdk/client-s3` — client d'accès, R2 étant compatible avec l'API S3
- `@aws-sdk/s3-request-presigner` — génération d'URL présignées à durée limitée
- **MinIO** en conteneur Docker pour le développement local — même API, aucun compte requis

**Règles de configuration non négociables :**

- Bucket **privé**, aucun accès public, aucun domaine public rattaché
- Aucun fichier accessible par URL directe — tout téléchargement passe par une URL présignée,
  générée côté serveur uniquement après vérification de la session et du rôle
- Jeton d'API à portée limitée à ce seul bucket, en lecture et écriture
- Versioning activé, pour pouvoir récupérer un fichier supprimé par erreur

> **L'API S3 est le standard de fait du stockage objet.** Le code est écrit une fois contre
> `@aws-sdk/client-s3` : changer de fournisseur revient à modifier trois variables
> d'environnement — point de terminaison, clé, bucket. Aucune ligne à réécrire.
>
> C'est ce qui permet de développer contre MinIO en local et de déployer sur R2, ou de
> migrer vers un autre fournisseur plus tard sans coût.

### Résidence des données — décision assumée

R2 ne propose pas de juridiction canadienne. Seules l'Union européenne et FedRAMP font l'objet
de restrictions juridictionnelles fermes ; `enam` est une **indication de placement**, pas une
garantie contractuelle. Les fichiers doivent donc être considérés comme hébergés **hors du
Canada**, vraisemblablement aux États-Unis.

C'est **cohérent avec le reste de la pile** : Neon n'a pas non plus de région canadienne, donc
les dossiers clients, les fiches employés et les métadonnées des candidats sont déjà hors du
pays. Faire l'inverse — base à l'étranger, fichiers au Canada — était une demi-mesure qui
compliquait le discours sans rien protéger de plus.

Conséquence pratique : **un seul accord écrit du client** couvre l'ensemble des données, et une
seule mention suffit dans sa politique de confidentialité. Voir `cahier-des-charges.MD`, point
ouvert PO-3.

> **Alternative si la résidence canadienne redevient une exigence** : Supabase Storage propose
> une région Canada Central et une API compatible S3. Le changement se limiterait alors aux
> variables d'environnement.

---

## 7. Bibliothèques fonctionnelles

- **react-hook-form** — `react-hook-form` — gestion des formulaires
- **Zod** — `zod` — schémas de validation partagés client et serveur
- **@hookform/resolvers** — connexion de Zod à React Hook Form
- **TanStack Table** — `@tanstack/react-table` — tri, filtres et pagination des listes CRM et employés
- **TanStack Query** — `@tanstack/react-query` — cache et synchronisation des données côté client
- **date-fns** — `date-fns` — manipulation des dates pour le suivi des heures
- **@react-pdf/renderer** — génération des devis PDF du calculateur de prix
- **ExcelJS** — `exceljs` — export Excel des heures et des listes
- **Recharts** — `recharts` — visualisations et totaux d'heures

---

## 8. Observation & journalisation

**Suivi des erreurs**

- **Sentry** — `@sentry/nextjs` — remontée des erreurs de production, offre gratuite

**Journal d'audit applicatif**

- Table dédiée en base de données, alimentée par le code de l'application
- Enregistre qui a fait quoi et quand : consultation ou téléchargement d'un CV,
  modification d'une fiche client, saisie ou correction d'heures, connexion et déconnexion
- Ce n'est pas un confort : c'est une exigence implicite de la loi 25 dès lors que
  l'on manipule des renseignements personnels

**Journaux techniques**

- **Pino** — `pino`, `pino-pretty` — journalisation structurée côté serveur

**Surveillance de disponibilité**

- **Uptime Kuma** — conteneur Docker auto-hébergé, gratuit — alerte si le site tombe

**Statistiques d'usage (optionnel)**

- **Umami** — conteneur Docker auto-hébergé, gratuit, sans cookie, conforme RGPD et loi 25

> **Écarté : Google Analytics et Google Search Console.**
>
> Search Console est un outil de référencement : l'application étant derrière un login,
> elle ne sera jamais indexée par Google — et ne doit pas l'être. L'outil est hors sujet.
>
> Google Analytics est conçu pour mesurer du trafic anonyme sur un site public. Avec
> trois utilisateurs identifiés, il n'apprend rien qui ne soit déjà connu, et il transmet
> à un tiers des données de navigation sur un outil qui manipule des CV et des fichiers
> clients, sans rapport avec le fonctionnement de l'outil.
> Umami couvre le même besoin sans cet inconvénient.

---

## 9. Qualité de code

- **ESLint** — `eslint`, `eslint-config-next` — analyse statique
- **Prettier** — `prettier`, `prettier-plugin-tailwindcss` — formatage et tri automatique des classes Tailwind
- **Husky** — `husky` — hooks Git
- **lint-staged** — `lint-staged` — vérifications avant chaque commit
- **TypeScript strict** — mode `strict` activé dans la configuration

---

## 10. Tests

- **Vitest** — `vitest` — tests unitaires, notamment la logique du calculateur de prix et les calculs d'heures
- **Testing Library** — `@testing-library/react` — tests de composants
- **Playwright** — `@playwright/test` — tests de bout en bout : parcours de connexion et vérification des permissions par rôle

---

## 11. Infrastructure & déploiement

**Serveur**

- **VPS Hostinger** — KVM 2 minimum recommandé (2 vCPU, 8 Go de RAM, 100 Go de disque)
- **Ubuntu 24.04 LTS** — système d'exploitation
- **Emplacement du centre de données** — choisir le plus proche du Canada disponible,
  pour la même raison que le bucket S3

**Plateforme de déploiement**

- **Coolify** — PaaS auto-hébergé, gratuit et open source, installé sur le VPS

  Redonne l'essentiel de l'expérience d'une plateforme infogérée : déploiement automatique
  à chaque `git push`, HTTPS et renouvellement des certificats gérés seuls, gestion des
  variables d'environnement, journaux, et retour arrière en cas de problème.

**Conteneurisation**

- **Docker** et **Docker Compose** — exécution de l'application et des services annexes
  (la base de données est externe, chez Neon)
- **Traefik** — reverse proxy et certificats Let's Encrypt (fourni et configuré par Coolify)

**Intégration continue**

- **GitHub** — dépôt de code
- **GitHub Actions** — exécution des tests, du linter et de la vérification TypeScript
  à chaque poussée ; le déploiement est déclenché ensuite par webhook vers Coolify
- **Migrations de base de données** — `prisma migrate deploy` doit être exécuté à chaque
  déploiement, avant le démarrage de l'application (commande de démarrage du conteneur
  ou étape de pré-déploiement configurée dans Coolify)

**Sauvegardes**

- **Base de données** — sauvegardes et restauration à un instant précis assurées par Neon
- **Sauvegarde indépendante** — `pg_dump` hebdomadaire envoyé vers un bucket R2 distinct
  de celui des CV. Non par méfiance envers Neon, mais parce qu'une sauvegarde conservée
  chez le même fournisseur que la base ne protège ni d'un problème de compte, ni d'une
  suspension pour défaut de paiement
- **Fichiers CV** — versioning activé côté R2
- **Restauration testée au moins une fois** — une sauvegarde jamais restaurée n'est pas une sauvegarde

**Sécurisation du serveur**

- **UFW** — pare-feu, ports 22, 80 et 443 uniquement
- **fail2ban** — blocage des tentatives de connexion répétées
- **Connexion SSH par clé uniquement** — authentification par mot de passe désactivée
- **unattended-upgrades** — application automatique des correctifs de sécurité

**Nom de domaine**

- Domaine Hostinger existant, DNS pointé vers l'adresse IP du VPS

> **Ce que l'auto-hébergement fait perdre** : le CDN mondial, les déploiements de
> prévisualisation par branche, et surtout le fait que l'exploitation du serveur
> — mises à jour, disponibilité, sauvegardes, restauration après incident —
> devient entièrement votre responsabilité.
>
> **Ce qu'il fait gagner** : contrôle total, coût fixe et prévisible, aucune dépendance
> à un fournisseur, et maîtrise complète de l'emplacement des données personnelles.

---

## 12. Récapitulatif — pile principale

```
Next.js 16 + TypeScript  (mode standalone)
        ↓
Tailwind v4 + shadcn/ui + Motion
        ↓
Better Auth  (authentification, rôles & permissions — auto-hébergé)
        ↓
Prisma ORM → PostgreSQL infogéré chez Neon  (externe au VPS)
        ↓
Cloudflare R2  (CV, bucket privé, URL présignées, API S3)
        ↓
Docker + Coolify sur VPS Hostinger Ubuntu 24.04
        ↓
GitHub Actions (tests)  ·  Sentry (erreurs)  ·  Uptime Kuma (disponibilité)
```

---
