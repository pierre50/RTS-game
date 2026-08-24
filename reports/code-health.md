# Code Health Report

Generated: 2026-08-24T16:02:36.855Z

## Global Score

**73/100 (C)**

| Component | Score |
| --- | --- |
| Gates | 30/30 |
| Duplication | 25/25 |
| Structure | 8/25 |
| Hotspots | 0/10 |
| Type/Lint confidence | 10/10 |

## Summary

- Files analyzed: 282
- Total lines: 60620
- Code lines: 53915
- Approx branches: 8777
- Approx functions/methods: 6733
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
| app/classes/unit/UnitMovement.ts | 587 | 993 | 258 | 134 | 44 | beaucoup de branches, souvent modifie |
| app/classes/map/MapTerrain.ts | 586.4 | 997 | 321 | 120 | 16 | beaucoup de branches, souvent modifie |
| app/classes/unit/UnitActions.ts | 496.9 | 995 | 232 | 85 | 40 | beaucoup de branches, souvent modifie |
| app/controllers/HeroController.ts | 431.5 | 843 | 182 | 113 | 37 | beaucoup de branches, souvent modifie |
| app/classes/players/AIPlayer.ts | 427.4 | 970 | 209 | 147 | 12 | beaucoup de branches, souvent modifie |
| app/ai/AIEconomy.ts | 410.2 | 869 | 227 | 59 | 16 | beaucoup de branches, souvent modifie |
| app/lib/combat.ts | 394.2 | 528 | 194 | 40 | 30 | beaucoup de branches, souvent modifie |
| app/classes/Controls.ts | 382.6 | 965 | 189 | 74 | 25 | beaucoup de branches, souvent modifie |
| app/lib/heroTools.ts | 382.1 | 991 | 153 | 49 | 41 | complexite elevee, souvent modifie |
| app/classes/map/MapGeneration.ts | 373.7 | 981 | 140 | 70 | 44 | complexite elevee, souvent modifie, beaucoup de dependances |
| app/dev-console/createDevCommands.ts | 360.1 | 449 | 27 | 398 | 18 | gros bloc/fonction, souvent modifie |
| app/classes/building/BuildingProduction.ts | 347.4 | 575 | 170 | 37 | 26 | beaucoup de branches, souvent modifie |

## Largest Files

| File | LOC | Branches | Imports |
| --- | --- | --- | --- |
| app/classes/map/MapTerrain.ts | 997 | 321 | 8 |
| app/classes/unit/UnitActions.ts | 995 | 232 | 15 |
| app/classes/unit/UnitMovement.ts | 993 | 258 | 12 |
| app/lib/heroTools.ts | 991 | 153 | 24 |
| app/lib/lpc/equipment.ts | 984 | 58 | 2 |
| app/classes/map/MapGeneration.ts | 981 | 140 | 26 |
| app/classes/unit/index.ts | 975 | 83 | 32 |
| app/classes/players/AIPlayer.ts | 970 | 209 | 14 |
| app/classes/Controls.ts | 965 | 189 | 18 |
| app/screens/Game.ts | 962 | 116 | 37 |
| app/ai/AIEconomy.ts | 869 | 227 | 6 |
| app/dev-console/actions/debug.ts | 867 | 113 | 9 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/classes/map/MapTerrain.ts | 321 | 120 | 997 |
| app/classes/unit/UnitMovement.ts | 258 | 134 | 993 |
| app/classes/unit/UnitActions.ts | 232 | 85 | 995 |
| app/ai/AIEconomy.ts | 227 | 59 | 869 |
| app/classes/players/AIPlayer.ts | 209 | 147 | 970 |
| app/lib/combat.ts | 194 | 40 | 528 |
| app/classes/Controls.ts | 189 | 74 | 965 |
| app/controllers/HeroController.ts | 182 | 113 | 843 |
| app/classes/building/BuildingProduction.ts | 170 | 37 | 575 |
| app/classes/map/MapResources.ts | 157 | 48 | 746 |
| app/lib/heroTools.ts | 153 | 49 | 991 |
| app/lib/npcInteraction.ts | 151 | 67 | 612 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 62 | 199.9 | 494 |
| app/classes/unit/index.ts | 58 | 337.3 | 975 |
| app/lib/i18n/translations.ts | 45 | 164.7 | 769 |
| app/classes/unit/UnitMovement.ts | 44 | 587 | 993 |
| app/classes/map/MapGeneration.ts | 44 | 373.7 | 981 |
| app/lib/heroTools.ts | 41 | 382.1 | 991 |
| app/classes/building/index.ts | 41 | 255.7 | 556 |
| app/classes/animal/index.ts | 41 | 207.4 | 440 |
| app/config/assetManifest.ts | 41 | 129.9 | 275 |
| app/classes/unit/UnitActions.ts | 40 | 496.9 | 995 |
| app/controllers/HeroController.ts | 37 | 431.5 | 843 |
| app/screens/Game.ts | 36 | 329.7 | 962 |

## Notes

- Complexity is an approximation based on branch keywords/operators; use it as a prioritization signal.
- Churn is based on Git commits from the last 90 days.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
