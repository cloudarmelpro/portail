import { AVIS_COORDONNEES, composerEntete } from '@/components/calculateur/entete-document'
import { PALETTE_PDF } from '@/components/calculateur/pdf-estimation'
import { entreprise as infoEntreprise, type EntrepriseSlug } from '@/config/entreprises'
import {
  formaterDate,
  formaterDateSeule,
  formaterMontant,
  formaterPourcentage,
  formaterQuantite,
  ventilerEmis,
} from '@/lib/domaine/estimation'
import type { CoordonneesDocument } from '@/components/calculateur/entete-document'
import type { EstimationDocument } from '@/lib/data/estimations'

/**
 * Le document remis au client — exigence EST-10.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Rien n'est recalculé ici. Les montants, les taux et les libellés viennent de
 * l'estimation telle qu'elle a été enregistrée (exigence EST-12) : une
 * estimation relue dans deux ans doit afficher ce que le client a reçu.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le bloc échappe volontairement au thème clair/sombre : un devis imprimé garde
 * ses couleurs de papier. Il utilise les jetons `--pdf-*` de `globals.css`,
 * déclarés pour cela.
 *
 * `id` est repris par la feuille de style d'impression, qui masque tout le reste
 * de l'application.
 */
export const ID_DOCUMENT = 'document-estimation'

