# Activité locale des villages IA

Les règles locales ci-dessous restent le repli pour les cartes hors continent et les factions partiellement observées. Le mode abstrait des continents est décrit ensuite.

Chaque PNJ résident est rattaché à un TownCenter par `villageHome` (identité du propriétaire et du bâtiment, position extérieure). Ce rattachement est sauvegardé et reste stable quand le PNJ se déplace. Un centre détruit entraîne une réaffectation au centre restant le plus proche. Les éclaireurs, les expéditions et les unités contrôlées par le joueur sont exemptés.

Les cibles de travail, de chasse et de livraison sont limitées à 30 cellules du centre. Cette valeur partage la constante de rappel des bandits (`app/config/campActivity.ts`). Les trajets peuvent faire un détour de 4 cellules supplémentaires. Une tâche devenue extérieure à la zone est interrompue et le PNJ rentre. Le combat utilise le contrôleur commun des camps : poursuite limitée, recherche brève après perte de vue, retour puis réarmement.

`VillageActivitySystem` contrôle les zones toutes les 500 ms et réconcilie les nouvelles unités/centres toutes les 5 secondes. Un village devient distant au-delà de 110 cellules et redevient détaillé à moins de 80 cellules du héros. La caméra et les combats proches maintiennent aussi le détail. Une unité qui récolte ou un bâtiment du joueur ne constitue pas un observateur ; les bâtiments hostiles et leurs résidents inactifs non plus. Les positions intérieures sont projetées sur leur sortie extérieure.

La récolte distante réutilise `advanceOfflineWorker` avec un instantané local du terrain, des ressources et des réserves réelles. Les livraisons vers les coffres intérieurs sont projetées sur leur accès extérieur. Le terrain de calcul est borné au territoire et à sa marge : aucune exploration du continent entier. Les stocks voisins peuvent se chevaucher ; les transactions synchrones relisent toujours leur valeur réelle, évitant une double consommation. Les livraisons bloquées et les capacités des réserves sont respectées.

Les intervalles de déplacement/travail et les callbacks de récolte des ouvriers sont arrêtés pendant ce mode. Un calcul toutes les 2 secondes applique la production, l'épuisement des ressources et le temps de trajet. Le reste de temps de production utilise `offlineWork`, déjà sauvegardé. Une sauvegarde ou un réveil applique d'abord le temps restant. L'horloge du scheduler respecte la pause. La production nocturne est arrêtée. Les événements journaliers, la repousse et l'entretien restent sous l'autorité du runtime normal ; la simulation des régions inactives n'est pas exécutée pour la région présente.

Limites actuelles : chasse, construction, entraînement, repos et transitions de portail conservent le traitement détaillé du village. Les gardes restent des entités actives. Ce système réduit le travail de déplacement/récolte distant, mais ne décharge pas les entités de la mémoire. Les fractions d'un geste visuel en cours sont abandonnées à l'entrée du mode distant, pour éviter de compter un impact deux fois. Les nouvelles parties sur les continents 1000 et 5000 activent les civilisations IA ; les emplacements sont attribués par biome au démarrage.

## Simulation abstraite des continents

Sur les continents, `DistantVillageSystem` suspend maintenant les résidents et les décisions périodiques d'une faction dont tous les villages sont éloignés et sans interaction hostile. Les factions partagent leurs réserves entre villages : elles constituent donc une seule transaction économique. Une faction partiellement observée conserve le fonctionnement local précédent. Les transitions de portail, les expéditions, les scouts et les ordres de combat restent détaillés.

Le temps de référence est celui du cycle jour/nuit. Il n'y a plus de calcul de travail toutes les deux secondes pour une faction abstraite. Le rattrapage intervient avant les événements quotidiens, à l'approche du joueur, lors d'une attaque et avant la sérialisation. Le checkpoint n'avance qu'après application du résultat. Les états économiques sont des copies temporaires, construites par `VillageEconomySnapshot`, sans renderer ni grille de vision. Les données ordinaires des unités et bâtiments restent la source sauvegardée : aucun format de sauvegarde supplémentaire n'est nécessaire.

`DistantVillageEconomy` réutilise `simulateOfflineWorld`, la production abstraite de `AbstractVillageEconomy` et le planificateur `OfflineWorldBuildingPlanner`. Comme dans l'ancienne économie interrégionale, la production abstraite dépend des taux économiques ; elle ne consomme pas chaque arbre visible. Les stocks, capacités et coûts restent réels. Le terrain et les obstacles utilisés pour construire sont bornés aux territoires des villages. Les travaux terminés passent par le cycle de vie normal des bâtiments, pour appliquer une seule fois leur capacité de logement.

