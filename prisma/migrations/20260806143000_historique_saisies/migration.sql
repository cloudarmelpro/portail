-- `motif` devient facultatif : la table consigne désormais TOUT changement de
-- valeur d'une saisie, pas seulement les corrections d'après clôture.
--
-- Avant, vider une cellule supprimait la ligne et la valeur antérieure
-- n'existait plus nulle part — TR-9 interdit la disparition définitive. Un motif
-- renseigné signale une correction justifiée ; son absence, une saisie courante.

-- AlterTable
ALTER TABLE "correction_heures" ALTER COLUMN "motif" DROP NOT NULL;
