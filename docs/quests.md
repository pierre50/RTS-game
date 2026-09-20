# Quêtes et journal

Le bouton **Journal**, à côté du menu, et le raccourci configurable **J** ouvrent le même panneau. Une seule mission peut être suivie. Le journal affiche les missions acceptées, leur donneur, leurs objectifs, et leur historique. Les offres non acceptées restent réservées aux conversations.

## Stockage et identité

`QuestDefinition` décrit une mission et ses étapes, objectifs et interactions. Les définitions sont enregistrées dans `questDefinitions` avant de proposer des missions. Le registre est du code livré avec le jeu ; il n'est pas sauvegardé. Garder ses identifiants stables et migrer les instances si une définition change de structure.

`QuestInstance` est sauvegardé dans `CampaignSave.quests`. Il contient le donneur (`owner`), le bénéficiaire (`assigneeId`), la région extérieure, les rôles associés à des labels d'entités, les paramètres tirés une seule fois, l'étape, les interactions déjà consommées et les marqueurs. Les identifiants utilisent les labels persistants du jeu, jamais des références d'objets. Le journal appartient à la campagne pour survivre aux voyages et aux intérieurs. Le moteur relit la campagne actuelle à chaque opération, même lorsqu'une sauvegarde remplace son objet.

Les anciennes campagnes sans journal restent valides. Le journal est créé au premier accès. Les données présentes sont validées au chargement. Une définition manquante affiche une mission indisponible sans supprimer son historique.

## Définir une demande de ressources

Exemple de définition (les clés de texte doivent être ajoutées aux traductions) :

```ts
const request: QuestDefinition = {
  id: 'resource-request',
  title: { key: 'resourceRequestTitle' },
  description: { key: 'resourceRequestDescription' },
  stages: [{
    id: 'delivery',
    objectives: [{
      id: 'deliver',
      text: { key: 'resourceRequestObjective' },
      conditions: [{
        type: 'resource',
        resource: { parameter: 'resource' },
        quantity: { parameter: 'quantity' },
      }],
    }],
    interactions: [{
      id: 'give',
      actor: 'recipient',
      text: { key: 'resourceRequestGive' },
      visibleWhen: [],
      enabledWhen: [],
      requireObjectives: true,
      effects: [{
        type: 'take-resource',
        resource: { parameter: 'resource' },
        quantity: { parameter: 'quantity' },
      }],
      nextStageId: null,
    }],
  }],
}
questDefinitions.set(request.id, request)
```

Le producteur d'offres vérifie la présence d'un chef neutre et de ressources accessibles, choisit la ressource et la quantité, puis appelle `offer` avec une instance `available`. Ses `parameters` contiennent par exemple `{ resource: 'wood', quantity: 12 }`, et ses `bindings` associent `recipient` au label du chef. Il doit éviter de créer une seconde offre pour le même chef. `offer` refuse les identifiants de quête dupliqués et copie l'instance.

`accept` affecte la quête au joueur, la rend non lue et la suit si aucune autre quête n'est suivie. Le panneau n'accepte aucune mission à la place du dialogue.

## Conditions, aide et transactions

Les conditions d'une liste sont combinées avec ET. Les conditions disponibles portent sur une quantité (`at-least` ou `below`), un fait sauvegardé ou l'état d'une cible liée. Les conditions sont recalculées au clic : posséder la quantité requise ne termine pas automatiquement une livraison.

Une interaction d'aide utilise `repeatable: true` et omet `nextStageId`. Elle ne change pas d'étape. Une réserve peut être complétée jusqu'à un plafond via `top-up-resource`, sous une condition `below`. Le test de réapprovisionnement illustre ce contrat avec une réserve abstraite de flèches. Le futur adaptateur d'équipement devra compter le sac **et** les flèches équipées et utiliser les fonctions d'inventaire existantes.

