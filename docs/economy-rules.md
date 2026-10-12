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

L’économie régionale abstraite des villages IA garde ses rendements journaliers dans `worldEconomyBalance.ts`, mais sa production est désormais plafonnée par les besoins du village. Chaque durée de travail ne peut produire qu’une seule ressource. Les déplacements détaillés restent estimés.

Ce regroupement ne fixe pas une production arbitraire de 300 bois. L’alignement des trajets sur des sacs de 30, au lieu de lots de 10, peut augmenter la récolte simulée ; l’équilibrage doit être mesuré ensuite sur ce comportement commun.

## Chantiers et vie collective

Le placement d’un bâtiment à construire est gratuit. Son chantier conserve une copie du coût et les quantités déjà consommées. Les matériaux restent dans le sac du constructeur jusqu’au coup qui les utilise. Chaque progression utilise `constructionMaterials.ts` : elle ne peut avancer au-delà des matériaux disponibles. Les stocks locaux servent à planifier les besoins, mais ne financent plus directement les coups de construction. Le villageois prend au Storage Pit un chargement de matériaux encore nécessaires, puis consomme directement son sac en construisant. Il repart chercher des matériaux quand il ne peut plus progresser. Sans centre-ville, les sacs doivent également atteindre le chantier ; cela permet de fonder le premier village. Les anciennes constructions sans registre restent considérées comme déjà payées.

Les coffres personnels ne financent pas automatiquement le village. Le coffre interne d’un centre-ville, grenier ou dépôt représente en revanche une réserve collective. Les semis et les objets placés instantanément gardent leur paiement immédiat. Les dépôts de chantier des anciennes sauvegardes restent utilisables et récupérables dans les ruines, mais aucun nouveau dépôt n’est créé.

`collectiveTasks.ts` choisit les tâches selon la réserve alimentaire et les matériaux manquants du premier chantier local. Stocks et sacs sont comptés une fois ; les travailleurs disponibles se répartissent les besoins par lots de transport. Une fois les besoins satisfaits, la récolte automatique s’arrête. Les ordres explicites, le suivi du héros, les formations et le combat restent prioritaires. `CollectiveVillageWork` et `OfflineCollectiveWork` adaptent ce même plan au direct et à la simulation. `villageFood.ts` consomme uniquement les provisions du villageois concerné. Sous un repas disponible, il va chercher jusqu’à trois jours de provisions au Granary, dans la limite de son sac et du stock disponible. Sans réserve accessible, il récolte sa nourriture. Aucun repas ne prélève dans le sac d’un autre villageois.

Les tests `construction-materials`, `collective-village-work` et `collective-needs` couvrent les coûts exacts, les réserves séparées, les ordres explicites, la fondation sans dépôt et trois jours simulés en une fois ou par étapes.

La chasse détaillée hors écran reste une limite du simulateur existant : il ne simule pas les combats nécessaires pour obtenir du cuir. Un chantier qui dépend du cuir peut donc attendre une livraison ou une chasse en direct ; les quantités ne sont pas inventées pour contourner ce manque.

## Réserves des dépôts

Les livraisons automatiques vont exclusivement au Storage Pit pour les matériaux et au Granary pour la nourriture, y compris lorsque leur inventaire est représenté par un coffre intérieur. Le centre-ville ne reçoit plus de livraison ; ses anciens stocks restent visibles et utilisables par les systèmes à paiement immédiat, mais pas par les nouveaux retraits des villageois. Les coffres personnels sont réservés aux transferts manuels. L’ancien bouton de blocage des livraisons est supprimé et les anciens drapeaux de blocage sont ignorés au chargement et ne sont plus réécrits dans les nouvelles sauvegardes.

`DEFAULT_VILLAGE_RESERVES` dans `collectiveNeeds.ts` centralise les objectifs : 50 bois, 30 pierre, 10 or, 5 cuivre, 5 fer lorsque les outils le permettent ; au moins 100 nourriture dans un village avec grenier, augmenté si nécessaire selon la population. Ces objectifs sont par village, quel que soit le nombre de dépôts. Sans grenier, la réserve de survie reste de deux jours dans les sacs. Un chantier remplace les objectifs de confort jusqu’à sa réalisation.

