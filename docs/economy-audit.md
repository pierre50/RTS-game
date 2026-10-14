# Audit économique

Lancer `pnpm economy:audit` puis ouvrir `reports/economy/index.html`. Le rapport autonome en français contient les coûts de construction par niveau, les rénovations, les ratios par place d’abri configurée, les stocks initiaux et une carte interactive de densité par zone. `reports/economy/economy.json` expose les mêmes données, les sources et leurs empreintes SHA-256.

La carte par défaut est `public/maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map`. Le script lit les fichiers actuels ; il n’ouvre pas le jeu et ne modifie ni configuration ni carte.

```sh
pnpm economy:audit
pnpm economy:audit --map public/maps/worlds/world-4242/maps/world-4242-r0-0-temperate.map --out reports/economy --zone-size 64
node --test tests/economy-audit.test.cjs
```

Les chemins explicites sont relatifs au dossier courant. Les chemins par défaut sont relatifs au dépôt. `--help` décrit les options. Une nouvelle exécution remplace les deux sorties dans le dossier indiqué. Le dossier de sortie par défaut est ignoré par Git.

## Calculs

- Catalogue : définitions de base de `public/assets/data/gameplay/buildings.json`. Le rapport inclut le mobilier et les décors dans une section repliable ; il ne certifie pas leur disponibilité dans le catalogue du joueur. Les conditions configurées sont affichées sans être évaluées.
- Niveaux : `getBuildingLevels` et `getBuildingConfigForLevel` du jeu, avec leur règle exacte de remplacement des propriétés. Les niveaux internes sont 0, 1, 2.
- Rénovations : `getBuildingUpgradeCost` du jeu entre deux niveaux adjacents. Une différence négative ne rembourse rien. Les coûts restent ventilés par matériau.
- Construction : `constructionTime` est présenté en unités de travail de base, jamais comme un délai en secondes. Les ratios de logement portent sur `shelterCapacity`, pas sur les lits ni la population effective.
- Carte : blueprint finalisé, version 2, terrain en tableau ou base64. La grille a un pas de `size + 1`. Les cases absentes et le remplissage 255 sont exclus ; eau et terre sont comptées séparément. Les indices de terrain viennent des constantes du jeu.
- Si le fichier voisin `.settlements.json` existe, ses ressources **remplacent** celles du blueprint. Son identifiant, sa taille, sa version et l’empreinte du blueprint doivent correspondre, sinon le script échoue. Il ne régénère pas les villages et ne vérifie pas la fraîcheur des règles de préparation ni l’enregistrement dans le manifeste.
- Quantité initiale : `quantity`, sinon `totalQuantity`, sinon la quantité par défaut dans `resources.json`. Capacité : `totalQuantity`, sinon `quantity`, sinon le défaut. Les zéros sont conservés. Le compteur « quantité par défaut » indique les gisements sans aucune valeur explicite.
- Densité : quantité / nombre de cases × 100. Chaque zone utilise sa propre surface réelle, y compris aux bords. Les zones sans terre n’ont pas de densité terrestre. La carte suit les coordonnées stockées, pas la projection isométrique du jeu.

## Portée

Il s’agit d’un inventaire statique, toutes civilisations incluses. Le démarrage d’une partie retire certains contenus de la civilisation humaine. Les contrôles de chargement graphique (collision, texture…) ne sont pas exécutés ; les doublons et ressources déclarées sur eau sont signalés et conservés, les positions hors carte sont signalées et exclues. Une ressource inconnue ou une quantité invalide fait échouer l’audit au lieu de fabriquer un total.

L’inventaire statique de la carte exclut les animaux et leurs butins, coffres et réserves des villages, grottes, commerce, formations, repousses et croissance. Le catalogue des crafts et les mesures de flux sont décrits ci-dessous. Elle n’évalue ni les chemins, ni le temps de récolte, ni les bonus en cours de partie. Les observations sur les améliorations sont des questions à vérifier en jouant, pas un score d’équilibrage.

Le chargement des fonctions TypeScript réutilise le chargeur existant de `tools/maps/load-generation-ts.cjs`. Aucun calcul de rénovation n’est dupliqué dans le rapport. Le coût d’exécution est linéaire dans la surface de la carte et le nombre de ressources ; la version actuelle lit le JSON de la carte en mémoire.