La simulation partagée désactive les événements quotidiens et les formations du moteur hors carte : entretien, arrivées, repousse, marchés, raids et formations payées restent gérés par leurs services existants. Le travail précédent est appliqué **avant** que ces événements lisent les stocks. Ensuite, les nouvelles décisions de construction/recrutement sont réparties à raison d'une faction par vérification locale. Un checkpoint journalier empêche de relancer la planification à chaque sauvegarde ou visite. Les stagiaires gardent leur trajet d'entrée et leur formation réels ; les autres résidents suspendent déplacement, travail, patrouille et repos détaillés. La santé nocturne et l'énergie sont réconciliées au rattrapage.

Ce mode allège le calcul, pas encore l'allocation mémoire : les entités restent identifiables pour les quêtes, les références de sauvegarde et les interactions. Les changements de propriétaire/centre et les interactions incompatibles réactivent le détail. L'expansion territoriale et la conquête ne sont pas ajoutées par cette refonte.

Diagnostic : `village.abstract` et `village.detailed` marquent les transitions ; `village.state` indique `abstract=true` ; `runtime.village.abstractAdvance` mesure le rattrapage. Vérifier ces champs après `perf-report reset` sur une partie rechargée. Les animaux restent un coût distinct.

## Nettoyage après passage au continent

Le runtime de poursuite entre régions et son extraction des poursuivants ont été retirés : ils n’étaient plus démarrés depuis la suppression du voyage entre cartes. Les nouveaux snapshots ne produisent plus `worldPursuers`. Le validateur conserve ce champ en entrée pour lire les anciennes sauvegardes ; il ne relance pas les anciennes poursuites.

Les anciens modules de dessin de mini-carte sans appelant, le placement de repousse remplacé par le système actuel, les styles de carte régionale et leurs traductions inutilisées ont aussi été supprimés. La légende des factions reste utilisée par la mini-carte.

Les modules `OfflineWorld*` ne sont pas du code mort : la simulation distante et la restauration des cartes les utilisent. Les conversions de coordonnées locales restent nécessaires aux intérieurs et aux anciens formats. Le stockage synchrone reste le repli du navigateur, et certains exports sont chargés dynamiquement par les outils de génération et les tests ; les signalements de Knip doivent donc être vérifiés avant suppression.

## Travailleurs du joueur sur le continent

`PlayerWorkActivitySystem`, intégré au cycle de `VillageActivitySystem`, reprend le travail hors carte sous forme de sessions locales par travailleur. Aucun TownCenter n’est requis. Un seul travailleur entre en simulation par mise à jour pour répartir les transitions. Le héros, ses suivants, les formations, les livraisons en cours et les transitions d’intérieur restent dans le runtime détaillé. Les ordres dont la cible est hors du périmètre local de 30 cellules restent également détaillés.

Le travail n’est pas recalculé à chaque tick : il est réglé au retour du héros ou de la caméra, en cas de combat, avant un nouvel ordre, avant la sauvegarde et avant les événements quotidiens. Le moteur `simulateOfflineWorld` respecte les horaires, la cible et la file de construction, les ressources connues, leur quantité finie, les trajets et les dépôts accessibles. Les stocks, ressources et constructions sont répercutés sur les entités existantes. Il ne lance ni production abstraite IA, ni planification de bâtiments, ni événements quotidiens ou formations en double.

Les positions restent dans un instantané local de terrain ; une tâche non prise en charge continue normalement, elle n’est pas supprimée. Les unités demeurent adressables pour les ordres et les sauvegardes. La reprise recalcule le trajet depuis la position obtenue hors écran. Aucun nouveau format de sauvegarde n’est introduit.

Les diagnostics `village.state` indiquent maintenant `observationReason`, `observer` et `observerDistance` pour distinguer héros, caméra et combat. Les transitions du joueur émettent `player.work.distant` / `player.work.detailed` ; le coût de règlement apparaît sous `player.work.advance`.

La suspension des callbacks est maintenant partagée via `unitSuspension` (`distant-work` pour l’économie, `camp-paused` pour les camps figés). Le service propriétaire reste responsable du règlement du travail et de la reprise ; les règles de territoire restent dans `villageActivity`.