Les villageois disponibles du joueur utilisent le même plan que les autres villages. Le plan compte stocks, sacs et réservations de travail avant de répartir les besoins. Il conserve les tâches encore utiles, limite la récolte automatique à deux travailleurs par ressource et plafonne les prélèvements au manque réel, en direct comme hors écran. Les ordres explicites, le suivi du héros et les formations restent prioritaires. La production régionale utilise aussi les sacs lorsque le dépôt adapté manque, sans créer un dépôt fictif dans le centre-ville.

## Départ et communication

`startingProvisions.ts` fournit trois jours de nourriture (12 blé au tarif actuel) au compagnon de l’introduction et aux villageois initiaux, y compris ceux ajoutés aux profils de villages. Cette dotation ne s’applique ni aux chargements ni aux formations. La consommation quotidienne utilise toujours le sac avant les réserves locales, y compris pendant le suivi du héros.

Les conversations ne proposent plus de ressources, de construction ni de capture de chevaux. « Aller vers » reste un déplacement ou un ordre tactique, sans récolte, chasse économique ni construction implicite. « Suis-moi » interrompt les tâches économiques ; le suivi n’imite plus les travaux du héros. Libérer le villageois le remet à disposition de l’autonomie. Les conversations ne proposent plus d’entraînement ni de formation montée. Le menu E des bâtiments militaires et du temple permet de demander 1, 5 ou 10 formations. Une file persistante appelle des recrues disponibles, avec cinq places par bâtiment, trajets compris. Les demandes sans recrue ou sans place restent en attente ; combat, suivi du héros et repos restent prioritaires. Les demandes non commencées peuvent être retirées sans annuler les formations actives.

Les retraits utilisent le même passage dans les intérieurs que les dépôts : coffre atteint avant transfert, sortie puis reprise du chantier. Chaque coup consomme la fraction cumulée du coût correspondant à la progression ; l’arrondi cumulatif garantit le coût exact à la fin et après rechargement. Les lots en route sont réservés dans le plan sans débiter le coffre ; le transfert réel vérifie de nouveau stock et capacité. La sauvegarde conserve le retrait en cours. Hors écran, le trajet et le chargement prennent du temps ; les repas sont consommés dans les sacs aux pauses du matin, du midi et du soir. Les dépôts automatiques préservent les trois jours de provisions personnelles. Les paiements immédiats (semis, artisanat, etc.) restent une étape distincte de cette migration progressive. Former une unité existante demande du temps, sans coût en ressources.

Les repas suivent désormais les trois pauses individuelles : 1 nourriture au réveil, 2 au déjeuner, 1 à la fin du travail (ration quotidienne inchangée : 4). `villagerMeals.ts` partage les horaires et la consommation entre le direct et la simulation. `lastMealAt`, conservé en sauvegarde et lors des voyages, évite tout doublon ; un repas sans provisions est compté comme manqué et ne prélève rien ailleurs. L’événement quotidien rapporte les repas déjà pris, sans débiter une ration supplémentaire à 06:00.

Le menu E du Storage Pit et du Granary sépare la quantité cible et sa répartition. Les réglages sont partagés entre dépôts du même type dans un village et sauvegardés avec les bâtiments. Modifier une part redistribue les autres parts actives proportionnellement, sans réactiver les parts à zéro. La somme vaut 100 %, ou 0 % si tout est désactivé ; une ressource seule représente donc 100 %. Les arrondis conservent exactement la quantité cible. Une cible nulle ou toutes les parts à zéro suspendent seulement le stockage de confort, sans supprimer de contenu ni empêcher les transferts manuels, les repas ou les chantiers.

Par défaut le grenier vise du blé ; on peut répartir sa réserve entre blé, baies et viande. Les trois jours de provisions personnelles sont exclus de ces objectifs de stockage. Le plan commun et les plafonds de récolte sont utilisés en direct, hors carte et pour la production régionale abstraite. Les matériaux issus des animaux peuvent être prélevés sur les carcasses hors carte ; la chasse de nouveaux animaux reste une limite de la simulation détaillée.

