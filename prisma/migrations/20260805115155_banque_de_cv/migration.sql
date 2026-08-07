-- CreateTable
CREATE TABLE "categorie_cv" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorie_cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichier_cv" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "typeMime" TEXT NOT NULL,
    "deposeParId" TEXT,
    "deposeParNom" TEXT NOT NULL,
    "deposeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "supprimeParNom" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fichier_cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FichierCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FichierCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorie_cv_nom_key" ON "categorie_cv"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "fichier_cv_cle_key" ON "fichier_cv"("cle");

-- CreateIndex
CREATE INDEX "fichier_cv_deletedAt_idx" ON "fichier_cv"("deletedAt");

-- CreateIndex
CREATE INDEX "fichier_cv_deposeLe_idx" ON "fichier_cv"("deposeLe");

-- CreateIndex
CREATE INDEX "fichier_cv_nom_idx" ON "fichier_cv"("nom");

-- CreateIndex
CREATE INDEX "_FichierCategories_B_index" ON "_FichierCategories"("B");

-- AddForeignKey
ALTER TABLE "_FichierCategories" ADD CONSTRAINT "_FichierCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categorie_cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FichierCategories" ADD CONSTRAINT "_FichierCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "fichier_cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
