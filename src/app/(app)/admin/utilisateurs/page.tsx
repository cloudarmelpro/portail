import { EnTeteAdmin } from '@/components/admin/en-tete-admin'
import { BandeChiffres, type Chiffre } from '@/components/shared/bande-chiffres'
import { DialogueUtilisateur } from '@/components/admin/dialogue-utilisateur'
import { FiltreSuspendus } from '@/components/admin/filtre-suspendus'
import { RechercheUtilisateurs } from '@/components/admin/recherche-utilisateurs'
import { TableauUtilisateurs, type LigneUtilisateur } from '@/components/admin/tableau-utilisateurs'
import { EtatVide } from '@/components/shared/etat-vide'
import { TableauVide } from '@/components/shared/tableau'
import { listerUtilisateurs } from '@/lib/data/admin'
import { requirePermissionEcran } from '@/lib/guards'
import { FUSEAU } from '@/config/dates'

/**
 * Gestion des comptes — ADM-1.
 *
 * L'horodatage est rendu au fuseau du Québec, pas à celui du serveur : « dernière
 * connexion à 3 h 12 » désignerait sinon un moment que personne n'a vécu.
 */
const HORODATAGE = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: FUSEAU,
})

/**
 * Comparaison indifférente à la casse ET aux accents : « bedard » doit trouver
 * « Bédard ». Sans cela, la recherche échoue précisément sur les noms d'ici.
 */
function aplati(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export default async function PageUtilisateurs({ searchParams }: PageProps<'/admin/utilisateurs'>) {
  const session = await requirePermissionEcran('admin:utilisateurs')

  // Un paramètre répété dans l'URL arrive en tableau : on ne retient que la
  // forme utilisable plutôt que de chercher un compte nommé « a,b ».
  const requete = await searchParams
  const recherche = typeof requete.q === 'string' ? requete.q.trim() : ''

  /*
    L'état par défaut ne s'écrit pas dans l'adresse : seule l'extinction laisse
    une trace. Toute autre valeur que `0` — y compris une valeur bricolée à la
    main — rend donc la liste complète, ce qui est le côté sûr de l'erreur.
  */
  const voirSuspendus = requete.suspendus !== '0'

  const utilisateurs = await listerUtilisateurs()

  /*
    Les chiffres portent sur TOUS les comptes, jamais sur le résultat filtré :
    « 1 administrateur » doit rester vrai pendant qu'on cherche quelqu'un
    d'autre, sinon la bande devient un second résultat de recherche déguisé.
  */
  const chiffres: Chiffre[] = [
    { libelle: 'Comptes', valeur: String(utilisateurs.length) },
    {
      libelle: 'Administrateurs',
      valeur: String(utilisateurs.filter((u) => u.role === 'admin').length),
    },
    { libelle: 'Actifs', valeur: String(utilisateurs.filter((u) => !u.suspendu).length) },
    { libelle: 'Suspendus', valeur: String(utilisateurs.filter((u) => u.suspendu).length) },
  ]

  const filtre = aplati(recherche)
  const cherches = filtre
    ? utilisateurs.filter(
        (u) => aplati(u.nom).includes(filtre) || aplati(u.courriel).includes(filtre),
      )
    : utilisateurs

  const retenus = voirSuspendus ? cherches : cherches.filter((u) => !u.suspendu)

  /*
    Un compte suspendu écarté par l'interrupteur n'est pas la même absence qu'un
    compte introuvable : le premier se rétablit d'un geste, le second demande
    d'écrire autre chose. Sans ce décompte, les deux donneraient le même écran
    vide et l'utilisateur chercherait une faute d'orthographe là où il n'y en a
    pas.
  */
  const masques = cherches.length - retenus.length

  const lignes: LigneUtilisateur[] = retenus.map((u) => ({
    id: u.id,
    nom: u.nom,
    courriel: u.courriel,
    role: u.role,
    suspendu: u.suspendu,
    motifSuspension: u.motifSuspension,
    derniereConnexion: u.derniereConnexion
      ? HORODATAGE.format(u.derniereConnexion)
      : 'Jamais connecté',
    soiMeme: u.id === session.userId,
  }))

  return (
    <div>
      <EnTeteAdmin titre="Utilisateurs" />
      <BandeChiffres chiffres={chiffres} />

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
        {/*
          La recherche à gauche, ce qui filtre l'affichage à droite — et les deux
          alignés par le BAS, le champ portant son libellé au-dessus de lui.

          `h-9` sur l'interrupteur : c'est la hauteur du champ, pas celle de son
          libellé. Sans elle, l'alignement par le bas le collerait sous la ligne
          du champ au lieu de le mettre en face.
        */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <RechercheUtilisateurs />
          <FiltreSuspendus className="ml-auto flex h-9 items-center" />
        </div>

        {/*
          Le chemin dit ce que le tableau montre — tous les comptes, ou les
          seuls comptes actifs. Il répond à l'interrupteur au-dessus de lui : une
          bascule dont on ne voit pas l'effet quand la liste ne change pas
          passerait pour une commande morte.

          Le filet est AU-DESSUS, entre la recherche et lui, pas entre lui et le
          tableau : il sépare ce qui commande de ce qui est commandé.
        */}
        <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
          <p className="text-ink3 text-[13px] leading-4.5">
            Utilisateurs /{' '}
            <span className="text-ink font-medium">{voirSuspendus ? 'tous' : 'actifs'}</span>
          </p>
          <div className="ml-auto">
            <DialogueUtilisateur />
          </div>
        </div>

        <div className="mt-4">
          {lignes.length > 0 ? (
            <TableauUtilisateurs utilisateurs={lignes} />
          ) : recherche ? (
            /*
              Recherche sans résultat : il n'y a rien à expliquer et rien à
              créer, donc une seule phrase dans le cadre du tableau. L'écran
              répond au lieu de disparaître.
            */
            <TableauVide>
              Aucun compte ne correspond à « {recherche} ». Essayez une autre orthographe.
            </TableauVide>
          ) : masques > 0 ? (
            /*
              La liste n'est vide que parce que l'interrupteur écarte tout ce
              qu'elle contient. Le dire évite de chercher un compte qui est là.
            */
            <TableauVide>
              Aucun compte actif. {masques} compte{masques > 1 ? 's sont écartés' : ' est écarté'}{' '}
              par « Afficher les comptes suspendus ».
            </TableauVide>
          ) : (
            /*
              Aucun compte du tout : c'est le PREMIER usage, et là il y a quelque
              chose à expliquer. L'état vide complet est justifié — il dit quoi
              faire ensuite.
            */
            <EtatVide
              titre="Aucun compte"
              message="Invitez un premier utilisateur : il recevra un courriel et choisira son mot de passe."
            />
          )}
        </div>
      </div>
    </div>
  )
}
