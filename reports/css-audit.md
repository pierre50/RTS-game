# Audit des variables CSS — 13 septembre 2026

Audit statique de l'état de travail actuel, y compris les modifications non commitées. Aucun style ni code applicatif modifié. Les références de lignes correspondent à cet état.

## Bilan

- 13 fichiers CSS, dont le point d'entrée `app/styles.css`. `quests.css` est bien chargé séparément par `QuestJournalManager.ts`.
- 204 noms de variables déclarés en CSS, dont 165 dans `tokens.css`.
- 32 noms sans aucune référence : 31 dans `tokens.css`, 1 dans `menus.css`. Recherche des noms dans les sources CSS, TypeScript, JavaScript, HTML, les outils et les tests ; les seules occurrences sont leurs déclarations.
- 3 variables utilisées sans définition ni valeur de secours ; 1 autre sans définition mais avec une valeur de secours.
- 132 occurrences de couleurs hexadécimales ou `rgb()/rgba()` hors `tokens.css` et `theme.css` : 93 dans `hud.css`, 26 dans `menus.css`, 6 dans `layout.css`, 4 dans `controls.css`, 2 dans `interaction.css`, 1 dans `base.css`. Ce comptage inclut les valeurs de secours et les répétitions, exclut les couleurs nommées ; ce n'est pas un nombre de défauts.

## 1. À corriger en priorité

### Variables manquantes

| Variable | Emplacement | Conséquence / recommandation |
| --- | --- | --- |
| `--font-size-xs` | `app/styles/hud.css:792`, 12 usages au total | Les tailles prévues pour les petits libellés et badges ne sont pas appliquées ; la propriété hérite de sa valeur. Définir un vrai niveau XS après vérification visuelle, ou utiliser un niveau existant. |
| `--ui-gap-4` | `app/styles/hud.css:920` | Le raccourci `margin` devient invalide à la résolution des variables. Définir `4px` dans l'échelle ou conserver `4px` localement si cet espacement doit rester spécifique. |
| `--color-stone-light` | `app/styles/hud.css:1516` | La couleur du portefeuille et du texte de vente du marché n'est pas appliquée ; la couleur est héritée. Choisir une couleur secondaire cohérente et définie. |
| `--status-danger-color` | `app/styles/menus.css:326` et `331` | La valeur de secours `#ffb09b` fonctionne, mais cette variable n'est jamais définie. Le thème possède déjà `--text-color-danger`. Réutiliser ce rôle si approprié, ou définir intentionnellement une couleur différente. |

Une propriété contenant une variable indéfinie sans secours devient invalide au moment du calcul : une ancienne déclaration du même bloc ne constitue pas automatiquement un repli.

### Réglage responsive sans effet

`--menu-page-overflow` est déclaré dans `app/styles/menus.css:4`, puis redéfini en `auto` aux lignes 567 et 681. Pourtant, le menu utilise toujours `overflow: hidden` à la ligne 29. Ces réglages ne peuvent donc pas activer le défilement. Risque de contenu coupé sur un écran court, à vérifier visuellement. Décider si le menu doit défiler ; raccorder la variable si oui, supprimer les trois déclarations sinon.

## 2. Variables inutilisées : liste complète

Toutes sont dans `app/styles/tokens.css`, sauf indication contraire.

| Groupe / lignes | Variables sans référence |
| --- | --- |
| Palette, 17–36 | `--color-black-deep`, `--color-black-blue`, `--color-blue-deep`, `--color-blue-mid`, `--color-blue-bright`, `--color-cyan`, `--color-orange-dark`, `--color-orange`, `--color-magenta`, `--color-moss-dark`, `--color-moss`, `--color-parchment`, `--color-bronze`, `--color-gold-aged` |
| Bordures, 40–43 | `--border-top-color`, `--border-side-color`, `--border-bottom-color`, `--border-dark-color` |
| Effets / surfaces, 126–154 | `--checkbox-check-shadow`, `--surface-dark-weak`, `--surface-row-dark`, `--border-row-subtle` |
| Menu, 164–187 | `--menu-backdrop-glow`, `--menu-title-shadow`, `--home-button-bg`, `--home-button-focus-scale` |
| Santé, 212 | `--status-health-background` |
| Espacements / effets, 247–359 | `--ui-gap-40`, `--ui-hover-scale`, `--ui-control-sheen`, `--focus-outline-color` |
| `app/styles/menus.css:4` | `--menu-page-overflow` ; aussi redéfinie aux lignes 567 et 681 |

La palette et les bordures inutilisées ne sont pas nécessairement à jeter : plusieurs couleurs correspondantes sont recopiées directement dans les ombres et les bordures. Il faut choisir entre raccorder ces variables et supprimer cette palette inerte. Supprimer une déclaration non référencée n'impose pas de supprimer ses dépendances : `--status-health-top` et `--status-health-bottom`, par exemple, servent réellement ailleurs.

## 3. Valeurs en dur qui méritent une centralisation

### Palette et ombres partiellement raccordées

Dans `app/styles/tokens.css:45`, `--border-btn` utilise `--border-light-color`, mais `--panel-border` recopie `#cfd8ff`. Même situation pour `--border-slot` et `--ui-slot-border`, qui recopient `#31385f`. Les ombres des lignes 293–326 réemploient aussi les couleurs de bordure en dur.

Conséquence : changer la variable d'une couleur ne met pas à jour tous les éléments correspondants. Préférer une source de couleur, puis des variables de rôle si elles apportent une distinction réelle. Le fichier de tokens doit naturellement contenir des couleurs littérales ; le problème est la duplication d'une même couleur censée évoluer ensemble.

