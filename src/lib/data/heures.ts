import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { type ParametresCalcul, type Periode, enCentiemes, enIso, jour } from '@/lib/domaine/heures'

/**
 * Couche d'accès aux données — suivi des heures.
 *
 * INVARIANT N°2 : aucun appel Prisma n'est écrit hors de `lib/data/`. C'est le
 * seul dossier à auditer quand on se demande qui peut lire quoi.
 *
 * Ce module n'est PAS cadré par entreprise, à la différence du CRM et du
 * calculateur : la grille présente en une seule vue les employés des trois
 * entreprises (exigence HEU-2). L'entreprise est ici un attribut de
 * regroupement et d'export, pas une frontière d'accès — voir la note d'en-tête
 * de `prisma/schema/heures.prisma`.
 *
 * Les `Decimal` de Prisma sont convertis en entiers **ici**, au bord : un objet
 * `Decimal` transmis à un composant client ferait échouer la sérialisation.
 */

const VIVANTS = { deletedAt: null } as const

/** Un `Decimal(_, 2)` en entier de centièmes, sans passer par un flottant. */
function centiemesDe(valeur: { toString(): string }): number {
  return enCentiemes(valeur.toString())
}

/** L'inverse, pour l'écriture : Prisma accepte la chaîne décimale. */
function decimalDe(centiemes: number): string {
  return (centiemes / 100).toFixed(2)
}

/* ══════════════════════════════════════════════════════════════════
   Paramètres de paie
   ══════════════════════════════════════════════════════════════════ */

export type ParametresPaie = ParametresCalcul & { joursPeriode: number }

/**
 * Ligne unique `global`. Créée à la première lecture avec les valeurs par
 * défaut **du schéma** : le seuil et la majoration suivent la norme du travail
 * et doivent rester modifiables sans déploiement (HEU-7, HEU-9). Les reprendre
 * en constante dans le code annulerait ce choix.
 */
/**
 * Les défauts du SCHÉMA, recopiés ici — et c'est la seule copie tolérable.
 *
 * `prisma/schema/heures.prisma` les déclare en `@default` : 40 heures, 1,5 fois
 * le taux, quatorze jours. La ligne `global` n'existant pas tant que personne
 * n'a enregistré, il faut bien les nommer quelque part pour ne pas rendre une
 * grille sans seuil.
 *
 * Un test relit le schéma et refuse toute divergence : c'est ce qui empêche
 * cette copie de devenir un second réglage, caché dans le code.
 */
const DEFAUTS_PAIE: ParametresPaie = {
  seuilCentiemes: 4000,
  majorationCentiemes: 150,
  joursPeriode: 14,
}

export const parametresPaie = cache(async (): Promise<ParametresPaie> => {
  /*
    Une LECTURE, plus un `upsert`.

    L'écriture créait la ligne à la première consultation — ce qui plaçait une
    écriture sur le chemin d'affichage de la grille, l'écran le plus ouvert du
    module. Une écriture coûte un journal, un verrou de ligne, et Neon ne peut
    jamais la servir depuis un réplica.

    La ligne n'a pas besoin d'exister : `enregistrerParametresPaie` la crée au
    premier enregistrement, et les défauts rendus ici sont ceux du SCHÉMA, pas
    des constantes du code — c'est ce que HEU-7 et HEU-9 exigent.

    `cache()` dédoublonne l'appel dans un même rendu : les deux écrans du module
    l'attendent, et la fiche d'un employé le demande une seconde fois.
  */
  const p = await prisma.parametresPaie.findUnique({ where: { id: 'global' } })
  if (!p) return DEFAUTS_PAIE

  return {
    seuilCentiemes: centiemesDe(p.seuilSupplementaires),
    majorationCentiemes: centiemesDe(p.majoration),
    joursPeriode: p.joursPeriode,
  }
})

/* ══════════════════════════════════════════════════════════════════
   Employés
   ══════════════════════════════════════════════════════════════════ */

