# Introduction au camp

Une nouvelle partie prépare un feu de camp et un compagnon appartenant au joueur, de sexe opposé au héros. La recherche de placement utilise les cases de terre accessibles autour du héros, respecte les occupations et réserve l’emprise du feu avant de choisir la position du compagnon.

`startGameRuntime` appelle la préparation après le démarrage du monde. Les voyages ne passent pas par ce point d’entrée. `finishBoot` prépare la pose endormie avant de révéler la carte, puis lance la séquence après la transition. Il peut également reprendre une introduction préparée lors d’un chargement ou redémarrage.

`CampaignSave.introduction` conserve `status` (`prepared` ou `completed`), `worldId`, `companionLabel` et `campfireLabel`. L’absence du champ est valide pour les anciennes parties et ne déclenche rien au chargement. Les créations et l’état sont enregistrés ensemble par `autosave()`, qui sérialise le monde courant. Reprendre une introduction ne recrée aucune entité.

Le panneau de communication reçoit une réponse scénarisée. Pendant l’échange, le jeu continue de tourner, les ordres et commandes de débogage du panneau sont masqués et la fermeture ordinaire est désactivée. Le texte se déroule avec le système de dialogue habituel. La réponse marque l’introduction comme terminée, ferme le panneau, reprend le jeu et sauvegarde. Le feu et le compagnon restent présents.

La présentation utilise le même panneau, le même placement et les mêmes styles que les communications ordinaires (`NpcOrdersManager` et `createInspectionModal`), sans variante visuelle propre à l’introduction.

Les textes sont `introductionCampDialogue` et `introductionCampReply` dans les traductions françaises et anglaises. La réponse finale donne au héros le statut de chef et ne crée pas de quête ; elle est indépendante du futur tutoriel.

La phase sauvegardée (`approaching`, `waking`, `dialogue`) permet de reprendre la scène sans recréer le camp. Le compagnon démarre à trois ou quatre cases lorsque le terrain le permet, puis rejoint une case accessible près du héros. Le héros utilise `setSleepingOutsideFinalVisual`, l’indicateur de sommeil et `playSleepingWakeVisual`. Les commandes du joueur restent désactivées pendant la séquence ; la simulation fonctionne pendant la marche et le réveil. Le dialogue laisse la simulation active ; les commandes et le HUD restent masqués jusqu’à la réponse. Le héros est non-chef avant cette réponse, puis devient chef : les barres de vie des unités de la même équipe deviennent alors visibles. Une approche bloquée est interrompue après douze secondes afin de poursuivre le réveil. Les anciennes introductions sans phase reprennent directement le dialogue.
