import { FiltresHeures } from '@/components/heures/filtres-heures'
import { NavigationSemaine } from '@/components/heures/navigation-semaine'

/**
 * Navigation de semaine et filtre d'entreprise — les commandes de la saisie.
 *
 * Un composant plutôt que deux appels côte à côte, parce qu'ils sont rendus à
 * DEUX endroits : dans la rangée de la grille quand il y a des employés, seuls
 * au-dessus de l'état vide quand il n'y en a pas. Deux copies auraient divergé
 * à la première retouche, et c'est le cas rare — celui sans employé — qui
 * aurait gardé l'ancienne.
 */
export function CommandesSemaine({
  libelle,
  precedente,
  suivante,
  courante,
  entreprise,
}: {
  libelle: string
  precedente: string
  suivante: string | null
  courante: string | null
  entreprise: string
}) {
  return (
    <>
      <NavigationSemaine
        libelle={libelle}
        precedente={precedente}
        suivante={suivante}
        courante={courante}
      />
      <FiltresHeures entreprise={entreprise} />
    </>
  )
}