## Crafts et matériaux

Le rapport lit maintenant `heroCraftRecipes.ts`, partagé avec les actions du jeu : recettes de forge et feu de camp, lots produits, ingrédients, culture de la forge et coût par objet. Le coût brut développe récursivement les recettes de lingots en minerais et combustible ; il ne transforme pas les lots en fabrications fractionnaires. Les filtres du rapport permettent de choisir la culture de la forge et de rechercher une recette.

Les recettes sont accessibles sans découverte technologique. Posséder ou fabriquer un lingot ne débloque aucun palier global. Le catalogue compare les matériaux des outils réellement équipés et leurs effets sur la récolte, la construction et l’accès au minerai de fer. La fabrication consomme les ressources de la recette et exige l’atelier approprié.

## Mesurer une période de jeu

Dans la console du jeu (touche Entrée) :

```text
economy-flow start
```

Jouer, visiter ou quitter des villages pour observer aussi le rattrapage hors écran, puis :

```text
economy-flow show
economy-flow stop
economy-flow export
```

Le dernier ordre télécharge `economy-flow.json`. Charger ce fichier dans « Bilan joué » du rapport HTML fonctionne localement, sans serveur ni téléversement. Autre possibilité :

```sh
pnpm economy:audit --capture /chemin/economy-flow.json
```

Les compteurs sont désactivés par défaut. Une nouvelle capture remplace la précédente uniquement après son arrêt ; `start` refuse d’écraser une capture active. La destruction de la console à la sortie du jeu arrête la mesure. Ce diagnostic ne fait pas partie des sauvegardes : exporter avant de recharger l’application. `export` peut également exporter un instantané encore actif, explicitement marqué comme tel.

### Ce qui est compté

- Récolte : quantités effectivement acceptées dans un sac en direct ou récoltées par le simulateur, après ses limites de transport et de stockage.
- Construction/rénovation : différence du registre des matériaux réellement consommés, y compris les anciens matériaux livrés. Les prévisions de coût et les réparations ne sont pas facturées une deuxième fois.
- Repas : baies, viande et blé réellement retirés des provisions personnelles. L’agrégat virtuel `food` n’est pas ajouté en plus de ses composantes.
- Craft : ingrédients réellement payés et résultats produits, y compris les lots de flèches automatiques de la ville. Les objets portent le préfixe `item:` pour les distinguer des ressources.
- Autres paiements/remboursements : variations réelles passant par le registre commun `payCost`/`refundCost`.
- Approvisionnement RPG : quantités réellement ajoutées aux réserves des villages concernés, distinctes de la récolte.
- Renouvellement du monde : repousse quantitative des baies/blé, réinitialisation du potentiel d’un blé récolté, et ressources naturelles réapparues. Ce potentiel n’est pas une entrée en stock, et un blé immature ne peut pas être immédiatement récolté.

Les scopes synchrones de simulation étiquettent les événements `offline` et restaurent le mode, même en cas d’erreur. Les scopes imbriqués ne doublent pas les fenêtres. Les transferts entre sacs et dépôts ne déclenchent aucun événement de production.

Les taux par jour utilisent `DAY_NIGHT_CONFIG.dayLengthMs`. Le direct divise par le temps de jeu écoulé pendant la capture ; le hors écran divise par l’union des fenêtres observées pour le joueur, sans additionner deux fenêtres qui se chevauchent. Les fenêtres peuvent commencer avant la capture si un village rattrape une longue absence. Ces taux ne comparent donc pas automatiquement la même période ni le même nombre de travailleurs.

Les stocks début/fin sont ceux des inventaires des unités et bâtiments chargés, héros et intérieurs inclus, sans compter deux fois une même référence. Leurs variations sont comparées aux entrées/sorties instrumentées du joueur. « Écart non expliqué » conserve la différence : il ne la rebaptise pas production. Chargement/déchargement de villages, commerce direct, butin, morts, maturation, stocks des marchés, création de cultures et autres flux non instrumentés peuvent l’expliquer. Les stocks entièrement déchargés et le temps d’activité par travailleur ne sont pas mesurés par cette version.

