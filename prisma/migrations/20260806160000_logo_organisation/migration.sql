-- Logo d'entreprise en en-tête du document remis au client — EST-10.
--
-- Nullable et sans valeur par défaut : l'absence de logo est l'état normal, et
-- c'est elle qui fait retomber le document sur la marque écrite. Une chaîne
-- vide aurait dit la même chose de deux façons.
--
-- On stocke la CLÉ dans le stockage objet, jamais une URL : une adresse signée
-- expire en cinq minutes, et une adresse permanente ferait servir le fichier
-- par un lien direct — ce que TR-3 interdit.
ALTER TABLE "organisation" ADD COLUMN "logoCle" TEXT;
