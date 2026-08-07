import { AlertCircle } from 'lucide-react'

/**
 * Message d'échec des écrans d'authentification.
 *
 * `role="alert"` le fait lire à l'instant où il paraît : sans session, aucune
 * autre annonce ne signale que la soumission a échoué.
 */
export function MessageErreurAuth({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="text-critical-texte flex items-start gap-2 text-[13px] leading-[18px]"
    >
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
