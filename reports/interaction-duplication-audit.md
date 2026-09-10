# Audit des interactions répétées — 11 septembre 2026

## Résultat

Une duplication confirmée et corrigée : récupérer un piège plusieurs fois avant la fin de sa disparition donnait plusieurs objets. Aucun autre défaut de duplication identifié dans les parcours examinés ci-dessous. Ce résultat porte sur les appels répétés et les transitions différées ; il ne constitue pas un audit exhaustif de toute l'économie du jeu.

## Pièges : cause et correction

`recoverTrapBuilding` créditait l'inventaire avant de retirer le bâtiment du monde, retrait effectué dans le callback de `fadeOut`. Pendant ce délai, le bâtiment restait vivant, présent dans sa cellule et dans la liste de son propriétaire. Chaque nouvelle récupération créditait un objet et remplaçait l'animation précédente. Pour un piège rempli, ce remplacement pouvait aussi perdre le callback portant la proie.

La récupération marque maintenant le piège comme mort avant le crédit, le retire immédiatement des collections du monde et libère sa proie immédiatement. Seul le nettoyage visuel attend la fin de l'animation. Les vérifications existantes excluent donc ce piège des interactions et du remplissage quotidien. Les données du monde sont déjà cohérentes pendant l'animation : le piège est dans le sac, sa proie est dans le monde et le bâtiment a quitté la liste du propriétaire.

Conséquence visuelle : la proie apparaît dès la récupération, pendant que le piège termine son fondu. Le nettoyage final ne retire pas un nouvel occupant de la cellule.

Les anciens tests exécutaient le callback de disparition immédiatement ; ils ne pouvaient pas détecter cette fenêtre. Deux nouveaux tests maintiennent le callback en attente et répètent les appels sur des pièges vides et remplis, avec deux héros. Ils vérifient un seul objet, un seul son, une seule animation, la proie, le retrait des collections avant la fin du fondu, l'absence de remplissage quotidien et la conservation d'un nouvel occupant de la cellule.

## Cas examinés

| Parcours | Protection observée | Vérification |
| --- | --- | --- |
| Récupération de pièges | Consommation immédiate du bâtiment ; animation uniquement visuelle | Nouveaux tests différés et répétés, vides et remplis |
| Butin des cadavres | Retrait de l'équipement de la liste ; diminution des ressources pendant l'appel | Tests existants d'équipement et ressources ; ajout de 20 appels après épuisement des ressources |
| Transferts sac/coffre | Retrait de la source avant crédit et notification du destinataire | Ajout de 20 transferts répétés après épuisement, objets et ressources |
| Achat au marché | Quantité limitée par l'or et le stock ; stock et or débités dans le même appel | Nouveau test de 20 achats après épuisement du stock |
| Vente au marché | Retrait de chaque objet avant crédit d'or ; ressources diminuées dans le même appel | Nouveau test de 20 ventes après épuisement de l'objet ; tests existants de vente de ressources |
| Fabrication | Ressources vérifiées et retirées avant création des objets | Ajout de 20 tentatives après une fabrication qui épuise les ingrédients nécessaires |
| Consommables et équipement | Consommable retiré avant soin ; déplacement entre sac et emplacement équipé | Lecture et tests existants de fabrication/équipement |
| Placement des objets construisibles | Objet retiré avant construction ; rendu si l'achat échoue ; aperçu supprimé après succès | Lecture de `BuildingPlacer` et tests existants de placement |
| Formation et annulation | Ordre du stagiaire effacé avant le fondu ; files de formation mises à jour dans l'appel de remboursement | Lecture de `BuildingTraineeTraining`, `BuildingUnitTrainingCancellation` et tests existants de production |
| Monter/descendre du cheval | Transition refusée si une tâche de transition existe déjà ; état monté vérifié | Lecture de `HeroCompanionHorseController` et tests existants du compagnon |
| Entrées/sorties et voyages | Verrous de transition et désactivation des entrées pendant les opérations asynchrones | Lecture des parcours de voyage ; tests existants de voyage intérieur |
| Touche maintenue | Les événements clavier répétés sont déjà filtrés pour les actions hors caméra | Lecture de `ControlsKeyboard` ; ce filtre ne suffit pas contre plusieurs appuis distincts |

Les opérations répétables, comme acheter ou fabriquer, restent autorisées tant que leur coût est payé à chaque fois. Aucun délai arbitraire n'a été ajouté.

## Validation

- 145 tests ciblés réussis : pièges, interactions de proximité, butin, marché, fabrication, transferts, placement, production, voyages intérieurs et compagnon cheval.
- `pnpm typecheck` réussi.
- ESLint réussi sur les six fichiers de code/tests modifiés pour ce correctif.
- Pas de validation manuelle en jeu ni de lancement de la totalité des tests du dépôt. Les tests différés contrôlent l'état utilisé pour sauvegarder, sans effectuer eux-mêmes un cycle complet de sauvegarde/rechargement.

Les modifications déjà présentes dans le dépôt ont été conservées. Les objets dupliqués avant ce correctif ne sont pas retirés des sauvegardes : leur origine ne peut pas être distinguée d'objets légitimement acquis.
