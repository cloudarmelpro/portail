# Architecture technique — Application web (CRM / Banque de CV / Suivi des heures / Calculateur)

> Conventions reprises du projet **Paysagiste Acadien**, adaptées à une application
> authentifiée et cloisonnée par rôle.
>
> Pile technique : voir `technologies.MD`. Cahier des charges d'origine : `CCharge.MD`.
>
> **Le système de design est en section 19**, fusionné depuis l'ancien `design.MD`.
> Le prototype Claude Design en est la mise en œuvre visuelle de référence — mais il
> montre le résultat, pas le raisonnement : les valeurs et leurs justifications sont ici.

---

## 1. Principe directeur

Une règle qui dépend de la mémoire du développeur n'est pas une architecture.

Tout ce qui suit découle de ce principe : les garanties de sécurité et de cloisonnement
ne sont pas des conventions à respecter, ce sont des contraintes que la structure du code
rend **impossibles à contourner**. Là où une règle ne peut pas être rendue structurelle,
elle est vérifiée par un test qui fait échouer l'intégration continue.

---

## 2. Ce qui change par rapport au projet de référence

**Repris à l'identique**

- Arborescence `src/` : `app` · `components` · `config` · `lib` · `hooks`
- `lib/actions/` et `lib/validations/` placés **hors de `app/`** — un composant de
  `components/` qui importerait depuis `app/` inverserait les couches
- `proxy.ts` et non `middleware.ts`
- Aucun barrel file — importer directement le fichier
- Client Prisma généré dans `src/generated/prisma`, configuré par `prisma.config.ts`
- `output: "standalone"` pour l'auto-hébergement
- En-têtes de sécurité et CSP déclarés dans `next.config.ts`
- Server Components par défaut, `"use client"` seulement si état, effet ou événement
- `lib/rate-limit.ts` — présent dans le projet de référence, indispensable ici aussi

**Abandonné**

- **L'internationalisation.** Le projet de référence est bilingue parce qu'il s'adresse à
  un public. Ici, trois utilisateurs francophones sur un outil interne. Le segment `[lang]`,
  les dictionnaires et la contrainte « aucune chaîne en dur » disparaissent.
- **Google Tag Manager dans la CSP.** Plus aucun script tiers : `script-src 'self'`
  devient strict, ce qui renforce la protection contre l'injection.
- **Les redirections d'anciennes URL et le SEO.** L'application est derrière un login et
  ne doit jamais être indexée : `X-Robots-Tag: noindex, nofollow` sur toutes les routes.

> **Le nom de domaine n'est pas un secret.** Le client prévoit un domaine distinct connu
> des seules personnes concernées. C'est une bonne décision d'isolation, mais elle
> n'apporte **aucune sécurité** : dès l'émission du certificat SSL, le domaine est publié
> dans les registres de transparence des certificats, que des robots scrutent en continu.
> Le site sera visité par des scanners automatisés dans les heures suivant sa mise en ligne.
>
> Ce qui protège réellement l'application : l'authentification, la limitation de débit sur
> la connexion, des sessions courtes, et le `noindex` pour rester hors des moteurs de
> recherche. Jamais la confidentialité de l'adresse.

**Ajouté**

- Une **fabrique d'actions** qui rend l'oubli d'un contrôle d'accès impossible (section 5)
- Une **extension de client Prisma** qui rend une fuite entre entreprises impossible (section 6)
- Une **couche d'accès aux données** isolée et marquée `server-only` (section 7)
- Un **domaine de calcul pur** pour les prix, sans base ni framework (section 9)
- Un **journal d'audit** alimenté par toutes les mutations (section 11)
- Une **matrice de permissions exécutable** en tests (section 13)

---

## 3. Arborescence

```
src/
├─ app/
│  ├─ layout.tsx                    # <html lang="fr">, polices, providers globaux
│  ├─ globals.css                   # Tailwind v4
│  ├─ error.tsx  not-found.tsx      # filets globaux
│  │
│  ├─ (auth)/                       # zone publique — aucune session requise
│  │  ├─ layout.tsx                 # mise en page centrée, sans navigation
│  │  ├─ page.tsx                   # « / » EST l'écran de connexion — pas de landing
│  │  └─ mot-de-passe-oublie/page.tsx
│  │
│  ├─ (app)/                        # zone protégée — session obligatoire
│  │  ├─ layout.tsx                 # garde de session + shell (barre latérale, en-tête)
│  │  ├─ page.tsx                   # redirige vers le module du rôle
│  │  │
│  │  ├─ crm/
│  │  │  ├─ layout.tsx              # garde de rôle : admin
│  │  │  ├─ loading.tsx  error.tsx  # squelette et repli, par module
│  │  │  ├─ page.tsx                # choix de l'entreprise
│  │  │  └─ [entreprise]/
│  │  │     ├─ page.tsx             # liste des clients
│  │  │     ├─ clients/nouveau/page.tsx
│  │  │     └─ clients/[id]/page.tsx
│  │  │
│  │  ├─ cv/
│  │  │  ├─ layout.tsx              # garde de rôle : admin, recruteuse
│  │  │  ├─ loading.tsx  error.tsx
│  │  │  ├─ page.tsx                # vue « dossiers » — catégories + recherche
│  │  │  └─ [categorie]/page.tsx    # contenu d'une catégorie
│  │  │
│  │  ├─ heures/
│  │  │  ├─ layout.tsx              # garde de rôle : admin, gérante
│  │  │  ├─ loading.tsx  error.tsx
│  │  │  ├─ page.tsx                # liste des employés
│  │  │  └─ employes/[id]/page.tsx  # fiche et saisie
│  │  │
│  │  ├─ calculateur/
│  │  │  ├─ layout.tsx              # garde de rôle : admin
│  │  │  ├─ loading.tsx  error.tsx
│  │  │  ├─ page.tsx                # choix de l'entreprise
│  │  │  └─ [entreprise]/page.tsx
│  │  │
│  │  └─ admin/
│  │     ├─ layout.tsx              # garde de rôle : admin
│  │     ├─ utilisateurs/page.tsx   # création et gestion des comptes
│  │     ├─ tarifs/[entreprise]/page.tsx   # grilles de prix versionnées
│  │     └─ journal/page.tsx        # journal d'audit
│  │
│  └─ api/
│     ├─ auth/[...all]/route.ts     # Better Auth
│     └─ cv/[id]/telecharger/route.ts   # génère une URL présignée R2
│
├─ proxy.ts                         # redirection des non-authentifiés (confort, pas sécurité)
│
├─ config/
│  ├─ site.ts                       # constantes de l'application
│  ├─ entreprises.ts                # les 3 entreprises : slug, nom, couleur
│  └─ navigation.ts                 # entrées de menu, dérivées de permissions.ts
│
├─ components/
│  ├─ ui/                           # shadcn — non modifié manuellement
│  ├─ layout/                       # barre latérale, en-tête, fil d'Ariane, sélecteur d'entreprise
│  ├─ crm/  cv/  heures/  calculateur/  admin/    # composants propres à un module
│  └─ shared/                       # tableau de données, état vide, squelettes, confirmations
│
├─ lib/
│  ├─ env.ts                        # validation Zod des variables d'environnement au démarrage
│  ├─ auth.ts                       # configuration Better Auth (serveur)
│  ├─ auth-client.ts                # client Better Auth (navigateur)
│  ├─ permissions.ts                # matrice rôle → modules → actions — source unique
│  ├─ guards.ts                     # requireSession · requireRole · requireEntreprise
│  ├─ safe-action.ts                # fabrique d'actions — voir section 5
│  ├─ rate-limit.ts                 # limitation de débit (connexion, URL présignées)
│  ├─ prisma.ts                     # instance unique + extension de cloisonnement
│  ├─ storage.ts                    # téléversement et URL présignées (API S3)
│  ├─ audit.ts                      # écriture du journal d'audit
│  ├─ email.ts                      # envoi via Resend
│  ├─ logger.ts                     # Pino + identifiant de corrélation
│  ├─ utils.ts
│  │
│  ├─ data/                         # couche d'accès aux données — "server-only"
│  │  └─ crm.ts  cv.ts  heures.ts  tarifs.ts  utilisateurs.ts
│  │
│  ├─ domain/
│  │  └─ pricing/                   # calcul pur — ni base, ni framework
│  │     ├─ calcul.ts                # moteur unique : lignes, ajustements, taxes
│  │     └─ types.ts
│  │
│  ├─ actions/                      # Server Actions — toutes issues de safe-action.ts
│  │  └─ crm.ts  cv.ts  heures.ts  calculateur.ts  tarifs.ts  utilisateurs.ts
│  │
│  └─ validations/                  # schémas Zod, partagés client et serveur
│     └─ crm.ts  cv.ts  heures.ts  calculateur.ts  tarifs.ts
│
├─ generated/prisma/                # client Prisma généré — jamais édité à la main
└─ hooks/

prisma/
├─ schema/                          # schéma découpé par domaine
│  ├─ base.prisma                   # generator + datasource
│  ├─ auth.prisma                   # tables Better Auth
│  ├─ crm.prisma  cv.prisma  heures.prisma  calculateur.prisma  audit.prisma
└─ migrations/

tests/
├─ permissions.spec.ts              # matrice rôle × action — voir section 13
├─ pricing/                         # tests unitaires du domaine de calcul
└─ e2e/                             # Playwright

docs/
└─ adr/                             # décisions d'architecture, une par fichier
```

---

## 4. Les deux groupes de routes

Le découpage `(auth)` et `(app)` est le pivot de l'architecture. Ce sont des **groupes de
routes** : les parenthèses n'apparaissent pas dans l'URL, elles servent uniquement à
donner deux mises en page et deux régimes de sécurité distincts.

`(auth)` ne requiert aucune session : connexion, mot de passe oublié. Mise en page centrée,
sans navigation.

> **Décision du client : il n'y a pas de page de présentation.** La racine `/` **est**
> l'écran de connexion. Un visiteur non authentifié n'a rien à lire, seulement un
> formulaire. Un utilisateur déjà connecté qui atteint `/` est renvoyé directement vers
> le module de son rôle.
>
> Conséquence : cet écran est vu chaque jour par les trois utilisateurs et constitue
> **toute** la façade du produit. Il porte à lui seul la direction visuelle — fond très
> clair, typographie noire large, un seul bouton, aucune photographie.

`(app)` requiert une session valide, vérifiée dans son `layout.tsx`. Il porte le shell de
l'application — barre latérale, en-tête, sélecteur d'entreprise. Chaque module y ajoute son
propre `layout.tsx` qui restreint l'accès à son rôle.

---

## 5. Autorisation — la fabrique d'actions

L'application repose sur trois barrières successives. **Aucune ne remplace les autres.**

**Première barrière — `proxy.ts`.** Redirige un visiteur sans session vers `/connexion`.
C'est du confort d'utilisation, **pas une mesure de sécurité** : le proxy ne consulte pas
la base et ne connaît pas les rôles. Il ne doit jamais être le seul contrôle.

**Deuxième barrière — les layouts.** Le layout de `(app)` vérifie la session, celui de
chaque module vérifie le rôle. C'est ce qui empêche l'affichage d'une page interdite.

**Troisième barrière — la mutation elle-même.** C'est la seule qui compte vraiment.

> **Un Server Action ne traverse pas les layouts.** Il est exposé comme un point d'entrée
> HTTP autonome : quiconque connaît son identifiant peut l'appeler directement, sans jamais
> charger la page correspondante. Un layout qui vérifie le rôle ne protège **que
> l'affichage**, jamais la mutation.

### Pourquoi une fabrique plutôt qu'une règle

La règle « chaque Server Action commence par `requireRole()` » est juste, et c'est
exactement le genre de règle qu'on respecte trois semaines puis qu'on oublie un vendredi
soir. Le passage au niveau professionnel consiste à rendre l'oubli **impossible**, pas
interdit.