export type EmployeVue = {
  id: string
  nom: string
  entrepriseSlug: string
  /** Taux horaire en cents, ou `null` si non renseigné (HEU-8). */
  tauxCents: number | null
  actif: boolean
  notes: string | null
  version: number
}

const CHAMPS_EMPLOYE = {
  id: true,
  nom: true,
  entrepriseSlug: true,
  tauxHoraire: true,
  actif: true,
  notes: true,
  version: true,
} as const

type LigneEmploye = {
  id: string
  nom: string
  entrepriseSlug: string
  tauxHoraire: { toString(): string } | null
  actif: boolean
  notes: string | null
  version: number
}

function vueEmploye(e: LigneEmploye): EmployeVue {
  return {
    id: e.id,
    nom: e.nom,
    entrepriseSlug: e.entrepriseSlug,
    tauxCents: e.tauxHoraire === null ? null : centiemesDe(e.tauxHoraire),
    actif: e.actif,
    notes: e.notes,
    version: e.version,
  }
}

export async function listerEmployes(actifsSeulement = false): Promise<EmployeVue[]> {
  const lignes = await prisma.employe.findMany({
    where: { ...VIVANTS, ...(actifsSeulement && { actif: true }) },
    orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    select: CHAMPS_EMPLOYE,
  })
  return lignes.map(vueEmploye)
}

export async function employeParId(id: string): Promise<EmployeVue | null> {
  const e = await prisma.employe.findFirst({ where: { id, ...VIVANTS }, select: CHAMPS_EMPLOYE })
  return e ? vueEmploye(e) : null
}

export type DonneesEmploye = {
  nom: string
  entrepriseSlug: string
  tauxCents: number | null
  actif: boolean
  notes: string | null
}

export async function creerEmploye(d: DonneesEmploye): Promise<string> {
  const e = await prisma.employe.create({
    data: {
      nom: d.nom,
      entrepriseSlug: d.entrepriseSlug,
      tauxHoraire: d.tauxCents === null ? null : decimalDe(d.tauxCents),
      actif: d.actif,
      notes: d.notes,
    },
    select: { id: true },
  })
  return e.id
}

/**
 * Renvoie `false` si la fiche a changé entre-temps. L'appelant traduit ce refus
 * en message qui dit quoi faire, pas ce qui a échoué.
 */
export async function modifierEmploye(
  id: string,
  version: number,
  d: DonneesEmploye,
): Promise<boolean> {
  const maj = await prisma.employe.updateMany({
    where: { id, version, ...VIVANTS },
    data: {
      nom: d.nom,
      entrepriseSlug: d.entrepriseSlug,
      tauxHoraire: d.tauxCents === null ? null : decimalDe(d.tauxCents),
      actif: d.actif,
      notes: d.notes,
      version: { increment: 1 },
    },
  })
  return maj.count > 0
}

/* ══════════════════════════════════════════════════════════════════
   Saisies
   ══════════════════════════════════════════════════════════════════ */

export type SaisieVue = {
  employeId: string
  /** Jour civil au format `AAAA-MM-JJ` — jamais un horodatage. */
  date: string
  centiemes: number
  note: string | null
}

export async function saisiesEntre(p: Periode, employeId?: string): Promise<SaisieVue[]> {
  const lignes = await prisma.saisieJour.findMany({
    where: {
      date: { gte: p.debut, lte: p.fin },
      ...(employeId && { employeId }),
      employe: VIVANTS,
    },
    orderBy: [{ date: 'asc' }],
    select: { employeId: true, date: true, heures: true, note: true },
  })

  return lignes.map((l) => ({
    employeId: l.employeId,
    date: enIso(l.date),
    centiemes: centiemesDe(l.heures),
    note: l.note,
  }))
}

export async function compterSaisies(p: Periode): Promise<number> {
  return prisma.saisieJour.count({
    where: { date: { gte: p.debut, lte: p.fin }, employe: VIVANTS },
  })
}

