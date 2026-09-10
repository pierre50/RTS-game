# Grottes

Les grottes utilisent les espaces intérieurs des bâtiments. Entrer ne change pas de monde et ne suspend pas l'économie extérieure.

## Générer les plans

```sh
pnpm caves:generate --seed 4242
```

Sortie : `public/maps/interiors/cave/`, avec un manifest, un catalogue compact préchargé et sept fichiers `.map` accompagnés de leurs aperçus PNG.

- `small` : un cercle repris du générateur d'intérieur pour un bâtiment de taille 3.
- `medium` : trois plans de 32 × 32 cellules.
- `large` : trois plans de 64 × 64 cellules.
- Variantes : `branches`, `loop`, `chamber`.

Le champ technique `size` est l'indice maximal de la grille (31 et 63). La petite grotte conserve la grille locale du blueprint de bâtiment existant. Le sol utilise le même rendu que les intérieurs de bâtiments, sans teinte supplémentaire ni bordure assombrie. Les murs seront ajoutés séparément. Le vert des PNG indique l'entrée ; il s'agit d'un aperçu de contrôle.

La graine rend les contours reproductibles. Tous les passages sont validés depuis l'entrée. Les plans moyens et grands restent dans leur grille d'origine au chargement.

## Attribuer les grottes aux cartes

`pnpm maps:generate` et `pnpm world:generate` passent par la finalisation commune qui attribue une grotte par carte terrestre disposant d'une zone plane. Les cartes entièrement aquatiques n'en reçoivent pas. Le placement réserve une marge de 18 cellules depuis les bords de la carte, y compris les limites de la grille locale, et évite les villages, les côtes et les pentes. Une clairière de rayon 6 est dégagée autour de la grotte. Les camps de bandits déjà prévus sont placés à 3–5 cellules de son entrée ; leur nombre est conservé. Leurs clairières et leurs chemins de liaison sont dégagés et exclus du placement de la faune. Chaque camp enregistre le `caveId` associé, et les positions locales des camps sont mises à jour dans les cartes et le manifest. Une région trop étroite pour respecter la marge ne reçoit pas de grotte. Si un camp prévu ne peut pas être associé à une grotte, la génération rejette cette carte et essaie une autre graine.

Pour mettre à jour les cartes déjà présentes :

```sh
node tools/finalize-world-maps.cjs public/maps/worlds/world-4242
```

L'attribution existante est conservée. Pour la recalculer explicitement :

```sh
node tools/finalize-world-maps.cjs public/maps/worlds/world-4242 --replan-caves
```

Chaque carte stocke la position, l'identité, la graine et le blueprint de sa grotte. La taille est tirée en premier avec une probabilité de 1/3, puis la variante est choisie uniformément dans cette taille. Aucun tirage ni recherche de placement n'est effectué en jeu.

## Persistance

Le bâtiment conserve sa définition `cave` dans la sauvegarde. Les coffres et autres bâtiments intérieurs utilisent la sauvegarde existante des intérieurs. Les unités et corpses conservent aussi leurs coordonnées dans la grotte ; le rechargement restaure cet espace et la vue du héros. L'extérieur continue de tourner pendant la visite.

Les anciennes sauvegardes contenant une grotte sans définition utilisent le petit cercle, sans tirer de nouvelle taille. Les cartes déjà sauvegardées sans grotte ne sont pas modifiées automatiquement.

Seules les grottes associées aux bandits reçoivent un coffre de butin et des décorations de camp. Un seul feu reste à l'extérieur, avec tous les bandits. Les meubles préservent l'accès à l'entrée et la connexion des couloirs. Leur contenu est sauvegardé sans être recréé lors des visites ou des chargements. Les grottes sans camp restent vides. Les compagnons et les adversaires utilisent les mécanismes existants de passage entre espaces.

Ne pas remplacer les plans d'une partie en cours par une nouvelle graine : les coordonnées des occupants sauvegardés se rapportent à leur plan d'origine.

Les coffres et décorations des repaires appartiennent au joueur bandit de la carte. Leur couleur provient normalement de ce propriétaire. La grotte reste neutre. Les sauvegardes imbriquent les objets selon leur espace et conservent leur propriétaire dans `interiorOwner`. Les anciens objets de repaire neutres sont transférés aux bandits au chargement, sans modifier leur inventaire. Tous les joueurs sont restaurés avant le contenu des intérieurs.