## Priorité des chantiers sur le stockage

Le combat et le suivi du héros suspendent les décisions économiques, y compris les rappels de livraison. Vient ensuite la nourriture urgente : sous une ration quotidienne, un villageois se ravitaille avant de construire. Avec un chantier actif, il recherche une seule journée de nourriture, puis reprend le chantier ; sans chantier, le réapprovisionnement normal reste de trois jours. Aucun prélèvement quotidien de bois n’est réintroduit.

Un chantier local interrompt une livraison de confort encore en route à l’extérieur. Le même calcul protège dans le sac les matériaux encore utiles pour construire ; seuls le surplus et les matériaux sans utilité pour le chantier peuvent être déposés. Ce contrôle s’applique au choix du dépôt, au transfert effectif à l’intérieur et à la simulation hors carte. La récolte destinée à construire arrive dans le sac, y compris dans l’économie régionale abstraite. Les stocks de confort reprennent après les chantiers.

Les chantiers ont deux phases distinctes. L’approvisionnement transfère les matériaux du sac dans `constructionMaterials.delivered`, sans aucun gain de progression, consommation d’énergie de construction, usure du marteau ou XP. Les livraisons partielles sont conservées et chaque ingrédient est plafonné au devis. Le travail ne commence qu’une fois toute la recette livrée ; le premier impact engage les matériaux dans `consumed`, puis les ouvriers réalisent la totalité du travail défini par `constructionWorkRequired` ou `buildingUpgrade.constructionTime`. Les prix et le travail nécessaire sont indépendants des PV. Les stocks des dépôts doivent être transportés jusqu’au chantier, sans prélèvement distant.

Les anciens chantiers gardent leur progression et les matériaux déjà consommés : seuls les ingrédients encore manquants doivent être livrés. Les chantiers prépayés sans registre de matériaux restent utilisables sans nouvelle facturation. Livraison, progression et matériaux engagés sont sauvegardés avec le registre existant. Les mêmes règles s’appliquent en direct et hors écran, aux constructions et améliorations, ainsi qu’aux petits objets et meubles. L’interface distingue le pourcentage d’approvisionnement du pourcentage de construction. Le budget de travail est défini par `constructionWorkRequired` pour chaque niveau ; `constructionTime` conserve le rythme des réparations et sert de repli aux anciennes définitions. Une amélioration copie le budget du niveau cible dans son chantier. Les travaux sauvegardés conservent leur budget initial.

Une attribution de ressource refusée tente une autre tâche utile dans la même mise à jour. Sans cible utilisable, le villageois devient inactif, quitte son ancien métier visuel et explique le blocage au lieu de prétendre travailler. Cette intention temporaire n’ajoute aucun coût ni nouvelle ressource.

Le réglage des réserves affiche cinq matériaux au Storage Pit (bois, pierre, or, cuivre, fer) et trois aliments au Granary (blé, baies, viande). Les composants d’artisanat restent disponibles pour les chantiers qui les demandent, sans objectif de stockage configurable. Les anciennes parts d’artisanat sont ignorées et les parts encore affichées sont renormalisées ; si elles sont toutes nulles, le stockage reste désactivé. Les quantités déjà stockées ne sont pas supprimées.

Le menu utilise les contrôles communs des fenêtres : réserve cible prédéfinie, barres de pourcentage par pas de cinq, navigation verticale et réglage horizontal à la manette ou au clavier. Les identifiants stables conservent la sélection après rééquilibrage et l’aide de la fenêtre affiche les commandes disponibles. Une ancienne quantité personnalisée reste proposée.


### Pose des bâtiments et semis

Tous les bâtiments du catalogue sont des chantiers, y compris le piège, le coffre et le feu de camp. Ces trois petits objets demandent quatre impacts au rythme de base ; les matériaux sont livrés avant le travail puis engagés au premier impact, jamais à la pose. Le héros peut les construire seul avec son sac. Les anciens objets prépayés et les chantiers sauvegardés sans état de matériaux ne sont pas facturés à nouveau. Le mode instantané de débogage reste une exception explicite.

