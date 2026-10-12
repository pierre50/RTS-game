# Export PNG des interfaces

Depuis la racine du dépôt :

```sh
pnpm ui:png
```

Construit la galerie puis exporte les fenêtres dans `reports/ui-gallery/` :

- un PNG par écran, en **1600 × 1000 pixels** par défaut ;
- `index.html` pour parcourir les captures ;
- `manifest.json` avec les écrans capturés, dimensions, débordements et erreurs.

```sh
pnpm ui:png --width 1920 --height 1080
pnpm ui:png --list
pnpm ui:png --only 02-forge,03-marche,12-dialogue
pnpm ui:png --out reports/ui-mobile --width 800 --height 900
pnpm ui:png --lang en
```

`--no-build` réutilise une galerie déjà compilée. L’omettre après un changement de code ou de styles. Les fichiers portant le même nom sont remplacés ; les autres fichiers du dossier restent intacts. Le script termine avec un code non nul si la construction ou une capture échoue. Il poursuit les autres captures après une erreur de rendu.

## Couverture

26 vues : feu de camp, forge, marché, butin, coffre, onglets du menu I (Inventaire, Personnage, Carte, Construction et sa variante en intérieur), formation (disponible et en cours), réserves, quêtes, dialogue / ordres, fiche de bâtiment, pause, paramètres du jeu, graphismes, clavier, manette, amélioration du bâtiment, sauvegardes, nouvelle partie, erreur de sauvegarde, fiche de ressource.

La galerie réutilise les composants et les styles du jeu, avec des **données de démonstration**. Elle ne photographie pas la partie ouverte. Les scènes de conversation et de butin sont des exemples de disposition ; elles ne couvrent pas toutes les branches de dialogue ni tous les états possibles. La carte est volontairement sans monde chargé et la liste des sauvegardes est vide. Les libellés propres aux exemples restent en français avec `--lang en` ; les libellés des composants suivent la langue choisie.

Electron utilise un profil temporaire et une session séparée, sans accès aux sauvegardes de la partie. Les ressources sont servies sur une adresse locale temporaire ; les requêtes externes sont bloquées. Aucun serveur ne reste ouvert après l’export.

## Ajouter un écran

Ajouter son identifiant stable et son nom au catalogue `screens` dans `index.ts`, puis son rendu dans `show`. Réutiliser le composant de production, fournir des données déterministes et un nettoyage dans `cleanup` si nécessaire. La commande `--list` expose les identifiants utilisables avec `--only`. Conserver les identifiants existants lors du renommage ou du retrait d’une vue.

`pnpm ui:gallery` construit uniquement la page de contrôle interactive dans `build/ui-gallery`. L’exporteur la sert automatiquement avec les ressources du jeu.
