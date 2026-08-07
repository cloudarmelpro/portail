# Cahier des charges — Portail

**Application web interne de gestion — CRM, banque de CV, suivi des heures, calculateur d'estimations**

Version 2 · août 2026
Remplace le cahier des charges initial, dont l'historique figure en section 12.

Documents liés : `architecture.MD` (structure du code, règles de sécurité, système de design)
et `technologies.MD` (pile technique et justification des choix).

---

## 1. Objet et contexte

### 1.1 — Le besoin

Le client exploite **trois entreprises distinctes** : Paysagement, Développement web et Staff
augmentation. Sa gestion est aujourd'hui répartie entre des fichiers Excel, des courriels et
des dossiers partagés, sans cloisonnement ni traçabilité.

L'objet du projet est de regrouper quatre outils métier dans une **application web unique,
accessible en ligne, protégée par authentification**, où chaque personne ne voit que ce qui
la concerne.

### 1.2 — Ce que le projet n'est pas

Ce n'est pas un site vitrine. Ce n'est pas un progiciel de gestion. Ce n'est pas un logiciel
de facturation — celle-ci reste dans QuickBooks.

C'est un **outil de travail interne** pour trois personnes, dont la valeur tient autant à son
ergonomie qu'à ses fonctions : un outil interne mal conçu est abandonné au profit d'Excel en
quelques semaines.

### 1.3 — Périmètre

Quatre modules fonctionnels, un module d'administration, et le socle commun d'authentification
et de contrôle d'accès.

---

## 2. Les utilisateurs

Trois personnes, trois rôles, trois périmètres disjoints.

**L'administrateur** — le dirigeant. Accès complet à l'ensemble des modules, plus la gestion
des comptes, des grilles de tarifs et du journal d'audit. Utilise quotidiennement le CRM et le
calculateur.

**Le rôle recrutement** — accès à la banque de CV uniquement. Usage ponctuel : dépôt,
consultation, téléchargement de curriculum vitæ.

**Le rôle gestion des heures** — accès au suivi des heures uniquement. Usage hebdomadaire :
saisie des heures travaillées de l'ensemble des employés.

> **Le système repose sur des rôles, pas sur trois comptes figés.** Chaque rôle peut porter
> plusieurs comptes. L'arrivée d'une seconde recruteuse ou d'une remplaçante ne demande aucune
> intervention technique.

---

## 3. Contraintes générales

**GEN-1** — L'application est accessible depuis n'importe où avec une connexion internet, 24 h
sur 24.

**GEN-2** — Une **page de connexion obligatoire** protège l'intégralité de l'application. La
racine du domaine **est** l'écran de connexion : il n'existe aucune page de présentation
publique.

**GEN-3** — Chaque utilisateur ne voit que les modules autorisés par son rôle. Un module
inaccessible n'apparaît nulle part dans l'interface — jamais grisé, jamais mentionné.

**GEN-4** — Les mots de passe sont chiffrés. Les sessions expirent automatiquement après
inactivité, avec un avertissement deux minutes avant échéance permettant de prolonger.

**GEN-5** — **Seul l'administrateur** crée, modifie, suspend un compte ou réinitialise un mot
de passe. Il n'existe aucune inscription libre.

**GEN-6** — L'interface est en français uniquement. Aucune internationalisation.

**GEN-7** — L'application fonctionne sur ordinateur, tablette et téléphone. La saisie des
heures doit rester utilisable au doigt, sur le terrain.

**GEN-8** — L'application n'est jamais indexée par les moteurs de recherche.

**GEN-9** — Un mode sombre est disponible, construit et non obtenu par inversion.

**GEN-10** — Le domaine est distinct des sites vitrines du client.

> **Le nom de domaine ne constitue pas une protection.** Dès l'émission du certificat SSL,
> il est publié dans les registres publics de transparence des certificats. Ce qui protège
> l'application est l'authentification, la limitation des tentatives de connexion et la durée
> des sessions.

---

## 4. Module — Banque de CV

### 4.1 — Modèle retenu

**Un gestionnaire de fichiers**, sur le modèle explicite d'un Google Drive : déposer, classer,
retrouver, retirer.

Ce n'est **pas** un logiciel de suivi de candidatures. Il n'y a ni statut de candidat, ni
pipeline de recrutement, ni notes d'entrevue.

### 4.2 — Contexte d'usage

Le module sert au **recrutement offshore de l'activité Staff augmentation**, auprès d'une
agence située à Madagascar. Les postes recherchés relèvent du numérique et du service à la
clientèle.