La pose d’une parcelle de 4 × 4 est gratuite : elle crée 16 cases à semer indépendamment. Chaque case consomme un grain du sac au semis puis démarre sa croissance ; les autres restent en attente. Le catalogue affiche « Semer » pour les champs et « Poser le chantier » pour les bâtiments. Les coûts des chantiers sont informatifs, sans comparaison rouge avec le stock. Le suivi des quantités se trouve sur le chantier.

Les ouvriers humains, l’IA et la simulation hors écran réutilisent le même circuit de collecte et de construction, notamment pour la fibre. L’IA conserve sa limite d’un projet à la fois ; une affectation de récolte refusée essaie les autres matériaux utiles et ne crée pas de nouveaux chantiers en boucle.

Les cases à semer sont sauvegardées comme chantiers `Farm` de taille 1, coût d’un grain et durée d’un impact. Le catalogue conserve une empreinte de parcelle de taille 4. À l’achèvement, chaque chantier est remplacé par une ressource `Wheat` au stade 0, en direct comme hors écran. Les anciennes ressources de blé restent inchangées. L’IA compte les cases en attente et ne lance une nouvelle parcelle qu’avec une graine disponible hors coffres personnels, sans exiger les 16 graines.

Le total de réserve n’est plus un réglage : chaque dépôt achevé ajoute sa capacité réelle aux objectifs (Storage Pit : 300 / 900 aux niveaux 0 / 1 ; Granary : 300 / 600 / 900 aux niveaux 0 / 1 / 2). Les anciennes valeurs `target` restent lisibles pour les sauvegardes mais sont ignorées au profit de cette capacité. Le menu affiche la capacité et permet uniquement de répartir les quantités entre ressources, avec des barres contrôlables au clavier et à la manette. La répartition reste commune aux dépôts du même type dans le village ; tout désactiver reste possible. Les repas urgents et les chantiers conservent leur priorité.

Les coffres personnels ont une capacité de 100 ressources. Le grenier stocke 300 / 600 / 900 ressources aux niveaux 0 / 1 / 2, le dépôt 300 / 900 aux niveaux 0 / 1 ; leurs coffres intérieurs suivent le niveau du bâtiment parent. La capacité augmente à la fin de l’amélioration. Le centre-ville reste limité à 300. Les inventaires déjà au-dessus du plafond sont conservés ; les nouveaux dépôts attendent qu’une place soit libérée.

Quand le plan collectif ne trouve aucune tâche utile, les villageois disponibles se rassemblent près d’un feu achevé de leur propriétaire, sinon près d’un Town Center achevé du même village. Ils réservent des places espacées, accessibles et hors des passages, puis restent immobiles. Ce déplacement reste interruptible par les besoins collectifs ; les combats, ordres de suivi, déplacements manuels, entraînements et repos gardent leur priorité. Sans lieu accessible, ils restent sur place. Les places de rassemblement sont temporaires et ne sont pas des ordres sauvegardés.

Hors zone, les demandes d’entraînement attendent une recrue admissible et accessible et une place parmi les cinq places simultanées (trajets compris). Le temps de trajet restant est sauvegardé ; la durée de formation commence à l’entrée et utilise les mêmes jours calendaires qu’en direct. Les sorties achevées libèrent les places pour les demandes suivantes pendant une longue absence. Les demandes excédant le nombre de villageois restent en attente, sans créer de recrues. Les sorties bloquées sont retentées lors des pas de simulation suivants.

Les affectations collectives en direct sont réévaluées sur changement utile : chantier, réserve configurée, disponibilité, reprise après pause, repas ou seuil de ressources/capacité franchi. Les notifications de récolte et de construction sont regroupées ; une variation qui ne change pas les besoins ne relance pas le plan. Les déplacements et animations ne sont pas des déclencheurs. Le contrôle des blocages reste indépendant et un audit de secours toutes les 30 secondes couvre les mutations d’inventaire des anciens adaptateurs. Avant d’arrêter une tâche remplacée, son ancienne autonomie est retirée pour empêcher sa reprise pendant la transition.

