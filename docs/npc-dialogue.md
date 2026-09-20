# Répliques de routine des PNJ

`npcRoutineChatter.ts` choisit une réplique une seule fois à l’ouverture du panneau de communication. La détection de proximité ne tire aucune phrase. Les dialogues scénarisés, les sujets de quête, les remerciements après sauvetage et les répliques explicitement fournies restent prioritaires.

Pour les villageois, le matin va du réveil individuel à la reprise du travail ; le repos du soir va de la fin du travail au coucher. Ces limites utilisent les horaires sauvegardés du PNJ. Le sommeil effectif prend priorité sur les phases horaires, et son état est relevé avant que l’ouverture du dialogue puisse réveiller le PNJ.

Le ton distingue le chef du même propriétaire, un membre du même groupe, un chef étranger et un visiteur. Le statut de chef est celui du personnage, pas celui des boutons du panneau. Un PNJ chef parle des responsabilités de son village. Les répliques des travailleurs étrangers, du repos matinal et du soir, ainsi que les salutations des chefs PNJ tiennent compte des relations de faction : méfiante, neutre ou amicale. Les factions alliées partagent le ton amical. Une relation absente utilise le ton neutre ; les répliques du même groupe et celles de sommeil ne sont pas modifiées par la diplomatie.

Pendant le travail, `autonomousJob` choisit la réplique : nourriture, bois, pierre, or, cuivre, fer, construction ou capture de chevaux. Sans mission autonome, le métier actif est résolu par `getVillagerAssignedJob`, également utilisé par le résumé des affectations. Cela couvre les ordres de travail de l’IA et conserve le type de minerai pendant une conversation.

Les catalogues français et anglais sont dans `npcRoutineLines.ts`. Leur typage impose une liste non vide pour chaque métier, période et interlocuteur. Les formules de sommeil, de sauvetage et les répliques générales de repli restent dans `npcChatter.ts`.