### 4.3 — Exigences

**CV-1** — Stockage de curriculum vitæ aux formats **PDF, DOC et DOCX**, jusqu'à 10 Mo par
fichier. Le type réel du fichier est vérifié côté serveur, pas seulement son extension.

**CV-2** — Classement par **catégories de poste** : Développeur, Monteur vidéo, Gérant,
Gestionnaire de résultat, Designer, Support client. La liste est modifiable par
l'administrateur. Aucune autre famille de classement.

**CV-3** — Un même CV peut appartenir à **plusieurs catégories**. À l'écran, les catégories se
présentent comme des dossiers ; en base, ce sont des étiquettes — ce qui évite la duplication
des fichiers.

**CV-4** — Deux dossiers systématiques : _Tous les CV_ et _Non classé_.

**CV-5** — **Aperçu du document sans téléchargement**, avec navigation précédent/suivant au
clavier dans la liste en cours. Sans cette fonction, la consultation de vingt candidatures
impose vingt téléchargements.

**CV-6** — Téléversement par glisser-déposer, avec affectation des catégories au lot.

**CV-7** — Recherche par nom de fichier.

**CV-8** — Téléchargement accessible aux deux rôles autorisés. **La suppression est réservée à
l'administrateur.**

**CV-9** — Un fichier supprimé transite par une **corbeille de 30 jours** avant disparition
définitive.

**CV-10** — **Aucune suppression automatique.** Un curriculum vitæ n'est jamais effacé par le
système, quel que soit son âge. Seul l'administrateur supprime, et sa suppression passe par la
corbeille de trente jours (CV-9).

Un dossier système _Plus de 24 mois_, visible de l'administrateur, regroupe les CV les plus
anciens avec leur date de dépôt. C'est un **repère**, pas une échéance : rien ne se produit à
son franchissement.

> **Décision du client, août 2026.** La version précédente de cette exigence annonçait une
> « conservation limitée à 24 mois ». Elle ne venait pas du cahier initial mais d'une
> proposition faite lors de la démonstration du prototype — voir section 12.2. Le client l'a
> écartée : les curriculum vitæ sont conservés sans limite de durée.
>
> La formulation a donc été reprise pour que le document dise ce que le produit fait. Une
> politique de conservation affichée mais jamais appliquée est plus risquée que pas de
> politique du tout ; c'est vrai dans les deux sens, et c'est pourquoi l'écran ne promet plus
> une suppression qui n'a pas lieu.
>
> **Conséquence à porter à la connaissance du client** : conserver des renseignements
> personnels sans durée définie est un choix qui l'engage vis-à-vis des personnes concernées.
> Il relève de sa politique de confidentialité, au même titre que l'hébergement hors du Canada
> (PO-3), et non du logiciel.

---

## 5. Module — Suivi des heures

### 5.1 — Exigences de saisie

**HEU-1** — Une **fiche par employé** : nom, entreprise de rattachement, taux horaire, statut
actif ou inactif.

**HEU-2** — **Grille de saisie hebdomadaire** : les employés en lignes, les sept jours en
colonnes, les totaux calculés en direct. La saisie doit être intégralement pilotable au
clavier — tabulation, entrée, flèches — sans recours à la souris.

**HEU-3** — Un bouton **Copier la semaine précédente** recopie les heures de la semaine
antérieure sur l'ensemble des employés actifs, avec confirmation si la semaine affichée
contient déjà des saisies.

> Les horaires se répètent. Sans cette fonction, la gérante ressaisit soixante cellules chaque
> semaine ; avec elle, elle en corrige trois.

**HEU-4** — À l'enregistrement, si un employé actif n'a **aucune heure sur toute la semaine**,
une confirmation s'affiche **en le nommant**. Le nom permet de distinguer immédiatement un
oubli de saisie d'une absence réelle.

**HEU-5** — Le total franchissant **40 heures par semaine** est signalé visuellement, avec
icône et non par la couleur seule.

### 5.2 — Calcul et paie

**HEU-6** — **Compilation automatique** des heures totales par employé et par période.

**HEU-7** — Calcul des **heures supplémentaires** au-delà de 40 heures hebdomadaires, majorées
à 1,5 fois le taux normal, conformément à la norme québécoise. Le seuil et le taux restent
paramétrables.

**HEU-8** — Calcul du montant en dollars à partir du taux horaire de l'employé. Si les taux ne
sont pas renseignés, seules les heures sont totalisées.

**HEU-9** — **Période de paie aux deux semaines** par défaut, paramétrable.

