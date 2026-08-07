'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/lib/safe-action'
import {
  NOMS_JOURS,
  ajouterJours,
  enCentiemes,
  jour,
  libelleJourMois,
  libelleSemaine,
  lundiDe,
  libellePeriode,
  periodeDe,
} from '@/lib/domaine/heures'
import {
  type ConflitCellule,
  cloturerPeriode as cloturerEnBase,
  copierSemaine,
  creerEmploye as creerEnBase,
  ecrireSaisies,
  enregistrerCorrections,
  modifierEmploye as modifierEnBase,
  parametresPaie,
  periodeVue,
} from '@/lib/data/heures'
import {
  cloturerPeriodeSchema,
  copierSemainePrecedenteSchema,
  corrigerSemaineSchema,
  creerEmployeSchema,
  enregistrerSemaineSchema,
  modifierEmployeSchema,
} from '@/lib/validations/heures'
import { ErreurMetier } from '@/lib/erreurs'
import { enumerer } from '@/lib/enumerer'

/**
 * Actions du suivi des heures — toutes issues de `createAction`.
 *
 * Le module n'est pas cloisonné par entreprise : c'est `createAction` et non
 * `createActionCloisonnee` qui s'applique (exigence HEU-2).
 *
 * La lecture seule après clôture est vérifiée **ici**, pas seulement à
 * l'affichage : un Server Action ne traverse pas les layouts, et une grille
 * grisée dans le navigateur n'empêche personne d'appeler la mutation.
 */

const CHEMIN = '/heures'

/** Semaine affichée et période de paie qui la contient. */
async function contexteSemaine(debutIso: string) {
  const parametres = await parametresPaie()
  const semaineDebut = lundiDe(jour(debutIso))
  const semaine = { debut: semaineDebut, fin: ajouterJours(semaineDebut, 6) }
  const periode = periodeDe(semaineDebut, parametres.joursPeriode)
  return { parametres, semaine, periode }
}

async function refuserSiCloturee(periode: { debut: Date; fin: Date }) {
  const vue = await periodeVue(periode)
  if (vue.cloturee) {
    throw new ErreurMetier(
      'Cette période est clôturée. Passez par « Corriger » pour consigner une modification.',
    )
  }
}

/** « lundi 3 août » — la cellule refusée, telle qu'elle se lit dans la grille. */
function jourNomme(iso: string): string {
  const d = jour(iso)
  return `${NOMS_JOURS[(d.getUTCDay() + 6) % 7]} ${libelleJourMois(d)}`
}

/**
 * Refus de concurrence sur la grille.
 *
 * Les cellules sont **nommées** : sur soixante saisies, « une valeur a changé »
 * ne dit pas laquelle a été refusée, et tout est refait.
 */
function refuserConflits(conflits: readonly ConflitCellule[]) {
  if (conflits.length === 0) return

  /*
    Plafonné à trois noms — section 19, qui prend PRÉCISÉMENT ce message comme
    exemple. Sans plafond, une semaine complète en nommait soixante : le refus
    débordait de la notification, et plus personne n'y lisait quelle cellule
    avait bougé.
  */
  const liste = enumerer(conflits.map((c) => `${c.nom} — ${jourNomme(c.date)}`))
  throw new ErreurMetier(
    `Ces heures ont été modifiées ailleurs entre-temps : ${liste}. Rechargez la page avant de recommencer.`,
  )
}

export const enregistrerSemaine = createAction({
  permission: 'heures:saisir',
  schema: enregistrerSemaineSchema,
  action: 'Saisie d’heures',
  entite: (e) => libelleSemaine(lundiDe(jour(e.debut))),
  async handler(entree, { session }) {
    const { periode } = await contexteSemaine(entree.debut)
    await refuserSiCloturee(periode)

    // L'auteur accompagne l'écriture : chaque valeur remplacée ou effacée est
    // consignée avec son nom (TR-9). Le journal d'audit, lui, ne retient que
    // « Saisie d'heures » et la semaine — pas les valeurs.
    const { ecrites, conflits } = await ecrireSaisies(entree.saisies, {
      id: session.userId,
      nom: session.nom,
    })
    refuserConflits(conflits)

    revalidatePath(CHEMIN)
    revalidatePath('/heures/employes')
    return { ecrites }
  },
})

