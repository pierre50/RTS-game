# Faune : première séparation simulation / affichage

Les animaux vivants hors caméra conservent leur objet `Animal`, leur cellule, leur identité, leur état et leurs contrôleurs. Ils ne créent plus automatiquement de `AnimatedSprite`, d'ombre, de callbacks de ticker ni d'abonnement aux réglages visuels. La caméra crée ces éléments quand ils deviennent visibles, puis les détruit à la sortie du champ. Les textures partagées restent dans le cache d'assets.

Les déplacements et les tests de blocage utilisent un état de lecture logique : avancer, attendre, voler ou changer d'altitude ne demande plus de sprite. La sauvegarde lit le sprite existant, ou les champs logiques en son absence. Les limites visuelles nécessaires à la caméra sont calculées à partir des textures et partagées.

Les animations possédant un callback, les cadavres et les animaux sélectionnés restent résidents. Plusieurs comportements de combat et de mort utilisent encore les callbacks d'animation comme horloge ; les supprimer modifierait le jeu. Une demande explicite de sprite par une interaction peut également créer l'affichage hors caméra.

Les comportements ambiants gardent une période de 250 ms, répartie en 16 groupes. Un seul rendez-vous dans le scheduler remplace les rendez-vous individuels ; la pause et le temps simulé restent ceux du scheduler. Les déplacements détaillés, la recherche de menaces et les combats continuent hors caméra.

Le chargement des animaux préparés rend la main après environ 8 ms de travail plutôt que toutes les 32 créations. Les traces `blueprint.animals` indiquent total, progression, nombre créé, durée, temps de travail hors attentes (`workMs`), nombre de pauses (`yields`) et mémoire. Les emplacements occupés par les villages restent exclus.

Les animaux sauvages de Gaia ne remplissent plus une grille d'exploration partagée. Un petit état de position/rayon remplace leurs listes de cellules visibles. Le passage dans une nouvelle zone notifie toujours les unités capables de les détecter ; la découverte par les observateurs humains/IA reste active. Les animaux domestiqués, compagnons et unités de Gaia conservent leur vision habituelle.

## Limite de cette étape

Ce n'est pas encore une simulation distante simplifiée : tous les objets Animal/Container et tous les déplacements détaillés restent en mémoire et actifs. Les ressources et les cellules du continent ont aussi leur propre coût. Cette étape réduit l'affichage et la gestion des rendez-vous, elle ne garantit donc pas une carte de 5 000 × 5 000 fluide.

La suite structurelle consiste à sortir les événements de combat/mort de l'animation, puis à faire évoluer la faune éloignée par événements espacés avec réveil au voisinage de toute unité ou activité IA, pas uniquement du héros. Cela nécessite de définir et tester les règles de déplacement et de collision entre deux réveils.