**HEU-10** — **Clôture de période.** Après clôture, la grille passe en lecture seule. Une
correction reste possible mais exige un motif et laisse une trace nominative avec la valeur
antérieure.

**HEU-11** — **Export Excel** de la période : détail par employé et par jour, totaux réguliers
et supplémentaires, montants.

### 5.3 — Hors périmètre

La gestion des congés, des absences et des jours fériés n'est pas retenue. Une note sur
l'entrée du jour suffit à documenter une absence.

---

## 6. Module — CRM

### 6.1 — Cloisonnement

**CRM-1** — Le module est **réservé à l'administrateur**.

**CRM-2** — Les données sont **cloisonnées par entreprise** : Paysagement, Développement web,
Staff augmentation. Aucun mélange n'est possible entre les trois dossiers.

> Ce cloisonnement est une garantie structurelle, pas une convention d'affichage : une requête
> portant sur une entreprise ne peut pas retourner les données d'une autre.

### 6.2 — Exigences

**CRM-3** — Fiche client : particulier ou entreprise, personne-ressource, courriel, téléphone,
adresse, provenance du contact, notes libres.

**CRM-4** — **Chronologie des interactions**, du plus récent au plus ancien : type — appel,
courriel, visite, soumission —, date, résumé, et **prochaine action prévue avec sa date**.
Ajout rapide depuis la fiche.

**CRM-5** — **Cinq statuts** de suivi : Prospect, Contacté, Soumission envoyée, Gagné, Perdu.
Le passage à Gagné ou Perdu exige une confirmation et un motif.

**CRM-6** — **Tableau de bord des relances**, écran d'accueil du module : à relancer
aujourd'hui, relances en retard, soumissions en attente, estimations expirant sous sept jours.
Les retards apparaissent en tête.

**CRM-7** — Création, modification et suppression d'une fiche. Aucune suppression n'est
définitive : les enregistrements sont marqués supprimés et restent restaurables.

**CRM-8** — Liste des clients avec recherche, filtres par statut et par type, tri par colonne
et pagination.

---

## 7. Module — Calculateur d'estimations

### 7.1 — Nature de l'outil

**Une calculette utilisée pendant un appel téléphonique**, pour qualifier un prospect en
direct. Sa qualité première est la rapidité, pas l'exhaustivité.

Ce n'est pas un moteur de soumission. La facturation et les contrats se font dans QuickBooks,
hors de cette application. L'interface parle d'**estimations**, jamais de devis.

### 7.2 — Exigences de calcul

**EST-1** — Composition par **lignes** : produit, prix unitaire, quantité avec son unité,
sous-total. La touche entrée ajoute une ligne et y place le curseur.

**EST-2** — Ajustements : frais de déplacement, majorations, rabais en montant ou en
pourcentage.

**EST-3** — Calcul et affichage séparés de la **TPS et de la TVQ**, puis du total.

**EST-4** — Le total se met à jour à chaque frappe, sans rechargement.

**EST-5** — Chaque entreprise dispose de **ses propres produits et unités**. La mécanique de
calcul est identique pour les trois — un seul moteur, trois grilles.

### 7.3 — Enregistrement au dossier client

**EST-6** — Le choix du client n'est **pas** une condition de départ. On calcule immédiatement.
Le rattachement est une action de fin.

> Pendant un appel de qualification, le client n'existe souvent pas encore dans le CRM. Exiger
> de le sélectionner d'abord rendrait l'outil inutilisable dans son usage réel.

**EST-7** — Le bouton _Enregistrer au dossier client_ propose de **rechercher un client
existant** ou d'en **créer un** avec deux champs seulement, nom et téléphone.

**EST-8** — Une case _Marquer le client comme contacté_, cochée par défaut, n'agit que si le
client est encore au statut Prospect. **Aucun statut ne change automatiquement.**

**EST-9** — L'estimation enregistrée apparaît dans la chronologie du client avec son montant.

### 7.4 — Documents et suivi

**EST-10** — **Aperçu et export PDF** portant le logo et les coordonnées de l'entreprise
concernée, jamais celles de l'application. Numérotation séquentielle par entreprise.

**EST-11** — **Duplication** d'une estimation existante — le cas le plus fréquent est la
révision. L'original n'est jamais modifié.

**EST-12** — Une estimation émise est **figée**. Une modification ultérieure des tarifs ne la
change jamais rétroactivement.

**EST-13** — Statuts : Brouillon, Envoyé, Accepté, Refusé, Expiré. Validité de 30 jours par
défaut.

