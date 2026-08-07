import { NextResponse } from 'next/server'
import { nomFichierPdf, rendreEstimationPdf } from '@/components/calculateur/pdf-estimation'
import { organisation } from '@/lib/data/admin'
import { estimationParId } from '@/lib/data/estimations'
import { sessionCourante } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { prismaCadre } from '@/lib/prisma'
import { lireObjet } from '@/lib/storage'
import { estEntreprise } from '@/config/entreprises'
import { journaliser, journaliserRefus } from '@/lib/audit'

/**
 * Export PDF d'une estimation — exigence EST-10.
 *
 * Le document est composé par le SERVEUR, à partir de ce que la base a figé. La
 * capture d'écran d'un navigateur dépendait de la fenêtre, du zoom et du thème
 * de la personne qui imprimait ; deux exemplaires du même devis n'étaient pas le
 * même papier.
 *
 * Cette route ne passe pas par `createAction` — elle ne mute rien. Elle refait
 * donc à la main ce que la fabrique impose ailleurs : session, puis permission,
 * puis validation du slug. `estimationParId` reçoit le client cadré : une
 * estimation d'une autre entreprise n'y répond pas, même avec le bon `id`.
 */
export async function GET(
  _requete: Request,
  contexte: RouteContext<'/calculateur/[entreprise]/estimations/[id]/pdf'>,
) {
  const session = await sessionCourante()
  if (!session) {
    return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  }

  // Les refus des routes ne laissaient aucune trace, contrairement à ceux des
  // gardes d'écran et de la fabrique d'actions. ADM-4 vise les tentatives
  // refusées autant que les gestes aboutis.
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

  const { entreprise, id } = await contexte.params
  if (!estEntreprise(entreprise)) {
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'calculateur',
      entite: entreprise,
    })
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  const db = prismaCadre(entreprise)
  const estimation = await estimationParId(db, id)
  if (!estimation) {
    return NextResponse.json({ erreur: 'Cette page n’existe pas.' }, { status: 404 })
  }

  /*
    Journalisé AVANT de composer le document : il fait sortir de l'application
    un dossier client complet — nom, adresse, téléphone, montants. C'est le
    raisonnement de l'export des heures, qui n'avait pas été appliqué ici.
  */
  await journaliser({
    userId: session.userId,
    utilisateurNom: session.nom,
    action: 'Export d’une estimation en PDF',
    module: 'calculateur',
    entite: estimation.reference,
    entrepriseSlug: entreprise,
    sensible: true,
  })

  const o = await organisation(db)

  /*
    Le logo est lu ICI, pas dans le composant : celui-ci est rendu hors de toute
    requête, et une lecture réseau à l'intérieur du rendu ferait échouer le
    document entier sur un seau momentanément injoignable. `lireObjet` rend
    `null` plutôt que de lever — un devis doit pouvoir sortir sans son logo.
  */
  const pdf = await rendreEstimationPdf({
    slug: entreprise,
    estimation,
    organisation: o,
    logo: o.logoCle ? await lireObjet(o.logoCle) : null,
  })

  // Le `Blob` n'est pas une coquetterie : c'est la seule forme binaire que le
  // type du corps de réponse accepte des deux côtés, Node et Web.
  return new NextResponse(new Blob([pdf], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      // En pièce jointe : le geste qui suit est de joindre le fichier à un
      // courriel, pas de le relire — l'aperçu est déjà à l'écran.
      'Content-Disposition': `attachment; filename="${nomFichierPdf(estimation.reference)}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
