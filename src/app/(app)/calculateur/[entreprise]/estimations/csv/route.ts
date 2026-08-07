import { NextResponse } from 'next/server'
import { estimationsPourExport } from '@/lib/data/estimations'
import { dateFichier, dateFichierSeule } from '@/lib/domaine/estimation'
import { sessionCourante } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'
import { estEntreprise } from '@/config/entreprises'
import { journaliser, journaliserRefus } from '@/lib/audit'

/**
 * Export CSV à la nomenclature QuickBooks — exigence EST-14.
 *
 * Une ligne par ligne de service, le client répété : c'est la forme qu'Intuit
 * importe. Portail reste la source de vérité des prix ; il n'y a pas
 * d'intégration par API, et c'est un choix (voir architecture.MD, section 9).
 *
 * Cette route ne passe pas par `createAction` — elle ne mute rien. Elle refait
 * donc à la main ce que la fabrique impose ailleurs : session, puis permission.
 */

const COLONNES = [
  'Customer',
  'Estimate No',
  'Estimate Date',
  'Expiration Date',
  'Product/Service',
  'Description',
  'Qty',
  'Rate',
  'Amount',
  'Taxable',
]

/**
 * ─────────────────────────────────────────────────────────────────────────
 * POINT décimal, et non virgule.
 *
 * Le fichier était formaté pour Excel en français — virgule décimale, séparateur
 * point-virgule. Mais sa cible annoncée est QuickBooks, qui attend un point :
 * « 1234,5 » y est rejeté, ou pire, lu comme 12345.
 *
 * Le séparateur de colonnes reste le point-virgule, ce qui évite l'ambiguïté
 * avec la virgule des nombres et convient aussi à un Excel francophone si
 * quelqu'un veut relire le fichier.
 * ─────────────────────────────────────────────────────────────────────────
 */
function nombreCsv(valeur: number): string {
  return valeur.toFixed(2)
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * L'apostrophe devant `=`, `+`, `-` et `@` n'est pas une coquetterie.
 *
 * Ces quatre caractères ouvrent une FORMULE dans Excel. Le nom d'un client
 * vient du CRM, où il est librement saisi : un nom commençant par `=` devient
 * une formule que le tableur exécute à l'ouverture. Le fichier part chez le
 * comptable, qui n'a aucune raison de s'en méfier.
 *
 * `admin/journal/export/route.ts` fait de même. Les deux exports ont été écrits
 * séparément, et un seul des deux traitait le cas.
 * ─────────────────────────────────────────────────────────────────────────
 */
function cellule(valeur: string): string {
  const sur = /^[=+\-@]/.test(valeur) ? `'${valeur}` : valeur
  return `"${sur.replace(/"/g, '""')}"`
}

export async function GET(
  _requete: Request,
  contexte: RouteContext<'/calculateur/[entreprise]/estimations/csv'>,
) {
  const session = await sessionCourante()
  if (!session) {
    return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  }

  /*
    Les refus des ROUTES ne laissaient aucune trace, contrairement à ceux des
    gardes d'écran et de la fabrique d'actions. ADM-4 vise les tentatives
    refusées : une session compromise qui balaie les exports en espérant une
    permission passait sans une ligne, là où la même personne tâtonnant sur un
    écran en laissait deux.
  */
  if (!aPermission(session.role, 'calculateur:lire')) {
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'calculateur',
      entite: 'calculateur:lire',
    })
    // Ne rien révéler : le message est le même que l'entreprise existe ou non.
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  const { entreprise } = await contexte.params
  if (!estEntreprise(entreprise)) {
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'calculateur',
      entite: entreprise,
    })
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  /*
    Journalisé AVANT de construire le fichier, comme l'export des heures : ce
    geste fait SORTIR de l'application le nom de chaque client et chaque montant
    d'une entreprise. Il manquait, et une revue de sécurité aurait vu les
    téléchargements de CV sans jamais voir partir le carnet clients.
  */
  await journaliser({
    userId: session.userId,
    utilisateurNom: session.nom,
    action: 'Export des estimations',
    module: 'calculateur',
    entrepriseSlug: entreprise,
    sensible: true,
  })

  const estimations = await estimationsPourExport(prismaCadre(entreprise))

  const lignes = [COLONNES]
  for (const estimation of estimations) {
    const entete = [
      estimation.clientNom,
      estimation.reference,
      dateFichier(estimation.date),
      estimation.valideJusquau ? dateFichierSeule(estimation.valideJusquau) : '',
    ]

    for (const ligne of estimation.lignes) {
      lignes.push([
        ...entete,
        ligne.designation,
        `${ligne.designation} (${ligne.unite})`,
        nombreCsv(ligne.quantite),
        nombreCsv(ligne.prixUnitaire),
        nombreCsv(ligne.sousTotal),
        'Yes',
      ])
    }

    /*
      ─────────────────────────────────────────────────────────────────────
      Une ligne de réconciliation, pour que le fichier totalise le bon montant.

      Le fichier ne portait que les lignes de service : ni frais de déplacement,
      ni majoration, ni rabais. La somme importée différait donc du montant que
      le client a reçu — moins s'il y avait des frais, plus s'il y avait un
      rabais. Et l'écart était INVISIBLE : le fichier avait l'air complet, chaque
      ligne était cohérente, seul le total ne correspondait plus. C'est le genre
      d'erreur qu'on découvre en rapprochant la facturation trois mois plus tard.

      Le montant est l'écart entre le sous-total ÉMIS et la somme des lignes,
      plutôt qu'une reconstitution des quatre ajustements. La différence compte :
      une reconstitution refait l'arithmétique du domaine — ordre d'application,
      assiettes, arrondis — et peut en diverger sans que rien ne le signale. Ici,
      le fichier totalise le montant émis par construction, quoi que fasse le
      domaine.

      Le libellé énumère les ajustements appliqués : le comptable doit pouvoir
      lire d'où vient l'écart, pas seulement le constater.
      ─────────────────────────────────────────────────────────────────────
    */
    const sommeLignes = estimation.lignes.reduce((t, l) => t + l.sousTotal, 0)
    const ecart = Math.round((estimation.sousTotal - sommeLignes) * 100) / 100

    if (ecart !== 0) {
      const parts: string[] = []
      if (estimation.fraisDeplacement > 0) parts.push('frais de déplacement')
      if (estimation.majorationPct > 0) parts.push(`majoration ${estimation.majorationPct} %`)
      if (estimation.rabaisMontant > 0) parts.push('rabais')
      if (estimation.rabaisPct > 0) parts.push(`rabais ${estimation.rabaisPct} %`)

      const designation = parts.length > 0 ? `Ajustements — ${parts.join(', ')}` : 'Ajustements'

      lignes.push([
        ...entete,
        'Ajustements',
        designation,
        '1.00',
        nombreCsv(ecart),
        nombreCsv(ecart),
        'Yes',
      ])
    }
  }

  /**
   * Point-virgule et marque d'ordre : sans elles, Excel en français ouvre le
   * fichier sur une seule colonne et transforme les accents en charabia.
   */
  const contenu = `\uFEFF${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`
  const nomFichier = `estimations_${entreprise}_${dateFichier(new Date())}.csv`

  return new NextResponse(contenu, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