`lib/safe-action.ts` expose un `createAction()` qui prend trois choses : la permission
requise, le schéma Zod d'entrée, et le traitement. Le traitement ne reçoit jamais de données
non validées et ne s'exécute jamais sans session vérifiée — il est **inatteignable
autrement**. La fabrique se charge en plus, de façon uniforme, de l'écriture au journal
d'audit, de la journalisation de l'erreur en cas d'échec, et du format de retour.

`lib/actions/` n'exporte **que** des actions issues de cette fabrique.

> **Test de garde** : un test parcourt `lib/actions/` et échoue si une fonction exportée
> ne passe pas par `createAction`. La règle n'est plus une convention — c'est le CI qui
> la fait respecter.

La bibliothèque `next-safe-action` fournit ce motif, ou une implémentation maison d'une
trentaine de lignes suffit.

### La source unique des permissions

`lib/permissions.ts` porte la matrice rôle → module → action. Elle alimente **à la fois**
les gardes serveur, la fabrique d'actions, le filtrage du menu dans `config/navigation.ts`,
et les tests de la section 13. Un rôle modifié à un seul endroit se propage partout —
et toute incohérence fait tomber les tests.

---

## 6. Cloisonnement des entreprises

Le cahier des charges est explicite : aucun mélange entre Paysagement, Développement web
et Staff augmentation. Cela concerne le CRM et le calculateur.

L'entreprise est un **segment d'URL** — `/crm/paysagement/clients/42`. C'est lisible, mais
un segment d'URL est saisi par l'utilisateur : il n'a aucune valeur de preuve. Il est
**toujours** revalidé côté serveur contre `config/entreprises.ts`.

### Le cloisonnement est structurel, pas répété

Écrire « la condition d'entreprise figure dans le `where` de toutes les requêtes » revient
à l'écrire cinquante fois sans jamais se tromper. Ça finira par arriver.

`lib/prisma.ts` expose donc, en plus du client global, un **client cadré par entreprise**
construit avec une extension Prisma qui injecte automatiquement la condition sur les modèles
concernés. Les fonctions de `lib/data/` destinées au CRM et au calculateur ne reçoivent
que ce client cadré : elles ne peuvent physiquement pas sortir du périmètre, même si la
clause est oubliée.

> Charger un client par son seul `id` est le bug de cloisonnement typique : l'identifiant
> est unique, la requête aboutit, et un client de Paysagement s'affiche dans le dossier
> Développement web. Avec le client cadré, cette requête ne retourne rien — le défaut
> devient visible immédiatement au lieu de fuir silencieusement.

---

## 7. Couche d'accès aux données

Aucun appel Prisma n'est écrit directement dans une page, un composant ou un Server Action.
Tout passe par `lib/data/`, dont chaque fichier est marqué `server-only`.

Chaque fonction y reçoit la session — ou le client déjà cadré — et applique le filtrage
qui la concerne. L'intérêt est simple : quand on se demande « qui peut lire quoi »,
il y a **un seul dossier à auditer**, et il tient en quelques fichiers.

Les requêtes ramènent les relations en une fois plutôt qu'en cascade : la base est distante,
chaque aller-retour vers Neon coûte.

---

## 8. Banque de CV

### Le modèle demandé par le client

_« C'est comme un Google Drive : on pourra déposer des CV dedans ou les retirer,
sûrement avec des catégories. »_

C'est un modèle de **gestionnaire de fichiers**, pas de suivi de candidatures. Il n'y a
donc ni pipeline de recrutement, ni statut de candidat, ni notes d'entrevue. Déposer,
classer, retrouver, retirer.

**Catégories : dossiers à l'écran, étiquettes en base.** L'utilisateur voit et manipule
des dossiers — c'est son modèle mental, il faut le respecter. Le stockage se fait en
étiquettes, ce qui permet à un même CV d'apparaître dans plusieurs catégories sans être
dupliqué. Un vrai dossier ne le permettrait pas.

Les métadonnées restent minimales, dans l'esprit du Drive : nom, catégories, date de
dépôt, taille. Pas de fiche candidat. C'est la présence des catégories qui empêche l'outil
de devenir inutilisable en grandissant — un Drive sans classement tient jusqu'à une
cinquantaine de fichiers et s'effondre ensuite.

### Contexte d'usage — précisé par le client

_« Juste pour agence de Madagascar pour le moment, pas besoin de faire autre catégorie.
Juste des CV par poste comme développeur, monteur vidéo, gérant, gestionnaire de résultat. »_

Le module sert au **recrutement offshore de l'activité staff augmentation**. Les candidats
sont malgaches, les postes appartiennent au numérique et au service à la clientèle.

Les six catégories retenues : Développeur, Monteur vidéo, Gérant, Gestionnaire de résultat,
Designer, Support client. Modifiables par l'administrateur, mais aucune autre famille de
classement.

> Cela explique rétroactivement la tarification « poste-mois » de cette entreprise, et
> confirme que la banque de CV ne doit pas être déclinée par entreprise.

### Ancienneté — et non conservation

**Un curriculum vitæ n'est JAMAIS supprimé automatiquement.** Le client a écarté toute limite
de durée pour eux — voir CV-10. Les vingt-quatre mois ne sont pas une échéance : ce sont un
repère d'ancienneté. Une catégorie système **« Plus de 24 mois »**, visible de
l'administrateur seulement, regroupe les CV les plus anciens pour qu'il puisse décider,
lui-même et au cas par cas, ce qu'il en fait.

> Cette section disait l'inverse, et les libellés d'interface le répétaient : « Échéance »,
> « Conservation jusqu'au », « n'approche de son échéance de conservation ». Ils promettaient
> une suppression qui n'a jamais lieu — un écran qui ment sur ce que le système fait est pire
> qu'un écran muet.
>
> **Ne pas confondre avec TR-6**, qui porte sur d'autres données et dans l'autre sens :
> 3 ans pour les registres d'heures et 6 ans pour le registre de paie sont des durées
> **minimales**, une interdiction d'effacer avant terme. Voir la section 10. Aucune des deux
> règles n'autorise une purge : l'une l'exclut, l'autre l'interdit.

### Accès aux fichiers

Aucun fichier n'est jamais servi par l'application ni exposé par une URL directe.

Le téléchargement suit ce parcours : le navigateur appelle `/api/cv/[id]/telecharger`,
la route vérifie la session et le rôle, applique la limitation de débit, confirme que le CV
existe, écrit une entrée au journal d'audit, génère une URL présignée valable quelques
minutes, puis redirige le navigateur vers cette URL.

Le téléversement suit le chemin inverse : validation du type et de la taille par Zod,
génération d'une URL présignée d'écriture, envoi direct du navigateur vers le stockage sans transiter
par le serveur, puis enregistrement des métadonnées en base.

> Le contenu du fichier ne traverse jamais le VPS. Cela évite de saturer la mémoire du
> conteneur sur un CV volumineux et supprime tout risque de fichier résiduel sur le serveur.

---

## 9. Calculateur d'estimations

> **Le client a redéfini ce module.** Ses mots : _« Produit, prix par unité, nombre
> d'unités, total, taxe »_ · _« pour faire les estimations en discutant avec le client »_.
>
> Ce n'est pas un moteur de soumission. La facturation et les contrats se font dans
> QuickBooks, hors de cette application. L'interface dit **estimation**, jamais « devis ».

### Le flux est inversé

_« Je fais l'estimation et à la fin du call je peux sauver les informations sur le dossier
du client. »_

Pendant un appel de qualification, **le client n'existe souvent pas encore dans le CRM**.
Le rattachement est donc une action de **fin**, pas une condition de départ.

Conséquence sur le modèle : une estimation peut exister **sans client**. La relation vers
le client est facultative, et le rattachement se fait après coup — éventuellement en créant
le client au même moment, avec deux champs seulement.

Le statut du client n'est **jamais** modifié automatiquement. Une case à cocher, pré-cochée
uniquement si le client est encore au statut _Prospect_, propose de le marquer comme
contacté.

> Au moment de l'enregistrement, deux choses sont vraies : Cédric a contacté le client — il
> vient de lui parler — et il n'a rien envoyé. Passer à « Soumission envoyée » serait faux.
> Et un statut qui bouge sans qu'on l'ait demandé érode la confiance dans l'outil.

### Un domaine pur

`lib/domain/pricing/` contient des fonctions **pures** : elles reçoivent une grille de
tarifs et des lignes, elles retournent un total. Ni base de données, ni Prisma, ni
composant, ni Next.js.

Le calcul est le même pour les trois entreprises — quantité × prix unitaire, ajustements,
TPS, TVQ. Ce qui change d'une entreprise à l'autre, ce sont les **produits et leurs unités**,
pas la mécanique. Un seul moteur, trois grilles.

> **Le modèle par taux de production a été écarté.** Les logiciels du secteur — LMN en tête —
> estiment en heures d'équipe par tâche plutôt qu'en prix à l'unité, ce qui rattache le devis
> à la capacité réelle de travail. C'est plus juste, mais le client veut une calculette
> rapide de qualification, pas un moteur d'estimation. Le lui imposer aurait ralenti
> exactement ce qu'il cherche à accélérer.

Bénéfice direct : ces fonctions se testent en isolation, exhaustivement et instantanément,
sans base ni navigateur. C'est là que doit se concentrer l'effort de test unitaire.

### Des grilles immuables et versionnées

Les grilles sont modifiables par l'admin depuis `/admin/tarifs/[entreprise]`. Mais **une
grille n'est jamais modifiée en place** : chaque enregistrement crée une **nouvelle
version**, et une estimation référence la version utilisée.

> Une estimation calculée est figée. Modifier les tarifs ne doit jamais changer
> rétroactivement une estimation déjà envoyée. Le versionnement permet en plus d'expliquer à
> un client, deux ans plus tard, exactement sur quelle base son prix a été établi.

Les numéros d'estimation sont séquentiels et immuables. Chaque estimation conserve **ses
lignes**, ce qui rend la duplication réelle — la révision d'une estimation est le cas le plus
fréquent, et l'original reste intact.

### QuickBooks — export, pas intégration

Le client facture dans QuickBooks et demande si les deux outils peuvent être reliés.

**Export CSV à la nomenclature Intuit** : `Customer`, `Estimate No`, `Estimate Date`,
`Expiration Date`, `Product/Service`, `Description`, `Qty`, `Rate`, `Amount`, `Taxable`.
Une ligne par ligne de service.

> **Pas d'intégration API pour l'instant.** L'API QuickBooks Online existe, et une
> implémentation correcte — OAuth 2.0, jetons conservés côté serveur, portée limitée à la
> création de documents — ne présente pas de faille. Ce n'est pas le risque.
>
> Le coût est ailleurs : compte développeur Intuit, application à faire approuver, jetons à
> renouveler, intégration à maintenir. Pour trois utilisateurs et des estimations de
> qualification, c'est disproportionné.
>
> **Portail reste la source de vérité des prix d'estimation.** Le risque de divergence avec
> les articles QuickBooks est réel et assumé. Demander au client que les noms d'articles
> soient identiques des deux côtés rendra un import futur trivial.

### L'en-tête du document — EST-10

Raison sociale, adresse, téléphone et logo sont **par entreprise** et se saisissent dans
`/admin/organisation`. Ils vivent en base, comme les grilles de tarifs : le client les corrige
seul, sans déploiement.

Le logo suit exactement le chemin d'un dépôt de CV — lien signé, écriture directe du navigateur
vers le stockage, puis confirmation côté serveur. Ce n'était pas le chemin le plus court : deux
mégaoctets passeraient sans peine par un Server Action. Mais c'eût été un **second** chemin de
téléversement, avec sa propre vérification de type, sa propre limite, et son propre oubli à
venir. Un seul motif, vérifié une fois.

Trois conséquences qui ne se négocient pas :

