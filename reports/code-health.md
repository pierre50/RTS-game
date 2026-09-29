# Code Health Report

Generated: 2026-09-27T21:05:52.306Z

## Global Score

**91/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 12/20 |
| Architecture | 15/15 |
| Hotspots | 10/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 12/20 | 8 |
| Architecture | 15/15 | 0 |
| Hotspots | 10/10 | 0 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Structure (8 points)**. Gate blockers: Quality regressions: fail; 1076 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 0 | 0 |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 947
- Total lines: 120908
- Code lines: 111548
- AST branch decisions: 24431
- AST functions/methods: 9502
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
| Behavior tests | PASS | 2826/2826 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2014**. New or worsened findings: **1076**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |
| function-complexity | app/ai/AIEconomy.ts:102 | 17 | 15 |
| double-assertion | app/ai/AIEconomy.ts:347 | 1 | 0 |
| function-lines | app/ai/AIEconomyFoodManager.ts:247 | 101 | 80 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:84 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:136 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:137 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:242 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:279 | 1 | 0 |
| double-assertion | app/ai/AIEconomyHorseCapture.ts:32 | 1 | 0 |
| function-lines | app/ai/AIStrategyBuilding.ts:111 | 157 | 80 |
| function-lines | app/ai/AIStrategyBuilding.ts:269 | 120 | 80 |
| function-complexity | app/ai/AITheftDefense.ts:55 | 32 | 15 |

## Critical Test Coverage

Branch coverage: **80.18%** (5220/6510). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/serialization/AsyncSaveStorage.ts | 0/18 | 0 |
| app/serialization/SaveUnitValidators.ts | 50/131 | 38.16 |
| app/serialization/validation/CampaignRecordValidation.ts | 22/56 | 39.28 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitAffectNewDest.ts | 56/97 | 57.73 |
| app/classes/unit/movement/UnitDirectMovement.ts | 52/87 | 59.77 |
| app/lib/units/energyRules.ts | 3/5 | 60 |
| app/serialization/CaveSave.ts | 51/85 | 60 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 131/217 | 60.36 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 99 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| app/ui/minimap/MinimapEntityLayer.ts:13 drawMinimapEntities | 62 | 5 | 93 |
| app/serialization/SaveUnitValidators.ts:61 validatePlayerUnits | 59 | 3 | 104 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/lib/economy/collectiveTasks.ts:37 planCollectiveTasks | 57 | 5 | 158 |
| app/services/world/OfflineWorldWork.ts:37 advanceOfflineWorker | 54 | 3 | 153 |
| app/services/VillagerAutonomySystem.ts:139 VillagerAutonomySystem.check | 52 | 2 | 77 |
| app/services/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |
| app/dev-console/actions/PerformanceDebug.ts:13 performanceReport | 50 | 3 | 80 |
| app/services/WildlifeSystem.ts:102 WildlifeSystem.update | 50 | 3 | 119 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/classes/resources/CompactResourceSet.ts | runtime | 284.3 | 632 | 177 | 47 | 1 | beaucoup de branches |
| app/lib/ui/GameWindow.ts | ui | 247.9 | 495 | 153 | 69 | 2 | complexite elevee |
| app/lib/economy/collectiveTasks.ts | library | 239.7 | 251 | 114 | 158 | 0 | complexite elevee |
| app/ui/NpcOrdersManager.ts | ui | 233.1 | 471 | 79 | 120 | 33 | souvent modifie |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 231.1 | 699 | 114 | 122 | 3 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 228.1 | 256 | 107 | 149 | 2 | complexite elevee |
| app/controllers/HeroController.ts | runtime | 219.7 | 493 | 66 | 59 | 53 | souvent modifie |
| app/screens/Game.ts | ui | 214.7 | 553 | 39 | 45 | 61 | souvent modifie, beaucoup de dependances |
| app/services/quests/NeutralVillageQuests.ts | runtime | 213 | 348 | 119 | 92 | 5 | complexite elevee |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | runtime | 210.8 | 450 | 119 | 54 | 7 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 209.1 | 231 | 55 | 81 | 60 | souvent modifie |
| app/classes/players/Player.ts | runtime | 209 | 324 | 79 | 58 | 37 | souvent modifie, beaucoup de dependances |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 699 | 114 | 16 |
| app/classes/resources/CompactResourceSet.ts | runtime | 632 | 177 | 3 |
| app/ui/PlayerSetupPanel.ts | ui | 596 | 70 | 8 |
| app/lib/i18n/fr.ts | data/config | 590 | 0 | 5 |
| app/lib/i18n/en.ts | data/config | 586 | 0 | 5 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/screens/Game.ts | ui | 553 | 39 | 37 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/fr.ts | data/config | 590 | 0 |
| app/lib/i18n/en.ts | data/config | 586 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 401 | 41 |
| app/constants/entities.ts | data/config | 319 | 0 |
| app/config/assetManifest.ts | data/config | 221 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 215 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityDetails.ts | data/config | 186 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 183 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/gameplay.ts | data/config | 104 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/classes/resources/CompactResourceSet.ts | 177 | 47 | 632 |
| app/lib/ui/GameWindow.ts | 153 | 69 | 495 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 119 | 54 | 450 |
| app/services/quests/NeutralVillageQuests.ts | 119 | 92 | 348 |
| app/screens/game/BuildingInteriorExitRouting.ts | 117 | 53 | 344 |
| app/services/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/classes/map/terrain/MapTerrainBake.ts | 114 | 122 | 699 |
| app/lib/economy/collectiveTasks.ts | 114 | 158 | 251 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/serialization/ZonedSaveFormat.ts | 107 | 149 | 256 |
| app/services/VillageActivitySystem.ts | 104 | 88 | 278 |
| tools/health/analyze.cjs | 103 | 115 | 290 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/screens/Game.ts | 61 | 214.7 | 553 |
| app/serialization/SaveSerializer.ts | 60 | 209.1 | 231 |
| app/config/assetManifest.ts | 59 | 29.1 | 221 |
| app/types/context.ts | 58 | 125 | 360 |
| app/classes/map/MapGeneration.ts | 57 | 208.5 | 385 |
| app/types/save.ts | 57 | 129.3 | 517 |
| app/controllers/HeroController.ts | 53 | 219.7 | 493 |
| app/classes/unit/UnitActions.ts | 49 | 76.5 | 172 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/classes/building/BuildingLifecycle.ts | 45 | 157.5 | 178 |
| app/dev-console/createDevCommands.ts | 40 | 151.5 | 472 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 7 dossier(s) avec plus de 24 fichiers TS |
| Dossiers severement charges | OK | 0 dossier(s) avec plus de 48 fichiers TS |
| Dossiers trop volumineux | OK | 0 dossier(s) avec plus de 8000 lignes |
| Dossiers trop branches | WARN | 2 dossier(s) avec plus de 1200 branches approx. |
| Profondeur de dossiers | OK | 0 dossier(s) au-dela de 5 niveaux |
| Index trop lourds | OK | 0 index.ts avec plus de 300 lignes |
| Nomenclature par zone | WARN | 1 fichier(s) ne suivent pas la convention attendue de leur dossier |

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