**EST-14** — **Export CSV à la nomenclature QuickBooks** pour reprise dans la facturation.

---

## 8. Module — Administration

**ADM-1** — **Gestion des comptes** : création par invitation — l'utilisateur choisit son mot
de passe lui-même —, modification, attribution du rôle, **suspension**.

> Un compte n'est jamais supprimé, seulement suspendu : une suppression ferait disparaître
> l'auteur des entrées du journal d'audit.

**ADM-2** — **Grilles de tarifs** modifiables par entreprise, sans intervention technique. Les
prix évoluent : le client doit pouvoir les ajuster seul.

**ADM-3** — Les grilles sont **versionnées**. Chaque enregistrement crée une nouvelle version
horodatée ; l'historique reste consultable avec les écarts. Une grille n'est jamais modifiée
en place.

**ADM-4** — **Journal d'audit** consultable et filtrable : horodatage, utilisateur, action,
élément concerné, entreprise, adresse IP. Export CSV.

---

## 9. Exigences transverses

### 9.1 — Sécurité

**TR-1** — Contrôle d'accès vérifié à chaque opération, et non seulement à l'affichage des
écrans.

**TR-2** — Limitation du nombre de tentatives de connexion.

**TR-3** — Les fichiers ne sont **jamais accessibles par une adresse directe**. Chaque
téléchargement passe par un lien temporaire généré après vérification de la session et du rôle.

**TR-4** — Les messages d'erreur d'authentification sont **identiques** que le compte existe ou
non, afin de ne pas révéler quelles adresses possèdent un accès.

### 9.2 — Traçabilité et conservation

**TR-5** — Toute opération modifiant des données est **journalisée**, ainsi que toute
consultation ou tout téléchargement de CV.

**TR-6** — Durées de conservation, différenciées par nature de donnée :
registres d'heures **3 ans** · registre de paie **6 ans**.

Ce sont des durées **minimales** de conservation, imposées par la norme du travail : rien ne
doit les effacer avant terme. Les curriculum vitæ n'y figurent plus — voir CV-10, le client a
écarté toute limite de durée pour eux.

**TR-7** — Les fichiers et la base de données sont hébergés **hors du Canada**,
vraisemblablement aux États-Unis. Ni Cloudflare R2 ni Neon n'offrent de garantie de résidence
canadienne.

> C'est une **décision assumée et cohérente** : plutôt qu'une base à l'étranger et des fichiers
> au Canada — demi-mesure qui ne protégeait rien de plus tout en compliquant le discours —,
> l'ensemble des données relève du même régime. Un seul accord écrit du client le couvre, et
> une seule mention suffit dans sa politique de confidentialité.
>
> Le transfert transfrontalier est permis, à condition d'être documenté et porté à la
> connaissance des personnes concernées. Voir PO-3.

> **Régime applicable à confirmer.** La loi 25 s'applique au Québec ; le régime fédéral
> (LPRPDE) s'applique ailleurs au Canada. La province d'exploitation des trois entreprises doit
> être confirmée, ainsi que l'acceptation écrite du client concernant l'hébergement de la base
> de données hors du Canada.

### 9.3 — Justesse des données

**TR-8** — Les montants et les durées ne sont jamais représentés en nombres à virgule
flottante.

**TR-9** — Aucune suppression définitive : les enregistrements sont marqués supprimés et
restent restaurables.

**TR-10** — Protection contre l'écrasement silencieux lorsqu'un même enregistrement est modifié
depuis deux onglets.

### 9.4 — Ergonomie et accessibilité

**TR-11** — **Palette de commandes** au clavier permettant d'atteindre tout écran, client,
employé, fichier ou estimation, dans les limites du rôle.

**TR-12** — Écrans de chargement, d'erreur et d'état vide traités dans chaque module.

**TR-13** — Sauvegarde automatique des saisies en cours sur les formulaires longs.

**TR-14** — Contraste, navigation clavier complète, focus visible, respect de la préférence de
mouvement réduit. **Aucune information portée par la couleur seule.**

---

## 10. Hors périmètre

Explicitement écartés, et documentés comme tels :

La **facturation et les contrats**, assurés par QuickBooks. L'**intégration automatique à
QuickBooks** — seul un export CSV est fourni. L'**acceptation en ligne des estimations** par le
client. L'**estimation par taux de production**, retenue par les logiciels du secteur mais
contraire au besoin de rapidité exprimé. Le **suivi de candidatures** — statuts, pipeline,
notes d'entrevue. La **gestion des congés et des absences**. Le **temps réel** entre
utilisateurs, sans objet puisque chacun travaille dans un module distinct.
L'**internationalisation**. Toute **page publique**.

