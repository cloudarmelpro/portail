'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ContenuDialogue } from '@/components/shared/contenu-dialogue'
import { Bouton, classesBouton } from '@/components/shared/bouton'
import { Tronque } from '@/components/shared/tronque'
import { formaterTaille } from '@/components/cv/format-fichier'
import { confirmerTeleversement, preparerTeleversement } from '@/lib/actions/cv'
import { notifier } from '@/lib/toast'
import { cn } from '@/lib/utils'

const TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const TAILLE_MAX = 10 * 1024 * 1024

type EnCours = { nom: string; etat: 'attente' | 'envoi' | 'fait' | 'echec'; message?: string }

type Props = {
  /** Catégorie du dossier ouvert, préselectionnée pour le lot. Absente depuis « Tous les CV ». */
  categorieId?: string
  categories: { id: string; nom: string }[]
}

/**
 * Dépôt de CV — exigence CV-6, catégories affectées AU LOT.
 *
 * Le fichier part DIRECTEMENT du navigateur vers le stockage, via un lien signé.
 * Il ne transite jamais par le serveur : cela évite de saturer la mémoire du
 * conteneur sur un CV volumineux et supprime tout risque de fichier résiduel.
 *
 * Le dépôt se fait donc en deux temps — choisir, puis envoyer. Le classement ne
 * peut pas se décider après coup : l'envoi commence dès le premier fichier, et
 * il n'existe plus d'écran pour revenir sur le lot entier.
 */
