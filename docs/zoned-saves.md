# Sauvegardes par zones

Le format de stockage `zoned-save-v1` sépare une sauvegarde en un manifeste et des parties compressées indépendantes. Les structures `SaveRecord` utilisées par le jeu et la simulation restent compatibles : `loadSave` les reconstruit avant leur validation habituelle. Les anciens fichiers monolithiques restent lisibles et sont convertis lors de leur prochaine écriture.

## Contenu

Les entités sont regroupées par monde, espace intérieur/extérieur et zone de 64 × 64 cases : ressources, animaux, unités, bâtiments (avec leur contenu intérieur), cadavres et emplacements de repousse. Leur état complet est conservé, notamment inventaire, vie, activité et informations de disparition déjà présentes dans le sérialiseur.

Les observations `targetKnowledge`, les mémoires IA et l'exploration appartiennent à des canaux séparés pour chaque joueur. Le stockage ne rafraîchit jamais une observation à partir de l'état réel de l'entité. Les identifiants/labels existants sont conservés. Les collections anciennes sans labels ont une identité de stockage fondée sur leur type, leur position et leur occurrence.

Les états des régions simulées à distance utilisent les mêmes règles. Le terrain compact de leur économie est enregistré par groupes de lignes. Les sauvegardes anciennes avec une grille de terrain ou de vision utilisent aussi des groupes de lignes.

L'ordre des listes est conservé dans des pages de 1024 identifiants. Ces pages sont indépendantes des entités : retirer un élément ne déplace pas les autres entités entre les parties stockées. Le manifeste contient les chemins des collections, leurs longueurs et les références aux parties.

## Écriture et restauration

1. Le sérialiseur existant capture les entités présentes. Le découpage n'effectue aucun parcours de la grille de cellules du terrain.
2. Les parties sont comparées à la sauvegarde précédente. Seules les parties modifiées sont recompressées et écrites sous de nouvelles clés. Les parties inchangées sont réutilisées.
3. Le manifeste est publié après toutes les parties. Un déplacement entre zones ou un transfert unité/cadavre devient visible en une seule publication.
4. Après publication, les parties obsolètes de cette sauvegarde sont supprimées. Les autres emplacements de sauvegarde possèdent leurs propres parties.

Une zone est un instantané complet de ses entités sauvegardées, et non un delta par rapport au blueprint. Une entité absente du nouvel instantané reste absente au rechargement. Il n'est pas nécessaire d'accumuler un historique de suppressions. Une repousse est une nouvelle entrée, accompagnée des données de repousse existantes.

Les erreurs d'écriture déclenchent une restauration du manifeste précédent et le nettoyage des parties préparées lorsque cette restauration est confirmée. Une partie manquante ou corrompue provoque une erreur : le chargeur ne restitue pas un monde partiel. Electron écrit les fichiers temporaires puis les renomme pour éviter un manifeste partiellement écrit ; cette amélioration de `main.js` nécessite un redémarrage d'Electron.

## Coûts et limites

- La détection actuelle compare les instantanés des entités au moment de la sauvegarde. Elle n'intercepte pas encore toutes les mutations du jeu. Son coût dépend du nombre d'entités et de données enregistrées.
- Le chargement reconstruit encore l'état complet demandé par le moteur. Ce changement ne décharge pas les cellules logiques et ne modifie pas les règles de simulation lointaine.
- La première sauvegarde écrit toutes ses parties. Une nouvelle sauvegarde manuelle possède un ensemble indépendant ; les réécritures du même emplacement sont incrémentales.
- Un arrêt brutal avant publication peut laisser des parties préparées orphelines, sans rendre l'ancienne sauvegarde incohérente. Le nettoyage automatique après une interruption de processus n'est pas encore implémenté.
- Les logs `[save-zones]` indiquent les zones modifiées/réutilisées/supprimées et le nombre total de parties écrites/réutilisées (pages d'ordre comprises).
