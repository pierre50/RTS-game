# Butin des unités ennemies

La configuration se trouve dans `app/config/unitCorpseLoot.ts`, dans `UNIT_CORPSE_LOOT`.
Chaque type possède sa liste indépendante : villageois, fantassin, archer, bandit à l'épée,
bandit archer, chef bandit, chef, prêtre et éclaireur.

Pour modifier une récompense, changer sa ligne :

```ts
{ item: 'leather', chancePercent: 60, min: 1, max: 3 }
```

Cela donne 60 % de chances d'obtenir entre 1 et 3 peaux, chaque quantité étant aussi probable.
Chaque objet est tiré séparément : un corps peut donner plusieurs ressources ou aucune.
Les chances d'une table n'ont donc pas à totaliser 100 %. `0` désactive une ligne,
`100` la garantit. Les quantités doivent être des entiers positifs, avec `max >= min`.

Identifiants utiles : `leather` (peau), `fiber` (fibre), `sinew` (tendon),
`feather` (plume), `herb` (herbe médicinale), `toxicHerb` (herbe toxique),
`berry` (baie), `meat` (viande), `gold` (or).
Les autres ressources stockables sont également acceptées et vérifiées par TypeScript.

Les bandits transportent des matériaux et parfois de l'or ; les archers privilégient
plumes et tendons ; les villageois, fibres et provisions ; les prêtres, herbes.
Les chefs bandits offrent de meilleures chances et des quantités plus importantes.

Le tirage est effectué une seule fois par `UnitLifecycle.die()`, avec le générateur
aléatoire de la carte, uniquement si le propriétaire est ennemi du joueur à la mort.
Les ressources s'ajoutent à l'inventaire du corps et utilisent la récupération et la
sauvegarde existantes. Fouiller, vider ou recharger le corps ne relance pas le tirage.
Les anciens cadavres sauvegardés ne reçoivent pas rétroactivement de butin.
Les équipements et flèches conservent leurs règles existantes.

Pour ajouter un type, ajouter son identifiant dans `UNIT_CORPSE_LOOT` et sa liste.
Un type absent ne reçoit aucun bonus. Les héros et animaux ne font pas partie de ces tables.