export function BoutonDepot({ categorieId, categories }: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [survol, setSurvol] = useState(false)
  const [enAttente, setEnAttente] = useState<File[]>([])
  /*
    Depuis « Tous les CV », il n'y a pas de dossier courant : rien n'est coché,
    et la ligne d'état sous la liste dit où ira le lot faute de choix. Le
    classement cesse d'être une conséquence de l'endroit d'où l'on a cliqué.
  */
  const [choisies, setChoisies] = useState<Set<string>>(
    () => new Set(categorieId ? [categorieId] : []),
  )
  const [encours, setEncours] = useState<EnCours[]>([])
  const [enTransition, demarrer] = useTransition()
  const champ = useRef<HTMLInputElement>(null)
  const titreCategories = useId()
  const router = useRouter()

  const enEnvoi = encours.length > 0 && encours.some((f) => f.etat !== 'fait' && f.etat !== 'echec')
  const termine =
    encours.length > 0 && encours.every((f) => f.etat === 'fait' || f.etat === 'echec')
  const reussis = encours.filter((f) => f.etat === 'fait').length

  function retenir(fichiers: File[]) {
    // Une fois l'envoi lancé, le lot est figé : le classement a déjà été
    // décidé pour lui, et un fichier ajouté ici n'aurait plus d'écran.
    if (encours.length > 0) return

    const retenus = fichiers.filter((f) => {
      if (!TYPES.includes(f.type)) {
        notifier.erreur(`« ${f.name} » — formats acceptés : PDF, DOC et DOCX.`)
        return false
      }
      if (f.size > TAILLE_MAX) {
        notifier.erreur(`« ${f.name} » dépasse 10 Mo.`)
        return false
      }
      return true
    })
    if (!retenus.length) return

    setEnAttente((liste) => [
      ...liste,
      // Le même fichier glissé deux fois n'est pas deux candidatures.
      ...retenus.filter((f) => !liste.some((x) => x.name === f.name && x.size === f.size)),
    ])
  }

  function basculer(id: string) {
    setChoisies((s) => {
      const suivante = new Set(s)
      if (suivante.has(id)) suivante.delete(id)
      else suivante.add(id)
      return suivante
    })
  }

  async function deposer() {
    const lot = enAttente
    const categorieIds = [...choisies]
    if (!lot.length) return

    setEncours(lot.map((f) => ({ nom: f.name, etat: 'attente' })))

    for (const [i, fichier] of lot.entries()) {
      setEncours((e) => e.map((x, j) => (j === i ? { ...x, etat: 'envoi' } : x)))

      const prepare = await preparerTeleversement({
        nom: fichier.name,
        typeMime: fichier.type,
        taille: fichier.size,
      })

      if (!prepare.ok) {
        setEncours((e) =>
          e.map((x, j) => (j === i ? { ...x, etat: 'echec', message: prepare.erreur } : x)),
        )
        continue
      }

      const reponse = await fetch(prepare.donnees.url, {
        method: 'PUT',
        body: fichier,
        headers: { 'Content-Type': fichier.type },
      })

      if (!reponse.ok) {
        setEncours((e) =>
          e.map((x, j) =>
            j === i ? { ...x, etat: 'echec', message: 'Envoi refusé par le stockage.' } : x,
          ),
        )
        continue
      }

      const confirme = await confirmerTeleversement({
        cle: prepare.donnees.cle,
        nom: fichier.name,
        categorieIds,
      })

      setEncours((e) =>
        e.map((x, j) =>
          j === i
            ? confirme.ok
              ? { ...x, etat: 'fait' }
              : { ...x, etat: 'echec', message: confirme.erreur }
            : x,
        ),
      )
    }

    setEnAttente([])
    demarrer(() => router.refresh())
  }

  function fermer(ouvrir: boolean) {
    setOuvert(ouvrir)
    if (!ouvrir) {
      if (reussis > 0) notifier.succes(`${reussis} CV déposé${reussis > 1 ? 's' : ''}.`)
      setEncours([])
      setEnAttente([])
      setChoisies(new Set(categorieId ? [categorieId] : []))
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={fermer}>
      <DialogTrigger className={classesBouton({ variante: 'principale', taille: 'lg' })}>
        Upload
      </DialogTrigger>

      <ContenuDialogue className="sm:max-w-140">
        <DialogHeader>
          <DialogTitle>Déposer un CV</DialogTitle>
          <DialogDescription>
            Glissez les fichiers ou choisissez-les sur votre appareil.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setSurvol(true)
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSurvol(false)
            retenir(Array.from(e.dataTransfer.files))
          }}
          className={cn(
            'flex h-40 flex-col items-center justify-center rounded-md border border-dashed',
            survol ? 'border-ink bg-hover' : 'border-border-strong',
          )}
        >
          <Upload className="text-ink3 size-6" aria-hidden />
          <p className="text-ink2 mt-3 text-[15px]">Glissez vos fichiers ici</p>
          <Bouton
            variante="secondaire"
            className="mt-3"
            disabled={encours.length > 0}
            onClick={() => champ.current?.click()}
          >
            Choisir des fichiers
          </Bouton>
          <input
            ref={champ}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={(e) => {
              retenir(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
        </div>

        {/* Les contraintes sont écrites ici, pas cachées dans un message d'erreur. */}
        <p className="text-ink3 text-[13px]">PDF, DOC et DOCX — 10 Mo maximum par fichier.</p>

        {enAttente.length > 0 && encours.length === 0 && (
          <ul className="flex max-h-40 flex-col gap-1.5 overflow-auto">
            {enAttente.map((f) => (
              <li key={`${f.name}-${f.size}`} className="flex items-center gap-2.5 text-[13px]">
                <FileText className="text-ink3 size-4 shrink-0" aria-hidden />
                <Tronque className="max-w-none min-w-0 flex-1">{f.name}</Tronque>
                <span className="text-ink3 shrink-0 tabular-nums">{formaterTaille(f.size)}</span>
              </li>
            ))}
          </ul>
        )}

        {encours.length === 0 && (
          <div role="group" aria-labelledby={titreCategories} className="flex flex-col gap-2">
            <p id={titreCategories} className="text-[13px] font-medium">
              Catégories
            </p>

            {categories.length === 0 ? (
              <p className="text-ink3 text-[13px]">
                Aucune catégorie n’existe encore. Créez-en une depuis «&nbsp;Gérer les
                catégories&nbsp;».
              </p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto">
                {categories.map((c) => (
                  <li key={c.id}>
                    <label className="hover:bg-hover flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-[15px]">
                      <input
                        type="checkbox"
                        checked={choisies.has(c.id)}
                        onChange={() => basculer(c.id)}
                        className="accent-action size-4 shrink-0"
                      />
                      <Tronque className="max-w-none min-w-0 flex-1">{c.nom}</Tronque>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-ink3 text-[13px]">
              {choisies.size === 0
                ? enAttente.length > 1
                  ? 'Aucune catégorie : les fichiers iront dans « Non classé ».'
                  : 'Aucune catégorie : le fichier ira dans « Non classé ».'
                : `${choisies.size} catégorie${choisies.size > 1 ? 's' : ''} sélectionnée${choisies.size > 1 ? 's' : ''}.`}
            </p>
          </div>
        )}

        {encours.length > 0 && (
          <ul className="flex max-h-52 flex-col gap-1.5 overflow-auto">
            {encours.map((f) => (
              <li key={f.nom} className="flex items-center gap-2.5 text-[13px]">
                <FileText className="text-ink3 size-4 shrink-0" aria-hidden />
                <Tronque className="max-w-none min-w-0 flex-1">{f.nom}</Tronque>
                {f.etat === 'envoi' && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {/* Les deux issues portent une icône ET un mot : l'une sans l'autre
                    ferait reposer l'information sur la couleur seule. */}
                {f.etat === 'fait' && (
                  <span className="text-ink2 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="text-good size-3.5" aria-hidden />
                    Déposé
                  </span>
                )}
                {f.etat === 'echec' && (
                  <span className="text-ink2 flex items-center gap-1 text-[11px]">
                    <AlertCircle className="text-critical size-3.5" aria-hidden />
                    {f.message ?? 'Échec'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {termine ? (
            <Bouton onClick={() => fermer(false)} disabled={enTransition}>
              Terminer
            </Bouton>
          ) : (
            <>
              <Bouton variante="secondaire" disabled={enEnvoi} onClick={() => fermer(false)}>
                Annuler
              </Bouton>
              <Bouton
                disabled={enAttente.length === 0}
                chargement={enEnvoi}
                onClick={() => void deposer()}
              >
                Déposer
              </Bouton>
            </>
          )}
        </DialogFooter>
      </ContenuDialogue>
    </Dialog>
  )
}