---

## 11. Technologies et architecture

Le cahier des charges initial imposait PHP, MySQL et l'hébergement mutualisé Hostinger. Ces
contraintes ont été levées d'un commun accord au profit d'une pile moderne, sans dépendance à
un fournisseur propriétaire.

**Application** — Next.js 16, TypeScript strict, Tailwind CSS v4, shadcn/ui.
**Authentification** — Better Auth, auto-hébergée, avec rôles et permissions.
**Données** — PostgreSQL infogéré chez Neon, accès par Prisma.
**Fichiers** — Cloudflare R2 (API compatible S3), bucket privé, accès par liens temporaires.
Développement local sur MinIO, même API.
**Hébergement** — VPS Hostinger sous Ubuntu, déploiement par Coolify.
**Services** — Resend pour les courriels, Sentry pour le suivi des erreurs.

Le détail et la justification de chaque choix figurent dans `technologies.MD` ; la structure du
code, les règles de sécurité et le système de design dans `architecture.MD`.

---

## 12. Historique et évolutions

### 12.1 — Ce que demandait le cahier initial

Une application web à quatre modules — CRM cloisonné par entreprise, banque de CV, suivi des
heures, calculateur de prix —, protégée par un login, avec trois rôles et une gestion des
comptes réservée à l'administrateur. Contraintes techniques : PHP, MySQL, hébergement Hostinger
mutualisé, fichiers stockés sur l'espace disque du forfait.

### 12.2 — Ce qui a changé, et pourquoi

**La pile technique.** Abandon de PHP, MySQL et de l'hébergement mutualisé. Un outil visant une
qualité d'exécution élevée demandait un socle capable de la porter.

**Le stockage des fichiers.** Un stockage objet compatible S3 remplace l'espace disque du forfait, avec
accès privé et traçabilité — conséquence directe du caractère personnel des données contenues
dans un CV.

**Le calculateur.** Redéfini par le client après démonstration : une calculette de
qualification, et non un moteur de soumission. Le flux a été inversé — on calcule d'abord, on
rattache au dossier ensuite.

**La banque de CV.** Recentrée sur le recrutement offshore de l'activité Staff augmentation,
avec des catégories par poste.

**Ajouts issus de la démonstration du prototype**, absents du cahier initial : copie de la
semaine précédente, aperçu des CV, tableau de bord des relances, journal d'audit, gestion de la
conservation, versionnement des grilles de tarifs, export QuickBooks.

### 12.3 — Ce qui a été proposé et refusé

L'authentification par Google ou Microsoft, reportée faute de connaître le fournisseur de
courriel du client. L'estimation par taux de production. L'intégration automatique à QuickBooks.

---

## 13. Points ouverts

Aucun ne bloque le développement.

**PO-1** — Nom de l'application et logos des trois entreprises. Un nom provisoire est en place,
modifiable à un seul endroit.

**PO-2** — Province d'exploitation, pour déterminer le régime applicable en matière de
renseignements personnels.

**PO-3** — Accord écrit du client sur l'hébergement **de l'ensemble des données** — base et
fichiers — hors du Canada, et mention correspondante dans sa politique de confidentialité.

**PO-4** — Alignement des noms d'articles entre QuickBooks et les grilles de tarifs, afin de
rendre triviale une éventuelle intégration future.

**PO-5** — Le registre d'heures québécois prévoit l'enregistrement des heures de début,
d'interruption et de fin, là où le module retient un total quotidien. À valider avec le
comptable du client.

**PO-6** — Fournisseur de courriel professionnel, pour décider de l'authentification externe.

---

## 14. Ordre de réalisation

**Socle** — authentification, rôles et permissions, gardes d'accès, cloisonnement par
entreprise, ossature applicative, gestion des comptes, journal d'audit. Rien n'est livrable
sans cette étape, et tout en dépend. Elle doit être complète **avant** le premier module.

**Banque de CV** — le plus simple depuis le recentrage. Introduit le stockage de fichiers et la
traçabilité des consultations.

**Suivi des heures** — immédiatement utile, périmètre stable.

**CRM** — le plus gros volume d'écrans. Premier usage réel du cloisonnement.

**Calculateur d'estimations** — en dernier, car il réutilise le cloisonnement du CRM et dépend
des grilles de tarifs du client.

Chaque module est mis en ligne dès qu'il est prêt.