| Signal | Count | Threshold | Penalty |
| --- | --- | --- | --- |
| Large files | 0 | LOC >= 1000 | 0 |
| Huge files | 0 | LOC >= 1500 | 0 |
| Complex files | 2 | branches >= 120 or max block >= 160 | 1.6 |
| Crowded folders | 7 | files > 24 | 4.9 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 2 | branches > 1200 | 1.6 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 1 | folder naming convention mismatch | 0.2 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/serialization | 38 | 37 | 4203 | 1344 | file count > 24, branches > 1200 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/units | 26 | 37 | 3198 | 822 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/services/world | 23.7 | 29 | 4140 | 1364 | file count > 24, branches > 1200 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 16 | 32 | 4721 | 666 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/services | 12 | 30 | 4708 | 1151 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/types | 10 | 29 | 2546 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/classes/unit | 2 | 25 | 4645 | 969 | file count > 24 | Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/serialization | 37 | 4203 | 1344 |
| app/lib/units | 37 | 3198 | 822 |
| app/ui | 32 | 4721 | 666 |
| app/services | 30 | 4708 | 1151 |
| app/services/world | 29 | 4140 | 1364 |
| app/types | 29 | 2546 | 0 |
| app/classes/unit | 25 | 4645 | 969 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 506 |
| camelCase | 387 |
| mixed | 54 |

### Naming Mismatches

| File | Style | Expected |
| --- | --- | --- |
| app/serialization/SaveCompression.worker.ts | mixed | PascalCase |

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
