# Code Health Report

Generated: 2026-08-25T19:14:27.338Z

## Global Score

**90/100 (A)**

Minimum required score: **90/100**. Quality gate: **PASS**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 20/20 |
| Architecture | 15/15 |
| Hotspots | 0/10 |
| Type/Lint confidence | 10/10 |

> Architecture is scored separately from the baseline gate: staying at or below the baseline keeps the check green, but existing cycles still reduce the global quality score.

## Summary

- Files analyzed: 358
- Total lines: 65056
- Code lines: 57861
- Approx branches: 8874
- Approx functions/methods: 7370
- Duplication: 0 clones, 0%
- Import cycles: 0 cycles / baseline 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | OK |  |
| TypeScript | OK |  |
| Duplication | OK | 0 clones, 0% |
| Dead code | OK |  |
| Import cycles | OK | 0 cycles / baseline gate 0 |

## Top Priorities

| File | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- |
| app/classes/unit/UnitActions.ts | 233.5 | 341 | 64 | 65 | 43 | souvent modifie |
| app/controllers/HeroController.ts | 232.4 | 475 | 67 | 48 | 40 | souvent modifie |
| app/lib/heroTools.ts | 230.4 | 336 | 60 | 49 | 44 | souvent modifie |
| app/classes/map/MapGeneration.ts | 230.3 | 477 | 52 | 19 | 46 | souvent modifie |
| app/classes/Projectile.ts | 229.4 | 566 | 68 | 124 | 26 | souvent modifie |
| app/screens/Game.ts | 225.3 | 708 | 48 | 54 | 40 | souvent modifie, beaucoup de dependances |
| app/classes/unit/index.ts | 223.6 | 555 | 13 | 18 | 61 | souvent modifie, beaucoup de dependances |
| app/ui/InventoryManager.ts | 219.4 | 794 | 95 | 80 | 19 | souvent modifie |
| app/classes/building/index.ts | 217.3 | 454 | 33 | 118 | 42 | souvent modifie |
| app/classes/players/AIPlayer.ts | 216.3 | 559 | 87 | 121 | 13 | souvent modifie |
| app/classes/unit/UnitMovement.ts | 215.8 | 292 | 47 | 45 | 46 | souvent modifie |
| app/classes/animal/index.ts | 214.5 | 436 | 30 | 114 | 43 | souvent modifie |

## Largest Files

| File | LOC | Branches | Imports |
| --- | --- | --- | --- |
| app/lib/lpc/equipment.ts | 965 | 54 | 2 |
| app/ui/InventoryManager.ts | 794 | 95 | 16 |
| app/lib/i18n/translations.ts | 793 | 8 | 1 |
| app/ui/PlayerSetupPanel.ts | 781 | 65 | 8 |
| app/services/WeatherSystem.ts | 712 | 67 | 8 |
| app/screens/Game.ts | 708 | 48 | 33 |
| app/classes/map/index.ts | 610 | 36 | 19 |
| app/services/TributeRaidSystem.ts | 580 | 97 | 16 |
| app/classes/Controls.ts | 574 | 50 | 21 |
| app/classes/Projectile.ts | 566 | 68 | 18 |
| app/classes/Resource.ts | 562 | 63 | 14 |
| app/classes/players/AIPlayer.ts | 559 | 87 | 14 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/serialization/SaveValidator.ts | 116 | 69 | 364 |
| app/services/VillagerShelterSystem.ts | 104 | 21 | 462 |
| app/ai/AIEconomyFoodManager.ts | 99 | 19 | 395 |
| app/lib/combatActionConditions.ts | 99 | 24 | 209 |
| app/services/TributeRaidSystem.ts | 97 | 62 | 580 |
| app/classes/map/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/ui/InventoryManager.ts | 95 | 80 | 794 |
| app/classes/map/MapTerrainReliefAppearance.ts | 87 | 64 | 137 |
| app/classes/players/AIPlayer.ts | 87 | 121 | 559 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |
| app/classes/Instance.ts | 82 | 44 | 530 |
| app/classes/map/MapResources.ts | 82 | 48 | 548 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 64 | 205.1 | 462 |
| app/classes/unit/index.ts | 61 | 223.6 | 555 |
| app/lib/i18n/translations.ts | 47 | 172.8 | 793 |
| app/classes/map/MapGeneration.ts | 46 | 230.3 | 477 |
| app/classes/unit/UnitMovement.ts | 46 | 215.8 | 292 |
| app/lib/heroTools.ts | 44 | 230.4 | 336 |
| app/classes/unit/UnitActions.ts | 43 | 233.5 | 341 |
| app/classes/animal/index.ts | 43 | 214.5 | 436 |
| app/classes/building/index.ts | 42 | 217.3 | 454 |
| app/config/assetManifest.ts | 42 | 133 | 278 |
| app/controllers/HeroController.ts | 40 | 232.4 | 475 |
| app/screens/Game.ts | 40 | 225.3 | 708 |

## Dependency Cycles

Madge found **0 circular dependencies**. Architecture score: **15/15**. Baseline gate: **0**.

Fix priority:

1. Break barrel/helper cycles around `lib/index.ts`, `types/entities.ts`, and projectile helpers.
2. Then handle local two-way feature splits such as AI, map generation, controls, menu, building, and unit modules.
3. Keep the baseline gate so new cycles cannot sneak in while old ones are being removed.

### Cycle Hubs

No cycle hubs measured.

### Sample Cycles



## Notes

- Complexity is an approximation based on branch keywords/operators; use it as a prioritization signal.
- Churn is based on Git commits from the last 90 days.
- Import-cycle baseline avoids making existing architecture debt fail the audit, while preventing regressions.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