La mémoire est bornée à 20 000 combinaisons joueur/mode/flux/ressource et 10 000 fenêtres de simulation. Le rapport signale toute capture tronquée. La validation refuse les versions inconnues, quantités négatives/non finies et chronologies incohérentes. Le résultat d’une capture doit être interprété avec ses limites de couverture, pas comme une comptabilité exhaustive du monde.

### Armes et rendement des outils

Les sections « Armes et dégâts » et « Outils et rendement » comparent les niveaux de compétence 1 à 20 en réutilisant les fonctions du jeu. Les armes sont comparées à équipement fixe, avec armure effective de 0 au maximum du catalogue par emplacement, coups normaux et critiques ; les arcs incluent la flèche indiquée. Difficulté normale, sans charge, parade ni défense active : aucun DPS réel n’est estimé.

Les rendements combinent quantité de base, compétence et palier de forge du propriétaire. Le tableau distingue lots de récolte et travail de construction par impact. Le cuivre améliore le lot de bois, mais l’abattage conserve 1 PV retiré par impact. Les villageois ne gagnent actuellement pas d’XP ; leurs niveaux supérieurs sont des scénarios de données préexistantes. Les stocks restants, la capacité, les déplacements et la fatigue peuvent limiter le résultat réel.

## Objectifs et durée

Le scénario interactif couvre la maison initiale, la hache en cuivre et la découverte du bronze. Les recettes sont développées en lots entiers, après utilisation du stock disponible ; les excédents intermédiaires sont réutilisés. Une forge absente ajoute une seule fois ses matériaux et son travail. Un lingot de bronze déjà détenu satisfait immédiatement la condition de découverte, sans consommation ni forge supplémentaire.

Les hypothèses affichées sont illustratives et modifiables : travailleurs, compétence, palier de forge, capacité, longueur du trajet, vitesse, secondes par impact, coût d’abattage amorti par bois, pauses, manipulation des crafts et trajet à la forge. Le palier reste fixe durant le parcours. Les phases sont successives et la répartition du travail entre travailleurs est idéale ; aucun moteur de cheminement ou de fatigue n’est exécuté. Les stocks sont supposés accessibles sur place, la nourriture et l’usure ne sont pas déduites. Les pauses sont une fraction du temps total, donc leur durée vaut temps actif × p / (1 − p). Le gain sur les 100 bois suivants isole le bonus de découverte sous les mêmes hypothèses.

Pour chronométrer une vraie partie, les nouvelles commandes s’insèrent dans une capture économique :

```text
economy-flow start
economy-flow goal maison
economy-flow phase harvest
```

Aux changements d’activité, utiliser `economy-flow phase travel`, `pause`, `build`, `craft` ou `other`. À la fin :

```text
economy-flow finish
economy-flow stop
economy-flow export
```

L’identifiant peut aussi être `hache-cuivre`, `bronze` ou un nom personnel sans espaces. Le joueur déclare l’objectif terminé : il n’y a pas de détection automatique du bâtiment/craft. Le rapport distingue le temps réel monotone (incluant les pauses et la console) du temps de l’horloge du jeu. La répartition des phases est manuelle ; les périodes non annotées restent « Non attribué ». Un arrêt de capture interrompt l’objectif sans le déclarer réussi. Les mesures sont bornées à 100 objectifs et environ 2 000 changements par objectif. Les anciennes captures sans objectifs restent importables. Exporter avant de quitter : ces diagnostics ne sont pas sauvegardés dans les parties.

Si la quantité initiale totale recensée sur la carte est inférieure au besoin restant, le rapport affiche une durée conditionnelle et signale la ressource. Cela ne prouve pas l’impossibilité en partie : stocks des villages, marchés, grottes et autres cartes peuvent fournir une autre source. À l’inverse, un stock total suffisant ne garantit pas l’accessibilité locale.

## Sources d’approvisionnement élargies

