# Règles économiques communes

Les modes direct et simulé utilisent les mêmes règles de base. Le direct exécute des impacts d’animation et des déplacements ; la simulation consomme un budget de temps. Les effets économiques ne doivent pas être réécrits dans ces deux adaptateurs.

| Règle | Source commune | Utilisateurs |
| --- | --- | --- |
| Quantité récoltée, coups nécessaires, quantité disponible | `app/lib/economy/workRules.ts` ; `RESOURCE_GATHER_SWINGS` dans `app/constants/entities.ts` ; `gatherAmount` dans la configuration des unités | Récolte animée, bois, agriculture, `OfflineWorldWork` |
| Construction : progression et arrondi par impact | `app/lib/economy/workRules.ts` ; `totalHitPoints` et `constructionTime` dans la configuration des bâtiments | `UnitBuildingAction`, `OfflineWorldWork` |
| Capacité de transport et place occupée par les objets | `app/lib/resources/resourceDelivery.ts` | Sacs réels et amortissement des trajets simulés |
| Horaires et pause repas | `app/lib/units/villagerSchedule.ts` | Disponibilité des villageois, repos, travail simulé |
| Durée, progression et échéance des formations | `app/lib/training/trainingRules.ts` ; `trainingDays` et éventuel `mountingDays` | Production des bâtiments, formation hors écran, planification abstraite |
| Vitesse des animations | `app/lib/animations/animationTiming.ts`, séquences dans `actionFrameSequences.ts` | Animation directe et estimation des cycles de travail |
| Coûts et paramètres d’énergie par défaut | `app/lib/units/energyRules.ts`, configuration des unités | Énergie directe et estimation du travail hors écran |
| Stockage et livraison | `app/lib/resources/storagePolicy.ts`, `playerResourceTotals.ts` | Réserves réelles et transactions simulées |

`workRules.ts` et `trainingRules.ts` manipulent des données simples : ni sprites, ni interface, ni carte. `configuredWorkTiming.ts` résout les animations chargées à la frontière et transmet leurs données à `workTiming.ts`. Les services de simulation ne dépendent plus du générateur de carte pour calculer leurs cycles.

Les instantanés conservent l’expérience déjà enregistrée afin d’appliquer les mêmes bonus de rendement et de construction. Les villageois ne gagnent actuellement pas d’expérience, conformément à la règle existante de `grantUnitXp`.

## Vérification

`tests/economy-rules-parity.test.cjs` compare les adaptateurs direct et simulé pour la récolte, la construction, les formations et les horaires. Il vérifie aussi qu’une récolte à plusieurs coups attend un cycle complet, qu’un dernier prélèvement ne dépasse pas la quantité restante et que les coûts du cuivre et du fer ne sont pas remplacés par celui de l’or.

Pour une nouvelle règle, ajouter le calcul commun ici puis le brancher sur les deux adaptateurs. Les paiements, apparitions d’unités, notifications et effets visuels restent dans leurs gestionnaires respectifs.

## Limites du modèle

Partager les règles ne signifie pas exécuter le déplacement case par case hors écran. Les trajets y sont estimés et amortis sur la capacité réelle du sac ; l’énergie est convertie en durée moyenne de cycle. En direct, obstacles, fatigue instantanée, collisions et interruptions peuvent donc modifier le rendement final.

L’économie régionale abstraite des villages IA reste une politique distincte : ses productions journalières et pondérations sont définies dans `worldEconomyBalance.ts`. Elle ne représente pas des bûcherons individuels et n’est pas utilisée pour remplacer la récolte du joueur. Un futur réglage global incluant cette politique doit préciser le lien souhaité entre ses objectifs journaliers et les règles physiques.

Ce regroupement ne fixe pas encore la cible de 300 bois. L’alignement des trajets sur des sacs de 30, au lieu de lots de 10, peut augmenter la récolte simulée ; l’équilibrage doit être mesuré ensuite sur ce comportement commun.
