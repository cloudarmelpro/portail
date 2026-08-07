/**
 * Surligne le terme recherché dans un libellé.
 *
 * Le fond est NEUTRE — `--hover2`, un voile d'encre. Il a emprunté `--warning`,
 * réservé aux états : la section 19 interdit nommément d'en faire un accent
 * décoratif, et c'était exactement ce cas.
 *
 * Le fond suffit à repérer la correspondance ; le texte reste intégralement
 * lisible sans lui.
 */
export function Surligner({ texte, terme }: { texte: string; terme?: string }) {
  const cherche = terme?.trim()
  if (!cherche) return <>{texte}</>

  // Le terme vient de l'utilisateur : il peut contenir des caractères qui ont un
  // sens dans une expression régulière. Sans échappement, « c++ » lèverait une
  // erreur et casserait l'affichage.
  const motif = new RegExp(`(${cherche.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const morceaux = texte.split(motif)

  return (
    <>
      {morceaux.map((m, i) =>
        m.toLowerCase() === cherche.toLowerCase() ? (
          <mark key={i} className="bg-hover2 text-ink rounded-[4px] px-0.5">
            {m}
          </mark>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </>
  )
}
