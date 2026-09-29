# Activité et économie des villages

Les règles locales ci-dessous restent le repli pour les cartes hors continent et les factions partiellement observées. Le mode abstrait des continents est décrit ensuite.

Chaque PNJ résident est rattaché à un TownCenter par `villageHome` (identité du propriétaire et du bâtiment, position extérieure). Ce rattachement est sauvegardé et reste stable quand le PNJ se déplace. Un centre détruit entraîne une réaffectation au centre restant le plus proche. Les éclaireurs, les expéditions et les unités contrôlées par le joueur sont exemptés.

Les cibles de travail, de chasse et de livraison sont limitées à 30 cellules du centre. Cette valeur partage la constante de rappel des bandits (`app/config/campActivity.ts`). Les trajets peuvent faire un détour de 4 cellules supplémentaires. Une tâche devenue extérieure à la zone est interrompue et le PNJ rentre. Le combat utilise le contrôleur commun des camps : poursuite limitée, recherche brève après perte de vue, retour puis réarmement.

`VillageActivitySystem` contrôle les zones toutes les 500 ms et réconcilie les nouvelles unités/centres toutes les 5 secondes. Un village devient distant au-delà de 110 cellules et redevient détaillé à moins de 80 cellules du héros. La caméra et les combats proches maintiennent aussi le détail. Une unité qui récolte ou un bâtiment du joueur ne constitue pas un observateur ; les bâtiments hostiles et leurs résidents inactifs non plus. Les positions intérieures sont projetées sur leur sortie extérieure.

La récolte distante réutilise `advanceOfflineWorker` avec un instantané local du terrain, des ressources et des réserves réelles. Les livraisons vers les coffres intérieurs sont projetées sur leur accès extérieur. Le terrain de calcul est borné au territoire et à sa marge : aucune exploration du continent entier. Les stocks voisins peuvent se chevaucher ; les transactions synchrones relisent toujours leur valeur réelle, évitant une double consommation. Les livraisons bloquées et les capacités des réserves sont respectées.

Les intervalles de déplacement/travail et les callbacks de récolte des ouvriers sont arrêtés pendant ce mode. Un calcul toutes les 2 secondes applique la production, l'épuisement des ressources et le temps de trajet. Le reste de temps de production utilise `offlineWork`, déjà sauvegardé. Une sauvegarde ou un réveil applique d'abord le temps restant. L'horloge du scheduler respecte la pause. La production nocturne est arrêtée. Les événements journaliers, la repousse et l'entretien restent sous l'autorité du runtime normal ; la simulation des régions inactives n'est pas exécutée pour la région présente.

Limites actuelles : chasse, construction, entraînement, repos et transitions de portail conservent le traitement détaillé du village. Les gardes restent des entités actives. Ce système réduit le travail de déplacement/récolte distant, mais ne décharge pas les entités de la mémoire. Les fractions d'un geste visuel en cours sont abandonnées à l'entrée du mode distant, pour éviter de compter un impact deux fois. Les nouvelles parties sur les continents 1000 et 5000 activent les civilisations IA ; les emplacements sont attribués par biome au démarrage.

## Simulation distante des continents

Sur les continents, `DistantVillageSystem` suspend maintenant les résidents et les décisions périodiques d'une faction dont tous les villages sont éloignés et sans interaction hostile. Les factions partagent leurs réserves entre villages : elles constituent donc une seule transaction économique. Une faction partiellement observée conserve le fonctionnement local précédent. Les transitions de portail, les expéditions, les scouts et les ordres de combat restent détaillés.

Le temps de référence est celui du cycle jour/nuit. Il n'y a plus de calcul de travail toutes les deux secondes pour une faction abstraite. Le rattrapage intervient avant les événements quotidiens, à l'approche du joueur, lors d'une attaque et avant la sérialisation. Le checkpoint n'avance qu'après application du résultat. Les états économiques sont des copies temporaires locales, sans renderer ni grille de vision. `VillageEconomySnapshot` reste utilisé pour préparer les décisions de construction de l’IA. Les données ordinaires des unités et bâtiments restent la source sauvegardée : aucun format de sauvegarde supplémentaire n'est nécessaire.

`DistantVillageEconomy` délègue le travail à `advanceVillageWork`, exactement comme les villages du joueur. Le calcul commun utilise les ressources finies, les stocks réels, les horaires et les priorités autonomes. Il ne crée plus de ressources abstraites pour les IA de la carte active. Le terrain est borné à l’union des territoires concernés. Les travaux terminés passent par le cycle de vie normal des bâtiments, une seule fois. Les TownCenters encore en chantier servent aussi de point de rattachement.

La simulation partagée désactive les événements quotidiens et les formations du moteur hors carte : arrivées, repousse, marchés, raids et formations payées restent gérés par leurs services existants. Les repas sont consommés chronologiquement dans le rattrapage du travail ; `lastMealAt` empêche le service de repas normal de les prélever une seconde fois. Le travail précédent est appliqué **avant** que ces événements lisent les stocks. Ensuite, les nouvelles décisions de construction/recrutement sont réparties à raison d'une faction par vérification locale. Un checkpoint journalier empêche de relancer la planification à chaque sauvegarde ou visite. Les stagiaires gardent leur trajet d'entrée et leur formation réels ; les autres résidents suspendent déplacement, travail, patrouille et repos détaillés. La santé nocturne et l'énergie sont réconciliées au rattrapage.

