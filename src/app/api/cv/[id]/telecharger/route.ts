import { NextResponse } from 'next/server'
import { journaliser, journaliserRefus } from '@/lib/audit'
import { fichierParId } from '@/lib/data/cv'
import { sessionCourante } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { PLAFONDS, cleUtilisateur, limiter } from '@/lib/rate-limit'
import { urlApercu, urlTelechargement } from '@/lib/storage'

/**
 * Téléchargement et aperçu d'un CV.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Aucun fichier n'est JAMAIS servi par l'application ni exposé par une adresse
 * directe. Le parcours est toujours le même :
 *
 *   vérifier la session → vérifier le rôle → journaliser → lien signé → rediriger
 *
 * Le contenu ne traverse pas le serveur : on redirige vers un lien à durée
 * limitée généré par le stockage.
 *
 * Cette route ne passe pas par `createAction` — ce n'est pas une mutation mais
 * une redirection. Elle refait donc à la main ce que la fabrique impose
 * ailleurs : permission, puis journal.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionCourante()
  if (!session) {
    return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  }

  const { id } = await params
  const apercu = new URL(requete.url).searchParams.get('apercu') === '1'
  const permission = apercu ? 'cv:lire' : 'cv:telecharger'

  if (!aPermission(session.role, permission)) {
    /*
      Le refus est journalisé, comme celui d'une garde d'écran ou de la fabrique
      d'actions. Il ne l'était pas : une session compromise qui balayait cette
      route en espérant une permission passait sans laisser une ligne, là où la
      même personne tâtonnant sur un écran en laissait deux. ADM-4 vise les
      tentatives refusées.
    */
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'cv',
      entite: permission,
    })
    // Ne rien révéler : le message est le même que le fichier existe ou non.
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  /*
    Plafond de débit — la seule chose qui séparait une session compromise de la
    banque de CV entière.

    Chaque appel forge un lien signé neuf : sans plafond, une boucle sort tous
    les fichiers en quelques secondes. Le journal en garderait la trace, ce qui
    rend l'extraction constatable APRÈS coup, jamais évitable.

    Le plafond est posé après la permission : un utilisateur sans droit ne doit
    pas pouvoir remplir le compteur de quelqu'un d'autre.
  */
  const verdict = limiter(
    cleUtilisateur('cv:telecharger', session.userId),
    PLAFONDS.telechargementCv.max,
    PLAFONDS.telechargementCv.fenetreSecondes,
  )

  if (!verdict.autorise) {
    return NextResponse.json(
      { erreur: 'Trop de téléchargements. Réessayez dans quelques minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(verdict.secondesAvantReprise) },
      },
    )
  }

  const fichier = await fichierParId(id)
  if (!fichier) {
    /*
      Journalisé aussi : c'est la forme que prend l'ÉNUMÉRATION d'identifiants.
      Un lien périmé en produit une ligne isolée, sans conséquence ; une boucle
      en produit une rafale, que `journaliserRefus` plafonne pour ne pas noyer
      le journal tout en gardant le signal.
    */
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'cv',
      entite: 'fichier introuvable',
    })
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  /**
   * Journalisé AVANT la redirection. Après, l'utilisateur est déjà parti vers le
   * stockage et un échec d'écriture laisserait un accès sans trace — or « qui a
   * consulté quel CV et quand » est précisément l'obligation de ce module.
   */
  await journaliser({
    userId: session.userId,
    utilisateurNom: session.nom,
    action: apercu ? 'Consultation d’un CV' : 'Téléchargement d’un CV',
    module: 'cv',
    entite: fichier.nom,
    sensible: true,
  })

  const url = apercu
    ? await urlApercu(fichier.cle)
    : await urlTelechargement(fichier.cle, fichier.nom)

  return NextResponse.redirect(url, {
    // Le lien expire en cinq minutes : il ne doit jamais être mis en cache.
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
