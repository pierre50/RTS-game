# Butin des animaux

À la mort, la viande restante et les matériaux sont placés dans un inventaire unique.
Le héros l’ouvre avec E ; Gather reste réservé aux ressources du décor.
Les chasseurs ramassent une charge au contact, viande en priorité, puis déposent et
reviennent au même corps si un butin qu’ils peuvent déposer y reste. Une charge mixte
peut nécessiter plusieurs dépôts. Les autres PNJ et le héros prélèvent dans le même stock.

Les matériaux sont configurés dans `app/config/animalGatherLoot.ts` : chaque ligne est
un tirage indépendant par animal, avec une quantité entière entre `min` et `max`.
Les matériaux principaux sont garantis, notamment pour les proies du tutoriel.
Les quantités de viande restent celles des animaux ; la collecte plus rapide devra
être évaluée en partie pour ajuster l’économie de la chasse.

La viande se dégrade toujours d’une unité toutes les cinq secondes. Quand elle est
épuisée, les matériaux restent accessibles pendant CORPSE_TIME avant disparition.
Le temps restant et le contenu sont sauvegardés. Un ancien cadavre conserve uniquement
sa viande restante : le chargement ne lui attribue pas de nouveaux matériaux.
L’IA alimentaire continue à compter la viande restante, pas les matériaux, comme nourriture.
