import Link from 'next/link'
import { FlecheDroite } from '@/components/shared/fleches'
import { Tronque } from '@/components/shared/tronque'
import {
  CadreTableau,
  CelluleTableau,
  ColonneTableau,
  CorpsTableau,
  EnTeteTableau,
  LigneTableau,
  Tableau,
} from '@/components/shared/tableau'
import { LIBELLE_MODULE } from '@/lib/permissions'
import type { Panneau } from '@/lib/data/accueil'

/**
 * Un aperçu de module sur l'accueil — cinq rangées et une sortie.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un creux gris, et des rangées POSÉES dedans.
 *
 * C'était une liste filetée dans une carte blanche, et elle se lisait comme un
 * tableau sans en-tête. Le creux inverse le rapport : la carte devient le fond,
 * chaque rangée devient l'objet. Une liste où l'on prend UNE ligne — pas où on
 * les compare — se lit mieux ainsi.
 *
 * Et les rangées n'ont pas de filet : le contraste des deux fonds pose déjà
 * leur limite. Un filet par-dessus l'aurait redite une seconde fois.
 *
 * Ce n'est toujours pas un tableau, et ça ne doit pas y ressembler : pas
 * d'en-tête de colonne, pas de tri, pas de pagination. Trois affordances qui
 * promettraient une liste complète alors qu'on n'en montre que le haut. Le lien
 * du coin est la seule réponse à « et les autres ? », et il est nommé par le
 * module plutôt que par un « voir tout » qui ne dit pas où l'on va.
 *
 * La flèche de fin de rangée n'est pas un ornement : chaque rangée MÈNE
 * quelque part — la fiche du client, celle de l'employé. Une flèche sans
 * destination serait une promesse non tenue, et c'est pourquoi `href` n'est pas
 * facultatif du côté des données.
 * ─────────────────────────────────────────────────────────────────────────
 */
/**
 * Noms de colonnes — ils font passer le panneau en forme de TABLEAU.
 *
 * Les donner, c'est affirmer que les lignes se comparent : un en-tête de colonne
 * annonce des valeurs de même nature, alignées, qu'on lit de haut en bas. Là où
 * l'on prend une ligne sans regarder les autres, ne pas les donner.
 */
export type ColonnesPanneau = { principal: string; secondaire?: string; valeur?: string }

export function PanneauDonnees({
  panneau,
  colonnes,
}: {
  panneau: Panneau
  colonnes?: ColonnesPanneau
}) {
  return (
    <section
      aria-labelledby={`panneau-${panneau.cle}`}
      className="bg-rail flex flex-col rounded-xl p-4"
    >
      <div className="flex items-baseline gap-3 px-1">
        <h3 id={`panneau-${panneau.cle}`} className="text-[12px] leading-6 uppercase">
          {panneau.titre}
        </h3>
        <Link
          href={panneau.href}
          className="text-ink3 hover:text-ink ml-auto shrink-0 text-[13px] leading-4.5"
        >
          {LIBELLE_MODULE[panneau.module]}
        </Link>
      </div>

      {colonnes ? (
        <div className="mt-3">
          <CadreTableau>
            <Tableau>
              <EnTeteTableau>
                <ColonneTableau libelle={colonnes.principal} />
                {colonnes.secondaire && <ColonneTableau libelle={colonnes.secondaire} />}
                {colonnes.valeur && <ColonneTableau libelle={colonnes.valeur} aDroite />}
              </EnTeteTableau>
              <CorpsTableau>
                {panneau.lignes.map((l) => (
                  <LigneTableau key={l.cle}>
                    {/*
                      Le lien est sur le NOM, pas sur la rangée : un tableau se
                      parcourt cellule par cellule, et une rangée entièrement
                      cliquable y rend la sélection d'un texte impossible.
                    */}
                    <CelluleTableau
                      discret
                      tronque
                      titre={l.principal}
                      className="max-w-72 text-[13px]"
                    >
                      <Link
                        href={l.href}
                        className="hover:text-ink hover:underline focus-visible:underline"
                      >
                        {l.principal}
                      </Link>
                    </CelluleTableau>

                    {colonnes.secondaire && (
                      <CelluleTableau discret tronque className="max-w-48 text-[13px]">
                        {l.secondaire ?? '—'}
                      </CelluleTableau>
                    )}

                    {colonnes.valeur && (
                      <CelluleTableau discret aDroite chiffres className="text-[13px]">
                        {l.valeur ?? '—'}
                      </CelluleTableau>
                    )}
                  </LigneTableau>
                ))}
              </CorpsTableau>
            </Tableau>
          </CadreTableau>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {panneau.lignes.map((l) => (
            <li key={l.cle}>
              <Link
                href={l.href}
                /*
                Aucun filet sur la rangée : le creux gris lui en tient lieu.
                C'est ce que le contraste des deux fonds fait déjà, et un filet
                par-dessus aurait redit la même limite une seconde fois.

                Le survol se marque donc sur la FLÈCHE plutôt que sur le bord.
                Un fond survolé aurait dû être plus clair que blanc.
              */
                className="group bg-raised flex h-12 items-center gap-3 rounded-md px-3"
              >
                <Tronque className="max-w-72 text-[13px] leading-4.5">{l.principal}</Tronque>

                {/*
                Le mot du milieu porte le dossier ou l'auteur — ce qui situe la
                rangée sans la nommer. Il s'efface avant le reste sur un écran
                étroit : perdre « Paysagement » coûte moins que perdre le nom du
                client ou le retard qui presse.
              */}
                {l.secondaire && (
                  <Tronque className="text-ink3 hidden max-w-48 text-[13px] leading-4.5 sm:block">
                    {l.secondaire}
                  </Tronque>
                )}

                {l.valeur && (
                  <span className="text-ink2 ml-auto shrink-0 text-[13px] leading-4.5 tabular-nums">
                    {l.valeur}
                  </span>
                )}

                {/*
                `ml-auto` conditionnel : sans valeur à droite, c'est la flèche
                qui doit être poussée au bout. Avec, elle la suit de près — deux
                marges automatiques se partageraient l'espace et sépareraient le
                nombre de sa flèche.
              */}
                <FlecheDroite
                  className={`text-ink3 group-hover:text-ink w-3.5 shrink-0 ${l.valeur ? '' : 'ml-auto'}`}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
