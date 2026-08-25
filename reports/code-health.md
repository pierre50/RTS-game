# Code Health Report

Generated: 2026-08-25T23:16:46.209Z

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

- Files analyzed: 377
- Total lines: 66610
- Code lines: 59263
- Approx branches: 8982
- Approx functions/methods: 7503
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
| app/classes/map/MapGeneration.ts | 230.3 | 477 | 52 | 19 | 46 | souvent modifie |
| app/classes/Resource.ts | 230 | 646 | 72 | 126 | 23 | souvent modifie |
| app/screens/Game.ts | 228.3 | 708 | 48 | 54 | 41 | souvent modifie, beaucoup de dependances |
| app/classes/unit/index.ts | 223.6 | 555 | 13 | 18 | 61 | souvent modifie, beaucoup de dependances |
| app/classes/building/index.ts | 223.3 | 454 | 33 | 118 | 44 | souvent modifie |
| app/ui/InventoryManager.ts | 222.4 | 794 | 95 | 80 | 20 | souvent modifie |
| app/classes/unit/UnitMovement.ts | 221.9 | 297 | 49 | 45 | 47 | souvent modifie |
| app/classes/players/AIPlayer.ts | 216.3 | 559 | 87 | 121 | 13 | souvent modifie |
| app/classes/building/BuildingLifecycle.ts | 214.8 | 433 | 80 | 74 | 28 | souvent modifie |
| app/classes/animal/index.ts | 214.5 | 436 | 30 | 114 | 43 | souvent modifie |
| app/serialization/SaveValidator.ts | 213.1 | 364 | 116 | 69 | 10 | complexite elevee, souvent modifie |
| app/lib/lpc/baked.ts | 212.2 | 498 | 65 | 99 | 29 | souvent modifie |

## Largest Files

| File | LOC | Branches | Imports |
| --- | --- | --- | --- |
| app/ui/InventoryManager.ts | 794 | 95 | 16 |
| app/lib/i18n/translations.ts | 793 | 8 | 1 |
| app/ui/PlayerSetupPanel.ts | 781 | 65 | 8 |
| app/services/WeatherSystem.ts | 741 | 56 | 10 |
| app/lib/lpc/equipmentData.ts | 739 | 2 | 2 |
| app/screens/Game.ts | 708 | 48 | 33 |
| app/classes/Resource.ts | 646 | 72 | 14 |
| app/classes/map/index.ts | 610 | 36 | 19 |
| app/services/TributeRaidSystem.ts | 580 | 97 | 16 |
| app/classes/players/AIPlayer.ts | 559 | 87 | 14 |
| app/classes/unit/index.ts | 555 | 13 | 26 |
| app/classes/map/MapFog.ts | 554 | 69 | 13 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/serialization/SaveValidator.ts | 116 | 69 | 364 |
| app/services/VillagerShelterSystem.ts | 104 | 21 | 462 |
| app/lib/combatActionConditions.ts | 103 | 24 | 220 |
| app/ai/AIEconomyFoodManager.ts | 99 | 19 | 395 |
| app/services/TributeRaidSystem.ts | 97 | 62 | 580 |
| app/classes/map/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/ui/InventoryManager.ts | 95 | 80 | 794 |
| app/classes/unit/UnitResourceActions.ts | 94 | 61 | 442 |
| app/classes/map/MapTerrainReliefAppearance.ts | 87 | 64 | 137 |
| app/classes/players/AIPlayer.ts | 87 | 121 | 559 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |
| app/classes/Instance.ts | 82 | 44 | 530 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 65 | 208.3 | 472 |
| app/classes/unit/index.ts | 61 | 223.6 | 555 |
| app/lib/i18n/translations.ts | 48 | 175.8 | 793 |
| app/classes/unit/UnitMovement.ts | 47 | 221.9 | 297 |
| app/classes/map/MapGeneration.ts | 46 | 230.3 | 477 |
| app/config/assetManifest.ts | 45 | 142.2 | 289 |
| app/classes/building/index.ts | 44 | 223.3 | 454 |
| app/classes/unit/UnitActions.ts | 44 | 161.8 | 173 |
| app/lib/heroTools.ts | 44 | 150 | 59 |
| app/classes/animal/index.ts | 43 | 214.5 | 436 |
| app/screens/Game.ts | 41 | 228.3 | 708 |
| app/controllers/HeroController.ts | 40 | 179.4 | 397 |

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