« Approvisionnement » relie les entrées `map.caves` au catalogue intérieur réellement chargé par le jeu, `public/maps/interiors/cave/catalog.json`. Chaque grotte placée contribue une fois selon son plan ; les variantes non placées ne sont pas ajoutées. Ce potentiel est séparé de la surface, des stocks préparés et des quantités restantes d’une sauvegarde. Un plan absent reste inconnu. Seul le héros peut miner ces gisements, sans repousse ; le rapport ne certifie pas l’accès sans combat.

Les stocks préparés sont ceux des inventaires physiques des unités, bâtiments et intérieurs. Une recherche permet de filtrer par propriétaire, conteneur ou ressource. Les agrégats miroirs des joueurs et `food` quand ses composantes existent ne sont pas recomptés. Les trésoreries et stocks marchands restent séparés. Les stocks des camps ne sont pas automatiquement disponibles au joueur.

Importer une sauvegarde JSON dans le rapport, ou lancer `pnpm economy:audit --save partie.json`, affiche les mêmes détails pour une vraie partie, avec les minerais restants déjà enregistrés dans les grottes. Les campagnes parcourent `worlds[*].state` ; les régions abstraites non visitées ne sont pas incluses. Aucun état n’est avancé ni écrit. Sans sauvegarde importée, aucun stock actuel n’est inventé.

Le catalogue marchand réutilise les fonctions du jeu : équipement par civilisation, prix d’achat/revente et quantité au réapprovisionnement. Les prix des ressources représentent exclusivement leur revente par le joueur ; ils ne prouvent pas une offre d’achat de minerai ou de lingot auprès du marchand.

## Corrections étain et armure

Les plans des grottes moyennes/grandes contiennent de l’étain, désormais accepté par le chargement intérieur. Une grotte anciennement visitée récupère son filon manquant si aucun état d’étain n’existe. Un filon déjà présent, déplacé ou épuisé reste intact ; aucun autre minerai n’est régénéré. La carte de surface n’est pas modifiée.

Le plafond de 3 points d’armure de l’équipement des unités ordinaires est supprimé. Chaque pièce intacte contribue à la protection cumulée ; les pièces cassées sont exclues comme auparavant. Le héros conserve sa règle de base + équipement. Cela augmente la résistance des unités fortement équipées, sans changer les coûts des objets ni la formule de dégâts minimum.

Le comparateur couvre désormais le maximum du catalogue par emplacement, plus la base du héros (18 dans les données actuelles). Des tableaux détaillent la protection brute des pièces et des exemples de tenues complètes. Les valeurs identiques de certaines pièces entre deux matériaux ne sont pas artificiellement augmentées.

## Mesures du moteur hors écran

À chaque audit, une scène indépendante exécute `simulateOfflineWorld` jusqu’à 100 bois récoltés ou un jour de jeu. Un villageois niveau 1, un arbre debout avec ses PV et son stock configurés, un dépôt, un centre et un grenier sont placés sur un terrain plat. Provisions : 12 blés personnels et 200 en bâtiments. Huit essais comparent les quatre paliers et deux distances ; deux essais supplémentaires démarrent à midi et le soir.

Les quantités, transports, abattage, repas et horaires viennent du moteur, pas du calculateur de scénario. La cadence utilise `getWorkCycleMs` avec les données actuelles et son repli sans sprites chargés, incluant sa récupération d’énergie théorique. La durée d’atteinte est encadrée par des pas de 30 secondes d’horloge de jeu ; le repos est la durée des fenêtres non travaillées du villageois. Le moteur ne mesure pas ici le temps réel devant l’écran, les animations, les combats, les expéditions ou les crafts manuels. Aucun état de partie n’est modifié. Ces mesures de contrôle ne sont pas une simulation complète de la progression sur la carte.

## Ramassables, outils de secours et construction

La section « Ramassables » et l’objet JSON `groundResources` relisent les quantités des définitions, le stock initial de la carte auditée, les délais de réapparition du jeu et les recettes manuelles des quatre outils en pierre. Le bois et la pierre au sol font déjà partie des totaux de surface : ils ne sont pas ajoutés une seconde fois. Une ancienne carte sans ramassables affiche zéro ; l’audit ne modifie pas sa génération.

