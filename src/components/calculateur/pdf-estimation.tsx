import 'server-only'
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { AVIS_COORDONNEES, composerEntete } from '@/components/calculateur/entete-document'
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
 * Le vrai PDF de l'estimation — exigence EST-10.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Rien n'est recalculé. Les montants, les taux et les libellés viennent de
 * l'estimation telle qu'elle a été enregistrée (EST-12), et la ventilation est
 * DÉDUITE par `ventilerEmis`, partagée avec l'aperçu HTML.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `server-only` : `renderToBuffer` n'existe que côté Node, et l'importer d'un
 * composant client embarquerait tout PDFKit dans le paquet du navigateur.
 */

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Le seul endroit du projet où une couleur s'écrit en dur — et il ne peut pas en
 * être autrement : le PDF est composé hors du navigateur, sans feuille de style,
 * donc sans variables CSS.
 *
 * Ces valeurs DOUBLENT les jetons `--pdf-*` et les couleurs d'entreprise de
 * `globals.css` — d'où les noms de jetons en clés. `tests/estimation-document.spec.ts`
 * compare chaque entrée au `:root` du fichier et échoue dès qu'ils divergent :
 * la duplication est tenue par un test, pas par la mémoire de qui touchera aux jetons.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const PALETTE_PDF = {
  '--pdf-paper': '#ffffff',
  '--pdf-ink': '#111111',
  '--pdf-ink2': '#4a4a4a',
  '--pdf-rule': '#ececec',
  '--pays': '#1baf7a',
  '--dev': '#2a78d6',
  '--staff': '#eb6834',
} as const

const PAPIER = PALETTE_PDF['--pdf-paper']
const ENCRE = PALETTE_PDF['--pdf-ink']
const ENCRE2 = PALETTE_PDF['--pdf-ink2']
const FILET = PALETTE_PDF['--pdf-rule']

/** Lettre US, marge de 16 mm — le format des télécopieurs et imprimantes du Québec. */
const MARGE = 45

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPIER,
    color: ENCRE,
    paddingTop: MARGE,
    paddingBottom: MARGE,
    paddingHorizontal: MARGE,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.45,
  },

  entete: { flexDirection: 'row', justifyContent: 'space-between' },
  marque: { maxWidth: 300 },
  filetMarque: { height: 3, width: 48, marginBottom: 8 },
  logo: { height: 34, maxWidth: 200, objectFit: 'contain', objectPositionX: 0, marginBottom: 10 },
  nomEntreprise: {
    fontSize: 8,
    letterSpacing: 1,
    color: ENCRE2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  titre: { fontFamily: 'Helvetica-Bold', fontSize: 16, lineHeight: 1.2 },
  coordonnees: { fontSize: 8, color: ENCRE2, marginTop: 4 },
  avis: {
    fontSize: 8,
    color: ENCRE2,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: FILET,
    borderRadius: 3,
  },

  surtitre: {
    fontSize: 8,
    letterSpacing: 1,
    color: ENCRE2,
    textTransform: 'uppercase',
  },
  reference: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 2 },
  droite: { textAlign: 'right' },

  separateur: { height: 1, backgroundColor: FILET, marginVertical: 20 },
  bloc: { flexDirection: 'row', justifyContent: 'space-between' },
  destinataire: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 3 },
  secondaire: { color: ENCRE2 },

  tableau: { marginTop: 20 },
  enteteTableau: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ENCRE,
    paddingBottom: 5,
  },
  rangee: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: FILET,
    paddingVertical: 7,
  },
  colonneDescription: { flexGrow: 1, flexShrink: 1, paddingRight: 16 },
  colonneMontant: { width: 100, textAlign: 'right' },
  designation: { fontFamily: 'Helvetica-Bold' },

  totaux: { marginTop: 14, alignSelf: 'flex-end', width: 220 },
  ligneTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: ENCRE,
  },
  libelleTotal: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  montantTotal: { fontFamily: 'Helvetica-Bold', fontSize: 16 },

  pied: { marginTop: 28, fontSize: 8, color: ENCRE2 },
  pagination: {
    position: 'absolute',
    bottom: MARGE / 2,
    right: MARGE,
    fontSize: 8,
    color: ENCRE2,
  },
})

type Props = {
  slug: EntrepriseSlug
  estimation: EstimationDocument
  organisation: CoordonneesDocument
  /**
   * Octets du logo, déjà lus dans le stockage. Le composant ne va PAS les
   * chercher : il est rendu en dehors de toute requête, et une lecture réseau à
   * l'intérieur du rendu ferait échouer le document entier sur un seau
   * momentanément injoignable. `null` quand il n'y a pas de logo, ou qu'il n'a
   * pas pu être lu — le document retombe alors sur la marque écrite.
   */
  logo: Buffer | null
}