Les vérifications périodiques des repas, du repos et du recrutement consultent une échéance et les notifications de disponibilité avant de parcourir les unités. Les horaires individuels déclenchent les transitions, y compris après un saut de temps. Le repos actif ou momentanément bloqué reste surveillé pour réagir aux dangers et reprendre après une interruption. La file de formation cesse de chercher des recrues lorsque les places sont occupées ; une fin de formation ou une nouvelle disponibilité relance le recrutement.

L’annulation d’un chantier ne rembourse aucune ressource. Annulation, démolition et destruction conservent l’effet de fragments, sans créer de coffre au sol. Le contenu du bâtiment et de ses coffres intérieurs est perdu, y compris les inventaires d’un intérieur sauvegardé mais non chargé.

La répartition des travailleurs ne plafonne plus la récolte à deux villageois par ressource. Chaque chantier local réserve des charges correspondant à la place réellement libre dans les sacs, après déduction des matériaux transportés et des retraits de dépôt en cours. Une fois ses besoins couverts par les missions attribuées, les autres villageois peuvent alimenter les chantiers suivants. Chaque récolteur garde une affectation temporaire au chantier et une quantité maximale à rapporter ; une dernière charge partielle suffit à déclencher son retour. Ces affectations sont recalculées au chargement et utilisent le même planificateur en direct et hors zone. Les contrôles existants de chemin accessible et de charge des cibles restent appliqués lors de l'envoi en récolte.

## Lances et retrait des outils en cuivre

Les lances pierre/bronze/fer partagent le slash long LPC. La pierre se fabrique dans l’inventaire (6 bois, 3 pierres, 1 fibre) ; bronze et fer à la forge (6 bois, 1 fibre, 1 lingot du matériau). Puissances : 4/8/10. Leur profil de contact a une portée de 52 pixels avant mise à l’échelle et un demi-angle de 45°, contre une portée de 38 pour l’épée. Elles restent des armes de mêlée, sans portée de projectile.

Les outils suivent pierre → bronze → fer. Il n’existe plus de recette de lingot de cuivre ; le minerai de cuivre sert à fondre le bronze avec l’étain. À la lecture d’une ancienne sauvegarde ou d’un village préparé, les outils en cuivre deviennent leurs équivalents en bronze en conservant l’usure, et chaque ancien lingot de cuivre rend 3 minerais. Les indices historiques de forge restent compatibles avec les sauvegardes ; obtenir un lingot ne déclenche plus de découverte ni d’amélioration globale. Les recettes sont accessibles selon les ressources et l’atelier disponibles, et les rendements dépendent de l’outil réellement équipé.

### Marchés : progression commerciale

Les marchés de niveaux internes 0 / 1 (N1 / N2) ont une réserve cible de 250 / 600 or. Chaque village reçoit au maximum 25 / 60 or par jour, selon son meilleur marché achevé. Cette somme est répartie entre les caisses locales déficitaires, jusqu’à une réserve cumulée égale à la cible du meilleur marché. Les recettes des ventes et l’or des sauvegardes sont conservés, même au-dessus de cette cible. Une amélioration ne crédite pas immédiatement la caisse.

Le N1 vend les équipements simples, de pierre, de cuir et de bronze, ainsi que la fronde et l’arc simple ; le N2 ajoute le fer, les épées longues, les grands arcs et les arcs recourbés. Le catalogue reste propre à la civilisation. Un objet avancé racheté au joueur reste enregistré mais n’est pas achetable dans un marché de niveau insuffisant. Les outils sont renouvelés à 2 / 4 exemplaires par modèle, les autres équipements à 1 / 2 (le cuir reste à un exemplaire par modèle), les flèches à 20 / 40 par type débloqué.

Les stocks d’équipements et de ressources sont renouvelés tous les trois jours. Bois, pierre, blé et baies : 30 / 60 chacun ; viande et fibres : 15 / 30 ; cuir et herbes : 10 / 20. Cuivre et étain : 10 / 20 chacun ; lingots de bronze : 3 / 5. Au N2 s’ajoutent 10 plumes, 10 tendons, 10 minerais de fer et 4 lingots de fer. Les nouvelles offres d’une amélioration arrivent au prochain renouvellement ; ouvrir le marché ou recharger une sauvegarde ne remplit pas un stock épuisé.

