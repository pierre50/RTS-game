# Perception des PNJ

`playerTargetKnowledge.ts` distingue les observations actuelles et les informations mémorisées par propriétaire. Les observateurs sont ceux de la grille de vision de l'espace de la cible ; chaque observateur applique sa portée de détection et les règles de furtivité. La visibilité graphique, la caméra et l'exploration du terrain ne constituent pas une observation actuelle. Les animaux sauvages conservent leur détection individuelle.

Une unité engagée peut actualiser sa destination grâce à un autre observateur du même propriétaire. Lorsque la cible est cachée, `targetPursuit.ts` transforme la poursuite en déplacement vers sa dernière case connue. Une nouvelle détection permet de reprendre l'action pendant ce déplacement. À défaut, l'unité abandonne ou reprend son autonomie à l'arrivée. Un nouvel ordre manuel annule cette recherche. La portée d'attaque et les décisions d'engagement restent individuelles.

Les nouvelles chasses et captures exigent une cible actuellement détectée. Les ressources fixes et les carcasses utilisent les informations mémorisées. Les observations conservent les coordonnées et l'état constaté sans suivre les mutations de l'objet caché. Les références aux ressources découvertes ne sont pas supprimées chez un propriétaire qui ne voit pas leur disparition.

Les observations sont sauvegardées dans `targetKnowledge` et validées au chargement. Les anciennes sauvegardes sans ce champ reconstruisent une connaissance initiale des ressources fixes à partir du terrain exploré. Cette migration ne donne pas la position des unités ou animaux cachés.

Vérifications dédiées : `tests/player-target-knowledge.test.cjs` couvre vision partagée, furtivité, séparation des espaces, mémoire des ressources, mise à jour du déplacement, annulation manuelle et validation des observations sauvegardées.