- **Le type est établi sur les octets, pas sur la déclaration.** Le navigateur a écrit seul dans
  le seau ; ce qu'il a annoncé n'engage personne. Le serveur relit les douze premiers octets.
  Douze et non huit : le WebP porte sa seconde moitié de signature en positions 8 à 11, et
  « RIFF » seul désigne aussi bien un WAV qu'un AVI.
- **Le SVG est refusé.** C'est un document XML : il porte du script et des références externes,
  et il finirait rendu dans une page de l'application. Un logo n'a pas à être exécutable.
- **La base stocke une clé, jamais une URL.** Une adresse signée expire en cinq minutes ; une
  adresse permanente ferait servir le fichier par un lien direct, ce que TR-3 interdit pour tout
  le stockage. L'aperçu HTML reçoit une adresse signée, le PDF reçoit les octets — deux besoins
  différents, l'un rend dans un navigateur, l'autre compose sur le serveur.

Le logo **remplace** le filet de couleur de l'entreprise, il ne s'y ajoute pas : ce filet
n'existait que pour tenir la place d'un logo absent, et les deux ensemble feraient deux marques
l'une sur l'autre. Sans logo, le document n'est donc pas nu — c'est un état volontaire et
présentable, et le nom reste écrit à côté de la couleur comme l'exige la section 19.

> **Le logo ne peut pas empêcher d'émettre un devis.** `lireObjet` rend `null` plutôt que de
> lever : l'objet peut avoir disparu du seau alors que la ligne le désigne encore, et le
> document retombe alors sur la marque écrite. Il est lu dans le route handler, jamais dans le
> composant — celui-ci est rendu hors de toute requête, et une lecture réseau à l'intérieur du
> rendu ferait échouer le document entier sur un seau momentanément injoignable.

Un logo remplacé fait effacer le précédent, **après** l'écriture réussie en base. Dans l'autre
ordre, un échec de la mise à jour laisserait la ligne désignant un fichier déjà effacé. La clé
est aléatoire et neuve à chaque dépôt : réutiliser la même laisserait les navigateurs afficher
l'ancien logo depuis leur cache.

### La validation du contenu JSON

Les critères variables d'une entreprise à l'autre sont stockés dans un champ `Json`.

> **Prisma ne valide pas le contenu d'un champ `Json`.** Le type garantit que c'est du JSON
> syntaxiquement valide, rien de plus. Un schéma **Zod par entreprise**, dans
> `lib/validations/tarifs.ts`, valide à l'écriture **et à la lecture** — une grille produite
> par une version antérieure du code doit être rejetée explicitement plutôt que de produire
> un prix faux en silence.

---

## 10. Justesse des données

Trois pièges classiques, tous traités au niveau du schéma.

**L'argent n'est jamais un nombre flottant.** Un calculateur qui manipule des `Float`
produira un jour une estimation à 1 249,999999 $. Les montants sont en `Decimal` Prisma. Même
règle pour les heures travaillées : cumulées sur une année, des flottants dérivent.

**Aucune suppression réelle.** Les clients, les CV, les employés et les saisies d'heures
portent un `deletedAt`. Une gérante qui supprime une fiche par erreur un vendredi ne doit
pas déclencher une restauration de base de données. Les requêtes de `lib/data/` excluent
les enregistrements supprimés par défaut.

**Concurrence contrôlée.** Même à trois utilisateurs : la gérante ouvre la fiche d'un
employé dans deux onglets, modifie dans les deux, et la seconde sauvegarde écrase
silencieusement la première. Une colonne `version` vérifiée à l'écriture règle ça
définitivement. En cas de conflit, l'utilisateur est averti plutôt qu'ignoré.

### Conservation — TR-6

Trois ans pour le registre des heures, six ans pour le registre de paie. Ce sont des durées
**minimales**, et la nuance décide de tout le code qui en découle.

Une durée de conservation en droit du travail dit « tu ne dois pas effacer avant ». Elle ne
dit jamais « tu dois effacer après ». Lue comme une échéance de purge, elle produirait
exactement l'inverse de ce qu'elle protège : un registre détruit au premier jour de sa
quatrième année, alors qu'une réclamation le rendait encore opposable.

Il n'existe donc **aucune purge** de ces données, et c'est un choix, non un oubli.
`config/conservation.ts` porte les durées et n'expose que la question inverse —
`sousConservation(date, nature)`, « cette donnée est-elle encore retenue ? ». Elle n'a
aujourd'hui aucun appelant : elle existe pour que le jour où quelqu'un écrira une
suppression, la garde soit déjà là où il devra passer.

`tests/conservation.spec.ts` tient la garantie plutôt que la mémoire du développeur. Il
balaie tout `lib/` et refuse toute suppression sur `SaisieJour`, `PeriodePaie` ou
`CorrectionHeures` **bornée par une date haute sans borne basse** — la forme d'une purge.
Une fenêtre fermée des deux côtés reste permise : c'est celle de « copier la semaine
précédente », qui vise une semaine désignée et ne peut pas remonter aux archives. Le test
vérifie aussi que la route d'entretien périodique, seul point d'entrée destructeur du
projet, ne mentionne jamais ces modèles.

À ne pas confondre avec `CONSERVATION_MOIS` de `lib/data/cv.ts` : les vingt-quatre mois n'y
sont qu'un repère d'ancienneté affiché. Le client a écarté toute limite de durée pour les
curriculum vitæ, et rien ne les supprime (CV-10).

---

## 11. Journal d'audit

`lib/audit.ts` expose une fonction unique, appelée **par la fabrique d'actions** après
chaque mutation — donc jamais oubliée — et depuis la route de téléchargement des CV.

Sont consignés : l'utilisateur, l'action, l'entité concernée, l'entreprise le cas échéant,
l'horodatage et l'adresse IP. Consultable depuis `/admin/journal`.

Ce n'est pas une fonctionnalité de confort : dès lors que l'application manipule des
renseignements personnels, être capable de dire qui a consulté quoi et quand est une
exigence de la loi 25.

`lib/logger.ts` complète le dispositif côté technique : journalisation structurée Pino avec
un identifiant de corrélation propagé sur toute la requête, et repris dans Sentry.

---

## 12. États d'interface et ressenti

Ce qui sépare un outil interne agréable d'un outil qu'on subit tient à quelques détails,
tous structurels plutôt que cosmétiques.

**Un `loading.tsx` et un `error.tsx` par module.** Sans `loading.tsx`, l'utilisateur voit
un écran figé pendant que la requête part vers Neon. Avec, il voit un squelette qui se
remplit. C'est trente minutes de travail par module pour un gain de perception considérable.

**L'expiration de session traitée comme une fonctionnalité.** Le cahier des charges exige
une déconnexion automatique après inactivité. Mal faite, c'est une redirection brutale qui
efface un formulaire à moitié rempli — et c'est le premier motif de rejet d'un outil interne.
Bien faite, c'est un avertissement avant échéance, avec possibilité de prolonger.

**Sauvegarde automatique des brouillons.** Sur les formulaires longs — fiche client,
calculateur — enregistrement local du travail en cours. Perdre vingt minutes de saisie une
seule fois suffit à ce que l'utilisateur retourne à Excel.

**États vides travaillés.** Une liste vide qui affiche « Aucun résultat » est fonctionnelle.
Une qui explique quoi faire et propose l'action d'ajout est professionnelle. Il y en a une
par module, et elles se voient dès le premier jour d'utilisation.

---

## 13. Tests

Pour une application dont le cœur est le contrôle d'accès, le test à haute valeur n'est pas
de vérifier qu'un formulaire s'affiche.

**La matrice de permissions exécutable.** `tests/permissions.spec.ts` est généré à partir
de `lib/permissions.ts` : pour chaque rôle, pour chaque action, il affirme le résultat
attendu — autorisé ou refusé. Trois rôles multipliés par une trentaine d'actions donnent
une centaine d'assertions automatiques.

> Le jour où quelqu'un ajoute une action sans permission, ou élargit un rôle par mégarde,
> ce test tombe. C'est le seul filet qui protège réellement l'exigence centrale du cahier
> des charges.

**Le domaine de calcul.** Tests unitaires exhaustifs sur `lib/domain/pricing/` : fonctions
pures, exécution instantanée, aucune infrastructure requise.

**Le test de garde des actions.** Vérifie qu'aucun Server Action n'échappe à la fabrique.

**Playwright** couvre les parcours de bout en bout : connexion, expiration de session, et
tentative d'accès à un module interdit pour chaque rôle.

---

## 14. Conventions de code

**Rendu**

- Server Components par défaut. `"use client"` uniquement pour l'état, les effets et les
  événements — et le plus bas possible dans l'arbre.
- `params` et `searchParams` sont des Promises : les `await`. Utiliser les types globaux
  `PageProps<'/(app)/crm/[entreprise]'>` et `LayoutProps<...>`.
- Après mutation, `revalidatePath` sur la route concernée. Pas de rechargement manuel.

**Organisation**

- Alias `@/*` vers `src/*`.
- Aucun barrel file : un `index.ts` de ré-export force le compilateur à analyser tout le
  dossier pour un seul import.
- Les composants de `components/ui/` viennent de shadcn et ne sont pas modifiés à la main.
  Une variante se crée par composition dans `components/shared/`.
- Un composant utilisé par un seul module vit dans `components/<module>/`. Il ne remonte
  dans `shared/` qu'à partir du deuxième usage réel.

**Données et validation**

- Un schéma Zod par entité dans `lib/validations/`, importé par le formulaire **et** par
  la fabrique d'actions. Une seule source de vérité pour les règles de saisie.
- Aucun appel Prisma hors de `lib/data/`.
- `lib/env.ts` valide toutes les variables d'environnement par Zod au démarrage.
  L'application refuse de démarrer si l'une manque ou est mal formée, plutôt que d'échouer
  de façon cryptique trois jours plus tard en pleine utilisation.

**Nommage**

- Routes et segments d'URL en français, sans accent : `connexion`, `heures`,
  `mot-de-passe-oublie`.
- Fichiers en kebab-case, composants en PascalCase.

**Commentaires**

- Uniquement pour une contrainte que le code ne montre pas : piège, omission délibérée,
  invariant réparti entre plusieurs fichiers. Une à trois lignes.
- Ni historique, ni provenance, ni paraphrase du code, ni justification adressée au relecteur.

**À ne pas faire**

- Pas de `any`.
- Pas de `middleware.ts` — le fichier s'appelle `proxy.ts`.
- Pas d'emoji comme icône : `lucide-react`.
- Pas de Server Action écrit à la main hors de la fabrique.
- Pas d'appel Prisma hors de `lib/data/`.
- Pas de `Float` pour un montant ou une durée.
- Ne pas éditer `src/generated/prisma`.

---

## 15. Variables d'environnement

```
DATABASE_URL              # Neon — chaîne avec pool, utilisée par l'application
DIRECT_URL                # Neon — chaîne directe, exigée par Prisma Migrate

BETTER_AUTH_SECRET
BETTER_AUTH_URL

S3_ENDPOINT               # R2 en production, MinIO en développement local
S3_REGION                 # « auto » pour R2
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_BUCKET_CV

RESEND_API_KEY
SENTRY_DSN

NEXT_PUBLIC_APP_URL

PROXYS_DE_CONFIANCE       # CIDR des reverse proxys — obligatoire en production
EN_TETES_IP               # en-têtes lus pour l'adresse d'origine — défaut « x-forwarded-for »
```

Toutes sont validées par `lib/env.ts` au démarrage. Un `.env.example` à jour est versionné.
Les valeurs réelles vivent dans Coolify, jamais dans le dépôt.

**`PROXYS_DE_CONFIANCE`** mérite un mot, parce que son absence ne se voit pas.

`X-Forwarded-For` est une liste, et sa partie **gauche est écrite par le client** : un reverse
proxy ajoute à droite, il n'efface pas ce qui précède. Prendre la première entrée revient donc
à laisser la personne auditée choisir l'adresse que le journal inscrira — une colonne pire que
vide, puisqu'elle affirme quelque chose. La valeur digne de foi est la première en partant de la
**droite** qui ne soit pas un proxy connu, ce qui suppose de savoir lesquels sont devant.

