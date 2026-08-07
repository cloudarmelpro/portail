import { AlertCircle, AlertTriangle } from 'lucide-react'
import { BandeChiffres } from '@/components/shared/bande-chiffres'

type Props = {
  aujourdhui: number
  enRetard: number
  soumissions: number
  expirantes: number
}

/**
 * Les quatre regroupements de l'exigence CRM-6, en bande pleine largeur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La bande est celle de `shared/bande-chiffres`. Ce fichier ne décide plus que
 * du CONTENU.
 *
 * Les deux existaient en parallèle : mêmes classes de bande, mêmes tailles de
 * libellé et de valeur, recopiées. Un ajustement de gouttière sur l'un laissait
 * l'autre en arrière, et l'écart ne se voyait qu'en passant de l'administration
 * au CRM — ce que personne ne fait en relisant un diff.
 *
 * Ce qui reste ici est la seule vraie différence : l'administration ne porte
 * aucune couleur d'état, « Suspendus » étant un décompte. Un retard, lui, EST un
 * état, et la section 19 le prévoit nommément en fixant les deux mots.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function TuilesRelances({ aujourdhui, enRetard, soumissions, expirantes }: Props) {
  return (
    <BandeChiffres
      chiffres={[
        { libelle: 'À relancer aujourd’hui', valeur: String(aujourdhui) },
        {
          libelle: 'En retard',
          valeur: String(enRetard),
          /*
            Le mot double le libellé qui le surplombe, et c'est voulu : il reste
            lu quand la couleur ne l'est pas.
          */
          alerte:
            enRetard > 0 ? { jeton: '--critical', icone: AlertTriangle, mot: 'En retard' } : null,
        },
        { libelle: 'Soumissions en attente', valeur: String(soumissions) },
        {
          libelle: 'Estimations expirant sous 7 jours',
          valeur: String(expirantes),
          alerte:
            expirantes > 0 ? { jeton: '--serious', icone: AlertCircle, mot: 'À relancer' } : null,
        },
      ]}
    />
  )
}