/**
 * Employés actifs dont la semaine est ENCORE VIDE.
 *
 * Compté sur les employés et non sur les saisies : c'est le manque qui
 * intéresse, et un manque ne laisse aucune ligne à dénombrer. Une saisie à zéro
 * heure compte comme faite — quelqu'un a répondu « rien cette semaine », ce qui
 * n'est pas la même chose que ne pas avoir répondu.
 */
export async function compterEmployesSansSaisie(p: Periode): Promise<number> {
  return prisma.employe.count({
    where: {
      ...VIVANTS,
      actif: true,
      saisies: { none: { date: { gte: p.debut, lte: p.fin } } },
    },
  })
}

/** Les mêmes employés, nommés — pour l'accueil, qui en montre les premiers. */
export async function employesSansSaisie(p: Periode, limite: number): Promise<EmployeVue[]> {
  const lignes = await prisma.employe.findMany({
    where: {
      ...VIVANTS,
      actif: true,
      saisies: { none: { date: { gte: p.debut, lte: p.fin } } },
    },
    orderBy: [{ nom: 'asc' }],
    take: limite,
    select: CHAMPS_EMPLOYE,
  })
  return lignes.map(vueEmploye)
}

/** Qui écrit — consigné avec chaque changement de valeur. */
export type Auteur = { id: string | null; nom: string }

export type Cellule = {
  employeId: string
  date: string
  centiemes: number | null
  /**
   * Valeur que l'auteur de la modification croit enregistrée — `null` quand il
   * croit qu'aucune saisie n'existe. Faute de colonne `version` sur
   * `SaisieJour`, c'est la valeur de la cellule qui tient lieu de version.
   */
  avant: number | null
}

/** Cellule refusée : la base ne portait plus la valeur attendue. */
export type ConflitCellule = { employeId: string; nom: string; date: string }

export type ResultatEcriture = { ecrites: number; conflits: ConflitCellule[] }

/** Employés réellement existants parmi ceux proposés, avec leur nom. */
async function employesConnus(ids: readonly string[]): Promise<Map<string, string>> {
  const lignes = await prisma.employe.findMany({
    where: { id: { in: [...new Set(ids)] }, ...VIVANTS },
    select: { id: true, nom: true },
  })
  return new Map(lignes.map((l) => [l.id, l.nom]))
}

/** Client d'une transaction interactive — le client complet moins ses `$méthodes`. */
type Transaction = Omit<typeof prisma, `$${string}`>

const DELAI_GRILLE = 20_000

/**
 * Sentinelle d'annulation. Sortir par une exception est le seul moyen de
 * défaire une transaction interactive déjà entamée : le refus d'une seule
 * cellule doit annuler les cinquante-neuf autres.
 */
class ConflitEcriture extends Error {
  constructor(readonly conflits: ConflitCellule[]) {
    super('Écriture refusée : la valeur attendue a changé.')
    this.name = 'ConflitEcriture'
  }
}

function conflitsDe(cellules: readonly Cellule[], noms: Map<string, string>): ConflitCellule[] {
  return cellules.map((c) => ({
    employeId: c.employeId,
    nom: noms.get(c.employeId) ?? c.employeId,
    date: c.date,
  }))
}

/**
 * Écrit une cellule **sous condition de sa valeur antérieure**. Renvoie `false`
 * quand la base ne porte plus `avant` : un autre onglet a écrit entre-temps, et
 * l'écraser ferait disparaître sa valeur sans un mot.
 */
async function appliquerCellule(
  tx: Transaction,
  c: Cellule,
  auteur: Auteur | null,
): Promise<boolean> {
  const date = jour(c.date)

  if (c.avant === null) {
    if (c.centiemes === null) return true
    // `skipDuplicates` fait porter le refus par `@@unique([employeId, date])`
    // sans avorter la transaction : un compte à zéro dit qu'une saisie est
    // apparue depuis l'affichage. C'est un conflit, pas une panne.
    const creees = await tx.saisieJour.createMany({
      data: [{ employeId: c.employeId, date, heures: decimalDe(c.centiemes) }],
      skipDuplicates: true,
    })
    return creees.count > 0
  }

  // `heures` EST le contrôle de concurrence, faute de colonne `version`.
  const attendue = { employeId: c.employeId, date, heures: decimalDe(c.avant) }

  if (c.centiemes === null) {
    const supprimees = await tx.saisieJour.deleteMany({ where: attendue })
    if (supprimees.count === 0) return false
    await consigner(tx, c, null, auteur)
    return true
  }

  const modifiees = await tx.saisieJour.updateMany({
    where: attendue,
    data: { heures: decimalDe(c.centiemes) },
  })
  if (modifiees.count === 0) return false
  if (c.centiemes !== c.avant) await consigner(tx, c, c.centiemes, auteur)
  return true
}

