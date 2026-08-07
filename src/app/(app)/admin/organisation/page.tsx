import { AlertTriangle, Info } from 'lucide-react'
import { ChoixEntreprise } from '@/components/admin/choix-entreprise'
import { composerEntete } from '@/components/calculateur/entete-document'
import { EnTeteAdmin } from '@/components/admin/en-tete-admin'
import { FormulaireOrganisation } from '@/components/admin/formulaire-organisation'
import { LogoOrganisation } from '@/components/admin/logo-organisation'
import {
  ENTREPRISES,
  entreprise as infoEntreprise,
  estEntreprise,
  type EntrepriseSlug,
} from '@/config/entreprises'
import { organisation } from '@/lib/data/admin'
import { requirePermissionEcran } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'
import { urlApercu } from '@/lib/storage'

/**
 * Coordonnées d'une entreprise — EST-10.
 *
 * Elles paraissent en en-tête de chaque estimation qu'elle remet à un client.
 * Tant qu'elles sont vides, le document imprime « Coordonnées à compléter » à la
 * place de l'adresse : impossible d'en envoyer un sans s'en apercevoir.
 *
 * Une entreprise à la fois, comme les grilles de tarifs — les trois sont des
 * entités distinctes, chacune avec sa raison sociale et son adresse.
 */
export default async function PageOrganisation({ searchParams }: PageProps<'/admin/organisation'>) {
  await requirePermissionEcran('admin:organisation')

  const { entreprise } = await searchParams
  // Le slug vient de l'URL : il n'a aucune valeur de preuve. Sans valeur
  // reconnue, on ouvre la première plutôt que d'afficher une erreur.
  const slug: EntrepriseSlug = estEntreprise(entreprise) ? entreprise : ENTREPRISES[0].slug

  const o = await organisation(prismaCadre(slug))

  /*
    L'avertissement est calculé par `composerEntete`, celui-là même qui compose
    l'en-tête du document. Recopier la condition ici la faisait mentir : elle
    comptait la raison sociale, que le document remplace pourtant par le nom de
    l'entreprise. Un bandeau annonçait donc une mention qui n'apparaissait nulle
    part — et on apprend vite à ne plus lire un bandeau qui se trompe.
  */
  const entete = composerEntete(slug, o)
  const sansRaisonSociale = !o.raisonSociale.trim()
  // Signée et valable cinq minutes — TR-3 : aucun fichier n'est servi par une
  // adresse directe, pas même un logo.
  const logoUrl = o.logoCle ? await urlApercu(o.logoCle) : null

  return (
    <div>
      <EnTeteAdmin titre="Organisation" />

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
        <ChoixEntreprise courante={slug} base="/admin/organisation" />

        <section className="mt-8 max-w-[620px]">
          <h2 className="text-[17px] leading-6 font-semibold">Coordonnées</h2>
          <p className="text-ink2 mt-1 text-[15px] leading-[22px]">
            Ces informations paraissent en en-tête de chaque estimation remise à un client. Chaque
            entreprise a les siennes.
          </p>

          {entete.aCompleter ? (
            <p className="border-border bg-hover text-ink2 mt-6 flex items-start gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-[18px]">
              {/* La couleur ne va qu'à l'icône : --warning mesure moins de 3:1
                  sur --surface et ne peut pas porter de texte. */}
              <AlertTriangle className="text-warning-texte mt-px size-4 shrink-0" aria-hidden />
              <span>
                Tant que l’adresse et le téléphone ne sont pas remplis, les estimations imprimées de
                cette entreprise portent la mention «&nbsp;Coordonnées à compléter&nbsp;».
              </span>
            </p>
          ) : (
            sansRaisonSociale && (
              <p className="border-border bg-hover text-ink2 mt-6 flex items-start gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-[18px]">
                <Info className="text-ink3 mt-px size-4 shrink-0" aria-hidden />
                <span>
                  Sans raison sociale, les estimations imprimées portent le nom de l’entreprise.
                  Rien n’est manquant sur le document.
                </span>
              </p>
            )
          )}

          {/*
            La clé remonte l'entreprise : sans elle, passer de Paysagement à
            Développement web garderait la saisie précédente dans des champs
            désormais rattachés à l'autre dossier — et l'enregistrement écrirait
            les coordonnées de l'une sous le nom de l'autre.
          */}
          <div className="mt-6">
            <FormulaireOrganisation
              key={slug}
              entreprise={slug}
              raisonSociale={o.raisonSociale}
              adresse={o.adresse}
              telephone={o.telephone}
              version={o.version}
            />
          </div>
        </section>

        {/*
          Le logo partage la colonne `version` des coordonnées : deux onglets qui
          déposent un logo et corrigent une adresse en même temps se signalent
          mutuellement plutôt que de s'écraser.
        */}
        <section className="border-border mt-12 max-w-[620px] border-t pt-8">
          <LogoOrganisation
            key={slug}
            entreprise={slug}
            logoUrl={logoUrl}
            nomEntreprise={infoEntreprise(slug).nom}
            version={o.version}
          />
        </section>
      </div>
    </div>
  )
}
