/**
 * En-tête des trois écrans d'authentification — pilule, titre, sous-titre.
 *
 * Il existe pour que les trois écrans ne puissent pas diverger : ils partageaient
 * déjà le même gabarit, chacun le réécrivait, et les tailles avaient commencé à
 * s'écarter d'un écran à l'autre.
 *
 * Le titre se lit sur deux lignes, la première en encre tertiaire — c'est le seul
 * endroit du produit où le Display de 38 px sert. `surtitre` s'omet quand le
 * titre tient sur une ligne.
 */
export function EnteteAuth({
  surtitre,
  titre,
  sousTitre,
}: {
  surtitre?: string
  titre: string
  sousTitre: string
}) {
  return (
    <header className="mt-9 text-center">
      <span className="border-border bg-surface text-ink3 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] leading-[14px] font-medium tracking-[0.02em]">
        Accès réservé
      </span>

      <h1 className="mt-5 text-[30px] leading-[36px] font-semibold tracking-[-0.03em] md:text-[38px] md:leading-[44px]">
        {surtitre && (
          <>
            <span className="text-ink3">{surtitre}</span>
            <br />
          </>
        )}
        {titre}
      </h1>

      <p className="text-ink2 mx-auto mt-3 max-w-[34ch] text-[15px] leading-[22px]">{sousTitre}</p>
    </header>
  )
}