/**
 * Consigne un changement de valeur — TR-9.
 *
 * Sans cela, vider une cellule supprimait la ligne et la valeur antérieure
 * n'existait plus nulle part : une fausse manœuvre sur « Copier la semaine
 * précédente » effaçait une semaine entière sans retour possible. Le journal
 * d'audit ne consigne que « Saisie d'heures » et le libellé de la semaine, pas
 * les valeurs.
 *
 * Le motif reste NULL : c'est ce qui distingue une saisie courante d'une
 * correction d'après clôture, laquelle exige une justification (HEU-10).
 */
async function consigner(
  tx: Transaction,
  c: Cellule,
  nouvelle: number | null,
  auteur: Auteur | null,
): Promise<void> {
  if (!auteur) return

  await tx.correctionHeures.create({
    data: {
      employeId: c.employeId,
      date: jour(c.date),
      ancienneValeur: c.avant === null ? null : decimalDe(c.avant),
      // Une suppression est consignée comme un retour à zéro : la colonne est
      // obligatoire, et « ancienneValeur » porte déjà ce qui a été effacé.
      nouvelleValeur: decimalDe(nouvelle ?? 0),
      motif: null,
      parId: auteur.id,
      parNom: auteur.nom,
    },
  })
}

/**
 * Écriture de la grille.
 *
 * Une cellule à `null` **supprime** la saisie ; une cellule à zéro en enregistre
 * une qui vaut zéro. Les deux existent, et le journal des corrections les
 * distingue.
 *
 * Tout part en une transaction : une grille à demi écrite donnerait un total de
 * semaine faux, et personne ne verrait laquelle des soixante cellules manque.
 *
 * Aucune écriture n'est inconditionnelle : chaque cellule n'est écrite que si la
 * base porte encore la valeur que son auteur croyait enregistrée. Les cellules
 * refusées reviennent nommées, à charge de l'appelant de le dire.
 */
export async function ecrireSaisies(
  cellules: readonly Cellule[],
  auteur: Auteur | null = null,
): Promise<ResultatEcriture> {
  if (cellules.length === 0) return { ecrites: 0, conflits: [] }

  const noms = await employesConnus(cellules.map((c) => c.employeId))
  const retenues = cellules.filter((c) => noms.has(c.employeId))
  if (retenues.length === 0) return { ecrites: 0, conflits: [] }

  try {
    await prisma.$transaction(
      async (tx) => {
        const refusees: Cellule[] = []
        for (const c of retenues) {
          if (!(await appliquerCellule(tx, c, auteur))) refusees.push(c)
        }
        if (refusees.length > 0) throw new ConflitEcriture(conflitsDe(refusees, noms))
      },
      // Une cellule vérifiée est une requête : soixante allers-retours vers une
      // base distante dépassent le délai de cinq secondes par défaut.
      { timeout: DELAI_GRILLE },
    )
  } catch (e) {
    if (e instanceof ConflitEcriture) return { ecrites: 0, conflits: e.conflits }
    throw e
  }

  return { ecrites: retenues.length, conflits: [] }
}

