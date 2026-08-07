import { NextResponse } from 'next/server'
import { journaliser, journaliserRefus } from '@/lib/audit'
import { entreprise, estEntreprise } from '@/config/entreprises'
import { listerEmployes, parametresPaie, saisiesEntre } from '@/lib/data/heures'
import {
  NOMS_JOURS,
  aujourdHui,
  compilerPeriode,
  enIso,
  formaterDecimal,
  grouperParSemaine,
  jour,
  libelleDate,
  libellePeriode,
  semainesDe,
} from '@/lib/domaine/heures'
import { sessionCourante } from '@/lib/guards'
import { aPermission } from '@/lib/permissions'
import { periodeExportSchema } from '@/lib/validations/heures'

/**
 * Export de la période — exigence HEU-11.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CSV et non `.xlsx`.
 *
 * Le fichier est consommé par Excel, jamais relu par l'application : mise en
 * forme, formules et onglets n'y ont aucun rôle. Un CSV bien formé — séparateur
 * point-virgule, décimale à la virgule, BOM UTF-8 pour les accents — s'ouvre
 * d'un double-clic au Québec et évite d'embarquer un générateur de classeur.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Route et non Server Action : c'est un téléchargement, pas une mutation. Elle
 * refait donc à la main ce que la fabrique impose ailleurs — session, permission,
 * puis journal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Journalisé, bien qu'aucune donnée ne soit modifiée.
 *
 * TR-5 ne vise littéralement que les mutations et les consultations de CV, et
 * l'export y échappe. Mais c'est le seul geste du module qui fait SORTIR de
 * l'application les noms, les heures et les montants de tout le personnel, vers
 * un fichier qui vivra ensuite hors de tout contrôle. Un registre de paie se
 * conserve six ans (TR-6) ; savoir qui en a tiré une copie, et quand, relève de
 * la même exigence.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function GET(requete: Request) {
  const session = await sessionCourante()
  if (!session) return NextResponse.json({ erreur: 'Non authentifié.' }, { status: 401 })
  if (!aPermission(session.role, 'heures:lire')) {
    // Le refus est journalisé comme le succès : ADM-4 vise les tentatives
    // refusées, et une route n'en était pas dispensée.
    await journaliserRefus({
      userId: session.userId,
      utilisateurNom: session.nom,
      module: 'heures',
      entite: 'heures:lire',
    })
    return NextResponse.json({ erreur: 'Accès refusé.' }, { status: 403 })
  }

  const url = new URL(requete.url)
  const bornes = periodeExportSchema.safeParse({
    debut: url.searchParams.get('debut'),
    fin: url.searchParams.get('fin'),
  })
  if (!bornes.success) {
    return NextResponse.json({ erreur: 'Période invalide.' }, { status: 400 })
  }

  const periode = { debut: jour(bornes.data.debut), fin: jour(bornes.data.fin) }
  if (periode.fin < periode.debut) {
    return NextResponse.json({ erreur: 'Période invalide.' }, { status: 400 })
  }

  /*
    Journalisé AVANT de construire le fichier, comme la route de téléchargement
    des CV. Après l'envoi, il est trop tard : une écriture qui échoue laisserait
    une copie du registre de paie partie sans trace.
  */
  await journaliser({
    userId: session.userId,
    utilisateurNom: session.nom,
    action: 'Export d’une période d’heures',
    module: 'heures',
    entite: libellePeriode(periode),
    sensible: true,
  })

  const parametres = await parametresPaie()
  const [employes, saisies] = await Promise.all([listerEmployes(), saisiesEntre(periode)])
  const semaines = semainesDe(periode)

  const nomEntreprise = (slug: string) => (estEntreprise(slug) ? entreprise(slug).nom : slug)

  const lignes: string[][] = [
    [`Suivi des heures — ${libellePeriode(periode)}`],
    ['Généré le', libelleDate(aujourdHui())],
    [],
    [
      'Employé',
      'Entreprise',
      'Taux horaire',
      'Date',
      'Jour',
      'Heures',
      'Note',
      'Total normal',
      'Total supplémentaire',
      'Montant',
    ],
  ]

  for (const e of employes) {
    const siennes = saisies.filter((s) => s.employeId === e.id)
    // Un employé inactif sans heures sur la période n'a pas à figurer au
    // registre ; avec des heures, il y figure — elles ont été travaillées.
    if (!e.actif && siennes.length === 0) continue

    // Vide et non « 0,00 » : sans taux renseigné, seules les heures sont
    // totalisées (HEU-8). Un zéro se lirait « travaille gratuitement ».
    const taux = e.tauxCents === null ? '' : formaterDecimal(e.tauxCents)

    for (const s of siennes) {
      lignes.push([
        e.nom,
        nomEntreprise(e.entrepriseSlug),
        taux,
        s.date,
        NOMS_JOURS[(jour(s.date).getUTCDay() + 6) % 7],
        formaterDecimal(s.centiemes),
        s.note ?? '',
        '',
        '',
        '',
      ])
    }

    const compilation = compilerPeriode(
      grouperParSemaine(siennes, semaines),
      e.tauxCents,
      parametres,
    )

    lignes.push([
      e.nom,
      nomEntreprise(e.entrepriseSlug),
      taux,
      '',
      'Total',
      formaterDecimal(compilation.total),
      '',
      formaterDecimal(compilation.normales),
      formaterDecimal(compilation.supplementaires),
      compilation.montantCents === null ? '' : formaterDecimal(compilation.montantCents),
    ])
  }

  /*
    L'apostrophe devant `=`, `+`, `-` et `@` désamorce une formule. Le nom d'un
    employé et la note d'une journée sont saisis librement : sans elle, une note
    commençant par `-` s'exécute à l'ouverture chez le comptable. Les guillemets
    ne suffisent pas — Excel les retire avant d'interpréter.
  */
  const cellule = (v: string) => {
    const sur = /^[=+\-@]/.test(v) ? `'${v}` : v
    return `"${sur.replace(/"/g, '""')}"`
  }
  // BOM UTF-8 : sans lui, Excel lit « Développement » en caractères abîmés.
  const texte = `\uFEFF${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`

  return new NextResponse(texte, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="heures_${enIso(periode.debut)}.csv"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
