import { EnTeteAdmin } from '@/components/admin/en-tete-admin'
import { FormulairePaie } from '@/components/admin/formulaire-paie'
import { parametresPaie } from '@/lib/data/admin'
import { requirePermissionEcran } from '@/lib/guards'

/** Paramètres de paie — HEU-7 et HEU-9. Réservés à l'administrateur. */
export default async function PagePaie() {
  await requirePermissionEcran('heures:parametres')
  const parametres = await parametresPaie()

  return (
    <div>
      <EnTeteAdmin titre="Paramètres de paie" />

      {/*
        Le contenu part du même axe que le chrome — fil d'Ariane, onglets, bande
        de chiffres. Les cinq écrans de l'administration le partagent : deux
        onglets du même module qui ne s'alignent pas se voient au premier
        aller-retour entre les deux.

        L'écart avec les bandes reste délibérément large : c'est lui qui les fait
        lire comme du chrome et ce qui suit comme du contenu. Serré, tout se
        confondait en une seule pile de rangées.
      */}
      <div className="mt-10">
        <FormulairePaie parametres={parametres} />
      </div>
    </div>
  )
}