/**
 * Copie d'une semaine sur la suivante — exigence HEU-3.
 *
 * Ne concerne que les employés **actifs** : recopier les heures d'un employé
 * parti ressusciterait une ligne de paie.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce chemin ÉCRASE une semaine entière d'un seul geste, à la demande de
 * quelqu'un qui voulait souvent remplir une semaine vide. Chaque valeur détruite
 * est donc consignée dans `CorrectionHeures`, comme le fait `consigner()` pour
 * une saisie ordinaire : TR-9 interdit la disparition définitive, et TR-6 impose
 * une conservation minimale des registres — une semaine de janvier écrasée en
 * mars serait une donnée du registre qui n'existe plus.
 *
 * La consignation est DANS la transaction qui efface : hors d'elle, un échec
 * laisserait la semaine détruite et l'historique muet, c'est-à-dire exactement
 * l'état qu'on corrige.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function copierSemaine(
  source: Periode,
  cible: Periode,
  auteur: Auteur,
): Promise<number> {
  const actifs = await prisma.employe.findMany({
    where: { ...VIVANTS, actif: true },
    select: { id: true },
  })
  if (actifs.length === 0) return 0

  const ids = actifs.map((a) => a.id)
  const origine = await prisma.saisieJour.findMany({
    where: { employeId: { in: ids }, date: { gte: source.debut, lte: source.fin } },
    select: { employeId: true, date: true, heures: true },
  })

  const decalage = cible.debut.getTime() - source.debut.getTime()
  const copiees = origine.map((o) => ({
    employeId: o.employeId,
    date: new Date(o.date.getTime() + decalage),
    heures: o.heures,
  }))

  const remplacante = new Map(
    copiees.map((c) => [`${c.employeId}|${enIso(c.date)}`, centiemesDe(c.heures)]),
  )

  await prisma.$transaction(
    async (tx) => {
      const fenetre = {
        employeId: { in: ids },
        date: { gte: cible.debut, lte: cible.fin },
      }

      // Relu ici et pas avant la transaction : une saisie arrivée entre-temps
      // serait effacée sans jamais figurer au registre des corrections.
      const ecrasees = await tx.saisieJour.findMany({
        where: fenetre,
        select: { employeId: true, date: true, heures: true },
      })

      await tx.saisieJour.deleteMany({ where: fenetre })
      await tx.saisieJour.createMany({ data: copiees })

      for (const e of ecrasees) {
        const ancienne = centiemesDe(e.heures)
        const nouvelle = remplacante.get(`${e.employeId}|${enIso(e.date)}`) ?? 0
        if (nouvelle === ancienne) continue

        await tx.correctionHeures.create({
          data: {
            employeId: e.employeId,
            date: e.date,
            ancienneValeur: decimalDe(ancienne),
            // Une cellule que la copie laisse vide se consigne comme un retour à
            // zéro : `ancienneValeur` porte déjà ce qui a été effacé.
            nouvelleValeur: decimalDe(nouvelle),
            // Pas de motif : un écrasement ordinaire n'est pas une correction
            // justifiée d'après clôture, et l'écran des corrections (HEU-10) ne
            // doit pas se remplir de copies de semaine.
            motif: null,
            parId: auteur.id,
            parNom: auteur.nom,
          },
        })
      }
    },
    { timeout: DELAI_GRILLE },
  )

  return origine.length
}

/* ══════════════════════════════════════════════════════════════════
   Périodes et corrections
   ══════════════════════════════════════════════════════════════════ */

export type PeriodeVue = {
  cloturee: boolean
  clotureeLe: string | null
  clotureeParNom: string | null
}

export async function periodeVue(p: Periode): Promise<PeriodeVue> {
  const ligne = await prisma.periodePaie.findUnique({
    where: { debut_fin: { debut: p.debut, fin: p.fin } },
    select: { cloturee: true, clotureeLe: true, clotureeParNom: true },
  })

  if (!ligne) return { cloturee: false, clotureeLe: null, clotureeParNom: null }

  return {
    cloturee: ligne.cloturee,
    clotureeLe: ligne.clotureeLe ? ligne.clotureeLe.toISOString() : null,
    clotureeParNom: ligne.clotureeParNom,
  }
}