L’équipement est racheté à 25 % de sa valeur ajustée à son état (arrondi inférieur, minimum 1 or). Les ressources sont achetables à trois fois leur valeur de rachat. Les achats créditent la caisse du marché, les ventes sont limitées par cette caisse. Les stocks commerciaux de ressources sont distincts des réserves du village et sont sauvegardés avec le bâtiment. Les règles quotidiennes sont communes au jeu en direct et à la simulation hors écran.


### Paramètres d’équilibrage et calculs communs

Les paramètres du marché (prix, réserves d’or, renouvellement, stocks et niveaux requis) se règlent dans `app/config/market.ts`. Les durées de vie des équipements et la fraction de recette utilisée pour réparer une arme se règlent dans `app/config/equipmentDurability.ts`. Les capacités de stockage se règlent dans `app/config/storage.ts`.

Les fonctions métier appliquent ces paramètres : l’interface et le rapport économique lisent les mêmes calculs de prix et de budget quotidien que les transactions et la simulation. Les configurations sont incluses dans les empreintes de sources du rapport ; régénérer celui-ci après un changement d’équilibrage.

### Formation militaire par niveau

`app/config/militaryTraining.ts` définit la capacité de la caserne et de l’écurie : 3 / 5 / 8 formations simultanées aux niveaux internes 0 / 1 / 2. Le camp de tir possède deux niveaux internes 0 / 1 : 3 / 8 places. Les recrues en route réservent une place ; les demandes supplémentaires restent en attente. Les autres bâtiments gardent cinq places. Les formations déjà engagées ne sont pas supprimées si leur nombre dépasse le nouveau plafond.

À l’admission, la caserne fixe 0 / 50 / 150 XP de mêlée pour le fantassin, le camp de tir fixe 0 / 150 XP de tir pour l’archer à ses deux niveaux. Cette expérience est sauvegardée dans la formation et appliquée une seule fois à la sortie. L’écurie conserve l’expérience du soldat sans bonus. Les durées, les PV et les coûts restent inchangés. Les bâtiments en amélioration n’admettent pas de nouvelles recrues. Ces règles servent à l’interface, au recrutement direct, à l’IA et à la simulation hors écran, y compris aux villages lointains.

### Tours : puissance, portée et salves

`app/config/towerCombat.ts` définit les trois profils de la tour : puissance par flèche 3 / 5 / 7, portée 6 / 7 / 8, et au maximum 1 / 2 / 3 cibles distinctes par salve. La cadence reste celle du bâtiment (1,9 seconde), sans changement des PV ou des coûts. Une cible isolée ne reçoit qu’une flèche par salve. Les dégâts continuent de passer par les règles de projectiles et de protection habituelles.

Chaque salve conserve la cible principale valide, puis cherche les ennemis supplémentaires les plus proches dans la même zone de jeu. Les alliés, animaux, cibles mortes et ennemis hors portée sont exclus. La tour cherche une autre cible quand la première n’est plus valide. Le niveau est relu à chaque salve ; la puissance est fixée au lancement du projectile. La portée effective des flèches et le rapport économique utilisent le même profil, y compris après rechargement. Une amélioration terminée déclenche une recherche de cible pour couvrir immédiatement la nouvelle portée.

### Centre-ville : défense légère et arrivées

`app/config/townCenter.ts` définit les niveaux internes 0 / 1 / 2 (N1 / N2 / N3) : puissance par flèche 2 / 3 / 4, portée 4 / 4,5 / 5, et 1 / 1 / 2 cibles distinctes par salve, toutes les 2,5 secondes. Le centre-ville réutilise le combat des tours et les protections habituelles, sans garnison. Le stockage reste de 300 ; les PV et coûts existants sont conservés.

Le plafond quotidien d’arrivées est de 1 / 2 / 3, avec une croissance de 12 / 18 / 24 % de la population locale (arrondi inférieur, minimum une personne si le village est peuplé). Les centres dont les territoires se recouvrent forment un groupe partageant le plafond du meilleur niveau ; multiplier les centres voisins ne multiplie pas les arrivées. Les villages distants conservent leur propre budget.

