import { NextResponse } from 'next/server'
import { journaliser } from '@/lib/audit'
import { ENTREPRISES } from '@/config/entreprises'
import { effacerFichier, fichiersExpires } from '@/lib/data/cv'
import { expirerEstimationsEchues } from '@/lib/data/estimations'
import { prismaCadre } from '@/lib/prisma'
import { env } from '@/lib/env'
import { supprimerObjet } from '@/lib/storage'

/**
 * Entretien périodique — purge de la corbeille.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pourquoi cette route existe.
 *
 * `purgerCorbeille` était écrite, protégée par permission, marquée sensible et
 * couverte par un test — et appelée par PERSONNE. Aucun bouton, aucune tâche.
 * Conséquence : la corbeille de trente jours n'effaçait rien. Les fichiers
 * supprimés restaient en base et dans le seau, indéfiniment.
 *
 * CV-9 ne dit pas « la corbeille cache pendant trente jours », il dit « avant
 * disparition définitive ». Sans exécution, la seconde moitié de la phrase
 * n'existait pas — et le cahier des charges prévient lui-même qu'une politique
 * de conservation qu'on n'applique pas est plus risquée que pas de politique.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Route et non Server Action : elle est appelée par un planificateur, sans
 * session ni utilisateur. Elle s'authentifie donc par un jeton partagé.
 *
 * À déclencher une fois par jour depuis Coolify :
 *
 *   curl -fsS -X POST https://<domaine>/api/entretien \
 *        -H "Authorization: Bearer $ENTRETIEN_SECRET"
 *
 * Sans `ENTRETIEN_SECRET`, la route répond 404 : un point d'entrée destructeur
 * ne doit pas être joignable sur une installation qui ne l'a pas configuré.
 */
export async function POST(requete: Request) {
  const attendu = env.ENTRETIEN_SECRET
  if (!attendu) return new NextResponse(null, { status: 404 })

  const fourni = requete.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  /*
    Comparaison à longueur constante. La différence de temps entre deux
    comparaisons de chaînes est mesurable sur un réseau, et permet de retrouver
    un jeton caractère par caractère. Le coût de s'en prémunir est nul.
  */
  if (!fourni || !memeJeton(fourni, attendu)) {
    return new NextResponse(null, { status: 404 })
  }

  /*
    EST-13 — les estimations dont la validité est dépassée passent à « Expiré ».

    Sans cela, le statut stocké affirmait qu'une soumission de l'an dernier
    attendait encore une réponse. Une entreprise à la fois : chaque appel doit
    passer par le client cadré, l'extension n'a rien à filtrer autrement.
  */
  let expirees = 0
  for (const e of ENTREPRISES) {
    expirees += await expirerEstimationsEchues(prismaCadre(e.slug))
  }

  const expires = await fichiersExpires()

  let effaces = 0
  const echecs: string[] = []

  for (const f of expires) {
    /*
      L'objet AVANT la ligne. Dans l'autre ordre, un échec de suppression au
      stockage laisserait un objet orphelin que plus aucune ligne ne désigne —
      donc introuvable et impossible à effacer. Ici, l'échec laisse la ligne :
      le fichier reste dans la corbeille et la prochaine passe réessaiera.
    */
    try {
      await supprimerObjet(f.cle)
      await effacerFichier(f.id)
      effaces += 1
    } catch {
      echecs.push(f.id)
    }
  }

  if (effaces > 0 || echecs.length > 0) {
    await journaliser({
      userId: null,
      utilisateurNom: 'Entretien automatique',
      action: 'Purge de la corbeille',
      module: 'cv',
      entite: `${effaces} fichier${effaces > 1 ? 's' : ''} effacé${effaces > 1 ? 's' : ''}`,
      sensible: true,
    })
  }

  return NextResponse.json(
    { effaces, echecs: echecs.length, expirees },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Comparaison à longueur constante, sans dépendre de la longueur des chaînes. */
function memeJeton(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let ecart = 0
  for (let i = 0; i < a.length; i++) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return ecart === 0
}