export async function cloturerPeriode(p: Periode, parNom: string): Promise<void> {
  const marque = {
    cloturee: true,
    clotureeLe: new Date(),
    clotureeParNom: parNom,
  }

  await prisma.periodePaie.upsert({
    where: { debut_fin: { debut: p.debut, fin: p.fin } },
    update: { ...marque, version: { increment: 1 } },
    create: { debut: p.debut, fin: p.fin, ...marque },
  })
}

export type CorrectionVue = {
  id: string
  date: string
  /** `null` quand la saisie n'existait pas — ce n'est pas « était à zéro ». */
  ancienneCentiemes: number | null
  nouvelleCentiemes: number
  motif: string
  parNom: string
  faiteLe: string
}

export async function correctionsEmploye(employeId: string): Promise<CorrectionVue[]> {
  const lignes = await prisma.correctionHeures.findMany({
    // Seules les corrections JUSTIFIÉES : les saisies courantes sont consignées
    // dans la même table avec un motif nul, pour que rien ne disparaisse (TR-9),
    // mais l'écran des corrections répond à « qui a réécrit un registre clos ».
    where: { employeId, motif: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return lignes.map((c) => ({
    id: c.id,
    date: enIso(c.date),
    ancienneCentiemes: c.ancienneValeur === null ? null : centiemesDe(c.ancienneValeur),
    nouvelleCentiemes: centiemesDe(c.nouvelleValeur),
    // Le filtre `motif: { not: null }` garantit la valeur ; TypeScript ne le

    // déduit pas d'une condition Prisma.

    motif: c.motif ?? '',
    parNom: c.parNom,
    faiteLe: c.createdAt.toISOString(),
  }))
}

/**
 * Correction d'une période clôturée — exigence HEU-10.
 *
 * La valeur antérieure est relue en base, jamais reprise du navigateur : c'est
 * elle qui fait foi dans le registre, et le client n'a aucune raison d'être cru
 * sur ce point. Une saisie absente donne `ancienneValeur` nulle, ce qui ne dit
 * pas la même chose que zéro.
 *
 * La correction est soumise à la même condition de valeur antérieure qu'une
 * saisie ordinaire : elle écrase tout aussi bien, et elle laisserait en plus une
 * trace nominative fausse au registre.
 */
export async function enregistrerCorrections(
  cellules: readonly Cellule[],
  motif: string,
  par: { id: string; nom: string },
): Promise<ResultatEcriture> {
  const noms = await employesConnus(cellules.map((c) => c.employeId))
  const retenues = cellules.filter((c) => noms.has(c.employeId))
  if (retenues.length === 0) return { ecrites: 0, conflits: [] }

  try {
    await prisma.$transaction(
      async (tx) => {
        const refusees: Cellule[] = []

        for (const c of retenues) {
          const date = jour(c.date)
          const ancienne = await tx.saisieJour.findFirst({
            where: { employeId: c.employeId, date },
            select: { heures: true },
          })

          // Une correction consigne toujours une valeur : effacer une saisie d'un
          // registre clôturé se dit « zéro », pas « rien ».
          const nouvelle = c.centiemes ?? 0

          // `null` : cette voie écrit elle-même sa ligne de correction, juste en
          // dessous, avec le motif obligatoire. La laisser consigner en plus
          // produirait deux entrées pour un seul geste.
          if (!(await appliquerCellule(tx, { ...c, centiemes: nouvelle }, null))) {
            refusees.push(c)
            continue
          }

          await tx.correctionHeures.create({
            data: {
              employeId: c.employeId,
              date,
              ancienneValeur: ancienne === null ? null : ancienne.heures,
              nouvelleValeur: decimalDe(nouvelle),
              motif,
              parId: par.id,
              parNom: par.nom,
            },
          })
        }

        if (refusees.length > 0) throw new ConflitEcriture(conflitsDe(refusees, noms))
      },
      { timeout: DELAI_GRILLE },
    )
  } catch (e) {
    if (e instanceof ConflitEcriture) return { ecrites: 0, conflits: e.conflits }
    throw e
  }

  return { ecrites: retenues.length, conflits: [] }
}