La collecte naturelle crée un emplacement sauvegardé : branches après 2 jours, pierres après 4 jours selon la configuration actuelle. La réapparition cherche localement une case libre ; les branches nécessitent un arbre vivant proche. Un échec reporte l’essai au jour suivant. Il ne s’agit donc pas d’un revenu journalier garanti.

Les contrôles PNJ vérifient l’absence de renouvellement gratuit, le paiement avec les matériaux du sac, l’outil temporaire en pierre et le retour au métal en stock à la prochaine casse. Deux scènes supplémentaires exécutent le moteur hors écran : construction à partir de ramassables et priorité au dépôt. Elles utilisent un chantier synthétique de 2 bois et 2 pierres, un marteau, des provisions préchargées et un terrain plat. Repas, formations et événements journaliers sont désactivés pour isoler la collecte et le chantier ; les durées ne sont pas des prévisions de partie réelle.

Le miroir visuel à 50 % des ramassables et plantes autorisés est déterministe à partir du type et de la position sauvegardée, sans incidence économique. Les icônes d’inventaire restent fixes. Les recettes et postes des consommables restent relus dans la section Crafts.

## Récolte du blé à la main

Le héros et les villageois peuvent récolter du blé mûr sans faux utilisable. Chaque lot donne 1 blé à la main, sans bonus de compétence ni de matériau ; le stock du plant n’est diminué que de la quantité effectivement prise. La règle est partagée par le jeu, le rattrapage hors écran et le tableau « Outils et rendement », qui compare désormais le blé à la main et avec faux. Au niveau 1, les faux actuelles donnent respectivement 2/3/4 blés par lot (pierre/bronze/fer). Une faux rangée ou cassée, ou un autre outil équipé, utilise le rendement manuel et n’use pas cet autre outil. Les stocks des plants et les recettes restent inchangés. La faux en pierre apporte désormais un gain par rapport à la récolte manuelle.

## Lances et équipement du fantassin

Le fantassin reçoit une lance en pierre, bronze ou fer selon le palier de forge. La hallebarde est retirée du catalogue ; les anciennes sauvegardes la convertissent en lance de fer et les épées des fantassins en lances du même matériau, en conservant leur usure. Les sources graphiques LPC de la hallebarde restent nécessaires à la génération de la lance.

L’audit contrôle les trois équipements du fantassin et le remplacement payant de sa lance cassée. Les recettes et statistiques des lances sont relues depuis le jeu. Le cuivre sert à fabriquer le bronze ; aucun outil en cuivre n’est proposé.


## Durée de vie des outils et comparaison aux bâtiments

Les quatre familles d’outils ont 300 contacts en pierre, 600 en bronze et 900 en fer. Une récolte, un abattage, une construction ou une attaque avec cet outil consomme le même budget, en direct et hors écran. Les armures conservent 100 contacts ; les armes ont désormais les budgets décrits ci-dessous. La faux en pierre récolte 2 blés par lot au niveau 1, contre 1 à la main, 3 en bronze et 4 en fer.

`toolLifetime` dans le JSON et « Usure et bâtiments » dans le rapport comparent un villageois niveau 1 avec des outils neufs. Les rendements relisent les règles communes ; les arbres sont abattus un par un et les fins de gisement sont plafonnées. Les durées viennent de `getWorkCycleMs`, récupération d’énergie théorique comprise, sans trajets, repas, repos ni fabrication : elles ne mesurent pas la partie en direct. Les pertes liées au sac et les interruptions sont exclues. Les ressources sont supposées disponibles en nombre suffisant ; le blé suppose des plants mûrs sans attente de repousse.

Chaque bâtiment de base demandant uniquement bois/pierre est comparé séparément : récolte depuis des arbres debout, puis construction. Les outils nécessaires incluent le premier outil et les remplacements, arrondis à des objets entiers. Leur coût est séparé de la recette du bâtiment ; la collecte récursive de ce coût et la création de la forge ne sont pas simulées. Réparations, outils de départ, ramassables et stocks existants ne sont pas déduits. Le calculateur d’objectifs garde ses propres hypothèses sans usure.

