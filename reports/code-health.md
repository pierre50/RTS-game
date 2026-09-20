# Code Health Report

Generated: 2026-09-20T00:19:49.739Z

## Global Score

**90/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 13/20 |
| Architecture | 15/15 |
| Hotspots | 8/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 13/20 | 7 |
| Architecture | 15/15 | 0 |
| Hotspots | 8/10 | 2 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Structure (7 points)**. Gate blockers: Quality regressions: fail; 499 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 1 | 1 |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 818
- Total lines: 111296
- Code lines: 102307
- AST branch decisions: 21558
- AST functions/methods: 8742
- Duplication: 0 clones, 0%
- Import cycles: 0 cycles / baseline 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | PASS |  |
| TypeScript | PASS |  |
| Duplication | PASS | 0 clones, 0% |
| Dead code | PASS |  |
| Import cycles | PASS | 0 cycles / baseline gate 0 |
| Typed async rules | PASS |  |
| Behavior tests | PASS | 2358/2358 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **1556**. New or worsened findings: **499**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |
| function-complexity | app/ai/AIEconomy.ts:377 | 17 | 15 |
| function-lines | app/ai/AIEconomy.ts:377 | 112 | 80 |
| function-complexity | app/ai/AIEconomyBuildingMaterials.ts:24 | 18 | 15 |
| double-assertion | app/ai/AIEconomyBuildingMaterials.ts:36 | 1 | 0 |
| function-lines | app/ai/AIEconomyFoodManager.ts:237 | 101 | 80 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:72 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:125 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:126 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:232 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:269 | 1 | 0 |
| double-assertion | app/ai/AIEconomyHorseCapture.ts:32 | 1 | 0 |
| function-lines | app/ai/AIStrategyBuilding.ts:113 | 134 | 80 |

## Critical Test Coverage

Branch coverage: **80.53%** (4407/5472). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/serialization/SaveUnitValidators.ts | 41/74 | 55.4 |
| app/classes/unit/movement/UnitAffectNewDest.ts | 56/97 | 57.73 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 119/202 | 58.91 |
| app/classes/unit/movement/UnitDirectMovement.ts | 52/87 | 59.77 |
| app/lib/combat/combatAttackLoop.ts | 98/158 | 62.02 |
| app/classes/unit/movement/UnitPathMovement.ts | 69/110 | 62.72 |
| app/serialization/SaveSerializer.ts | 91/145 | 62.75 |
| app/serialization/WorldEconomyValidation.ts | 27/42 | 64.28 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 99 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| app/services/world/OfflineWorldWork.ts:222 advanceOfflineWorker | 63 | 6 | 179 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/services/world/VillageStartingState.ts:53 applyVillageStartingState | 57 | 6 | 143 |
| app/serialization/SaveValidator.ts:39 validateSaveData | 53 | 4 | 109 |
| app/services/world/OfflineWorldBuildingPlanner.ts:74 planOfflineBuildings | 52 | 4 | 154 |
| app/services/VillagerAutonomySystem.ts:122 VillagerAutonomySystem.check | 48 | 2 | 71 |
| app/classes/unit/UnitCaptureHorseAction.ts:224 handleCaptureHorseAction | 47 | 3 | 131 |
| app/services/FogOfWar.ts:122 updateVisibilityNow | 46 | 4 | 91 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 44 | 4 | 139 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/quests/NeutralVillageQuests.ts | runtime | 314.5 | 387 | 194 | 64 | 3 | beaucoup de branches |
| app/services/TributeRaidSystem.ts | runtime | 303.5 | 594 | 160 | 61 | 15 | beaucoup de branches, souvent modifie |
| app/ui/NpcOrdersManager.ts | ui | 289.6 | 573 | 105 | 96 | 31 | complexite elevee, souvent modifie, beaucoup de dependances |
| app/services/world/OfflineWorldWork.ts | runtime | 287.2 | 401 | 128 | 179 | 2 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 243.6 | 537 | 74 | 89 | 56 | souvent modifie |
| app/controllers/HeroController.ts | runtime | 214.3 | 494 | 65 | 59 | 51 | souvent modifie |
| app/screens/Game.ts | ui | 212.4 | 571 | 39 | 45 | 59 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroCompanionHorseController.ts | runtime | 210.3 | 432 | 119 | 57 | 7 | complexite elevee |
| app/services/SpacePortalSystem.ts | runtime | 210.3 | 370 | 124 | 43 | 5 | complexite elevee |
| app/services/world/OfflineWorldBuildingPlanner.ts | runtime | 205.8 | 229 | 81 | 167 | 3 | score de risque relatif eleve |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 205.7 | 355 | 90 | 131 | 7 | score de risque relatif eleve |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 202.1 | 344 | 117 | 53 | 6 | complexite elevee |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/services/TributeRaidSystem.ts | runtime | 303.5 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/NpcOrdersManager.ts | ui | 289.6 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 717 | 92 | 16 |
| app/services/TributeRaidSystem.ts | runtime | 594 | 160 | 23 |
| app/ui/NpcOrdersManager.ts | ui | 573 | 105 | 30 |
| app/screens/Game.ts | ui | 571 | 39 | 38 |
| app/lib/i18n/fr.ts | data/config | 570 | 0 | 4 |
| app/ui/PlayerSetupPanel.ts | ui | 569 | 66 | 8 |
| app/lib/i18n/en.ts | data/config | 568 | 0 | 4 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/classes/map/Map.ts | runtime | 551 | 23 | 21 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/fr.ts | data/config | 570 | 0 |
| app/lib/i18n/en.ts | data/config | 568 | 0 |
| app/constants/entities.ts | data/config | 274 | 0 |
| app/config/assetManifest.ts | data/config | 221 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 215 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityDetails.ts | data/config | 139 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 137 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/gameplay.ts | data/config | 104 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/quests/NeutralVillageQuests.ts | 194 | 64 | 387 |
| app/services/TributeRaidSystem.ts | 160 | 61 | 594 |
| app/services/world/OfflineWorldWork.ts | 128 | 179 | 401 |
| app/services/SpacePortalSystem.ts | 124 | 43 | 370 |
| app/controllers/HeroCompanionHorseController.ts | 119 | 57 | 432 |
| app/screens/game/BuildingInteriorExitRouting.ts | 117 | 53 | 344 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 110 | 51 | 451 |
| app/ui/NpcOrdersManager.ts | 105 | 96 | 573 |
| tools/health/analyze.cjs | 103 | 115 | 290 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 101 | 30 | 316 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/screens/Game.ts | 59 | 212.4 | 571 |
| app/config/assetManifest.ts | 58 | 28.7 | 221 |
| app/serialization/SaveSerializer.ts | 56 | 243.6 | 537 |
| app/types/context.ts | 55 | 119 | 358 |
| app/classes/map/MapGeneration.ts | 54 | 186.8 | 333 |
| app/types/save.ts | 53 | 117.8 | 472 |
| app/controllers/HeroController.ts | 51 | 214.3 | 494 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/classes/unit/UnitActions.ts | 48 | 75.8 | 174 |
| app/classes/building/BuildingLifecycle.ts | 43 | 91.1 | 166 |
| app/dev-console/types.ts | 38 | 84.6 | 342 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 3 dossier(s) avec plus de 24 fichiers TS |
| Dossiers severement charges | OK | 0 dossier(s) avec plus de 48 fichiers TS |
| Dossiers trop volumineux | OK | 0 dossier(s) avec plus de 8000 lignes |
| Dossiers trop branches | OK | 0 dossier(s) avec plus de 1200 branches approx. |
| Profondeur de dossiers | OK | 0 dossier(s) au-dela de 5 niveaux |
| Index trop lourds | OK | 0 index.ts avec plus de 300 lignes |
| Nomenclature par zone | WARN | 4 fichier(s) ne suivent pas la convention attendue de leur dossier |

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

