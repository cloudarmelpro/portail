-- La table venait d'être créée et n'a jamais contenu de ligne : le changement de
-- clé primaire est donc sans risque de perte. Elle passait d'une ligne unique à
-- une ligne par entreprise — Paysagement, Développement web et Staff
-- augmentation sont trois entreprises distinctes, chacune avec ses coordonnées.

-- AlterTable
ALTER TABLE "organisation" DROP CONSTRAINT "organisation_pkey",
DROP COLUMN "id",
ADD COLUMN     "entrepriseSlug" TEXT NOT NULL,
ADD CONSTRAINT "organisation_pkey" PRIMARY KEY ("entrepriseSlug");
