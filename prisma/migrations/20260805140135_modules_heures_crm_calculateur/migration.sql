-- CreateEnum
CREATE TYPE "StatutEstimation" AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('particulier', 'entreprise');

-- CreateEnum
CREATE TYPE "StatutClient" AS ENUM ('prospect', 'contacte', 'soumission_envoyee', 'gagne', 'perdu');

-- CreateEnum
CREATE TYPE "TypeInteraction" AS ENUM ('appel', 'courriel', 'visite', 'soumission');

-- CreateTable
CREATE TABLE "estimation" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT,
    "statut" "StatutEstimation" NOT NULL DEFAULT 'brouillon',
    "fraisDeplacement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "majorationPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "rabaisMontant" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rabaisPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "sousTotal" DECIMAL(12,2) NOT NULL,
    "tps" DECIMAL(12,2) NOT NULL,
    "tvq" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "tauxTps" DECIMAL(7,5) NOT NULL,
    "tauxTvq" DECIMAL(7,5) NOT NULL,
    "grilleId" TEXT,
    "valideJusquau" DATE,
    "emiseLe" TIMESTAMP(3),
    "origineId" TEXT,
    "creeParId" TEXT,
    "creeParNom" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ligne_estimation" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "estimationId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "sousTotal" DECIMAL(12,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ligne_estimation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_estimation" (
    "entrepriseSlug" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_estimation_pkey" PRIMARY KEY ("entrepriseSlug","annee")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "type" "TypeClient" NOT NULL,
    "nom" TEXT NOT NULL,
    "personneRessource" TEXT,
    "courriel" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "provenance" TEXT,
    "notes" TEXT,
    "statut" "StatutClient" NOT NULL DEFAULT 'prospect',
    "motifCloture" TEXT,
    "clotureLe" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "TypeInteraction" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "resume" TEXT NOT NULL,
    "prochaineAction" TEXT,
    "prochaineActionLe" DATE,
    "auteurId" TEXT,
    "auteurNom" TEXT NOT NULL,
    "estimationId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "tauxHoraire" DECIMAL(8,2),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saisie_jour" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heures" DECIMAL(4,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saisie_jour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periode_paie" (
    "id" TEXT NOT NULL,
    "debut" DATE NOT NULL,
    "fin" DATE NOT NULL,
    "cloturee" BOOLEAN NOT NULL DEFAULT false,
    "clotureeLe" TIMESTAMP(3),
    "clotureeParNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "periode_paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_heures" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ancienneValeur" DECIMAL(4,2),
    "nouvelleValeur" DECIMAL(4,2) NOT NULL,
    "motif" TEXT NOT NULL,
    "parId" TEXT,
    "parNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_heures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_paie" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "seuilSupplementaires" DECIMAL(4,2) NOT NULL DEFAULT 40,
    "majoration" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "joursPeriode" INTEGER NOT NULL DEFAULT 14,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametres_paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grille_tarifs" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "ecarts" TEXT[],
    "creeParId" TEXT,
    "creeParNom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grille_tarifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produit_tarif" (
    "id" TEXT NOT NULL,
    "entrepriseSlug" TEXT NOT NULL,
    "grilleId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "prixUnitaire" DECIMAL(12,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "produit_tarif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimation_reference_key" ON "estimation"("reference");

-- CreateIndex
CREATE INDEX "estimation_entrepriseSlug_statut_idx" ON "estimation"("entrepriseSlug", "statut");

-- CreateIndex
CREATE INDEX "estimation_entrepriseSlug_valideJusquau_idx" ON "estimation"("entrepriseSlug", "valideJusquau");

-- CreateIndex
CREATE INDEX "estimation_clientId_idx" ON "estimation"("clientId");

-- CreateIndex
CREATE INDEX "estimation_deletedAt_idx" ON "estimation"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "estimation_entrepriseSlug_annee_numero_key" ON "estimation"("entrepriseSlug", "annee", "numero");

-- CreateIndex
CREATE INDEX "ligne_estimation_estimationId_ordre_idx" ON "ligne_estimation"("estimationId", "ordre");

-- CreateIndex
CREATE INDEX "client_entrepriseSlug_deletedAt_idx" ON "client"("entrepriseSlug", "deletedAt");

-- CreateIndex
CREATE INDEX "client_entrepriseSlug_statut_idx" ON "client"("entrepriseSlug", "statut");

-- CreateIndex
CREATE INDEX "client_entrepriseSlug_nom_idx" ON "client"("entrepriseSlug", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_estimationId_key" ON "interaction"("estimationId");

-- CreateIndex
CREATE INDEX "interaction_clientId_date_idx" ON "interaction"("clientId", "date");

-- CreateIndex
CREATE INDEX "interaction_entrepriseSlug_prochaineActionLe_idx" ON "interaction"("entrepriseSlug", "prochaineActionLe");

-- CreateIndex
CREATE INDEX "interaction_entrepriseSlug_deletedAt_idx" ON "interaction"("entrepriseSlug", "deletedAt");

-- CreateIndex
CREATE INDEX "employe_actif_nom_idx" ON "employe"("actif", "nom");

-- CreateIndex
CREATE INDEX "employe_entrepriseSlug_idx" ON "employe"("entrepriseSlug");

-- CreateIndex
CREATE INDEX "employe_deletedAt_idx" ON "employe"("deletedAt");

-- CreateIndex
CREATE INDEX "saisie_jour_date_idx" ON "saisie_jour"("date");

-- CreateIndex
CREATE UNIQUE INDEX "saisie_jour_employeId_date_key" ON "saisie_jour"("employeId", "date");

-- CreateIndex
CREATE INDEX "periode_paie_cloturee_debut_idx" ON "periode_paie"("cloturee", "debut");

-- CreateIndex
CREATE UNIQUE INDEX "periode_paie_debut_fin_key" ON "periode_paie"("debut", "fin");

-- CreateIndex
CREATE INDEX "correction_heures_employeId_date_idx" ON "correction_heures"("employeId", "date");

-- CreateIndex
CREATE INDEX "correction_heures_createdAt_idx" ON "correction_heures"("createdAt");

-- CreateIndex
CREATE INDEX "grille_tarifs_entrepriseSlug_actif_idx" ON "grille_tarifs"("entrepriseSlug", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "grille_tarifs_entrepriseSlug_numero_key" ON "grille_tarifs"("entrepriseSlug", "numero");

-- CreateIndex
CREATE INDEX "produit_tarif_grilleId_ordre_idx" ON "produit_tarif"("grilleId", "ordre");

-- CreateIndex
CREATE INDEX "produit_tarif_entrepriseSlug_idx" ON "produit_tarif"("entrepriseSlug");

-- AddForeignKey
ALTER TABLE "estimation" ADD CONSTRAINT "estimation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_estimation" ADD CONSTRAINT "ligne_estimation_estimationId_fkey" FOREIGN KEY ("estimationId") REFERENCES "estimation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_estimationId_fkey" FOREIGN KEY ("estimationId") REFERENCES "estimation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saisie_jour" ADD CONSTRAINT "saisie_jour_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "employe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_heures" ADD CONSTRAINT "correction_heures_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "employe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit_tarif" ADD CONSTRAINT "produit_tarif_grilleId_fkey" FOREIGN KEY ("grilleId") REFERENCES "grille_tarifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
