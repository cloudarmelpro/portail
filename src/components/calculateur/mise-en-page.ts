/**
 * Colonne de contenu des écrans du calculateur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Elle est écrite ICI parce qu'elle est partagée par trois écrans qui ne se
 * lisent pas ensemble — la calculette, la liste, le document.
 *
 * Le commutateur de vue vit dans cette colonne : deux écrans qui ne la
 * mesureraient pas pareil feraient sauter les onglets de quelques dizaines de
 * pixels au moment précis où l'on passe de l'un à l'autre.
 *
 * Le retrait latéral commence à 1536 et non à 1280, contrairement au CRM : à
 * 1280 la calculette pose déjà deux colonnes — la saisie et le total en direct —
 * et les 192 px de marges y prendraient la moitié de la largeur du sélecteur de
 * service. Le retrait sert la lecture d'une liste ; il dessert un plan de
 * travail.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const COLONNE_CONTENU = 'mt-10 2xl:mx-24'