Better Auth applique déjà cette règle, à condition qu'on lui donne la liste. Sans elle, il
refuse de trancher dès que l'en-tête porte plus d'une entrée et son limiteur retombe sur **un
seul seau par chemin** : le plafond de cinq tentatives de TR-2 cesse d'être compté par personne
et devient celui de toute l'application — cinq essais manqués mettent les trois utilisateurs
dehors pour cinq minutes, et un tiers non authentifié peut le déclencher en envoyant son propre
`X-Forwarded-For`. La variable est donc **exigée en production** et facultative en
développement, où les plages privées sont prises par défaut.

`lib/audit.ts` résout l'adresse avec **la même fonction et le même réglage** que Better Auth
(`configurationIp` de `lib/env.ts`). Deux résolutions divergeraient, et c'est le journal qui
aurait tort.

Valeur pour Coolify + Traefik — plages privées de Docker et boucle locale :

```
PROXYS_DE_CONFIANCE=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32,::1/128
```

Le jour où Cloudflare passe devant, la réponse propre est `EN_TETES_IP=cf-connecting-ip`,
et non l'inscription de toutes les plages de Cloudflare parmi les proxys de confiance.
Déclarer cet en-tête sans le proxy qui le pose reviendrait à laisser n'importe qui l'écrire.

---

## 16. Intégration continue et exploitation

**Portes de CI** — rien ne se déploie sans que ces quatre étapes passent : vérification
TypeScript, ESLint, suite de tests, et détection de dérive du schéma Prisma. Les migrations
sont appliquées par `prisma migrate deploy` avant le démarrage de l'application.

**Restauration testée.** Une sauvegarde jamais restaurée n'est pas une sauvegarde. La
restauration est exécutée une fois avant la mise en production, chronométrée, et la
procédure est écrite.

**Décisions d'architecture.** `docs/adr/` — un fichier par décision structurante, avec le
contexte, l'arbitrage et ses conséquences. Le journal de `technologies.MD` en est le point
de départ. C'est ce qui permet à quelqu'un — ou à vous dans dix-huit mois — de comprendre
un choix sans avoir à le redécouvrir.

---

## 17. Ce qui est délibérément écarté

Savoir ce qu'on n'ajoute pas fait partie du niveau professionnel.

**Row Level Security PostgreSQL.** Ce serait la garantie de cloisonnement la plus forte,
mais elle s'articule mal avec Prisma et une connexion applicative unique. L'extension de
client de la section 6 apporte l'essentiel du bénéfice pour une fraction de la complexité.

**Architecture hexagonale généralisée.** Trois des quatre modules sont du CRUD honnête.
Y plaquer des ports, des adaptateurs et des entités de domaine triplerait le nombre de
fichiers sans rien protéger. La seule exception est le calcul de prix, traité en section 9.

**Microservices, monorepo, tRPC.** Les Server Actions typées couvrent le besoin. Ajouter
une couche RPC serait de la complexité importée d'un problème que ce projet n'a pas.

**Mise à l'échelle, cache distribué, orchestration.** Trois utilisateurs.

**Temps réel.** Les trois utilisateurs travaillent chacun dans un module distinct et
n'éditent jamais les mêmes données simultanément. Voir `technologies.MD`, section 4.

---

## 18. Ordre de construction

L'ordre suit les dépendances techniques, et fait en sorte que le module le moins spécifié
arrive en dernier.

**Socle** — projet, `lib/env.ts`, Prisma et Neon, Better Auth, `permissions.ts`, `guards.ts`,
`safe-action.ts`, extension de cloisonnement, shell applicatif, gestion des comptes, journal
d'audit. Rien n'est livrable sans cette étape, et tout en dépend. C'est ici que se joue la
qualité de l'ensemble : les sections 5, 6 et 7 doivent être en place **avant** le premier
module, sinon elles ne le seront jamais.

**Suivi des heures** — le module le plus simple. Il valide le socle de bout en bout et
donne un premier résultat visible rapidement.

**Banque de CV** — simple fonctionnellement, mais introduit le stockage objet, les URL présignées et la
limitation de débit.

**CRM** — le plus gros volume d'écrans. Premier usage réel du cloisonnement par entreprise.

**Calculateur de prix** — en dernier. Il dépend des formules que le client n'a pas encore
fournies, et il réutilise le cloisonnement mis en place par le CRM.

---

## 19. Système de design

> Cette section reprend l'intégralité de ce que contenait `design.MD`, supprimé après
> fusion. Elle donne les valeurs **et les raisons** : le prototype Claude Design montre le
> résultat, pas le raisonnement.

### Direction

Fond très clair, typographie noire large et serrée, dégradés très subtils en bordure, un
seul bouton noir, badges en pilule. Écartés : photographies de banque d'images, statistiques
de vanité, violet générique.

**La distinction qui gouverne tout** : l'écran de connexion est aéré et contemplatif — on le
regarde trois secondes. L'application est dense et rapide — on y travaille des heures, et
chaque pixel perdu est une ligne de tableau en moins.

### Jetons

```css
/* Clair */
--page: #f9f9f7;
--surface: #fcfcfb;
--raised: #ffffff;
--border: rgba(11, 11, 11, 0.1);
--border-strong: rgba(11, 11, 11, 0.18);
--ink: #0b0b0b;
--ink2: #52514e;
--ink3: #898781;
--action: #0b0b0b;
--action-ink: #ffffff;
--pays: #1baf7a;
--dev: #2a78d6;
--staff: #eb6834;
--good: #0ca30c;
--warning: #fab219;
--serious: #ec835a;
--critical: #d03b3b;
--s1: #55534d;
--s2: #938f85; /* séries — achromatiques */
--sh-menu: 0 4px 16px rgba(11, 11, 11, 0.08);
--sh-modal: 0 16px 48px rgba(11, 11, 11, 0.16);

/* Sombre */
--page: #0d0d0d;
--surface: #1a1a19;
--raised: #232322;
--border: rgba(255, 255, 255, 0.1);
--border-strong: rgba(255, 255, 255, 0.18);
--ink: #ffffff;
--ink2: #c3c2b7;
--ink3: #898781;
--action: #ffffff;
--action-ink: #0b0b0b;
--pays: #199e70;
--dev: #3987e5;
--staff: #d95926;
--s1: #b5b1a6;
--s2: #6e6a61;
```

Les deux jetons de série sont **achromatiques**, et ce n'est pas une préférence de goût :
c'est ce qui les empêche de porter la teinte d'une entreprise. La raison complète est sous
« Séparation des couleurs ».

Le **filet de bordure fait le travail des ombres**. Les cartes n'ont aucune ombre : elles se
distinguent par leur fond et leur filet. Les deux ombres déclarées sont réservées aux
éléments qui flottent réellement — modales, menus, infobulles.

Le mode sombre est **construit**, pas inversé automatiquement.

### Couleurs d'entreprise — règle stricte

Les trois teintes ont été **validées par calcul**, en clair et en sombre, sur toutes les
paires : séparation daltonienne ΔE 9,2 et 9,4 (seuil 8), séparation en vision normale ΔE
24,0 et 20,9 (plancher 15).

Ce sont des **repères d'identité, jamais des surfaces**. Filet de 3 px, ou pastille de 8 px
à côté d'un nom. Jamais en fond de bloc, jamais en couleur de texte.

> Le vert du paysagement mesure 2,74:1 sur fond clair, sous le seuil de contraste. C'est
> acceptable **uniquement** parce que la couleur n'est jamais seule : le nom de l'entreprise
> est toujours écrit à côté, en encre normale.

**Contrastes des encres, mesurés.** Ils sont inscrits ici parce qu'un jeton dont personne ne
connaît le contraste finit par porter du texte trop petit pour lui.

```
--ink   #0b0b0b   18,7:1 sur --page   ·  19,2:1 sur --surface
--ink2  #52514e    7,5:1              ·   7,7:1
--ink3  #726f6a    4,7:1              ·   4,9:1
```

`--ink3` valait `#898781`, soit 3,4:1 — sous le seuil AA de 4,5:1, alors qu'il porte le texte
de 11 et 13 px du produit : en-têtes de colonnes, libellés de rôle, dates secondaires. Le texte
le plus petit était le moins lisible. La valeur a été corrigée en août 2026 ; le mode sombre
passait déjà et n'a pas changé.

L'affectation est **stable** : une entreprise garde sa couleur partout, indépendamment de
l'ordre d'affichage ou d'un filtre.

### États

`--good`, `--warning`, `--serious`, `--critical` sont **réservés aux états** — jamais un
accent décoratif, jamais une quatrième couleur d'entreprise. Toujours accompagnés d'une
**icône et d'un mot**. Jamais la couleur seule.

**La teinte pure ne touche jamais du texte.** Mesurée sur `--raised` en thème sombre,
`--critical` tombe à 4,02:1 et `--warning` à 1,83:1 — sous le seuil AA de 4,5:1 d'un texte, et
sous les 3:1 d'un élément d'interface porteur de sens. Deux jetons dérivés existent pour cela,
`--critical-texte` et `--warning-texte`, mélangés à 55 % vers `--ink` :

```
Icône seule, sur fond de badge à 13 %   --critical · --warning · --serious · --good
Mot, message de validation, cellule     --critical-texte
Icône devant du texte courant           --warning-texte
```

Le mélange à 55 % vient de `components/shared/badge-statut.tsx`, qui avait résolu le problème
dans son coin avant que les deux jetons n'existent. Changer ce pourcentage casse les mesures.

Trois usages nommés valent d'être rappelés parce qu'ils ont tous les trois été enfreints : le
surlignage d'un terme cherché est **neutre** (`--hover2`), pas `--warning` ; l'état d'un compte
s'**écrit** — « Actif », « Suspendu » — au lieu d'être mis en pastille, décision du client ; et
un dossier « Plus de 24 mois » **informe**, il n'alerte pas.

### Typographie

**Cal Sans**, auto-hébergée par `next/font/local`. Police variable, quatre graisses,
diacritiques françaises, licence SIL Open Font.

`font-optical-sizing: auto` déclaré une fois sur la racine — l'axe de 8 à 45 pt resserre les
formes dans les tableaux denses et les ouvre dans les grands titres. C'est ce qui résout la
tension entre l'écran de connexion aéré et les grilles compactes.

```
Display   38 / 44   -0.03em   600   — titre de l'écran de connexion
H1        30 / 36   -0.02em   600   — titre de page
H2        22 / 28   -0.01em   600   — titre de section
H3        17 / 24    0        600   — titre de carte
Corps     15 / 22    0        400   — texte courant
Petit     13 / 18    0        400   — méta, aide, libellés
Micro     11 / 14    0.02em   500   — badges, en-têtes de colonne (majuscules)
```

`font-variant-numeric: tabular-nums` sur **toute colonne de chiffres**. Les grands nombres
isolés — total d'une estimation, tuile de statistique — gardent les chiffres proportionnels.

> **Ne pas prendre le paquet npm `cal-sans`** : resté en 1.0.1, l'ancienne coupe à une seule
> graisse. Récupérer le `.woff2` variable depuis le dépôt officiel.
>
> **Vérifier les chiffres tabulaires** sur une colonne réelle avant de figer le choix. À
> défaut, police de repli à chasse fixe sur les seules colonnes numériques.

### Mesures

```
Espacement   base 4 — 4, 8, 12, 16, 24, 32, 48, 64, 96
Densité      padding de carte 16px · ligne de tableau 44px · gouttière 16px
Rayons       12px boutons · 9px menus et calendriers · 6px champs de saisie
             8px entrées de menu et pastilles · 10px cartes · 16px modales · 9999px pilules
Superposition  10 en-tête collant · 20 barre latérale · 30 en-tête · 40 menus
               50 voile · 60 modale et tiroir · 70 notifications et barre de chargement
Ruptures     640 · 768 (tiroir) · 1024 · 1280 (disposition complète) · 1536
Cibles tactiles  44px sous 768px · 36px à la souris
```