`QuestEnvironment` fournit la région extérieure actuelle, les lectures d'inventaire, les états des cibles et un engagement atomique des effets de ressources. `commitResources` doit soit appliquer tout le lot, soit ne rien changer et retourner `false`. Il doit rester synchrone, sans réentrer dans le moteur de quêtes. Cette frontière permet de brancher les règles réelles de stockage/transfert sans les introduire dans le journal. Les effets internes et le changement d'étape ne sont appliqués qu'après réussite du lot.

Une interaction ordinaire n'est utilisable qu'une fois par étape. `nextStageId: null` termine la mission et supprime son suivi ; une chaîne mène à l'étape suivante. Les étapes ne progressent pas automatiquement : une future mission de découverte nécessitera un branchement explicite sur les événements du monde.

## Recherche et camps

### Rencontres créées par les quêtes

`ensureQuestEncounter` prépare une rencontre extérieure pour une quête active. Son identifiant est propre à la quête ; les labels des entités, la position et les paramètres sont conservés dans `QuestInstance.encounters`. Une rencontre déjà enregistrée ne recrée pas ses entités, même après chargement ou après leur mort. La fabrique `create(cell)` peut créer des animaux ou des unités hostiles ; elle doit passer par le propriétaire habituel pour que les entités soient sauvegardées avec la carte. L'appelant sauvegarde après avoir associé les réservations et marqueurs.

La recherche avance par tranches de 128 cellules au maximum, avec une cible de 2 ms par tranche et un plafond de 8192 cellules à 48 cases du donneur. Chaque emplacement est accessible par voie terrestre, hors vision et hors caméra avec une marge de 96 pixels, libre, éloigné des bâtiments et des passages réservés. En l'absence de place, une nouvelle tentative est différée de 5 secondes. Ces contrôles sont refaits avant la création du groupe. `runtime.quests.encounter.search` mesure les tranches dans le rapport de performance.

Le tuto prépare trois animaux pendant l'étape du bois et conserve ce groupe pour la chasse. Les anciennes réservations encore utilisables sont adoptées sans duplication. Tant qu'une cible ou un cadavre reste récoltable, aucun nouveau placement n'est recherché. Si toutes les cibles sont épuisées et que le sac ne contient pas encore le butin demandé, la chasse seule autorise un groupe de remplacement.

### Nettoyer un camp de bandits

Hors tutoriel, les chefs IA non hostiles peuvent proposer `neutral-bandit-camp` parmi leurs nouvelles offres (une chance sur trois, sans deux missions de camp consécutives). Les offres déjà sauvegardées restent inchangées. Le délai habituel de trois jours s'applique après la récompense.

L'acceptation lance la recherche bornée d'un emplacement. Toute l'emprise du camp, dans un rayon de neuf cellules, doit être libre, hors caméra et hors vision. `placeOutdoorBanditQuestCamp` réutilise les feux, décors, coffre avec butin et patrouilles des camps générés ; il n'appelle jamais la génération de grotte. Le nombre de gardes suit les règles existantes de niveau du héros. Les labels sauvegardés concernent uniquement les nouveaux gardes, pas les bâtiments ni les autres bandits de la carte.

La quête est validable lorsque tous ces gardes sont morts ou ont été retirés de la carte chargée, quel que soit l'auteur des attaques. Cette vérification ne s'effectue que dans la région de la quête ; un voyage ne valide pas le camp. Le fait `campCleared` est sauvegardé et aucun groupe de remplacement n'est créé. Le joueur retourne au chef pour recevoir une seule fois 25 or et +10 de relation. Détruire les décors ou le coffre n'est pas nécessaire.

Les conditions de cible utilisent un rôle (`missingPerson`, `targetCamp`) associé à un label persistant et un état (`discovered`, `spoken-to`, `defeated`, `reached`). Le système qui connaît le monde décide de cet état. Un cercle de recherche ne constitue jamais une preuve de découverte.