function DocumentPdfEstimation({ slug, estimation, organisation, logo }: Props) {
  const identite = infoEntreprise(slug)
  const entete = composerEntete(slug, organisation)
  const ventilation = ventilerEmis(estimation)

  return (
    <Document
      title={estimation.reference}
      author={entete.titre}
      subject={`Estimation ${estimation.reference}`}
      creator={entete.titre}
      producer={entete.titre}
      language="fr-CA"
      creationDate={estimation.date}
    >
      <Page size="LETTER" style={s.page}>
        <View style={s.entete}>
          <View style={s.marque}>
            {/*
              Le logo REMPLACE le filet de couleur, il ne s'y ajoute pas : deux
              marques l'une sur l'autre en feraient deux fois trop, et le filet
              n'existait que pour tenir la place d'un logo absent.

              La hauteur est contrainte, jamais la largeur : un logo large et bas
              et un logo carré doivent occuper la même bande. `objectFit` garde
              les proportions — sans lui, react-pdf étire l'image jusqu'au cadre.
            */}
            {logo ? (
              // `Image` de react-pdf, pas une balise HTML : elle n'a pas d'attribut
              // `alt`, et le PDF porte déjà le nom de l'entreprise en toutes lettres.
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={s.logo} />
            ) : (
              <View style={[s.filetMarque, { backgroundColor: PALETTE_PDF[identite.jeton] }]} />
            )}
            {entete.nommerEntreprise && <Text style={s.nomEntreprise}>{entete.nomEntreprise}</Text>}
            <Text style={s.titre}>{entete.titre}</Text>
            {entete.coordonnees && <Text style={s.coordonnees}>{entete.coordonnees}</Text>}
            {entete.aCompleter && <Text style={s.avis}>{AVIS_COORDONNEES}</Text>}
          </View>

          <View style={s.droite}>
            <Text style={s.surtitre}>Estimation</Text>
            <Text style={s.reference}>{estimation.reference}</Text>
          </View>
        </View>

        <View style={s.separateur} />

        <View style={s.bloc}>
          <View>
            <Text style={s.surtitre}>Destinataire</Text>
            <Text style={s.destinataire}>{estimation.client?.nom ?? 'Client à déterminer'}</Text>
            {estimation.client?.adresse && (
              <Text style={s.secondaire}>{estimation.client.adresse}</Text>
            )}
            {estimation.client?.telephone && (
              <Text style={s.secondaire}>{estimation.client.telephone}</Text>
            )}
          </View>
          <View style={[s.droite, s.secondaire]}>
            <Text>Date&nbsp;: {formaterDate(estimation.date)}</Text>
            <Text>Valide jusqu’au {formaterDateSeule(estimation.valideJusquau)}</Text>
          </View>
        </View>

        <View style={s.tableau}>
          <View style={s.enteteTableau}>
            <Text style={[s.colonneDescription, s.surtitre]}>Description</Text>
            <Text style={[s.colonneMontant, s.surtitre]}>Montant</Text>
          </View>

          {estimation.lignes.map((ligne, i) => (
            // `wrap={false}` : une ligne coupée en deux pages sépare sa désignation
            // de son montant, et le document devient illisible.
            <View key={i} style={s.rangee} wrap={false}>
              <View style={s.colonneDescription}>
                <Text style={s.designation}>{ligne.designation}</Text>
                <Text style={s.secondaire}>
                  {formaterQuantite(ligne.quantite)} {ligne.unite} ×{' '}
                  {formaterMontant(ligne.prixUnitaire)}
                </Text>
              </View>
              <Text style={s.colonneMontant}>{formaterMontant(ligne.sousTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totaux} wrap={false}>
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

          <View style={s.total}>
            <Text style={s.libelleTotal}>Total</Text>
            <Text style={s.montantTotal}>{formaterMontant(estimation.total)}</Text>
          </View>
        </View>

        <Text style={s.pied}>
          Estimation établie par {estimation.creeParNom}. Les prix sont donnés à titre indicatif et
          demeurent valides jusqu’à la date indiquée.
        </Text>

        {/* Chiffres seuls : « Page 1 sur 2 » serait un libellé que la section 19 ne
            donne pas. Rien du tout sur un document d'une seule page. */}
        <Text
          style={s.pagination}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ''
          }
        />
      </Page>
    </Document>
  )
}

function LigneTotal({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={s.ligneTotal}>
      <Text style={s.secondaire}>{libelle}</Text>
      <Text>{valeur}</Text>
    </View>
  )
}

/** Nom du fichier remis au client : sa référence, et rien d'autre. */
export function nomFichierPdf(reference: string): string {
  return `${reference}.pdf`
}

export async function rendreEstimationPdf(props: Props): Promise<Uint8Array<ArrayBuffer>> {
  /*
    `renderToBuffer` rend un `Buffer` Node, dont le tampon est typé
    `ArrayBufferLike` — donc possiblement partagé, et refusé comme corps de
    réponse Web. La copie dans un `ArrayBuffer` neuf est ce qui rend le document
    transmissible ; elle porte quelques dizaines de kilooctets, une fois.
  */
  const buffer = await renderToBuffer(<DocumentPdfEstimation {...props} />)
  const octets = new Uint8Array(new ArrayBuffer(buffer.byteLength))
  octets.set(buffer)
  return octets
}
