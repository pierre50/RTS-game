# Code Health Report

Generated: 2026-08-24T14:04:07.442Z

## Global Score

**65/100 (D)**

| Component | Score |
| --- | --- |
| Gates | 30/30 |
| Duplication | 25/25 |
| Structure | 0/25 |
| Hotspots | 0/10 |
| Type/Lint confidence | 10/10 |

## Summary

- Files analyzed: 267
- Total lines: 60016
- Code lines: 53342
- Approx branches: 8775
- Approx functions/methods: 6680
- Duplication: 0 clones, 0%

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | OK |  |
| TypeScript | OK |  |
| Duplication | OK | 0 clones, 0% |
| Dead code | OK |  |

## Top Priorities

| File | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- |
| app/classes/unit/UnitActions.ts | 780.3 | 1027 | 248 | 412 | 39 | fichier volumineux, beaucoup de branches, gros bloc/fonction, souvent modifie |
| app/classes/map/MapGeneration.ts | 779.3 | 1481 | 239 | 391 | 43 | fichier volumineux, beaucoup de branches, gros bloc/fonction, souvent modifie, beaucoup de dependances |
| app/classes/unit/index.ts | 684.5 | 1587 | 230 | 217 | 57 | fichier tres volumineux, beaucoup de branches, gros bloc/fonction, souvent modifie, beaucoup de dependances |
| app/classes/unit/UnitMovement.ts | 663.5 | 1232 | 307 | 134 | 43 | fichier volumineux, beaucoup de branches, souvent modifie |
| app/classes/map/MapTerrain.ts | 583.4 | 997 | 321 | 120 | 15 | beaucoup de branches, souvent modifie |
| app/lib/heroTools.ts | 497.2 | 1370 | 223 | 49 | 40 | fichier volumineux, beaucoup de branches, souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | 475.2 | 1031 | 210 | 113 | 36 | fichier volumineux, beaucoup de branches, souvent modifie |
| app/classes/players/AIPlayer.ts | 424.4 | 970 | 209 | 147 | 11 | beaucoup de branches, souvent modifie |
| app/ai/AIEconomy.ts | 410.2 | 869 | 227 | 59 | 16 | beaucoup de branches, souvent modifie |
| app/lib/combat.ts | 391.2 | 528 | 194 | 40 | 29 | beaucoup de branches, souvent modifie |
| app/screens/Game.ts | 385.8 | 1164 | 151 | 77 | 35 | fichier volumineux, complexite elevee, souvent modifie, beaucoup de dependances |
| app/classes/Controls.ts | 382.6 | 965 | 189 | 74 | 25 | beaucoup de branches, souvent modifie |

## Largest Files

| File | LOC | Branches | Imports |
| --- | --- | --- | --- |
| app/classes/unit/index.ts | 1587 | 230 | 36 |
| app/classes/map/MapGeneration.ts | 1481 | 239 | 25 |
| app/lib/heroTools.ts | 1370 | 223 | 27 |
| app/classes/unit/UnitMovement.ts | 1232 | 307 | 11 |
| app/screens/Game.ts | 1164 | 151 | 41 |
| app/services/WeatherSystem.ts | 1090 | 67 | 7 |
| app/controllers/HeroController.ts | 1031 | 210 | 19 |
| app/classes/unit/UnitActions.ts | 1027 | 248 | 16 |
| app/classes/Projectile.ts | 1008 | 128 | 15 |
| app/classes/map/MapTerrain.ts | 997 | 321 | 8 |
| app/lib/lpc/equipment.ts | 984 | 58 | 2 |
| app/classes/players/AIPlayer.ts | 970 | 209 | 14 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/classes/map/MapTerrain.ts | 321 | 120 | 997 |
| app/classes/unit/UnitMovement.ts | 307 | 134 | 1232 |
| app/classes/unit/UnitActions.ts | 248 | 412 | 1027 |
| app/classes/map/MapGeneration.ts | 239 | 391 | 1481 |
| app/classes/unit/index.ts | 230 | 217 | 1587 |
| app/ai/AIEconomy.ts | 227 | 59 | 869 |
| app/lib/heroTools.ts | 223 | 49 | 1370 |
| app/controllers/HeroController.ts | 210 | 113 | 1031 |
| app/classes/players/AIPlayer.ts | 209 | 147 | 970 |
| app/lib/combat.ts | 194 | 40 | 528 |
| app/classes/Controls.ts | 189 | 74 | 965 |
| app/classes/building/BuildingProduction.ts | 170 | 37 | 575 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 61 | 196.9 | 494 |
| app/classes/unit/index.ts | 57 | 684.5 | 1587 |
| app/lib/i18n/translations.ts | 45 | 164.7 | 769 |
| app/classes/map/MapGeneration.ts | 43 | 779.3 | 1481 |
| app/classes/unit/UnitMovement.ts | 43 | 663.5 | 1232 |
| app/classes/building/index.ts | 41 | 255.7 | 556 |
| app/classes/animal/index.ts | 41 | 207.4 | 439 |
| app/config/assetManifest.ts | 41 | 129.9 | 275 |
| app/lib/heroTools.ts | 40 | 497.2 | 1370 |
| app/classes/unit/UnitActions.ts | 39 | 780.3 | 1027 |
| app/controllers/HeroController.ts | 36 | 475.2 | 1031 |
| app/screens/Game.ts | 35 | 385.8 | 1164 |

## Notes

- Complexity is an approximation based on branch keywords/operators; use it as a prioritization signal.
- Churn is based on Git commits from the last 90 days.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
