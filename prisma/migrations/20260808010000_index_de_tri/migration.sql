-- Cinq index pour les tris qu'aucun index ne couvrait.
--
-- Un audit a compté ce que coûte un affichage : sur cette base, le serveur
-- exécute dix requêtes en 13 ms et chaque aller-retour réseau en coûte 275.
-- Ces index ne changeront donc RIEN aujourd'hui — Postgres ignore un index sur
-- une table de trois lignes et parcourt la table, ce qui est plus rapide.
--
-- Ils sont posés pour le jour où les tables auront grossi. Le motif est le même
-- partout : l'écran FILTRE puis ORDONNE, et l'index existant s'arrêtait au
-- filtre. Sans la colonne de tri, Postgres trie le résultat entier avant de le
-- couper à cinq lignes.
--
-- Aucun index n'est supprimé ici, bien que l'audit en ait signalé cinq comme
-- inutiles. Ajouter un index est sans risque ; en retirer un demande une
-- certitude qu'une lecture du code seule ne donne pas.

-- Les cinq derniers clients ouverts, dossier par dossier — entrée du CRM.
CREATE INDEX "client_entrepriseSlug_createdAt_idx" ON "client" ("entrepriseSlug", "createdAt");

-- Les interactions récentes, même écran. `[clientId, date]` ne sert pas : la
-- lecture ne fixe aucun client.
CREATE INDEX "interaction_entrepriseSlug_date_idx" ON "interaction" ("entrepriseSlug", "date");

-- La liste des estimations : filtre sur le dossier et les vivantes, tri par
-- création décroissante.
CREATE INDEX "estimation_entrepriseSlug_deletedAt_createdAt_idx" ON "estimation" ("entrepriseSlug", "deletedAt", "createdAt");

-- Les soumissions en attente et celles qui périment : même filtre par statut,
-- même tri par date de validité.
CREATE INDEX "estimation_entrepriseSlug_statut_valideJusquau_idx" ON "estimation" ("entrepriseSlug", "statut", "valideJusquau");

-- Le journal d'audit est la seule table qui grossit sans plafond — rien ne
-- l'élague, et c'est voulu : un journal qu'on purge n'est plus une preuve. Ses
-- trois index à une colonne ne servaient que le filtre, jamais le tri qui
-- l'accompagne toujours.
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log" ("userId", "createdAt");
CREATE INDEX "audit_log_module_createdAt_idx" ON "audit_log" ("module", "createdAt");
CREATE INDEX "audit_log_sensible_createdAt_idx" ON "audit_log" ("sensible", "createdAt");