Chaque arrivée nécessite un lit libre dans une maison habitable et une place de population. Les provisions collectives locales doivent couvrir trois jours de consommation des résidents et cinq jours par nouvel arrivant, à quatre unités alimentaires par jour et par personne. Ce seuil autorise les arrivées sans prélever un droit d’entrée. Le sac du héros et les provisions des villages distants sont exclus. Le calcul commun s’applique en direct, hors écran et au statut du rapport de village, qui précise le manque de nourriture. Les villages statiques ne reçoivent toujours aucune arrivée. Le rapport économique affiche les profils de défense et les plafonds de croissance.

### Forge : déblocage du fer

La première amélioration de la forge (niveau interne 1, N2 affiché) débloque la production des lingots et équipements en fer, y compris les flèches, les casques décorés et l’épée longue. La forge initiale conserve le bronze. La forge ne possède que ces deux niveaux. L’amélioration ne nécessite ni minerai ni lingot de fer.

Le seuil est centralisé dans `app/config/forge.ts` et appliqué par `app/lib/equipment/forgeProduction.ts` au catalogue, à la validation des fabrications et aux approvisionnements automatiques, en direct et hors écran. Les habitants utilisent la meilleure forge achevée de leur village ; une forge distante ne débloque pas la production locale. Les équipements en fer déjà possédés ou stockés restent utilisables et les réparations restent accessibles à tout niveau. La fabrication demeure instantanée, sans file ni nouveau stockage.

### Bâtiments à deux variantes visuelles

Marché, camp de tir, forge et dépôt de ressources ont exactement deux niveaux (0 / 1), avec deux sprites distincts dans les huit civilisations. Leur amélioration unique reprend les PV et le coût cumulé de l’ancien niveau 2 : marché 750 PV et coût total 240 bois / 105 pierres / 9 fibres ; camp de tir 825 PV et 510 bois / 150 pierres ; forge 825 PV et 135 bois / 60 pierres / 6 fibres ; dépôt 825 PV et 150 bois / 60 pierres / 6 fibres. Le prix de rénovation est défini séparément par `levelStats[niveau].upgradeCost`, indépendamment du prix de construction neuve. Les définitions anciennes sans ce champ conservent le calcul par différence positive. Les autres bâtiments conservent leur progression.

Les sauvegardes et villages préparés ramènent les anciens niveaux 2 à 1, conservent les dégâts subis, les stocks, l’or et les formations engagées. Une rénovation devenue superflue est retirée ; les matériaux livrés mais non consommés sont rendus dans l’inventaire du bâtiment. Une migration répétée ne duplique rien.

Les équipements neufs restent plus chers à acheter que leurs ingrédients de recette achetés au marché. La fronde coûte 60 or (48 or d’ingrédients), afin de conserver un intérêt à sa fabrication. Le petit stock de cuir sert au dépannage aux deux niveaux.

### Maisons et lits

Les nouvelles maisons offrent 1 / 2 / 4 lits aux niveaux affichés 1 / 2 / 3. Les trois niveaux partagent le même intérieur standard de bâtiment de taille 2 (profil 11, 77 cases de sol), avec des coins légèrement coupés. Les profils sont centralisés dans `app/config/housing.ts`. Les habitants partagent les lits disponibles, même sans être en couple ; les couples restent prioritaires pour être réunis quand deux places sont libres. Les stagiaires et le héros conservent leur réservation. Une maison déjà habitée peut recevoir des arrivants tant qu’il reste un lit libre ; la même règle s’applique hors écran.

L’amélioration ajoute les lits nouvellement débloqués sans recréer ceux que le joueur a retirés. La surface reste identique lors des améliorations ; les cellules, meubles, inventaires et affectations existants sont conservés. Les anciennes sauvegardes gardent au minimum leur intérieur de taille moyenne et leurs lits existants. Les images restent inchangées.


### Coûts explicites des améliorations

Les prix suivants sont des matériaux à livrer pour chaque transition (niveaux internes). Les coûts de construction neuve restent inchangés. Le travail de chantier est réglé séparément ci-dessous. Les chantiers déjà sauvegardés conservent leurs matériaux requis.