### Composants

- **Énergie** : `app/styles/hud.css:333` utilise deux fois `#2f8cff`, puis `#dbe7ff` pour le texte. Un rôle énergie pour le remplissage et un pour le texte serait cohérent avec les variables santé/progression existantes.
- **Carte du monde** : `app/styles/hud.css:1261` / `1312` répètent `#6ee37a`, et `1265` / `1321` répètent `#2d3136`, dans les représentations SVG et HTML. Des variables communes éviteraient une divergence entre les deux rendus.
- **Textes secondaires** : `rgba(255, 255, 255, 0.72)` revient aux lignes 989, 1090, 1126 et 1331 de `hud.css`. Un petit nombre de couleurs de texte par rôle serait plus utile que toutes les nuances voisines actuelles.
- **Séparateur d'interaction** : `app/styles/interaction.css:52` et `112` répètent `rgba(179, 188, 239, 0.3)`. Utiliser une même variable locale pour les versions horizontale et verticale, ou harmoniser avec une bordure existante si la différence n'est pas voulue.
- **Passage du temps** : `app/services/TimeSkipSystem.ts:195` crée toute la présentation en styles inline, dont les fonds, la couleur `#f1f5ff` et `600 18px system-ui, sans-serif`. Déplacer la présentation dans des classes CSS et la raccorder au thème ; conserver la progression calculée dans le code. La police actuelle contourne explicitement la police UI commune.
- **Espacements** : `padding: 8px 12px` revient dans `components.css:41` et `menus.css:317`, `374`, `389`. Les variables `--ui-gap-8` et `--ui-gap-12` existent déjà. Même constat pour les gaps `16px` d'`interaction.css` et les gaps `8px` / `24px` de `quests.css`.

Les valeurs graphiques propres au logo, à un fondu noir ou à la géométrie d'un composant peuvent rester locales. Éviter de créer une variable globale pour chaque nombre.

## 4. Variables excessives ou simplifiables

Ces points sont des recommandations de conception, pas des bugs.

| Candidat | Avis |
| --- | --- |
| `--text-shadow-none` (`tokens.css:125`) | Remplacer par `none` aux usages paraît plus clair. Le nom exprime une constante CSS, sans rôle de thème. |
| `--msg-font-size`, `--msg-border-radius` (`tokens.css:77`) | Une seule utilisation chacune, simple relais de la taille et du rayon communs, aucune redéfinition trouvée. Utiliser directement les variables communes sauf besoin explicite de personnaliser les messages. |
| `--font-size-section-title`, `--ui-control-font-size` | Relais de `--font-size-base`. À conserver seulement si ces rôles doivent pouvoir diverger ; le nombre d'usages ne suffit pas à juger leur utilité. |
| `--msg-sheen`, `--ui-panel-sheen`, `--ui-button-sheen` | Toujours `none` et aucune surcharge trouvée. Supprimer les couches de fond correspondantes simplifierait le thème actuel ; les conserver si des reflets configurables font partie des besoins. |
| `--text-shadow-light-ui` et `--text-shadow-dark-ui` | Valeurs strictement identiques et aucune variation trouvée. Un rôle commun est probablement suffisant. Les noms actuels promettent une distinction absente. |
| `--main-border-radius` et `--main-border-radius-lg` | Tous deux à `0px`. Un rayon commun suffit si tous les panneaux doivent rester carrés ; sinon les deux rôles sont défendables. |
| `--font-family-logo` et `--font-family-display` | Identiques actuellement, mais rôles distincts plausibles. Au minimum, un alias évite de recopier la pile de polices. |

Des noms comme `--color-orange-bright` pour un jaune doré ou `--color-stone-muted` pour un texte d'état vide décrivent mal leur usage. Préférer les rôles accent / texte secondaire, sans fusionner automatiquement des valeurs qui coïncident mais ont des fonctions différentes.

## 5. Variables à conserver

- Les variables de progression et de pourcentage, alimentées par `HeroStatusHud.ts`, `GameLoadingScreen.ts`, `BuildingInteriorTransition.ts` et `BaseEntityInterface.ts`.
- `--stable-horse-color` et `--stable-horse-shadow` : fournies par `app/ui/entity/BuildingInterface.ts:90`. Leur absence de déclaration CSS est normale.
- `--minimap-local-edge-crop-x/y` : utilisées en CSS et lues par `MinimapGeometry.ts`. Le nom historique `--minimap-local-edge-crop`, non défini, est uniquement lu comme repli de compatibilité ; ce n'est pas une déclaration CSS cassée.
- `--modal-panel-padding-x/y` et les variables du menu réellement consommées : elles permettent les adaptations responsive sans répéter les règles de présentation.
- Les couleurs sémantiques de succès, erreur, avertissement et progression, même avec peu d'usages : elles constituent des réglages de thème compréhensibles.

## Ordre proposé

1. Corriger les trois variables manquantes et décider du comportement de défilement du menu.
2. Nettoyer les 32 variables sans référence, en raccordant d'abord celles de la palette que l'on souhaite conserver.
3. Centraliser les répétitions réellement liées : bordures, énergie, carte, textes secondaires et styles de passage du temps.
4. Simplifier les alias et effets désactivés selon les besoins de personnalisation réels.

Validation effectuée : inventaire statique, recherche des déclarations et usages, vérification des imports et des injections / lectures TypeScript. Aucun lancement du jeu ni test visuel effectué : les conséquences visuelles potentielles restent à confirmer en situation. Les scripts de lint et de typecheck actuels ciblent surtout le TypeScript et ne remplacent pas une vérification dédiée des variables CSS.