export const copierSemainePrecedente = createAction({
  permission: 'heures:saisir',
  schema: copierSemainePrecedenteSchema,
  action: 'Saisie d’heures',
  entite: (e) => libelleSemaine(lundiDe(jour(e.debut))),
  async handler(entree, { session }) {
    const { semaine, periode } = await contexteSemaine(entree.debut)
    await refuserSiCloturee(periode)

    const precedente = {
      debut: ajouterJours(semaine.debut, -7),
      fin: ajouterJours(semaine.debut, -1),
    }

    // L'auteur accompagne la copie : elle écrase une semaine entière, et chaque
    // valeur détruite est consignée à son nom (TR-9).
    const copiees = await copierSemaine(precedente, semaine, {
      id: session.userId,
      nom: session.nom,
    })

    revalidatePath(CHEMIN)
    revalidatePath('/heures/employes')
    return { copiees }
  },
})

export const cloturerPeriode = createAction({
  permission: 'heures:cloturer',
  schema: cloturerPeriodeSchema,
  action: 'Clôture d’une période',
  sensible: true,
  entite: (e) => libellePeriode({ debut: jour(e.debut), fin: jour(e.fin) }),
  async handler(entree, { session }) {
    const parametres = await parametresPaie()
    /**
     * Les bornes reçues sont recalculées à partir du découpage officiel : le
     * navigateur ne choisit pas ce qu'est une période de paie, sinon deux
     * clôtures pourraient se chevaucher et laisser des jours sans registre.
     */
    const periode = periodeDe(jour(entree.debut), parametres.joursPeriode)

    await cloturerEnBase(periode, session.nom)

    revalidatePath(CHEMIN)
    return { debut: entree.debut }
  },
})

export const corrigerSemaine = createAction({
  permission: 'heures:corriger',
  schema: corrigerSemaineSchema,
  action: 'Correction d’heures',
  sensible: true,
  entite: (e) => `${libelleSemaine(lundiDe(jour(e.debut)))} — ${e.motif}`,
  async handler(entree, { session }) {
    const { ecrites, conflits } = await enregistrerCorrections(entree.saisies, entree.motif, {
      id: session.userId,
      nom: session.nom,
    })
    refuserConflits(conflits)

    revalidatePath(CHEMIN)
    revalidatePath('/heures/employes')
    return { corrigees: ecrites }
  },
})

export const creerEmploye = createAction({
  permission: 'heures:employes',
  schema: creerEmployeSchema,
  action: 'Création d’un employé',
  entite: (e) => e.nom,
  async handler(entree) {
    const employeId = await creerEnBase({
      nom: entree.nom,
      entrepriseSlug: entree.entrepriseSlug,
      tauxCents: entree.tauxHoraire === null ? null : enCentiemes(entree.tauxHoraire),
      actif: entree.actif,
      notes: entree.notes,
    })

    revalidatePath(CHEMIN)
    revalidatePath('/heures/employes')
    return { employeId }
  },
})

export const modifierEmploye = createAction({
  permission: 'heures:employes',
  schema: modifierEmployeSchema,
  action: 'Modification d’un employé',
  entite: (e) => e.nom,
  async handler(entree) {
    const applique = await modifierEnBase(entree.employeId, entree.version, {
      nom: entree.nom,
      entrepriseSlug: entree.entrepriseSlug,
      tauxCents: entree.tauxHoraire === null ? null : enCentiemes(entree.tauxHoraire),
      actif: entree.actif,
      notes: entree.notes,
    })

    if (!applique) {
      throw new ErreurMetier(
        'Cette fiche a été modifiée ailleurs entre-temps. Rechargez la page avant de recommencer.',
      )
    }

    revalidatePath(CHEMIN)
    revalidatePath('/heures/employes')
    revalidatePath(`/heures/employes/${entree.employeId}`)
    return { employeId: entree.employeId }
  },
})