| Bâtiment | 0 → 1 : bois / pierre / fibres | 1 → 2 : bois / pierre / fibres |
|---|---|---|
| Maison | 40 / 30 / 6 | 40 / 25 / 4 |
| Centre-ville | 120 / 60 / 10 | 150 / 80 / 8 |
| Forge | 120 / 70 / 8 | — |
| Caserne | 80 / 50 / 8 | 110 / 60 / 6 |
| Grenier | 40 / 30 / 4 | 55 / 35 / 4 |
| Dépôt | 100 / 50 / 6 | — |
| Camp de tir | 285 / 85 / 0 | — |
| Écurie | 130 / 55 / 0 | 190 / 75 / 0 |
| Tour | 40 / 75 / 0 | 60 / 110 / 0 |
| Marché | 150 / 75 / 9 | — |
| Temple | 60 / 120 / 8 | 110 / 170 / 6 |

La première amélioration de maison finance cinq places supplémentaires ; la suivante augmente seulement les PV et coûte moins. Le centre-ville demande un investissement de défense plus conséquent. La forge reste accessible avec les ressources disponibles avant le fer. Ces prix constituent une base de réglage à valider en partie.


### Durées des bâtiments et améliorations

Une journée dure 24 minutes réelles (`DAY_NIGHT_CONFIG.dayLengthMs`). La référence est une équipe de deux villageois novices, difficulté normale, avec environ dix heures de travail par jour de jeu (7 h–18 h, moins une heure de repas). Les horaires individuels varient légèrement. Le cycle de construction inclut la récupération d’énergie théorique ; avec des marteaux en bronze, les deux ouvriers réalisent environ 2 197 unités de travail par journée. Le planificateur collectif affecte au maximum deux constructeurs par chantier.

Les bases restent accessibles dès l’installation. Les améliorations sont des projets durables. Les petits objets, murs, meubles et semis conservent leurs budgets courts existants ; la grotte conserve son absence de chantier.

| Bâtiment | Base : heures de travail de jeu, deux ouvriers en pierre | Première amélioration : jours, deux ouvriers en bronze | Deuxième amélioration : jours, deux ouvriers en bronze |
|---|---:|---:|---:|
| Maison | ~1,2 h | ~1 | ~2,5 |
| Grenier | ~2 h | ~1,5 | ~3 |
| Dépôt | ~2 h | ~2 | — |
| Caserne | ~4,1 h | ~2,5 | ~4,5 |
| Camp de tir | ~4,9 h | ~3 | — |
| Écurie | ~4,9 h | ~2,5 | ~4 |
| Tour de guet | ~5,7 h | ~2 | ~4 |
| Marché | ~4,1 h | ~3 | — |
| Forge | ~3,3 h | ~3,5 | — |
| Temple | ~7,4 h | ~3 | ~5 |
| Centre-ville | ~6,1 h | ~3,5 | ~6 |

Ces durées commencent après l’approvisionnement et supposent des outils de remplacement disponibles. Elles ne sont pas un compte à rebours garanti : trajets, repas supplémentaires, interruptions, remplacement/fabrication des marteaux et manque de personnel peuvent les prolonger. Un seul ouvrier met environ deux fois plus de temps. À compétence égale, la pierre demande environ 1,5 fois la durée de référence ; le fer environ 0,86 fois. Le héros et des ouvriers expérimentés peuvent accélérer le travail. Les prix, PV et vitesses de réparation restent indépendants de ce réglage. Le rapport d’économie et son calculateur utilisent les nouveaux budgets.

## Pause des chantiers

Le panneau d’information d’un chantier ou d’une amélioration permet de suspendre puis reprendre le projet. La pause interdit les livraisons de ressources et les impacts de construction, en direct comme hors écran. Les villageois affectés au chantier sont libérés immédiatement et le planificateur ignore ses besoins jusqu’à la reprise. Les ressources déjà déposées, les sacs des villageois et la progression sont conservés. L’état est sauvegardé ; une icône ⏸ remplace le pourcentage pendant la pause.
