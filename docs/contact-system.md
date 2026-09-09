# Contacts des attaques et du travail

Le héros, les PNJ et les animaux utilisent `app/lib/contact/contactGeometry.ts`. Les cellules servent toujours à rechercher les cibles et à naviguer. La validation d'un impact utilise des formes dans le plan du sol, indépendantes du zoom : secteur pour l'arme, l'outil ou la main, ellipse pour le corps, empreinte au sol pour les bâtiments et ressources. Il ne s'agit pas d'une collision pixel par pixel avec la lame animée.

- `canReachActionTarget` / `canReachContact` : vérifient la portée en orientant virtuellement l'acteur vers la cible.
- `isActionTouchingTarget` / `isContactTouching` : vérifient l'intersection dans la direction actuelle au moment de l'impact.
- `sampleContactApproach` : fournit ensemble direction, point d'approche, distance et portée, avec une seule construction de la forme cible.
- `createContactStrike` : partage la forme d'un coup pendant une recherche de candidats. Ne pas conserver cet objet entre les frames : l'acteur peut bouger.

Le travail choisit son outil par action. La récolte de buissons et de carcasses utilise la main même si une épée est équipée. Une carcasse peut être récoltée mais ne peut pas recevoir un nouveau coup de combat. Les conditions métier restent responsables de vérifier la quantité, l'état et les permissions de l'action.

## Réglages

Les valeurs par défaut et la correspondance exacte des outils sont centralisées dans `app/config/contactProfiles.ts`. Un outil inconnu utilise la portée de la main, sauf configuration explicite. Les dimensions sont exprimées en pixels du plan du sol, avant `spriteScale`; les angles sont en degrés. `width` élargit le secteur, `handOffset` définit son rayon intérieur, `reach` sa portée. Le rayon extérieur inclut la moitié de `width`.

Une entrée d'équipement dans la configuration du propriétaire peut définir :

```json
{ "contact": { "reach": 42, "width": 7, "handOffset": 10, "halfAngle": 40 } }
```

Une configuration d'unité ou d'animal peut définir son corps et son action naturelle :

```json
{ "contact": { "body": { "radius": 18, "verticalScale": 0.5 }, "action": { "reach": 30, "width": 10 } } }
```

Les tables `CONTACT_ENTITY_OVERRIDES` et `CONTACT_TOOL_OVERRIDES` permettent aussi des exceptions par identifiant exact. La configuration de l'entité ou de l'équipement est prioritaire. Les propriétés omises reprennent les valeurs par défaut; les dimensions invalides sont ignorées. Les bâtiments et ressources conservent leur empreinte existante.

## Approche et interruptions

`contactApproach.ts` partage la boucle finale, ses limites, la revalidation et le retour au calcul de chemin. Les adaptateurs conservent les déplacements existants : `moveDirect` pour les unités, déplacement sur terrain avec gestion des cellules et des empreintes pour les animaux. Les règles d'obstacles des PNJ, du héros et des animaux ne sont donc pas devenues identiques. Une étape bloquée ne force jamais la traversée d'un obstacle.

Un nouvel ordre ou la mort annule les effets de l'ancien cycle. La cible est revérifiée à l'impact. Un mouvement pendant la préparation peut provoquer un coup manqué. Le profil décrit une zone d'action; il ne suit pas chaque pixel du sprite à chaque frame.

## Affichage de contrôle

Dans la console du jeu : `localStorage.setItem('debug.contact', '1')`. À l'impact, le jaune montre l'action et le bleu les cibles pendant 300 ms. Désactivation : `localStorage.removeItem('debug.contact')`.

Les tests `contact-actions`, `contact-profiles` et `hero-melee-collision` couvrent la géométrie réelle, l'approche, les frames sautées, les interruptions, les obstacles, les carcasses et les cibles qui sortent de portée. Les réglages visuels propres à chaque sprite restent à calibrer en jeu.

## Ressources encombrées

Pour la récolte des villageois, une approche bloquée conserve brièvement la cible : nouvelle tentative toutes les 5 étapes, abandon après 30 étapes sans progrès d'au moins 1 pixel (environ 600 ms au rythme normal). Un déplacement latéral réussi ne suffit pas : la distance doit réellement diminuer. L'approche conserve aussi sa limite totale de durée.

Après abandon, la ressource est écartée pour ce villageois pendant 8 secondes et la recherche habituelle d'une autre cible reprend. Cette exclusion est respectée par la recherche classique et autonome, et reste active même lorsqu'une nouvelle cible est acceptée. Les autres villageois peuvent continuer à exploiter la ressource. Sans alternative, le comportement habituel d'arrêt ou d'exploration autonome s'applique. Un nouvel ordre ou la mort annule l'attente. Cette politique ne s'applique ni au héros contrôlé directement, ni aux attaques, ni à la construction.