Aucune valeur de `z-index` hors de cette échelle. Un `9999` quelque part signifie qu'elle a
été contournée.

**Deux ombres, et une seule chacune.** `--sh-menu` pour ce qui se pose à côté — menus,
calendriers, déclencheurs — et `--sh-modal`, trois fois plus profonde, pour ce qui recouvre :
modale et tiroir. Elles ont vécu interverties, les menus portant l'ombre de modale et la modale
n'en portant aucune : un menu de fin de ligne paraissait flotter plus haut que le dialogue
ouvert par-dessus lui. L'ombre de la modale et du tiroir est posée dans
`components/shared/contenu-dialogue.tsx` et `contenu-tiroir.tsx` — jamais dans
`components/ui/`, qui vient de shadcn.

**La croix native de `type="search"` est masquée.** Le navigateur en dessine une — bleue sur
Chromium — dès qu'un terme est saisi, et elle vide le champ **sans relancer la recherche** : on
lisait un champ vierge au-dessus d'une liste toujours filtrée. Là où le produit dessine déjà la
sienne, il y en avait deux côte à côte. La règle est portée par `CHAMP_FILTRE`, pas par chaque
écran. Le type reste `search` : il porte la sémantique et fait proposer l'historique du
navigateur.

**Deux gabarits de champ, déclarés dans `components/shared/gabarits.ts`.** `CHAMP` pour une
colonne de saisie — 6 px, `--surface`, `h-11 md:h-10`. `CHAMP_FILTRE` pour une rangée d'outils —
9 px, `--raised`, `h-11 md:h-9`, la forme des menus qu'il côtoie. `ZONE_TEXTE` pour le
multi-lignes. Six fichiers les avaient recopiés avec six formes différentes : passer d'un écran
à l'autre faisait changer le rayon, la hauteur et le corps du même contrôle.

Trois rayons pour trois familles, et la distinction se voit. **12 px** au bouton, qui est un
objet qu'on pousse. **6 px** au champ de saisie, qui est un contenant : plus rond, il aurait
l'air d'un bouton, et on cliquerait dessus en attendant qu'il se passe quelque chose. **9 px**
aux surfaces flottantes — menus, calendriers, déclencheurs de menu — qui se posent par-dessus
sans appartenir à la page.

La cible tactile de 44 px n'a de sens qu'au doigt. Un contrôle de 44 px de haut à la souris
donne des rangées trop lâches pour qu'on en lise huit d'un coup d'œil, sur un produit où l'on
passe la journée dans un tableau. Les champs s'écrivent donc `h-11 md:h-10` et les boutons
`h-9` : 44 px là où c'est nécessaire, 40 ou 36 là où ça ne l'est pas.

### Mouvement et focus

150 ms pour les micro-interactions, 200 ms `ease-out` pour panneaux et modales, 300 ms
maximum. Aucune animation d'entrée en cascade sur les listes.

Anneau de focus de 2 px en `--ink`, décalé de 2 px, sur **tous** les éléments interactifs.
Jamais supprimé.

`prefers-reduced-motion` supprime toutes les transitions non essentielles.

### L'attente

Un seul écran d'attente dans tout le produit : un trait de 3 px en `--ink`, fixé en haut de la
fenêtre, qui avance de gauche à droite et **s'arrête à 94 %**. Chaque `loading.tsx` ne rend que
lui — `components/shared/barre-chargement.tsx` — et rien d'autre.

Les squelettes qu'il remplace promettaient une forme : autant de cartes, autant de lignes, des
colonnes à telle largeur. Quand le contenu arrivait et ne correspondait pas — une liste vide,
trois lignes au lieu de huit — la page sautait, et l'attente avait coûté un mouvement au lieu
d'en épargner un. Chacun devait en outre être tenu à jour en même temps que son écran, ce que
rien ne garantissait.

La barre ne va jamais jusqu'au bout : la durée réelle n'est pas connue, et une barre qui atteint
100 % avant l'arrivée du contenu annonce une fin qui ne vient pas. Elle disparaît quand la page
prend sa place, sans jamais se remplir.

Un `fallback` de `<Suspense>` posé dans une page vaut `null` : la barre du haut couvre déjà
l'attente, et un second indicateur en dirait deux fois trop.

### Iconographie — Lucide uniquement

18 px en navigation, 16 px en tableaux, trait de 1,5 px. Jamais d'emoji.

```
Navigation   CRM users · CV folder-open · Heures clock · Calculateur calculator
             Administration settings
Actions      Ajouter plus · Modifier pencil · Supprimer trash-2 · Télécharger download
             Téléverser upload · Déplacer folder-input · Rechercher search
             Filtrer sliders-horizontal · Exporter file-down · Trier chevrons-up-down
             Fermer x · Retour ← (flèche du produit)
Interactions Appel phone · Courriel mail · Visite map-pin · Soumission file-text
États        Succès check-circle-2 · Avertissement alert-triangle · Erreur alert-circle
             Information info · Accès refusé lock · Introuvable search-x
Divers       Utilisateur user · Déconnexion log-out · Clair sun · Sombre moon
             Corbeille trash · Historique history
```

**Les deux flèches gauche et droite ne viennent PAS de Lucide.** Le client a fourni les siennes ;
elles sont recopiées en composants dans `components/shared/fleches.tsx` — `FlecheGauche` et
`FlecheDroite` — et remplacent partout `chevron-left`, `chevron-right`, `arrow-left` et
`arrow-right` : lien de retour, page précédente et suivante, semaine précédente et suivante,
navigation entre deux CV, valeur avant → après.

Deux pièges, tous deux vérifiés par un test.

Les fichiers d'origine, dans `public/icons/`, portent des noms **inversés** : `Left.svg` contient
la flèche qui pointe à droite, et son identifiant interne le dit lui-même. Les reprendre par leur
nom aurait mis « suivant » sur le bouton « précédent », sur toute l'application d'un coup.

Leur cadre est **plat** — 15,7 × 8,7 — là où Lucide est carré. `size-*` les étirerait : on les
dimensionne par la largeur seule, `w-3.5` là où l'icône Lucide faisait `size-3.5`.

Ce qui reste en Lucide : `chevron-down` et `chevron-up`, qui ouvrent un menu sans désigner de
direction, `chevrons-up-down`, qui indique un tri, et `panel-left`, qui est le pictogramme d'un
panneau qu'on replie.

### Graphiques et tuiles

**Tuile de statistique** — libellé 13 px `--ink3`, valeur 30 px poids 600 en chiffres
proportionnels, variation 13 px avec flèche et mot. Trois ou quatre par ligne, jamais plus.
Une tuile n'a jamais de graphique : si la tendance compte, elle devient une figure avec son
axe.

Les **30 px sont confirmés** contre les 38 px du prototype. Le 38 appartient au Display, donc
à l'écran de connexion, qu'on regarde trois secondes. Une tuile vit au-dessus d'un tableau :
à 38 px elle mange une ligne et demie de données et vient concurrencer le titre de page, qui
est lui-même à 30. Deux hiérarchies de même poids sur un écran de travail, c'est une de trop.

**Graphique des heures** — barres empilées, une par semaine. Heures normales en `--s1`,
supplémentaires en `--s2`. Deux séries, donc **légende obligatoire**. Espace de 2 px de la
couleur du fond entre les segments. Extrémités arrondies à 4 px, ancrées à la ligne de base.
Un seul axe vertical. Libellés directs sur les segments notables uniquement.

**Séparation des couleurs** — une couleur d'entreprise n'apparaît qu'en filet ou en pastille,
toujours avec le nom. Une couleur de série n'apparaît qu'en surface pleine, toujours avec sa
légende. Sur un même écran, aucun aplat ne désigne une entreprise, aucun filet ne désigne une
série.

Cette règle a d'abord été écrite avec `--s1` valant `#2a78d6`, soit `--dev`, et `--s2` valant
`#eb6834`, soit `--staff`. La lettre était respectée — filet d'un côté, aplat de l'autre. Ce
sont pourtant les mêmes pixels. Sur la fiche d'un employé de « Staff augmentation », la
pastille d'entreprise et le segment « heures supplémentaires » du graphique portent le même
orange à quelques centimètres d'écart, avec deux sens sans rapport. Une règle qu'il faut
connaître pour comprendre ce qu'on regarde n'a rien réglé : elle a déplacé la charge sur le
lecteur.

**Les séries sont donc achromatiques** : deux valeurs d'un même gris chaud, et rien d'autre.
Le décalage n'est pas cosmétique, il est structurel. Une couleur d'entreprise est saturée,
une couleur de série ne l'est jamais — aucune valeur de gris ne peut être confondue avec l'une
des trois teintes, dans aucun des deux modes, et sous aucune déficience de la vision des
couleurs, puisqu'une déficience comprime les teintes et n'ajoute jamais de saturation. La
garantie tient sans qu'on ait à la vérifier écran par écran, et elle survivra à une quatrième
entreprise.

Le gris convient d'autant mieux que les deux séries sont **ordinales** et non catégorielles :
les heures supplémentaires ne sont pas une autre espèce d'heures, ce sont les dernières de la
semaine. Une variation d'intensité dit cela plus juste qu'un changement de teinte, qui
suggérerait deux natures.

Les valeurs sont contrastées contre `--surface` : environ 7,5:1 pour `--s1` et 3,1:1 pour
`--s2` en clair, 8,1:1 et 3,2:1 en sombre. Les deux passent le seuil de 3:1 des éléments
d'interface, et l'écart entre elles avoisine un rapport de 2,4 dans les deux modes — la série
dominante est toujours la plus contrastée, quel que soit le fond.

L'interdit demeure par-dessus le marché, indépendamment des valeurs retenues : **une entreprise
et une série ne se désignent jamais de la même façon sur un même écran**. Si les deux règles
devaient un jour se contredire, c'est celle-ci qui tranche.

### Textes de l'interface

Français uniquement. Vouvoiement. Pas de point d'exclamation. Les libellés de boutons sont
des **verbes à l'infinitif** — jamais _OK_, jamais _Soumettre_. Un message d'erreur dit
**quoi faire**, pas ce qui ne va pas.

