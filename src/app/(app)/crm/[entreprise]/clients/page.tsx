import type { StatutClient, TypeClient } from '@/generated/prisma/client'
import { BarreFiltres } from '@/components/crm/barre-filtres'
import { DialogueClient } from '@/components/crm/dialogue-client'
import { Pagination } from '@/components/shared/pagination'
import { TableauClients } from '@/components/crm/tableau-clients'
import { EtatVide } from '@/components/shared/etat-vide'
import { TableauVide } from '@/components/shared/tableau'
import { LIBELLE_TYPE_CLIENT, ORDRE_STATUT_CLIENT } from '@/config/crm'
import { CLES_TRI, listerClients, type CleTri } from '@/lib/data/crm'
import { aujourdHui } from '@/lib/domaine/dates'
import { OngletsVue } from '@/components/crm/onglets-crm'
import { aPermission } from '@/lib/permissions'
import { requireEntreprise, requireModule } from '@/lib/guards'
import { prismaCadre } from '@/lib/prisma'

const PAR_PAGE = 10

function premier(v: string | string[] | undefined): string | undefined {
  const brut = Array.isArray(v) ? v[0] : v
  return brut?.trim() || undefined
}

/**
 * CRM-8 — liste des clients.
 *
 * Recherche, filtres, tri et page sont lus dans l'URL puis revalidés : une
 * valeur inconnue est ignorée, jamais transmise à la couche de données. Une
 * vue ainsi décrite se partage par simple copie de l'adresse.
 */
export default async function PageClients({
  params,
  searchParams,
}: PageProps<'/crm/[entreprise]/clients'>) {
  const { entreprise } = await params
  const session = await requireModule('crm')
  const slug = await requireEntreprise(entreprise)
  const peutSupprimer = aPermission(session.role, 'crm:supprimer')
  const sp = await searchParams

  const recherche = premier(sp.q)

  const statutBrut = premier(sp.statut)
  const statut = (ORDRE_STATUT_CLIENT as readonly string[]).includes(statutBrut ?? '')
    ? (statutBrut as StatutClient)
    : undefined

  const typeBrut = premier(sp.type)
  const type = Object.hasOwn(LIBELLE_TYPE_CLIENT, typeBrut ?? '')
    ? (typeBrut as TypeClient)
    : undefined

  const triBrut = premier(sp.tri)
  const tri = (CLES_TRI as readonly string[]).includes(triBrut ?? '') ? (triBrut as CleTri) : 'nom'
  const sens = premier(sp.sens) === 'desc' ? 'desc' : 'asc'
  const page = Number(premier(sp.page) ?? '1')

  const resultat = await listerClients(prismaCadre(slug), {
    recherche,
    statut,
    type,
    tri,
    sens,
    page: Number.isFinite(page) ? page : 1,
    parPage: PAR_PAGE,
  })

  /** Reconduit dans les liens de tri et de pagination : ils ne perdent aucun filtre. */
  const filtres: Record<string, string> = {
    ...(recherche && { q: recherche }),
    ...(statut && { statut }),
    ...(type && { type }),
    tri,
    sens,
  }

  const filtresActifs = Boolean(recherche || statut || type)

  return (
    <div>
      {/*
        Le titre ne s'affiche plus : le fil d'Ariane de l'en-tête nomme déjà
        l'écran. Il RESTE dans le document, en `sr-only` — une page sans `h1` ne
        se parcourt pas par les titres, et c'est le premier moyen de navigation
        d'un lecteur d'écran.
      */}
      <h1 className="sr-only">Clients</h1>

      {/*
        Le contenu est resserré sous les bandes, qui vont d'un bord à l'autre.
        L'écart est délibérément large : c'est lui qui les fait lire comme du
        chrome et ce qui suit comme du contenu.
      */}
      <div className="mt-10 xl:mx-24">
        {/*
          Le choix de vue vit dans la colonne de CONTENU, pas au bord du panneau : il
          commande ce qui suit, donc il partage sa largeur. Poussé à droite, parce
          que la lecture part du contenu à gauche et qu'un commutateur est un geste,
          pas une donnée à lire.
        */}
        <div className="mb-6 flex justify-end">
          <OngletsVue slug={slug} vue="clients" peutSupprimer={peutSupprimer} />
        </div>

        <BarreFiltres nombre={resultat.total} action={<DialogueClient entreprise={slug} />} />

        <div className="mt-4">
          {resultat.lignes.length > 0 ? (
            <TableauClients
              lignes={resultat.lignes}
              entreprise={slug}
              tri={tri}
              sens={sens}
              filtres={filtres}
              jour={aujourdHui()}
            />
          ) : filtresActifs ? (
            /*
              Un filtre sans résultat : il n'y a rien à expliquer et rien à
              créer, donc une seule phrase dans le cadre du tableau. La liste
              répond au lieu de disparaître.
            */
            <TableauVide>
              {recherche ? (
                <>
                  Aucun résultat pour «&nbsp;{recherche}&nbsp;». Ajustez la recherche ou retirez un
                  filtre.
                </>
              ) : (
                <>
                  Aucun client ne correspond à ce filtre. Retirez le filtre pour voir toute la
                  liste.
                </>
              )}
            </TableauVide>
          ) : (
            /* Aucun client du tout : c'est le PREMIER usage, et là il y a
               quelque chose à dire — l'état vide complet est justifié. */
            <EtatVide titre="Aucun client pour cette entreprise" message="Ajoutez le premier." />
          )}
        </div>

        {resultat.pages > 1 && (
          <div className="mt-4">
            {/*
              L'adresse reste ici : elle compose un chemin par entreprise et
              OMET `page` quand elle vaut 1, ce que le journal ne fait pas.
              C'était la seule vraie différence entre les deux paginations.
            */}
            <Pagination
              page={resultat.page}
              pages={resultat.pages}
              lien={(n) => {
                const p = new URLSearchParams(filtres)
                if (n > 1) p.set('page', String(n))
                else p.delete('page')
                const requete = p.toString()
                return requete ? `/crm/${slug}/clients?${requete}` : `/crm/${slug}/clients`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
