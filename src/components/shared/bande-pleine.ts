/**
 * Bande qui traverse le panneau d'un bord à l'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Des marges négatives n'y suffisaient pas.
 *
 * Elles annulent le rembourrage de `main`, mais `main` est aussi PLAFONNÉ et
 * centré : au-delà, il reste une gouttière de chaque côté, dont la largeur
 * dépend de celle de la fenêtre. Sur grand écran, le filet s'arrêtait donc à
 * 150 px des bords et la bande flottait au lieu de séparer.
 *
 * `100cqw` est la largeur du PANNEAU, mesurée par la requête de conteneur posée
 * dans `components/layout/shell.tsx`. `50% - 50cqw` ramène le bord gauche de la
 * bande sur celui du panneau, quelle que soit la gouttière.
 *
 * Les deux formes ne diffèrent QUE par le rembourrage reposé à l'intérieur, et
 * ce choix n'est pas cosmétique : il dit à quel niveau appartient ce que la
 * bande porte.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Bande de CHROME — son contenu se pose au bord du panneau.
 *
 * Pour ce qui situe l'écran sans en faire partie : fil d'Ariane, onglets de
 * module, bande de chiffres. Ces éléments répondent à « où suis-je », et leur
 * place est au bord, comme la barre latérale à laquelle ils font suite.
 */
export const BANDE_PLEINE = 'ml-[calc(50%_-_50cqw)] w-[100cqw] px-4 md:px-6 xl:px-8'