```
Navigation   CRM · Banque de CV · Suivi des heures · Calculateur · Administration
Rôles        Administrateur · Recrutement · Gestion des heures
Entreprises  Paysagement · Développement web · Staff augmentation
Catégories CV  Développeur · Monteur vidéo · Gérant · Gestionnaire de résultat
               Designer · Support client

Boutons principaux
  Connexion            Se connecter
  Mot de passe oublié  Envoyer le lien
  Banque de CV         Upload
  Liste clients        Nouveau client
  Fiche client         Nouvelle estimation
  Calculateur          Enregistrer au dossier client
  Saisie des heures    Enregistrer
  Utilisateurs         Nouvel utilisateur
  Grilles de tarifs    Enregistrer une nouvelle version

En-têtes de colonnes
  Banque de CV   Nom du fichier · Catégories · Déposé le · Taille
  Employés       Employé · Entreprise · Taux horaire · Total période · Statut
  Clients        Client · Type · Statut · Dernière interaction · Prochaine relance
  Estimations    Numéro · Client · Date · Montant · Statut · Valide jusqu’au
  Utilisateurs   Nom · Courriel · Rôle · Dernière connexion · Statut
  Journal        Horodatage · Utilisateur · Action · Élément · Entreprise · Adresse IP

Statuts client       Prospect · Contacté · Soumission envoyée · Gagné · Perdu
Statuts estimation   Brouillon · Envoyé · Accepté · Refusé · Expiré

Messages système
  Identifiants refusés   Courriel ou mot de passe incorrect.
  Trop de tentatives     Trop de tentatives. Réessayez dans 5 minutes.
  Session expirée        Votre session a expiré. Reconnectez-vous.
  Avertissement session  Votre session va expirer
                         Il reste M:SS. Prolongez pour ne rien perdre de votre travail
                         en cours.                          bouton : Rester connecté
  Mot de passe envoyé    Si un compte existe pour cette adresse, un courriel vient
                         d’être envoyé.
  Accès refusé           Vous n’avez pas accès à cette page.
  Introuvable            Cette page n’existe pas.
  Erreur serveur         Une erreur est survenue. Réessayez.
  Hors ligne             Connexion perdue. Vos modifications seront enregistrées au retour.
  Enregistré             Enregistré à H h MM      (9 h 05, sans zéro de tête)

États vides — un titre sans point final, puis un message terminé par un point
  Banque de CV, racine   Aucun CV pour l’instant
                         Déposez un premier curriculum vitæ pour commencer.
                         (administrateur) Créez vos catégories de postes, puis déposez
                         un premier curriculum vitæ.
  Catégorie de CV        Aucun CV dans cette catégorie
                         Déposez-en un pour commencer.
  Plus de 24 mois        Aucun CV de plus de 24 mois
                         Les curriculum vitæ déposés il y a plus de deux ans
                         apparaîtront ici. Aucun n’est supprimé.
  Corbeille              La corbeille est vide
                         Aucun fichier supprimé récemment.
  Clients                Aucun client pour cette entreprise
                         Ajoutez le premier.
  Relances               Aucune relance prévue aujourd’hui
                         Les prochaines relances apparaîtront ici à leur date.
  Soumissions            Aucune soumission en attente
                         Les estimations envoyées apparaîtront ici jusqu’à la réponse
                         du client.
  Estimations            Aucune estimation enregistrée
                         Calculez une estimation, puis enregistrez-la au dossier d’un
                         client.
                         (filtre actif) Retirez le filtre ou créez une nouvelle estimation.
  Employés               Aucun employé
                         Ajoutez une première fiche : nom, entreprise de rattachement
                         et taux horaire.
  Saisie des heures      Aucun employé actif
                         Créez une fiche d’employé pour commencer la saisie des heures.
                                                            bouton : Employés
  Utilisateurs           Aucun compte
                         Invitez un premier utilisateur : il recevra un courriel et
                         choisira son mot de passe.
  Journal                Aucune action sur cette période
                         Élargissez la période ou retirez un filtre.
  Recherche              Aucun résultat pour « terme »
                         Ajustez la recherche ou retirez un filtre.
  Recherche seule        Aucun résultat pour « terme »
                         Vérifiez l’orthographe ou essayez un autre mot.

Listes secondaires — une seule phrase en --ink3 à la place du tableau, jamais un bloc
  Corrections d’un employé   Aucune correction sur cette fiche.
  Détail des saisies         Aucune heure saisie sur cette période.
  Historique des versions    Aucune version enregistrée.
  Palette de commandes       Aucun résultat.
  Dialogue de déplacement    Aucune catégorie : le fichier ira dans « Non classé ».
```

> Les deux messages d'authentification sont **rigoureusement identiques** que le courriel
> existe ou non. Un message différent permettrait de découvrir quels courriels ont un compte.

### Règles d'écriture des chaînes

Ce qui suit vaut pour toute chaîne visible, y compris celles qu'aucune liste ne prévoit encore.
Les quatre modules ont été construits en parallèle, et chaque écran absent de cette section a
été comblé par un libellé inventé sur place : c'est ainsi qu'un même état vide a fini avec un
point final dans un module et sans dans l'autre. Les règles ci-dessous existent pour que le
prochain écran n'ait pas à choisir.

**L'apostrophe est courbe** — `’`, U+2019, jamais `'`. Elle est la seule employée dans les
chaînes, y compris dans celles que ce document recopie : les blocs de chaînes de cette section
sont à prendre au caractère près. La prose du document, elle, n'est pas recopiée dans le code
et garde l'apostrophe droite.

**Les signes doubles sont précédés d'une espace insécable** — `&nbsp;?`, `&nbsp;:`, `&nbsp;!`,
`&nbsp;;`, `&nbsp;%` — et les guillemets français enserrent leur contenu de la même façon :
`«&nbsp;Nom&nbsp;»`. Sans elle, un titre de confirmation renvoie son point d'interrogation seul
à la ligne suivante, et le nom d'un fichier se sépare de son guillemet fermant. C'est la règle
la plus souvent oubliée du projet : elle ne se voit qu'au moment où la fenêtre rétrécit.

**Un état vide se lit en deux temps** : un titre qui constate, sans point final, puis un message
qui dit quoi faire, terminé par un point. Le titre ne contient jamais de verbe d'action — c'est
le message qui le porte, ou le bouton.

**L'état vide de recherche porte le terme cherché dans le titre**, jamais dans le message :
`Aucun résultat pour «&nbsp;terme&nbsp;»`. C'est la première chose lue, et la seule qui permette
de comprendre qu'on a cherché autre chose que ce qu'on croyait. Le message reste générique et
dit quoi tenter ensuite.

**Un libellé d'action est un verbe à l'infinitif**, y compris quand il ne se voit pas : le
`aria-label` d'un bouton à icône suit la même règle que le texte d'un bouton. « Consulter », pas
« Aperçu ».

**Un compteur nomme son unité et décline le zéro et le singulier** : `Aucun CV` · `1 CV` ·
`12 CV` ; `Aucune entrée` · `1 entrée` · `12 entrées`. Jamais « 0 CV », qui se lit comme une
donnée manquante plutôt que comme un dossier vide.

**Un message d'erreur dit quoi faire.** La règle est écrite plus haut ; elle mérite son
corollaire : quand la seule chose à faire est de recharger, on le dit — « Rechargez la page
avant de recommencer » — plutôt que d'annoncer un conflit de version que personne n'a provoqué
sciemment.

### Écran de connexion

Le seul écran aéré de l'application. Ses chaînes ne suivent pas la densité des autres : elles
sont là pour être lues une fois, lentement.

```
Pilule           Accès réservé
Titre            Trois entreprises.
                 Un seul accès.
Sous-titre       Connectez-vous pour accéder à vos modules de travail.
Champs           Courriel · Mot de passe
Exemple          vous@exemple.ca · Votre mot de passe
Bascule          Afficher le mot de passe · Masquer le mot de passe
Case             Rester connecté
Bouton           Se connecter            en cours : Connexion en cours
Lien             Mot de passe oublié
Pied             Renseignements personnels protégés. Chaque accès est journalisé.

Mot de passe oublié
  Titre          Mot de passe
                 oublié
  Sous-titre     Saisissez votre courriel. Vous recevrez un lien pour définir un
                 nouveau mot de passe.
  Bouton         Envoyer le lien         en cours : Envoi en cours
  Lien           Retour à la connexion

Réinitialisation
  Titre          Choisir
                 un mot de passe
  Sous-titre     Au moins douze caractères. Choisissez une phrase que vous seul
                 retenez.
  Champs         Nouveau mot de passe · Confirmer le mot de passe
  Bouton         Enregistrer             en cours : Enregistrement en cours
  Succès         Mot de passe défini. Connectez-vous.
  Lien expiré    Ce lien n’est plus valide
                 Les liens expirent après une heure et ne servent qu’une fois.
                 Demandez-en un nouveau.
                 bouton : Demander un nouveau lien
  Lien           Retour à la connexion
```

### Écrans d'état

Trois écrans, un seul gabarit — `components/shared/etat-systeme.tsx`. Une icône, un titre court,
une phrase qui dit quoi faire, une action principale et, s'il en faut une seconde, une issue de
repli **à filet** : un seul bouton noir, ici comme partout.

```
Accès refusé     Accès refusé
                 Vous n’avez pas accès à cette page.
Introuvable      Cette page n’existe pas
                 Le lien est peut-être erroné, ou la page a été retirée.
Erreur           Une erreur est survenue
                 Réessayez. Si le problème persiste, transmettez la référence
                 ci-dessous.
                 Référence : <digest>
Actions          Réessayer               (principale)
                 Retour à l’accueil · Retour au CRM · Retour à la banque de CV ·
                 Retour au calculateur  (repli, à filet)
```

Le message d'un accès refusé ne dit **rien** de ce qui se trouve derrière. Jamais « ce client
appartient à une autre entreprise », qui confirmerait son existence. C'est la même règle que
celle des fiches supprimées, et elle vaut aussi pour l'introuvable.

`(app)/not-found.tsx` existe pour que ces écrans restent DANS le gabarit : sans lui, un
identifiant erroné faisait disparaître d'un coup barre latérale, en-tête et fil d'Ariane.

Le libellé « en cours » remplace celui du bouton pendant l'attente ; il ne s'y ajoute jamais. Le
bouton garde sa place et sa largeur, sinon la page saute au moment précis où l'utilisateur
attend.

### Titres, onglets et sections

Un titre de page nomme l'écran, pas le module — la barre latérale nomme déjà le module. Un titre
de section désigne un groupe de contenu, jamais une action.

```
Accueil          Au travail.
  Recherche      Rechercher un écran, un client, un employé, un CV…
  Cartes         le libellé du module, puis sa phrase (voir plus bas) · Ouvrir

CRM              CRM · Relances · Clients · (fiche : le nom du client)
  Choix          Choisissez l’entreprise dont vous voulez suivre les clients.
                 (cartes au gabarit de l’accueil : le nom, le compte, puis Ouvrir)
  Onglets        Relances · Clients                      sélecteur : Entreprise
  Sections       À faire aujourd’hui · Soumissions en attente
  Fiche          Coordonnées · Historique · Estimations · Ajouter une interaction

Banque de CV     Banque de CV · Corbeille
  Sections       Dossiers · Derniers dépôts
  Dossiers       Tous les CV · Non classé · Plus de 24 mois · Corbeille
  Étiquette      Supprimés récemment      (carte de la corbeille, à la place du compte)
  Renvoi         Voir les N CV            (sous les derniers dépôts, au-delà de dix)

Suivi des heures Suivi des heures · Employés · (fiche : le nom de l’employé)
  Onglets        Saisie · Employés
  Chiffres       Employés · Actifs · Heures de la semaine · Période
  Jours          lun 3 · mar 4 · …                      (toujours en minuscules)
  Auteur         par NOM                                (ligne de correction)
  Variation      +12 % par rapport à la période précédente
  Sections       Heures par semaine — 8 dernières semaines
                 Historique des corrections · Notes
  Repère         Cette semaine            (retour à la semaine courante)

Calculateur      Calculateur · Nouvelle estimation · Estimations
  Choix          Choisissez l’entreprise pour laquelle vous préparez une estimation.
  Colonnes       Service · Quantité · Montant          (grille de saisie)
  Sections       Services · Ajustements · Estimation en direct
  Vide           Choisissez un service et une quantité pour voir le total apparaître ici.
  Menu vide      Choisir un service…
  Compteur       Aucune estimation · 1 estimation · 12 estimations

Administration   Utilisateurs · Grilles de tarifs · Paramètres de paie · Journal d’audit
```

Deux libellés ne se lisent qu'avec un lecteur d'écran, et ils sont pourtant les seuls à
distinguer une ligne de sa voisine. Le menu de fin de ligne s'annonce `Actions pour NOM` — le
nom du client, de l'employé, du compte, ou la référence de l'estimation. Le bouton d'une carte
répétée s'annonce de même : `Ouvrir le calculateur — ENTREPRISE`. Sans eux, la liste des liens
d'une page ne montre que « Ouvrir », « Ouvrir », « Ouvrir ».

Les phrases des cartes de l'accueil, une par module. Elles disent ce qu'on y fait, jamais ce que
le module « permet de » faire.

```
CRM              Clients, relances et soumissions, un dossier par entreprise.
Banque de CV     Dépôt, classement et recherche des curriculum vitæ.
Suivi des heures Saisie de la semaine, périodes de paie et exports.
Calculateur      Estimations composées pendant l’appel, au tarif en vigueur.
Administration   Comptes, grilles de tarifs, journal d’audit et coordonnées.
```

Les tuiles du CRM portent les quatre regroupements de CRM-6 : `À relancer aujourd’hui` ·
`En retard` · `Soumissions en attente` · `Estimations expirant sous 7 jours`. Les deux tuiles
d'alerte prennent une icône et un mot — `En retard`, `À relancer` — dès que leur valeur dépasse
zéro ; la couleur ne va qu'à l'icône.

Les tuiles de la fiche d'employé : `Heures de la période` · `Heures supplémentaires` ·
`Montant de la période`. La variation affiche `Aucune période précédente à comparer` quand il
n'y a rien à comparer — jamais un tiret, qui laisserait croire à une valeur nulle.

### Boutons secondaires et actions de ligne

Les boutons principaux — un seul en noir par écran — sont déjà listés. Voici ceux qui portent un
filet, et les actions de ligne d'un tableau.

```
Partout          Annuler · Enregistrer · Ajouter · Modifier · Supprimer · Réessayer
                 Retour à l’accueil