| Signal | Count | Threshold | Penalty |
| --- | --- | --- | --- |
| Large files | 0 | LOC >= 1000 | 0 |
| Huge files | 0 | LOC >= 1500 | 0 |
| Complex files | 5 | branches >= 120 or max block >= 160 | 4 |
| Crowded folders | 3 | files > 24 | 2.1 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 4 | folder naming convention mismatch | 0.8 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/lib/units | 16 | 32 | 2925 | 732 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 12 | 30 | 5158 | 755 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 6 | 27 | 2429 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 32 | 2925 | 732 |
| app/ui | 30 | 5158 | 755 |
| app/types | 27 | 2429 | 0 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 431 |
| camelCase | 341 |
| mixed | 46 |

### Naming Mismatches

| File | Style | Expected |
| --- | --- | --- |
| app/lib/ActionScheduler.ts | PascalCase | camelCase |
| app/lib/resources/NaturalResourcePlacement.ts | PascalCase | camelCase |
| app/lib/ui/interactionCellMarker.ts | camelCase | PascalCase |
| app/ui/questMarker.ts | camelCase | PascalCase |

### Heavy Index Files

No heavy index.ts file detected.

## Dependency Cycles

Madge found **0 circular dependencies**. Architecture score: **15/15**. Baseline gate: **0**.

No import-cycle fix needed. Keep the baseline gate so new cycles cannot sneak in.

### Cycle Hubs

No cycle hubs measured.

### Sample Cycles



## Notes

- Complexity uses the TypeScript syntax tree; nested functions are measured independently. Comments and strings do not count as branches.
- Extended type safety (unchecked indexed access and exact optional properties), escape hatches and domain-to-UI imports are tracked against the explicit baseline.
- Existing debt remains visible even when the regression gate passes.
- Churn is advisory: it never grants an exemption from function or dependency rules.
- Churn is based on Git commits from the last 90 days.
- Every import cycle fails the audit; the allowed cycle count is zero.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
