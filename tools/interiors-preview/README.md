# Prévisualisation des intérieurs

```sh
pnpm interiors:preview
pnpm interiors:preview --serve
```

Le premier appel génère `reports/interiors/index.html`. Le second génère le même rapport et le sert sur `http://127.0.0.1:8880` (changer avec `--port`). Le rapport fonctionne aussi en ouvrant le fichier HTML, sans serveur : les sprites sont inclus dans le script généré.

Après une modification du code ou des sprites, relancer la commande puis recharger la page. Les fichiers générés sont ignorés par Git.

## Commandes de la page

- Sélection du bâtiment et de ses niveaux réellement disponibles.
- Aménagement prédéfini IA ou bâtiment du joueur.
- Mobilier, murs, grille, coordonnées, orientation inversée et zoom.
- Survol des cases et liste des positions du mobilier.
- Export PNG de la vue, avec fond transparent en option.

## Modifier les meubles pour le jeu

Lancer `pnpm interiors:preview --serve`, choisir le bâtiment, son niveau et l’aménagement IA, puis activer **Modifier les meubles**. Glisser un meuble sur la grille et cliquer sur **Enregistrer pour le jeu**. **Annuler la modification** revient sur la dernière action (déplacement, ajout, suppression ou rotation). Les placements hors de la pièce, les chevauchements réels et les passages bloqués sont refusés. Les meubles peuvent se toucher ou longer un mur : aucune marge invisible n’est ajoutée aux aménagements enregistrés. Les cases réellement occupées sont surlignées à la sélection.

Le catalogue **Ajouter une décoration** réutilise les catégories et les sprites du jeu. Choisir un meuble, cliquer sur **Ajouter dans la pièce**, puis sur une case libre. Sélectionner un meuble dans la pièce ou dans la liste pour le **Supprimer** ou le **Tourner ↔**. La rotation utilise les deux orientations miroir disponibles dans les sprites. Échap annule le mode ajout.

La liste complète des meubles, leurs orientations et leurs positions sont enregistrées dans `app/config/interiorLayoutPositions.json`, par bâtiment et par niveau. Les anciens fichiers contenant seulement des positions restent compatibles ; une nouvelle sauvegarde enregistre un aménagement complet, y compris une pièce vide. Les deux orientations partagent le même aménagement. Le jeu lit directement cette configuration pour ses nouveaux intérieurs prédéfinis ; le mobilier déjà présent dans une sauvegarde est conservé. Reconstruire le jeu pour distribuer les nouveaux aménagements. Les tapis ajoutés depuis le catalogue se modifient comme les autres meubles. Les tapis déjà présents en fond de pièce sont également sélectionnables, déplaçables, orientables et supprimables. Ils apparaissent avec la mention « (sol) » dans la liste et restent sous les meubles, sans collision. Une liste `rugs` vide supprime tous les tapis prédéfinis de ce bâtiment/niveau ; son absence conserve les tapis historiques. Cette couche de sol est relue à la création de la scène intérieure, y compris lors du chargement d’une partie existante.

Le mode fichier HTML seul permet de consulter et d’exporter, mais pas d’enregistrer. Des modifications concurrentes du fichier sont détectées pour éviter de les écraser.

Le rapport utilise les profils d’intérieur, les règles de placement et les empreintes du jeu. Le mobilier est créé dans une scène indépendante, sans lancer une partie ni lire les sauvegardes. Le dessin utilise les atlas actuels sur un canvas ; il ne reproduit pas l’éclairage dynamique, les ombres, les animations, les personnages ou les chevaux. Les grottes sont exclues.

## Vérification

Après génération : `node tools/interiors-preview/verify.cjs`.

La vérification ouvre un navigateur Electron isolé et invisible, parcourt les bâtiments/niveaux, les deux aménagements et orientations, vérifie les 1/2/4 lits des maisons et les options d’affichage/export. Une capture est enregistrée dans `reports/interiors/preview.png`.

`node tools/interiors-preview/verify-editor.cjs` teste le glisser-déposer, l’ajout, la suppression, la rotation, l’annulation, l’enregistrement et le rechargement avec un fichier temporaire, sans modifier la configuration du jeu. Capture : `reports/interiors/editor-preview.png`.

## Taille intérieure

Le sélecteur **Taille de la pièce** règle un carré de 5 à 17 cases de côté, par pas de 2, avec les petits angles existants. La valeur interne `roomSize` inclut les deux cases techniques supplémentaires. La taille extérieure et les sprites du bâtiment ne changent pas.

Les positions restent relatives au centre. Les meubles hors de la pièce restent dans le brouillon et dans la liste ; les déplacer ou les supprimer avant de sauvegarder. Une modification de taille peut être annulée. Pour les maisons, chaque niveau possède sa propre taille et son propre aménagement. Enregistrer un niveau ne modifie ni ne valide les autres niveaux. Les pièces déjà ouvertes ne sont pas redimensionnées à chaud.

## Intérieurs partagés entre niveaux

Tous les bâtiments sauf les maisons utilisent l’aménagement du niveau 1 : dimensions, meubles et tapis. Dans la preview, le choix du niveau est masqué pour ces bâtiments : toute modification porte sur leur intérieur commun du niveau 1. Les éventuelles anciennes variantes de niveaux supérieurs restent dans le fichier, sans être utilisées.

Les maisons conservent leurs meubles et tapis propres à chaque niveau, avec une taille indépendante pour chaque niveau.