CRM              Nouvelle estimation · Consulter
Banque de CV     Consulter · Télécharger · Déplacer · Supprimer · Restaurer
                 Catégories
Suivi des heures Copier la semaine précédente · Clôturer la période · Corriger
                 Semaine précédente · Semaine suivante · Cette semaine
                 Exporter en CSV
Calculateur      Ajouter un service · Voir l’estimation · Dupliquer · Imprimer
                 Exporter en PDF
                 Marquer comme envoyée · Marquer comme acceptée
                 Marquer comme refusée · Marquer comme expirée
Administration   Envoyer l’invitation · Réinitialiser le mot de passe
                 Suspendre · Réactiver · Historique des versions · Exporter en CSV
                 Déposer un logo · Remplacer le logo · Retirer le logo
Session          Rester connecté · Se déconnecter
Thème            Mode clair · Mode sombre
```

Le bouton d'une modale de confirmation **reprend le verbe de son titre** : « Supprimer ce
CV&nbsp;? » se confirme par « Supprimer », jamais par « Confirmer » ni par « OK ». Celui qui lit
le bouton sans avoir lu le titre doit savoir ce qu'il déclenche. Le second bouton est toujours
« Annuler ».

### Formulaires — champs, aides et exemples

Un libellé de champ est un nom, court, sans deux-points. L'aide passe sous le champ, en 13 px
`--ink3`, et n'existe que là où la valeur engage quelque chose que le libellé ne dit pas.

```
Fiche client       Nom · Type · Personne-ressource · Courriel · Téléphone · Adresse
                   Provenance du contact · Notes
  Aide             Le nom et le type suffisent pour commencer&nbsp;; le reste se complète
                   au fil des échanges.
  Types            Particulier · Entreprise

Interaction        Type d’interaction · Date de l’interaction · Résumé
                   Prochaine action · Le
  Exemples         Ce qui a été dit ou fait… · Relance téléphonique
  Types            Appel · Courriel · Visite · Soumission

Fiche d’employé    Nom · Entreprise · Taux horaire · Notes
  Aide             Le taux horaire est facultatif&nbsp;: sans lui, seules les heures sont
                   totalisées.
  Exemple          22,50

Compte             Nom · Courriel · Rôle
  Aide, invitation L’utilisateur reçoit un courriel et choisit lui-même son mot de passe.
  Aide, modification
                   Le mot de passe n’est jamais modifiable ici&nbsp;: l’utilisateur
                   choisit le sien.

Paramètres de paie Seuil des heures supplémentaires · Majoration
                   Durée de la période de paie
  Aides            Au-delà de ce nombre d’heures par semaine, la majoration s’applique.
                   Multiplicateur appliqué au taux horaire au-delà du seuil.
                   Nombre de jours couverts par une période.

Grille de tarifs   Service · Unité · Prix unitaire · État
  États            Actif · Retiré
  Bandeau          Version N en vigueur depuis le DATE — ENTREPRISE. Les estimations
                   déjà émises conservent les prix de leur version.
                   Aucune grille publiée pour ENTREPRISE. Les estimations déjà émises
                   conservent les prix de leur version.

Calculateur        Service · Unité · Quantité · Prix unitaire
                   Frais de déplacement · Majoration (%) · Rabais ($) · Rabais (%)
  Sélection vide   Choisir un service…
  Exemples         0,00 · 0

Correction         Motif de la correction
Fermeture d’un dossier
                   Motif
  Exemple          Prix trop élevé, délai trop long, contrat signé…

Recherche          Rechercher un client · Rechercher un fichier
                   Rechercher dans tous les CV
Brouillon (TR-13)  Saisie en cours reprise. Elle n'est pas encore enregistrée.
  Calculateur      Calcul en cours repris. Il n'est pas encore enregistré.
Palette (⌘K)       Rechercher un écran, un client, un employé, un CV…
  Groupes          Écrans · Clients · Employés · Banque de CV · Estimations
Téléphone, exemple 418 555-0123
```

Un champ obligatoire ne se marque pas par un astérisque : le refus est porté par le message de
validation, sous le champ, et il dit quoi saisir. Un astérisque seul est une information portée
par un symbole que rien n'explique.

### Messages de validation

Ils nomment la contrainte en toutes lettres plutôt qu'en chiffres collés : ils sont lus une
fois, sous un champ, par quelqu'un qui vient d'échouer.

```
Longueur     Au moins deux caractères. · Au moins douze caractères.
             Quarante caractères au maximum. · Soixante caractères au maximum.
             Quatre-vingts caractères au maximum. · Cent vingt caractères au maximum.
             Cent soixante caractères au maximum.
             Deux cent quatre-vingts caractères au maximum.
             Trois cents caractères au maximum. · Cinq cents caractères au maximum.
             Deux mille caractères au maximum.

Présence     Saisissez votre courriel. · Saisissez votre mot de passe.
             Confirmez le mot de passe. · Choisissez un client.
             Choisissez une entreprise. · Indiquez un motif.
             Indiquez le motif de la correction. · Indiquez le motif de la décision.
             Indiquez la date de la prochaine action. · Indiquez une unité.
             Désignation manquante. · Unité manquante. · Nom de fichier manquant.
             Estimation d’origine manquante. · Ajoutez au moins un service.
             Une grille contient au moins un service.

Format       Le format attendu est nom@domaine.ca
             Indiquez un taux comme 22,50. · Indiquez une date valide. · Date invalide.
             Un nombre, deux décimales au maximum.
             Un montant, deux décimales au maximum.
             Les heures se saisissent au centième.

Bornes       Un montant ne peut pas être négatif. · Montant hors des limites.
             Un pourcentage ne peut pas être négatif. · Cent pour cent au maximum.
             La quantité doit être supérieure à zéro. · Quantité hors des limites.
             Le seuil doit être supérieur à zéro.
             La majoration ne peut pas être inférieure à 1.
             Vingt-quatre heures au maximum par jour.
             Au moins une semaine. · Quatre semaines au maximum.
             La période doit compter des semaines entières&nbsp;: 7, 14, 21 ou 28 jours.

Cohérence    Les deux mots de passe diffèrent. · Aucune modification à consigner.
             Entreprise inconnue.

Global       Certains champs sont invalides.
```

Le refus de confirmation d'un mot de passe est porté **par le champ de confirmation**, jamais
par le premier : c'est celui que l'utilisateur vient de quitter.

### Dialogues et confirmations

Un dialogue porte un titre, une description d'une à deux lignes, et deux boutons. La description
dit ce que l'action va produire — pas ce qu'elle est.

```
Nouveau client            Le nom et le type suffisent pour commencer&nbsp;; le reste se
Modifier la fiche         complète au fil des échanges.

Nouvel employé            Le taux horaire est facultatif&nbsp;: sans lui, seules les
Modifier la fiche         heures sont totalisées.

Inviter un utilisateur    L’utilisateur reçoit un courriel et choisit lui-même son mot
                          de passe.
Modifier le compte        Le mot de passe n’est jamais modifiable ici&nbsp;:
                          l’utilisateur choisit le sien.

Upload                    Glissez les fichiers ou choisissez-les sur votre appareil.
  Zone de dépôt           Glissez vos fichiers ici
  Contraintes             PDF, DOC et DOCX — 10 Mo maximum par fichier.
  Progression             Déposé · Échec

Déplacer le fichier       «&nbsp;NOM&nbsp;» — un CV peut appartenir à plusieurs
                          catégories.
Gérer les catégories      Les catégories correspondent aux postes recrutés. Un même CV
                          peut appartenir à plusieurs d’entre elles.

Enregistrer au dossier client
                          Estimation de MONTANT. Elle apparaîtra dans la chronologie
                          du client.
Historique des versions   Les estimations déjà émises conservent les prix de leur
                          version.

Fermeture d’un dossier    Ce statut ferme le dossier. Indiquez le motif de la décision.

Votre session va expirer  Il reste M:SS. Prolongez pour ne rien perdre de votre travail
                          en cours.
```

**Confirmations destructives ou irréversibles** — titre interrogatif, description qui dit ce qui
est conservé, bouton reprenant le verbe.

```
Supprimer cette fiche&nbsp;?
    «&nbsp;NOM&nbsp;» n’apparaîtra plus dans la liste. La fiche et son historique restent
    conservés.
Supprimer ce CV&nbsp;?
    «&nbsp;NOM&nbsp;» ira dans la corbeille. Cette action peut être annulée pendant 30 jours.
Supprimer cette catégorie&nbsp;?
    «&nbsp;NOM&nbsp;» sera retirée. Les N CV qu’elle contient ne sont pas supprimés&nbsp;: ils
    passent dans «&nbsp;Non classé&nbsp;».
    Sans CV : Elle ne contient aucun CV.
Suspendre ce compte&nbsp;?
    NOM ne pourra plus se connecter. Ses entrées au journal d’audit sont conservées&nbsp;: un
    compte n’est jamais supprimé.
Réactiver ce compte&nbsp;?
    NOM pourra de nouveau se connecter.
Clôturer la période&nbsp;?
    La grille passera en lecture seule. Une correction restera possible avec un motif consigné.
Corriger une période clôturée
    Indiquez le motif de la correction. Il sera consigné au journal d’audit avec la valeur
    précédente.
Enregistrer quand même&nbsp;?
    N employés n’ont aucune heure cette semaine&nbsp;: NOMS.
Remplacer les heures déjà saisies&nbsp;?
    N cellules seront remplacées par les heures de la semaine précédente.
```

« Corriger une période clôturée » n'est pas interrogatif : rien n'est détruit, on ouvre un mode.
Un point d'interrogation y ferait craindre une conséquence qui n'existe pas.

Les deux confirmations de la grille des heures **nomment** ce qu'elles engagent — les employés
sans heures, le nombre de cellules écrasées. « Certains employés n'ont pas d'heures » oblige à
tout revérifier ; le nom permet de distinguer un oubli de saisie d'une absence réelle.

### Colonnes et filtres — compléments

Les en-têtes déjà listés plus haut restent. S'y ajoutent :

```
Banque de CV       Nom du fichier · Catégories · Déposé le · 24 mois atteints le · Taille
Corbeille          Nom du fichier · Par · Supprimé le
Relances           Client · Prochaine action · Dernier contact · Échéance
Soumissions        Numéro · Client · Montant · Valide jusqu’au
Grille de tarifs   Service · Unité · Prix unitaire · État
Saisie des heures  Employé · lun · mar · mer · jeu · ven · sam · dim · Total
                   pied : Total de l’équipe · Total de la semaine
Détail des saisies Date · Jour · Heures
```

La colonne « 24 mois atteints le » de la banque de CV n'était pas prévue. Elle ne dit pas ce qui
va disparaître — rien ne disparaît — mais quand un dossier franchit le repère d'ancienneté, ce
qu'une date de dépôt seule oblige à calculer de tête.

```
Sélecteurs       Tous les statuts · Tous les types · Tous les modules
                 Tous les utilisateurs
