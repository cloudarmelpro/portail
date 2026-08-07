/**
 * Mise en forme des caractéristiques d'un fichier de la banque de CV.
 *
 * Partagé entre le tableau et l'aperçu : la taille d'un même fichier doit se
 * lire à l'identique dans les deux, sans quoi on croit à deux fichiers.
 */

export function formaterTaille(octets: number): string {
  return octets < 1024 * 1024
    ? `${Math.round(octets / 1024)} Ko`
    : `${(octets / 1024 / 1024).toFixed(1)} Mo`
}

const FORMATS: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}

/**
 * Le type MIME ne se montre pas à l'écran : la section 19 ne connaît que
 * « PDF, DOC et DOCX ». Un type inattendu se tait plutôt que d'afficher une
 * chaîne technique.
 */
export function formatLisible(typeMime: string): string | null {
  return FORMATS[typeMime] ?? null
}