Les marqueurs sont instanciés par étape : position en cellules `i/j`, `spaceId`, rayon optionnel en cellules. `getTrackedMarkers` filtre par quête suivie, étape, région et espace intérieur. La minimap affiche les zones en doré pour la quête suivie, puis un « ? » sur le destinataire dès que la remise est possible. Le repère suit sa position et les changements d’inventaire, sans révéler le terrain.

## Demandes des chefs neutres

Le service `NeutralVillageQuests` est monté et détruit avec les services de la carte. Toutes les 500 ms, il propose une demande unique aux chefs vivants des villages neutres (faction de relation neutre, amicale ou alliée, ou propriétaire explicitement neutre sans faction). Il exclut le joueur et les ennemis. Les offres sont également disponibles sur les parties existantes.

Une demande porte sur 5 à 15 unités de bois, pierre ou baies, parmi les ressources présentes dans l’espace extérieur de la région. Le tirage est conservé dans la campagne. La vérification porte sur la présence et la quantité, pas sur un calcul de chemin jusqu’à chaque gisement. Après une livraison, `completedDay` et `nextOfferDay` sont sauvegardés. Une nouvelle instance est proposée après 3 jours (`VILLAGE_QUEST_CONFIG.repeatDelayDays`), au changement de jour, au premier contrôle après arrivée sur la carte ou lors du dialogue. Les contrôles périodiques continuent de synchroniser les marqueurs. Une offre disponible ou active ne se remplace pas ; les quêtes terminées restent dans l’historique. Le tirage évite de reproduire la dernière demande si une autre combinaison est possible. Les anciennes quêtes terminées sans date commencent leur délai lors de la première rencontre.

Le chef affiche `!` pour une offre et `?` lorsque le héros peut livrer une quête acceptée. Le marqueur utilise son propre label d’affichage : il n’efface pas les indicateurs de sommeil ou de raid. Il disparaît pendant le sommeil ou le combat. Les dialogues ajoutent Accepter / Pas maintenant, puis une remise conditionnelle, indépendamment des permissions d’ordres. La progression compte uniquement le sac du héros, jamais les stocks de son village. La remise transfère exactement la quantité demandée dans le sac du chef, une seule fois, avec une récompense de +10 de relation définie par `QuestDefinition.relationReward`. Le score de faction est plafonné à 100 et le message de fin indique le gain réel ainsi que le nouveau statut lorsqu’un palier est franchi. Les villages indépendants conservent leur réputation dans `QuestJournalState.villageRelations` (clé région/propriétaire), sans créer de faction artificielle. Cette réputation locale ne modifie pas les règles de combat des propriétaires sans faction. Une quête déjà terminée ne redonne jamais sa récompense, même après rechargement.

Le raccordement initial concerne les cartes extérieures et leurs espaces intégrés. Les anciennes cartes intérieures chargées comme mondes séparés ne génèrent pas d’offres. Une quête dont le donneur disparaît ou devient hostile reste dans le journal : les règles d’échec et de succession sont à définir pour les futures missions.

Le journal et le rappel d’objectif affichent le compteur courant, actualisé depuis l’inventaire. Les paramètres de ressources sont traduits à l’affichage, sans sauvegarder de texte dépendant de la langue.

L’escorte et les attaques scénarisées restent des extensions de gameplay.

La livraison verse aussi 1 or par ressource (`VILLAGE_QUEST_CONFIG.goldPerResource`), soit 5 à 15 or dans le sac du héros. Le montant `rewardGold` est figé dans les paramètres de chaque offre et affiché dans le dialogue et la description du journal. L’effet générique `give-resource` fait partie de la même transaction que le retrait des ressources : un échec ne retire ni ne verse rien. Cette récompense de mission est créée sans prélever le stock du chef. Les quêtes actives anciennes bénéficient du montant par défaut ; aucune récompense supplémentaire n’est versée aux quêtes déjà terminées.
