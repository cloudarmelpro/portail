-- DropIndex
DROP INDEX "categorie_cv_nom_key";

-- AlterTable
ALTER TABLE "categorie_cv" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "supprimeParNom" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "categorie_cv_deletedAt_ordre_idx" ON "categorie_cv"("deletedAt", "ordre");

-- CreateIndex
CREATE INDEX "categorie_cv_nom_idx" ON "categorie_cv"("nom");
