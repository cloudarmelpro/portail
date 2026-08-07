@AGENTS.md

# Portail — guide projet

Application web **interne** pour un client au Québec exploitant trois entreprises :
Paysagement, Développement web, Staff augmentation. Quatre modules — CRM, banque de CV, suivi
des heures, calculateur d'estimations — trois rôles, cloisonnement par entreprise.

Trois utilisateurs. Ce n'est pas un produit grand public : la valeur tient autant à
l'ergonomie qu'aux fonctions, parce qu'un outil interne mal conçu est abandonné au profit
d'Excel en quelques semaines.

## Documents qui font autorité

Dans `docs/` :

- `docs/cahier-des-charges.MD` — le quoi, avec des exigences numérotées et traçables
- `docs/architecture.MD` — structure du code, règles de sécurité, **système de design en
  section 19**
- `docs/technologies.MD` — la pile et la raison de chaque choix

**Si tu es tenté de t'en écarter, arrête-toi et demande.** Ils sont le fruit d'un long cadrage ;
une suggestion prise dans l'instant n'a pas le même poids.

## Pile

Next.js 16.3 (App Router, Turbopack, React Compiler) · React 19.2 · TypeScript strict ·
Tailwind v4 · shadcn/ui préréglage `base-nova` · `@base-ui/react` · `lucide-react` ·
Better Auth · Prisma → PostgreSQL (Neon) · Amazon S3 `ca-central-1`.

**Gestionnaire de paquets : `npm`.** Pas de pnpm, pas de yarn — un seul fichier de
verrouillage, `package-lock.json`.

Déploiement : VPS Hostinger + Coolify, `output: "standalone"`.

## Commandes

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run lint` — ESLint
- Design system : `python .claude/skills/ui-ux-pro-max/scripts/search.py "<requête>" --stack nextjs`

## Le principe directeur

> Une règle qui dépend de la mémoire du développeur n'est pas une architecture.

Les garanties de sécurité ne sont pas des conventions : ce sont des contraintes que la
structure du code rend **impossibles à contourner**. Là où c'est impossible, un test le vérifie.

## Les trois invariants

**1. Aucun Server Action écrit à la main.** Tout passe par `createAction` de
`lib/safe-action.ts`, qui impose permission, validation Zod et journal d'audit.

> Un Server Action ne traverse pas les layouts. Il est exposé comme un point d'entrée HTTP
> autonome : quiconque connaît son identifiant peut l'appeler sans jamais charger la page. Un
> layout qui vérifie le rôle ne protège que l'affichage, jamais la mutation.

**2. Aucun appel Prisma hors de `lib/data/`**, marqué `server-only`. Le CRM et le calculateur
n'y reçoivent que le **client cadré par entreprise**, dont l'extension Prisma injecte la
condition automatiquement.

> Charger un client par son seul `id` est le bug de cloisonnement typique : l'identifiant est
> unique, la requête aboutit, et un client de Paysagement s'affiche dans le dossier
> Développement web.

**3. `lib/permissions.ts` est la source unique.** Elle alimente les gardes, la fabrique, le menu
et les tests. Aucun rôle codé en dur ailleurs.

## Conventions

- App Router dans `src/app/`, alias `@/*` → `src/*`.
- Deux groupes de routes : `(auth)` — la racine `/` **est** l'écran de connexion, il n'y a pas
  de page de présentation — et `(app)`.
- `lib/actions/` et `lib/validations/` **hors de `app/`**.
- Le middleware s'appelle **`proxy.ts`**, jamais `middleware.ts`.
- Server Components par défaut ; `"use client"` seulement si état, effet ou événement, et le
  plus bas possible dans l'arbre.
- `params` et `searchParams` sont des Promises : les `await`.
- Aucun barrel file — import direct du fichier.
- `components/ui/` vient de shadcn et n'est pas modifié à la main : une variante se crée par
  composition dans `components/shared/`.
- Un `loading.tsx` et un `error.tsx` par module.

## Design

Tout est en **section 19 d'`architecture.MD`** : jetons, échelle typographique, mesures,
icônes, chaînes de l'interface.

- Aucun hex brut dans un composant.
- Les couleurs d'entreprise ne sont **jamais** des surfaces : filet de 3 px ou pastille de 8 px,
  toujours avec le nom écrit à côté.
- Les couleurs d'état sont réservées aux états, toujours avec une icône **et** un mot.
- **Aucune information portée par la couleur seule.**
- Un seul bouton noir par écran.
- `tabular-nums` sur toute colonne de chiffres.
- Toutes les chaînes visibles viennent de la section 19 — n'invente aucun libellé français.

## Justesse des données

Jamais de `Float` pour un montant ou une durée — `Decimal` Prisma.
Jamais de suppression réelle — `deletedAt`.
Colonne `version` sur toute entité éditable depuis deux onglets.

## Commentaires

Uniquement pour une contrainte que le code ne montre pas : piège, omission délibérée, invariant
réparti entre plusieurs fichiers. Une à trois lignes. Ni historique, ni provenance, ni
paraphrase du code, ni justification adressée au relecteur.

## Agents

- `nextjs-engineer` — implémentation
- `security-auditor` — **à lancer avant tout commit** touchant actions, data, guards,
  permissions, prisma, layouts de module ou routes api
- `prisma-architect` — schéma, migrations, extension de cloisonnement
- `design-system-guardian` — cohérence visuelle et accessibilité, après chaque écran
- `qa-e2e` — matrice de permissions, domaine de calcul, parcours Playwright

## À ne pas faire

Pas de `any`. Pas de `middleware.ts`. Pas d'emoji comme icône — `lucide-react`.
Pas de Server Action hors de la fabrique. Pas d'appel Prisma hors de `lib/data/`.
Ne pas éditer `src/generated/prisma`.
Ne pas coder une API Next.js sans lire la doc dans `node_modules/next/dist/docs/`.
