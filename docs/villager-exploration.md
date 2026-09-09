# Recherche autonome des villageois

Un ordre de métier donné dans la communication reste actif quand aucune ressource n'est connue ou accessible. Après un déplacement d'exploration, le villageois attend 250 ms puis réévalue son métier : il exploite une ressource découverte, ou lance une nouvelle étape. La reprise est programmée par le scheduler, jamais rappelée récursivement depuis la fin du chemin. Les deux sorties de déplacement (arrivée normale et fin du chemin) suivent cette règle.

Une recherche teste au plus 12 chemins. Les destinations essayées sont mémorisées 60 secondes, pour que la recherche suivante puisse tester d'autres destinations. Après un échec, une nouvelle vérification est programmée 2 secondes plus tard. Le rayon initial de 50 cellules augmente par tranches de 50 jusqu'aux limites de la grille. Les cellules connues, l'eau, les côtes et les cellules non utilisables restent filtrées par les règles existantes.

Le nouvel ordre de déplacement annule la reprise en attente. La reprise vérifie aussi la mort, le métier, l'espace de carte, les mouvements et actions en cours, l'abri, la conversation et le suivi du héros. La mémoire des destinations est séparée par grille. Les règles habituelles d'horaires de travail restent appliquées lors de la réévaluation du métier.

L'ordre nourriture conserve ses sources actuelles : buissons, blé mûr et carcasses. Il ne devient pas un ordre de chasse aux animaux vivants.

Tests : `villager-exploration-resume`, `movement-actions`, `villager-autonomy`, ainsi que les régressions des ordres, du repos et de la récupération de récolte.