Les anciens suffixes `~condition:N` restent des pourcentages : un outil à 50 % conserve 50 % de son nouveau budget. Après utilisation, les outils stockent un nombre entier de contacts avec `~uses:N` pour éviter les arrondis cumulés ; les barres d’inventaire, les prix et les réparations utilisent toujours un pourcentage. Un outil cassé reste cassé, et une réparation complète restaure le nouveau maximum. Les coûts des recettes, bâtiments et réparations ne changent pas.


## Durabilité et réparation des armes

Les armes de mêlée ont 300 contacts en pierre, 600 en bronze et 900 en fer. Tous les arcs ont 600 tirs et le lance-pierre 300. Les dégâts, coûts de fabrication, munitions, parades et armures sont inchangés. Un contact de mêlée consomme un usage même paré ; un tir consomme un usage à son lancement, même s’il rate. Les coups dans le vide ne consomment pas de durabilité.

La réparation des armes utilise la recette actuelle de chaque objet : `ceil(coût par objet × 0,5 × fraction usée)` par ingrédient, sans dépasser le coût de fabrication de cet ingrédient. Une arme intacte ne coûte rien à réparer. Les petits ingrédients peuvent donc coûter autant que dans la recette neuve à cause des arrondis. Les variantes d’arc sans recette propre utilisent celle de l’arc simple. Les coûts de réparation des outils et armures sont conservés.

Les colonnes « Contacts / tirs avant casse » et « Réparation à état zéro » de l’audit relisent ces règles. Pour les arcs combinés à une flèche, elles décrivent l’arc seul, sans remplacer les munitions. Les sauvegardes anciennes conservent leur pourcentage ; les nouvelles utilisent les budgets exacts `~uses:N`. Les anciens équipements PNJ stockés en pourcentages préservent aussi les fractions de pourcentage sans arrondir chaque contact.


### Usure à la parade

Chaque coup réellement bloqué consomme un usage de l’arme ou de l’outil du défenseur, en plus du contact consommé par l’attaquant en mêlée. La garde manuelle du héros utilise l’emplacement choisi au début de la garde, indépendamment de son métier ; les parades automatiques des PNJ utilisent leur équipement de mêlée courant. Maintenir la garde sans impact ne consomme pas de durabilité. Les coups reçus dans le dos et les parades manquées n’usent pas l’objet du défenseur. Le dernier usage bloque entièrement le coup, puis la garde du héros est annulée ; les coups suivants ne sont plus bloqués. Une fenêtre de parade automatique ne peut plus réussir si le défenseur n’a plus d’arme ou d’outil de mêlée utilisable.


### Durées de construction et rénovation

Les tableaux « Constructions » et « Rénovations » affichent la durée totale estimée du chantier, après livraison de tous les matériaux. Le calcul est commun au menu de construction et au menu d’amélioration (`app/lib/buildings/constructionDuration.ts`). La référence est deux ouvriers novices, difficulté normale, dix heures de travail par journée de jeu : outils en pierre au niveau de base, en bronze aux niveaux améliorés. Une journée dure 24 minutes réelles. Les budgets des nouveaux chantiers sont calibrés sur des heures entières de jeu pour les bases (1 à 8 h) et des jours entiers de jeu pour les améliorations (1 à 6 jours). Le catalogue affiche ces valeurs rondes dans un encadré Chantier, avec des icônes de matériaux et un sablier. Les hypothèses figurent en infobulle ; les chantiers actifs affichent les quantités livrées, la progression et une estimation du travail restant, arrondie à l’heure ou au jour supérieur. Trajets, interruptions et fabrication/remplacement des outils ne sont pas inclus. Il s’agit d’une estimation de charge de travail, pas d’une échéance garantie ni d’un compte à rebours.

Le JSON expose `constructionDuration` sur chaque construction et rénovation : nombre d’ouvriers, matériau de l’outil, heures de travail par jour, heures actives, jours de travail, unité et valeur d’affichage. Les lignes d’amélioration utilisent les prix explicites `upgradeCost` ; les anciennes définitions sans ce champ gardent le calcul par différence positive. Les chantiers sauvegardés utilisent leur budget initial dans le menu, tandis que le catalogue du rapport présente les budgets des nouveaux projets.
