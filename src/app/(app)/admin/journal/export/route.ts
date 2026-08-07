import { NextResponse } from 'next/server'
import { EXPORT_MAX, journalPourExport } from '@/lib/data/admin'
import { sessionCourante } from '@/lib/guards'
import { aPermission, LIBELLE_MODULE, type Module } from '@/lib/permissions'
import { filtresJournalSchema } from '@/lib/validations/admin'
import { estEntreprise, entreprise as entrepriseDe } from '@/config/entreprises'
import { FUSEAU } from '@/config/dates'
import { journaliser, journaliserRefus } from '@/lib/audit'

/**
 * Export CSV du journal d'audit — ADM-4.
 *
 * Une route et non un Server Action : le navigateur doit recevoir un fichier,
 * pas une valeur de retour. Elle ne traverse donc aucun layout et refait
 * elle-même le contrôle de permission.
 */

const HORODATAGE = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: FUSEAU,
})

/**
 * Marque d'ordre des octets. Sans elle, Excel lit le fichier en page de code
 * locale et massacre les accents. Le point-virgule qui sépare les colonnes
 * accompagne ce choix : c'est le séparateur de liste attendu d'une installation
 * francophone.
 */
const BOM = '\u{FEFF}'

const COLONNES = [
  'Horodatage',
  'Utilisateur',
  'Action',
  'Élément',
  'Module',
  'Entreprise',
  'Adresse IP',
]

/**
 * Un tableur interprète une cellule commençant par `=`, `+`, `-` ou `@` comme
 * une formule. Les éléments concernés portent du texte saisi par les
 * utilisateurs — nom de client, nom de fichier : on neutralise l'amorce.
 */
function cellule(valeur: string | null): string {
  const brut = valeur ?? ''
  const sur = /^[=+\-@]/.test(brut) ? `'${brut}` : brut
  return `"${sur.replace(/"/g, '""')}"`
}

export async function GET(requete: Request) {
  const session = await sessionCourante()
  if (!session) return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  if (!aPermission(session.role, 'admin:journal')) {
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'admin',
      entite: 'admin:journal',
    })
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  const url = new URL(requete.url)
  const filtres = filtresJournalSchema.parse(Object.fromEntries(url.searchParams))

  /*
    L'export du journal ne s'inscrivait pas AU journal.

    C'est pourtant le seul geste qui fait sortir le registre d'audit lui-même —
    tous les noms, toutes les actions, toutes les adresses IP. Il est journalisé
    avant d'être construit : après l'envoi, il est trop tard.
  */
  await journaliser({
    userId: session.userId,
    utilisateurNom: session.nom,
    action: 'Export du journal d’audit',
    module: 'admin',
    sensible: true,
  })

  /*
    LES HUIT axes, pas cinq.

    L'entreprise, l'action, l'élément et l'adresse IP étaient validés puis
    oubliés : un export filtré sur l'un d'eux rendait plus de lignes que l'écran
    n'en montrait. La section 19 dit que l'export reprend les mêmes filtres, et
    un fichier plus large que la vue qui l'a demandé est le genre d'écart qu'on
    ne remarque qu'en le relisant — c'est-à-dire jamais.

    `page` est délibérément absent : un export porte sur tout le résultat, pas
    sur la page affichée.
  */
  const entrees = await journalPourExport({
    utilisateur: filtres.utilisateur,
    module: filtres.module,
    entreprise: filtres.entreprise,
    action: filtres.action,
    entite: filtres.entite,
    ip: filtres.ip,
    du: filtres.du,
    au: filtres.au,
    sensible: filtres.sensible,
  })

  const lignes = entrees.map((e) =>
    [
      cellule(HORODATAGE.format(e.horodatage)),
      cellule(e.utilisateur),
      cellule(e.action),
      cellule(e.entite),
      cellule(libelleModule(e.module)),
      cellule(e.entreprise && estEntreprise(e.entreprise) ? entrepriseDe(e.entreprise).nom : null),
      cellule(e.ip),
    ].join(';'),
  )

  // Un export tronqué qui ne le dit pas est un journal qui ment.
  if (entrees.length === EXPORT_MAX) {
    lignes.push(
      cellule(`Export limité aux ${EXPORT_MAX} entrées les plus récentes. Resserrez la période.`),
    )
  }

  /**
   * BOM UTF-8 en tête, sans quoi Excel lit le fichier en page de code locale et
   * massacre les accents. Le point-virgule accompagne ce choix : c'est le
   * séparateur de liste attendu d'une installation francophone.
   */
  const corps = [COLONNES.map(cellule).join(';'), ...lignes].join('\r\n')
  const csv = `${BOM}${corps}\r\n`

  const jour = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="journal-audit-${jour}.csv"`,
      // L'export porte des renseignements sur des personnes : jamais de cache.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

function libelleModule(module: string): string {
  const connu = (Object.keys(LIBELLE_MODULE) as Module[]).find((m) => m === module)
  return connu ? LIBELLE_MODULE[connu] : module
}