export function DocumentEstimation({
  slug,
  estimation,
  organisation,
  logoUrl,
}: {
  slug: EntrepriseSlug
  estimation: EstimationDocument
  /**
   * Adresse signée du logo, à durée limitée — TR-3 : aucun fichier n'est servi
   * par une adresse directe. `null` quand il n'y a pas de logo ; le document
   * retombe alors sur le filet de couleur.
   *
   * L'aperçu la reçoit signée, le PDF reçoit les octets : ce sont deux besoins
   * différents, l'un rend dans un navigateur, l'autre compose sur le serveur.
   */
  logoUrl: string | null
  /**
   * Coordonnées légales, lues en base et saisies dans /admin/organisation.
   *
   * Propres à l'entreprise, comme le reste de ses données. Elles arrivent en
   * props plutôt que d'être lues ici : ce composant rend un document imprimable,
   * il n'a pas à interroger la base.
   */
  organisation: CoordonneesDocument
}) {
  const identite = infoEntreprise(slug)
  const entete = composerEntete(slug, organisation)

  /**
   * Le détail des ajustements est DÉDUIT des montants enregistrés, jamais
   * recalculé par le domaine : si la mécanique de calcul évoluait un jour, la
   * ventilation affichée continuerait de s'additionner jusqu'au total figé.
   */
  const ventilation = ventilerEmis(estimation)

  return (
    <article
      id={ID_DOCUMENT}
      className="bg-pdf-paper text-pdf-ink mx-auto w-full max-w-[680px] rounded-[4px] px-8 py-10 sm:px-14 sm:py-14 print:max-w-none print:rounded-none print:px-0 print:py-0"
    >
      <header className="flex items-start justify-between gap-6">
        <div>
          {/*
            Le logo REMPLACE le filet de couleur, il ne s'y ajoute pas : le filet
            n'existait que pour tenir la place d'un logo absent, et les deux
            ensemble feraient deux marques l'une sur l'autre.

            `print-color-adjust` est indispensable sur le filet : sans lui le
            navigateur retire les aplats à l'impression, et l'identité disparaît
            du papier. Il l'est tout autant sur le logo, dont l'image serait
            sinon délavée par l'économie d'encre.
          */}
          {logoUrl ? (
            /*
              `<img>` et non `next/image` : l'adresse est signée et expire en cinq
              minutes. L'optimiseur la mettrait en cache derrière une URL stable
              et publique — ce que TR-3 interdit pour tout le stockage. Et ce bloc
              part à l'imprimante, où l'optimisation ne sert à rien.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={entete.titre}
              className="mb-1 block h-[34px] w-auto max-w-[200px] object-contain object-left print:[print-color-adjust:exact]"
            />
          ) : (
            <span
              aria-hidden
              className="block h-[3px] w-12 print:[print-color-adjust:exact]"
              /*
                La valeur FIGÉE, et non `var(--pays)` qui bascule avec le thème.

                Le papier, lui, ne bascule pas : le même devis s'affichait dans
                deux verts selon le thème de celui qui le regardait, alors que le
                fichier imprimé n'en connaît qu'un. `PALETTE_PDF` porte déjà ces
                trois valeurs, verrouillées sur `:root` par un test — c'est la
                même source que le rendu PDF.
              */
              style={{ backgroundColor: PALETTE_PDF[identite.jeton as keyof typeof PALETTE_PDF] }}
            />
          )}
          {entete.nommerEntreprise && (
            <div className="text-pdf-ink2 mt-2 text-[11px] leading-[14px] tracking-[0.08em] uppercase">
              {entete.nomEntreprise}
            </div>
          )}
          <div
            className={`text-[22px] leading-7 font-bold tracking-[-0.01em] ${
              entete.nommerEntreprise ? 'mt-0.5' : 'mt-2'
            }`}
          >
            {entete.titre}
          </div>
          {entete.coordonnees && (
            <div className="text-pdf-ink2 mt-1 max-w-[280px] text-[11px] leading-4">
              {entete.coordonnees}
            </div>
          )}
          {entete.aCompleter && (
            <div className="border-pdf-rule text-pdf-ink2 mt-2 max-w-[280px] rounded-[4px] border border-dashed px-2 py-1.5 text-[11px] leading-4">
              {AVIS_COORDONNEES}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-pdf-ink2 text-[11px] leading-[14px] tracking-[0.08em] uppercase">
            Estimation
          </div>
          <div className="text-[17px] leading-6 font-semibold tabular-nums">
            {estimation.reference}
          </div>
        </div>
      </header>

      <div className="bg-pdf-rule my-7 h-px" />

      <div className="flex justify-between gap-6">
        <div>
          <div className="text-pdf-ink2 text-[11px] leading-[14px] tracking-[0.08em] uppercase">
            Destinataire
          </div>
          <div className="mt-1 text-[15px] leading-[22px] font-semibold">
            {estimation.client?.nom ?? 'Client à déterminer'}
          </div>
          {estimation.client?.adresse && (
            <div className="text-pdf-ink2 text-[13px] leading-[18px]">
              {estimation.client.adresse}
            </div>
          )}
          {estimation.client?.telephone && (
            <div className="text-pdf-ink2 text-[13px] leading-[18px] tabular-nums">
              {estimation.client.telephone}
            </div>
          )}
        </div>
        <div className="text-pdf-ink2 text-right text-[13px] leading-[18px]">
          <div>Date&nbsp;: {formaterDate(estimation.date)}</div>
          <div>Valide jusqu’au {formaterDateSeule(estimation.valideJusquau)}</div>
        </div>
      </div>

      <table className="mt-7 w-full border-collapse">
        <thead>
          <tr>
            <th className="border-pdf-ink text-pdf-ink2 border-b pb-2 text-left text-[11px] leading-[14px] tracking-[0.08em] uppercase">
              Description
            </th>
            <th className="border-pdf-ink text-pdf-ink2 border-b pb-2 text-right text-[11px] leading-[14px] tracking-[0.08em] uppercase">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {estimation.lignes.map((ligne, i) => (
            <tr key={i}>
              <td className="border-pdf-rule border-b py-3 text-[13px] leading-[18px]">
                <span className="block font-semibold">{ligne.designation}</span>
                <span className="text-pdf-ink2 block tabular-nums">
                  {formaterQuantite(ligne.quantite)} {ligne.unite} ×{' '}
                  {formaterMontant(ligne.prixUnitaire)}
                </span>
              </td>
              <td className="border-pdf-rule border-b py-3 text-right align-top text-[13px] tabular-nums">
                {formaterMontant(ligne.sousTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* La ventilation et le total forment un bloc que la feuille d'impression
          refuse de couper : un total seul en haut d'une page ne se rattache à rien. */}
      <div data-bloc="totaux" className="mt-5 flex flex-col items-end">
        <dl className="flex w-[280px] flex-col gap-1.5 text-[13px] leading-[18px]">
          <LigneTotal libelle="Sous-total" valeur={formaterMontant(ventilation.sousTotalLignes)} />
          {estimation.fraisDeplacement > 0 && (
            <LigneTotal
              libelle="Frais de déplacement"
              valeur={formaterMontant(estimation.fraisDeplacement)}
            />
          )}
          {ventilation.majoration > 0 && (
            <LigneTotal
              libelle={`Majoration (${formaterPourcentage(estimation.majorationPct)})`}
              valeur={formaterMontant(ventilation.majoration)}
            />
          )}
          {ventilation.rabais > 0 && (
            <LigneTotal libelle="Rabais" valeur={`− ${formaterMontant(ventilation.rabais)}`} />
          )}
          <LigneTotal
            libelle={`TPS (${formaterPourcentage(estimation.tauxTps * 100)})`}
            valeur={formaterMontant(estimation.tps)}
          />
          <LigneTotal
            libelle={`TVQ (${formaterPourcentage(estimation.tauxTvq * 100)})`}
            valeur={formaterMontant(estimation.tvq)}
          />
        </dl>

        <div className="border-pdf-ink mt-4 flex w-[280px] items-baseline justify-between border-t pt-3">
          <span className="text-[15px] font-semibold">Total</span>
          <span className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">
            {formaterMontant(estimation.total)}
          </span>
        </div>
      </div>

      <footer className="text-pdf-ink2 mt-10 text-[11px] leading-4">
        Estimation établie par {estimation.creeParNom}. Les prix sont donnés à titre indicatif et
        demeurent valides jusqu’à la date indiquée.
      </footer>
    </article>
  )
}

function LigneTotal({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="text-pdf-ink2 flex justify-between gap-4">
      <dt>{libelle}</dt>
      <dd className="text-pdf-ink tabular-nums">{valeur}</dd>
    </div>
  )
}