Ce mode allège le calcul, pas encore l'allocation mémoire : les entités restent identifiables pour les quêtes, les références de sauvegarde et les interactions. Les changements de propriétaire/centre et les interactions incompatibles réactivent le détail. L'expansion territoriale et la conquête ne sont pas ajoutées par cette refonte.

Diagnostic : `village.abstract` et `village.detailed` marquent les transitions ; `village.state` indique `abstract=true` ; `runtime.village.abstractAdvance` mesure le rattrapage. Vérifier ces champs après `perf-report reset` sur une partie rechargée. Les animaux restent un coût distinct.

## Nettoyage après passage au continent

Le runtime de poursuite entre régions et son extraction des poursuivants ont été retirés : ils n’étaient plus démarrés depuis la suppression du voyage entre cartes. Les nouveaux snapshots ne produisent plus `worldPursuers`. Le validateur conserve ce champ en entrée pour lire les anciennes sauvegardes ; il ne relance pas les anciennes poursuites.

Les anciens modules de dessin de mini-carte sans appelant, le placement de repousse remplacé par le système actuel, les styles de carte régionale et leurs traductions inutilisées ont aussi été supprimés. La légende des factions reste utilisée par la mini-carte.

Les modules `OfflineWorld*` ne sont pas du code mort : la simulation distante et la restauration des cartes les utilisent. Les conversions de coordonnées locales restent nécessaires aux intérieurs et aux anciens formats. Le stockage synchrone reste le repli du navigateur, et certains exports sont chargés dynamiquement par les outils de génération et les tests ; les signalements de Knip doivent donc être vérifiés avant suppression.

## Travailleurs du joueur sur le continent

`PlayerWorkActivitySystem`, intégré au cycle de `VillageActivitySystem`, suit les résidents éloignés, y compris ceux sans activité ni métier. Aucun TownCenter terminé n’est requis. Les résidents suspendus d’un même propriétaire sont simulés ensemble : stocks, besoins et ressources sont ainsi arbitrés dans une seule transaction. Avant l’entrée d’un nouvel habitant, le groupe existant est réglé à l’heure courante pour éviter de lui créditer du travail antérieur.

Le calcul commun `advanceVillageWork` → `simulateOfflineWorld` utilise les priorités collectives pour le joueur et l’IA : matériaux transportés/prélevés/récoltés, construction, réserves, repas et inactivité lorsqu’aucun besoin ne reste. Les anciens métiers des résidents actifs sont réévalués. Les ressources économiquement connues des habitants sont accessibles même hors de la vision du héros.

Le rattrapage intervient aux événements quotidiens (donc aussi à `nextday`), avant une sauvegarde et au réveil. Trois jours sautés doivent produire le même bilan économique qu’un rattrapage unique de trois jours. Les repas sont inclus, même sans chantier ; leurs identifiants empêchent un nouveau prélèvement au retour. Le héros, ses suivants, les formations, les transitions d’intérieur et les interactions incompatibles gardent leur traitement détaillé.

La décision de créer un bâtiment ou de lancer un entraînement reste propre à l’IA. La planification des bâtiments ne réécrit plus les stocks ni les tâches en cours. Dans le village du joueur, seuls les projets décidés par le joueur sont exécutés.

La suspension des callbacks est maintenant partagée via `unitSuspension` (`distant-work` pour l’économie, `camp-paused` pour les camps figés). Le service propriétaire reste responsable du règlement du travail et de la reprise ; les règles de territoire restent dans `villageActivity`.

## Pause repas des villageois

Le planning individuel comporte une pause déjeuner : début entre 11 h 40 et 12 h 20, durée entre 40 et 80 minutes. Ces variations sont déterministes par villageois et conservées dans `dailySchedule` ; les anciennes sauvegardes reçoivent ces deux horaires sans modifier leurs heures de réveil, de travail et de coucher. Le créneau reste identique d’un jour à l’autre.

En détail, le villageois interrompt sa tâche et reste éveillé près de son lieu de travail, en libérant les passages si nécessaire. Il reprend la tâche mémorisée à la fin du repas, sans transition de réveil supplémentaire. Les combats, le héros contrôlé, ses suivants et les formations gardent leurs règles de priorité. Les dialogues de déjeuner existent en français et en anglais. Cette pause n’ajoute pas de prélèvement alimentaire à l’entretien quotidien.

Les pauses éveillées du matin, du midi et du soir utilisent la pose `sit` une fois le villageois arrêté, y compris à sa place de repos dans une maison. Les hommes sont assis jambes croisées et les femmes jambes sur le côté : la variante est intégrée à l’atlas, avec une image fixe par direction. Un ordre, un déplacement, un dialogue, une alerte ou la reprise du travail fait quitter cette pose ; le coucher conserve le visuel de sommeil. Les outils ne sont pas affichés pendant la pose assise.

La simulation hors écran retire exactement ce même créneau du temps de travail. Elle conserve les ressources finies et les règles de dépôt existantes. La pause réduit le temps de travail d’environ 9 %, sans changer la cadence de récolte. Les trajets simulés sont désormais amortis sur la capacité réelle du sac, comme les livraisons en détail. Les règles partagées et les limites des approximations sont décrites dans [economy-rules.md](economy-rules.md).

Le forum est le lieu d’arrivée des nouveaux villageois et un point de rassemblement. Il ne fournit ni couchages ni capacité de population. Les maisons fournissent les places ; sans maison disponible, le repos extérieur près du camp reste possible. La capacité est recalculée au chargement et pour les régions simulées, sans supprimer les habitants déjà présents.
