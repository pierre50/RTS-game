# Tutoriel

Les nouvelles parties utilisent le village prégénéré. `TutorialOpening` choisit la maison la plus éloignée du TownCenter : le héros y dort, le chief entre par la porte, s’approche et le réveille. Après le dialogue, le chief sort et retourne au centre du village. Le héros reste non-chief.

La campagne conserve la scène dans `tutorial.stage` (`sleeping`, `dialogue`, `wood-requested`) et les labels de la maison et du chief. Les missions sont conservées séparément dans le journal de quêtes ; charger une partie ne recrée ni les personnages ni les récompenses.

`TutorialHuntQuest` enchaîne les étapes via le moteur générique :

- Livrer 10 bois : aucun or, mais un arc et 20 flèches, équipés avec les mêmes règles que l’inventaire normal.
- Livrer des peaux (`leather`) ou des plumes (`feather`). Le choix utilise les animaux accessibles sur la carte et leurs probabilités réelles de butin de dépeçage, partagées dans `animalGatherLoot`. La quantité est limitée à 3 et ajustée au rendement estimé. L’objectif et sa zone sont fixés lors de la remise du bois puis sauvegardés.

La quête propose des flèches supplémentaires uniquement si le sac et l’équipement n’en contiennent plus. Cette aide est une interaction répétable avec condition d’inventaire. Le moteur valide et applique les effets sur des inventaires détachés avant de les remplacer, pour éviter les paiements partiels. La minimap dessine la zone de la quête suivie sans découvrir le terrain.

Les anciennes quêtes de bois du tutoriel sont converties à la reprise. Si le bois a déjà été livré, le chief propose directement la suite sans reprendre du bois ni de l’or.

Les événements quotidiens et la simulation des régions distantes restent suspendus pendant le tutoriel, sans rattrapage ultérieur. La livraison du butin de chasse donne et équipe une épée, efface la zone de chasse et déclenche le son puis le dialogue d’alerte (`alarm`). La réponse, ou la fermeture du dialogue, passe à `raid` et déclenche une armée de faction de 24 unités via `TributeRaidSystem`. Ce raid attaque directement, sans tribut, contrainte horaire ni prélèvement dans l’économie distante. Les tentatives concurrentes sont bloquées ; un échec permet de réessayer en reparlant au chief. Les anciennes chasses déjà terminées passent par `legacy-hunt` pour recevoir l’épée sans nouveau paiement.

Pendant l’étape `raid`, la défaite du héros remplace l’écran de défaite par un fondu au noir. Le runtime du village est détruit, puis une partie normale sans base est initialisée avec la configuration du joueur et la scène existante au feu de camp. Le prologue n’est pas rejoué ; le compagnon commence son approche après le fondu de révélation. Les défaites hors de cette étape gardent le comportement normal.

Un chief encore en sommeil répond « Zzzz… On verra ça demain » et ne propose aucune action de quête. Le contrôle utilise la session de sommeil réelle et l’animation de réveil, pas seulement la posture affichée. Un héros non-chief ne force pas le réveil d’un PNJ de sa propre équipe en lui parlant.

Le village d’accueil appartient à un propriétaire IA distinct du joueur, même lorsque leur civilisation et leur faction sont identiques. Le joueur ne possède que son héros. La génération utilise `heroStartVillage` et le profil existant ; les stocks, bâtiments et habitants restent à l’IA. Les références au chief et à la maison sont résolues parmi les propriétaires présents. Les anciennes sauvegardes de tutoriel sont séparées au chargement en conservant les identifiants du village et des intérieurs, puis en réaffectant les quêtes au propriétaire du héros.

Les attaques contre le héros non-chief sont signalées à l’IA de sa faction : sa défense existante intervient lorsque le héros est près du village et l’attaquant visible par l’IA. Cela ne partage pas la vision avec le joueur. Les ordres scénarisés du chief restent prioritaires sur sa patrouille et sa défense autonome pendant la scène d’ouverture.

La préparation de l’ouverture réserve un groupe d’animaux pour les étapes bois et chasse. La sélection utilise un groupe accessible dans le rayon du marqueur, les probabilités de dépeçage et une marge de rendement. Si nécessaire, des cerfs ou oiseaux sont ajoutés via les profils et contraintes du générateur ambiant, hors de la vue du joueur et loin des bâtiments. Un contrôle périodique peut compléter les animaux épuisés tant que le héros manque de butin, sans changer la ressource de la quête active. Les chevaux domestiqués ne sont pas sélectionnés.

Les réservations sont génériques : `QuestInstance.reservation` contient des labels d’entités et les étapes concernées. Elles sont sauvegardées dans le journal et contrôlées par les conditions d’action communes (chasse, attaque, dépeçage et capture). Seul le héros assigné peut utiliser ces cibles ; les autres activités des PNJ restent disponibles. La réservation cesse de s’appliquer après les étapes concernées ou quand la quête n’est plus active.

La conversation de réveil utilise `NpcOrdersOpenOptions.dialogue` : une séquence de nœuds localisés, chacun contenant une réplique et des réponses du héros. Une réponse peut pointer vers un autre nœud ou terminer la conversation. Le panneau normal reste ouvert et utilise le même texte progressif et la même voix. L’ancien `scriptedReply` passe par ce même rendu pour les conversations à réponse unique.

Le chief réveille le héros, qui peut répondre poliment ou avec insolence. Le chief demande ensuite les 10 morceaux de bois sur le ton correspondant. Le joueur confirme avant la sortie du chief. `tutorial.dialogueNodeId` sauvegarde la branche courante ; les mises à jour de quête ne remplacent pas les répliques scénarisées et les anciens boutons ne peuvent pas rejouer un choix.

Au camp, la conversation de réveil utilise la même séquence à choix. Quatre sujets facultatifs expliquent l’attaque, le sauvetage, les premières priorités et le rôle du héros. Chaque réponse propose « J’ai d’autres questions » pour revenir au menu des sujets, ou une réponse finale. Seule cette dernière termine l’introduction, rend les contrôles et promeut le héros chief. `introduction.dialogueNodeId` conserve le sujet courant au rechargement.