Étiquettes       Filtrer par statut · Filtrer par type · Filtrer par module
                 Filtrer par utilisateur · Date de début · Date de fin
Retraits         Retirer le filtre · Effacer la recherche
Navigation       Page précédente · Page suivante · Semaine précédente · Semaine suivante
                 Employé précédent · Employé suivant · Fichier précédent · Fichier suivant
                 Fermer l’aperçu · Ouvrir le menu · Rechercher · Navigation
Aperçu d’un CV   Catégories · Déposé le · Déposé par · 24 mois atteints le
                 Non classé          (aucune catégorie)
Jamais connecté  (colonne « Dernière connexion », compte qui ne s’est jamais connecté)
```

Un en-tête de colonne triable est un **bouton** portant `aria-sort` sur sa cellule : une cellule
d'en-tête n'est ni focalisable ni actionnable par elle-même.

### Refus, conflits et limites

Un refus n'est pas une panne, et son message ne doit jamais être remplacé par « Une erreur est
survenue ». Il dit ce qui bloque et ce qu'il reste à faire.

**Conflit de version** — même phrase, déclinée par l'objet. La seconde moitié ne change jamais :
c'est elle qui porte l'action.

```
Fiche client     Cette fiche a été modifiée ailleurs entre-temps. Rechargez la page avant
                 de recommencer.
Estimation       Cette estimation a été modifiée ailleurs entre-temps. Rechargez la page
                 avant de recommencer.
Fichier          Ce fichier a été modifié ailleurs entre-temps. Rechargez la page avant de
                 recommencer.
Paramètres       Ces paramètres ont été modifiés ailleurs entre-temps. Rechargez la page
                 avant de recommencer.
Heures           Ces heures ont été modifiées ailleurs entre-temps&nbsp;: LISTE. Rechargez
                 la page avant de recommencer.
Grille de tarifs Une nouvelle version a été publiée entre-temps. Rechargez la page avant de
                 recommencer.
```

**Refus métier**

```
Période clôturée  Cette période est clôturée. Passez par «&nbsp;Corriger&nbsp;» pour
                  consigner une modification.
Dernier admin     C’est le dernier compte administrateur actif. Nommez un autre
                  administrateur avant de retirer celui-ci.
Courriel pris     Un compte existe déjà pour cette adresse.
                  Un autre compte utilise déjà cette adresse.     (modification)
Courriel inconnu  Aucun compte ne correspond à cette adresse.
Catégorie prise   Cette catégorie existe déjà.
                  Une autre catégorie porte déjà ce nom.          (renommage)
Sans changement   Aucun changement à enregistrer.
Estimation vide   Ajoutez au moins un service avant d’enregistrer.
Introuvable       Cette page n’existe pas.
```

**Limites de fichier et de rythme** — la contrainte est annoncée avant le geste, sous la zone de
dépôt, puis rappelée en cas de refus. Le refus **nomme le fichier** : sur un dépôt multiple,
« Le format n'est pas accepté » ne dit pas lequel.

```
Avant            PDF, DOC et DOCX — 10 Mo maximum par fichier.
Format, un seul  Ce format de fichier n’est pas accepté. Déposez un PDF, un DOC ou un DOCX.
Format, nommé    «&nbsp;NOM&nbsp;» — formats acceptés&nbsp;: PDF, DOC et DOCX.
Taille, un seul  Le fichier dépasse 10 Mo. Il n’a pas été conservé.
Taille, nommé    «&nbsp;NOM&nbsp;» dépasse 10 Mo.
Rythme           Trop de dépôts d’affilée. Réessayez dans quelques minutes.
Stockage         Envoi refusé par le stockage.
```

**Export tronqué** — un export qui ne dit pas qu'il est incomplet est un journal qui ment. La
dernière ligne du fichier porte : `Export limité aux N entrées les plus récentes. Resserrez la
période.`

### Notifications

Trois secondes pour un succès, persistante pour une erreur. Une notification confirme au passé
ce qui vient d'avoir lieu, en nommant l'objet — jamais « Opération réussie ».

```
CRM              Client ajouté. · Fiche mise à jour. · Interaction ajoutée.
                 Relance mise à jour. · Statut mis à jour — STATUT.
                 «&nbsp;NOM&nbsp;» a été supprimé.
Banque de CV     N CV déposés. · Classement mis à jour.
                 Catégorie «&nbsp;NOM&nbsp;» créée. · Catégorie renommée.
                 Catégorie «&nbsp;NOM&nbsp;» supprimée.
                 «&nbsp;NOM&nbsp;» déplacé dans la corbeille. · «&nbsp;NOM&nbsp;» restauré.
Suivi des heures Enregistré à H h MM · Semaine précédente copiée. · Période clôturée.
                 Correction ouverte — motif consigné.
Calculateur      Estimation RÉFÉRENCE enregistrée au dossier de CLIENT.
                 Estimation RÉFÉRENCE mise à jour.
Administration   Invitation envoyée à COURRIEL. · Compte mis à jour.
                 Statut du compte mis à jour.
                 Courriel de réinitialisation envoyé à COURRIEL.
                 Version N enregistrée. · Paramètres enregistrés.
                 Coordonnées enregistrées. · Logo enregistré. · Logo retiré.
```

`Enregistré à H h MM` s'affiche aussi en clair à côté du bouton d'enregistrement de la grille
des heures : la notification disparaît, la mention reste tant que rien n'a changé.

Le bandeau de la grille des heures, en lecture seule ou en correction :
`Période clôturée — grille en lecture seule.` et
`Correction en cours — les modifications seront consignées au journal.`

### Énumérations tronquées

Plusieurs messages nomment ce qu'ils refusent ou ce qu'ils vont écraser : les cellules en conflit
de la grille des heures, les employés sans heures d'une semaine. C'est délibéré — sur soixante
saisies, « une valeur a changé » ne dit pas laquelle, et tout est refait à la main.

Nommer sans plafond retourne l'intention contre elle-même : à quinze noms, le message déborde de
la modale et plus rien n'est lu.

**Trois éléments nommés au maximum, puis le reste compté.**

```
Un              Nom A
Deux            Nom A et Nom B
Trois           Nom A, Nom B et Nom C
Quatre et plus  Nom A, Nom B, Nom C et 12 autres
```

La forme est `et N autres`, sans virgule devant, et `et 1 autre` au singulier. Elle se lit dans
la continuité de la phrase :

```
Ces heures ont été modifiées ailleurs entre-temps : Marie Tremblay — lundi 3 août,
Jean Roy — mardi 4 août, Léa Côté — jeudi 6 août et 12 autres. Rechargez la page avant
de recommencer.
```

Les trois retenus sont les **premiers dans l'ordre d'affichage** de la liste concernée, jamais un
échantillon arbitraire : celui qui cherche la cause commence par le haut de sa grille.

### Le journal d'audit — colonnes et libellés

**Six colonnes à l'écran** : Horodatage · Utilisateur · Action · Élément · Entreprise ·
Adresse IP. Celles déjà déclarées plus haut, sans ajout.

Le module **n'est pas une colonne** — il est un filtre. Le libellé de l'action le nomme déjà :
« Dépôt d'un CV » n'a jamais eu lieu ailleurs que dans la banque de CV. Le tableau mesure mille
pixels avant de défiler horizontalement, et une colonne déductible d'une autre est la première à
retirer. L'entreprise, elle, reste : ADM-4 l'exige, elle ne se déduit de rien, et elle est vide
pour les modules non cloisonnés — ce vide est lui-même une information.

**Sept colonnes à l'export CSV**, module compris. Le fichier est lu dans un tableur, où la
largeur ne coûte rien, et il sert de pièce à produire : mieux vaut redondant que lacunaire.

Une entrée surveillée — téléchargement ou suppression d'un CV, changement de rôle, suppression
d'une fiche client — porte l'icône `alert-triangle` en `--serious` **et** son libellé en
demi-gras. La couleur ne dit rien seule, et `--serious` mesure 2,55:1 sur `--surface` : elle ne
va qu'à l'icône, jamais au texte.

**Les libellés d'action** sont passés à la fabrique, jamais construits à la volée. Ils sont lus
des mois plus tard par quelqu'un qui cherche qui a fait quoi. La forme est **un substantif
d'action, puis le complément avec son article** — « Suppression d'un CV », jamais « Supprimer un
CV » ni « Suppression de CV ». Deux exceptions assumées : les heures sont un pluriel de masse et
se passent d'article, et la corbeille est unique.

Un même libellé ne désigne jamais deux opérations de modules différents. C'est pourquoi le
changement de statut est décliné : lu sans colonne de module, qui n'existe pas à l'écran,
« Changement de statut » ne dit pas s'il s'agit d'un client ou d'une estimation.

```
CRM              Création d’une fiche client
                 Modification d’une fiche client
                 Changement de statut d’un client
                 Ajout d’une interaction
                 Suppression d’une fiche client
                 Restauration d’une fiche client

Banque de CV     Préparation d’un dépôt de CV
                 Dépôt d’un CV
                 Reclassement d’un CV
                 Consultation d’un CV
                 Téléchargement d’un CV
                 Suppression d’un CV
                 Restauration d’un CV
                 Création d’une catégorie de CV
                 Renommage d’une catégorie de CV
                 Réorganisation des catégories de CV
                 Suppression d’une catégorie de CV
                 Purge de la corbeille

Suivi des heures Saisie d’heures
                 Correction d’heures
                 Clôture d’une période
                 Export d’une période d’heures
                 Création d’un employé
                 Modification d’un employé

Calculateur      Création d’une estimation
                 Duplication d’une estimation
                 Émission d’une estimation
                 Changement de statut d’une estimation

Administration   Invitation d’un utilisateur
                 Modification d’un compte
                 Préparation d’un dépôt de logo · Dépôt d’un logo
                 Retrait d’un logo
                 Changement de rôle
                 Suspension d’un compte
                 Réactivation d’un compte
                 Réinitialisation de mot de passe
                 Publication d’une grille de tarifs
                 Modification des paramètres de paie

Hors fabrique    Connexion
                 Échec de connexion
                 Déconnexion
                 Refus d’accès
```

**Restauration d'une fiche client** manquait, et son absence a coûté un écran : CRM-7 exige que
rien ne soit définitivement supprimé et que tout reste restaurable, mais un écran de restauration
ne peut pas exister sans le libellé qui journalise son geste. Une suppression qu'on peut annuler
sans laisser de trace n'est pas une suppression réversible, c'est une suppression discrète.

**Export d'une période d'heures** est le seul libellé de cette liste qui ne consigne pas une
mutation. Il est là parce que l'export est le seul geste de l'application qui fait **sortir des
données nominatives** — noms, taux horaires, montants — vers un fichier que plus personne ne
contrôle ensuite. TR-5 ne l'exigeait pas ; la loi 25 rend la trace nécessaire. L'élément
journalisé est la période exportée.

**Connexion** figure dans les appels directs légitimes décrits par `lib/audit.ts`, mais n'est
consigné nulle part. Une déconnexion sans connexion correspondante rend le journal illisible :
la trace doit exister aux deux bouts.

### Ce que l'on ne fait pas

Pas de photographies, pas d'illustrations, pas d'emoji comme icônes.
Pas de dégradés colorés, sauf les deux voiles à 4 % de l'écran de connexion.
Pas d'ombre sur les cartes.
Pas d'animation d'entrée en cascade.
Pas de défilement infini — de la pagination.
Pas de graphique à deux axes verticaux.
Pas de camembert ni d'anneau.
Pas de couleur d'entreprise en fond de bloc.
Pas de couleur d'état détournée en décoration.
Pas de couleur de série teintée — les deux séries sont des valeurs de gris.
Pas de libellé d'interface inventé sur place : il s'inscrit ici d'abord.
Pas d'énumération sans plafond dans un message.
Pas de plus d'un bouton noir par écran.
Aucune information portée par la couleur seule.
