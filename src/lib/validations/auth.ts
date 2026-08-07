import { z } from 'zod'

/**
 * Schémas de validation partagés entre le formulaire et la fabrique d'actions.
 * Une seule source de vérité pour les règles de saisie : le client et le serveur
 * ne peuvent pas diverger.
 */

export const connexionSchema = z.object({
  courriel: z
    .string()
    .min(1, 'Saisissez votre courriel.')
    .email('Le format attendu est nom@domaine.ca'),
  motDePasse: z.string().min(1, 'Saisissez votre mot de passe.'),
})
export type ConnexionEntree = z.infer<typeof connexionSchema>

export const motDePasseOublieSchema = z.object({
  courriel: z
    .string()
    .min(1, 'Saisissez votre courriel.')
    .email('Le format attendu est nom@domaine.ca'),
})
export type MotDePasseOublieEntree = z.infer<typeof motDePasseOublieSchema>

export const reinitialisationSchema = z
  .object({
    motDePasse: z.string().min(12, 'Au moins douze caractères.'),
    confirmation: z.string().min(1, 'Confirmez le mot de passe.'),
  })
  // L'erreur est portée par le champ de confirmation : c'est celui que
  // l'utilisateur doit corriger.
  .refine((d) => d.motDePasse === d.confirmation, {
    message: 'Les deux mots de passe diffèrent.',
    path: ['confirmation'],
  })
export type ReinitialisationEntree = z.infer<typeof reinitialisationSchema>

/*
  Trois schémas d'administration vivaient ici, sans appelant, et DIVERGEAIENT de
  ceux de `validations/admin.ts` qui font foi : `changerRoleSchema` prenait un
  `userId` là où le vrai prend un courriel, et `inviterUtilisateurSchema` ne
  mettait pas le courriel en minuscules là où le vrai le fait.

  Or `utilisateurParCourriel` cherche sur `email.toLowerCase()` : importer le
  mauvais aurait fait taire le contrôle de doublon, et « Foo@x.ca » aurait créé
  un second compte pour « foo@x.ca ». Sans barrel file, deux symboles homonymes
  dans l'arbre sont exactement la condition qui produit le mauvais import.

  Ce fichier ne porte plus que les schémas des trois écrans d'authentification.
*/
