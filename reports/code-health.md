# Code Health Report

Generated: 2026-10-02T18:54:18.290Z

## Global Score

**54/100 (E)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **INCOMPLETE**.

| Component | Score |
| --- | --- |
| Gates | 17/25 |
| Duplication | 18/20 |
| Structure | 3/20 |
| Architecture | 15/15 |
| Hotspots | 1/10 |
| Tests and critical coverage | 0/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 17/25 | 8 |
| Duplication | 18/20 | 2 |
| Structure | 3/20 | 17 |
| Architecture | 15/15 | 0 |
| Hotspots | 1/10 | 9 |
| Tests and critical coverage | 0/10 | 10 |

Largest score loss: **Structure (17 points)**. Gate blockers: Duplication: fail; Dead code: fail; Behavior tests: fail; Source consistency: error; Quality regressions: fail; 1319 new or worsened debt finding(s); Score 54 below 80.

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 0 | Not reachable through hotspots alone |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 997
- Total lines: 126818
- Code lines: 117115
- AST branch decisions: 26499
- AST functions/methods: 9975
- Duplication: 1 clones, 0.012673842878145226%
- Import cycles: 0 cycles / baseline 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | PASS |  |
| TypeScript | PASS |  |
| Duplication | FAIL | 1 clones, 0.012673842878145226% |
| Dead code | FAIL | Command exited with 1 |
| Import cycles | PASS | 0 cycles / baseline gate 0 |
| Typed async rules | PASS |  |
| Behavior tests | FAIL | Command exited with 1 |
| Critical branch coverage | PASS |  |
| Source consistency | ERROR | Source files changed during the audit; rerun on a stable checkout |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2202**. New or worsened findings: **1319**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |
| function-complexity | app/ai/AIChiefEscort.ts:25 | 42 | 15 |
| function-complexity | app/ai/AIEconomy.ts:102 | 17 | 15 |
| double-assertion | app/ai/AIEconomy.ts:347 | 1 | 0 |
| function-lines | app/ai/AIEconomyFoodManager.ts:247 | 101 | 80 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:84 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:136 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:137 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:242 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:279 | 1 | 0 |
| double-assertion | app/ai/AIEconomyHorseCapture.ts:32 | 1 | 0 |
| function-lines | app/ai/AIStrategyBuilding.ts:111 | 156 | 80 |
| function-lines | app/ai/AIStrategyBuilding.ts:268 | 120 | 80 |

## Critical Test Coverage

Branch coverage: **66.37%** (4628/6972). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/classes/unit/movement/ManualMoveState.ts | 0/6 | 0 |
| app/lib/units/autonomy/villagerJobDiagnostics.ts | 0/28 | 0 |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/serialization/AsyncSaveStorage.ts | 0/18 | 0 |
| app/serialization/CampaignSave.ts | 0/125 | 0 |
| app/serialization/DepotReserveValidation.ts | 0/24 | 0 |
| app/serialization/MinimapMemoryValidation.ts | 0/41 | 0 |
| app/serialization/SaveEntityValidators.ts | 0/52 | 0 |
| app/serialization/SaveMapValidation.ts | 0/73 | 0 |
| app/serialization/SaveUnitValidators.ts | 0/154 | 0 |
| app/serialization/SaveValidator.ts | 0/83 | 0 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/lib/economy/collectiveTasks.ts:44 planCollectiveTasks | 94 | 4 | 245 |
| app/serialization/SaveUnitValidators.ts:61 validatePlayerUnits | 75 | 3 | 122 |
| app/ui/minimap/MinimapEntityLayer.ts:15 drawMinimapEntities | 75 | 5 | 135 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 99 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| app/services/world/VillageStartingState.ts:109 applyVillageStartingState | 60 | 4 | 182 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/classes/map/generation/BlueprintResourceLoading.ts:38 loadBlueprintResourceBatches | 54 | 4 | 111 |
| app/services/VillagerAutonomySystem.ts:141 VillagerAutonomySystem.check | 54 | 2 | 79 |
| app/services/world/OfflineWorldWork.ts:38 advanceOfflineWorker | 54 | 3 | 153 |
| app/services/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/lib/economy/collectiveTasks.ts | library | 391.3 | 351 | 163 | 245 | 2 | beaucoup de branches, gros bloc/fonction |
| app/services/world/VillageStartingState.ts | runtime | 362.1 | 339 | 142 | 237 | 5 | complexite elevee, gros bloc/fonction |
| app/services/rest/UnitRestSystem.ts | runtime | 330.4 | 508 | 181 | 75 | 13 | beaucoup de branches, souvent modifie, beaucoup de dependances |
| app/classes/resources/CompactResourceSet.ts | runtime | 309.1 | 664 | 191 | 47 | 2 | beaucoup de branches |
| app/lib/ui/GameWindow.ts | ui | 272.4 | 516 | 165 | 69 | 4 | beaucoup de branches |
| app/screens/game/GameWorldBoot.ts | ui | 252.6 | 341 | 81 | 153 | 19 | souvent modifie, beaucoup de dependances |
| app/services/quests/NeutralVillageQuests.ts | runtime | 243.9 | 370 | 134 | 95 | 6 | complexite elevee |
| app/ui/NpcOrdersManager.ts | ui | 235.1 | 471 | 79 | 120 | 34 | souvent modifie |
| app/classes/players/AIPlayer.ts | runtime | 232.2 | 547 | 67 | 168 | 22 | souvent modifie |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 231.1 | 699 | 114 | 122 | 3 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 231.1 | 256 | 107 | 149 | 3 | complexite elevee |
| app/ui/HeroBuildingMenuManager.ts | ui | 224.8 | 425 | 84 | 78 | 27 | souvent modifie, beaucoup de dependances |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/services/rest/UnitRestSystem.ts | runtime | 330.4 | branches >= 80, churn >= 8 | branches < 80 |
| app/screens/game/GameWorldBoot.ts | ui | 252.6 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/HeroBuildingMenuManager.ts | ui | 224.8 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | runtime | 224.5 | branches >= 80, churn >= 8 | branches < 80 |
| app/screens/game/GameResourceDelivery.ts | ui | 195.9 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/map/MapPlayerGeneration.ts | runtime | 178.2 | branches >= 80, churn >= 8 | branches < 80 |
| app/services/rest/UnitRestRules.ts | runtime | 173.8 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/unit/UnitDirectedActions.ts | runtime | 168.4 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/players/AIPlayerBehavior.ts | runtime | 155.9 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/i18n/en.ts | data/config | 118.2 | LOC >= 600, churn >= 8 | LOC < 600 |
| app/lib/i18n/fr.ts | data/config | 115.4 | LOC >= 600, churn >= 8 | LOC < 600 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 718 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 699 | 114 | 16 |
| app/classes/resources/CompactResourceSet.ts | runtime | 664 | 191 | 4 |
| app/lib/i18n/fr.ts | data/config | 656 | 0 | 6 |
| app/lib/i18n/en.ts | data/config | 649 | 0 | 6 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/screens/Game.ts | ui | 553 | 39 | 37 |
| app/lib/audio/settings.ts | library | 552 | 46 | 2 |
| app/classes/players/AIPlayer.ts | runtime | 547 | 67 | 23 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 718 | 2 |
| app/lib/i18n/fr.ts | data/config | 656 | 0 |
| app/lib/i18n/en.ts | data/config | 649 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 409 | 41 |
| app/constants/entities.ts | data/config | 325 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 265 | 0 |
| app/config/assetManifest.ts | data/config | 220 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityNames.ts | data/config | 189 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 180 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/gameplay.ts | data/config | 104 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/classes/resources/CompactResourceSet.ts | 191 | 47 | 664 |
| app/services/rest/UnitRestSystem.ts | 181 | 75 | 508 |
| app/lib/ui/GameWindow.ts | 165 | 69 | 516 |
| app/lib/economy/collectiveTasks.ts | 163 | 245 | 351 |
| app/services/world/VillageStartingState.ts | 142 | 237 | 339 |
| app/services/quests/NeutralVillageQuests.ts | 134 | 95 | 370 |
| app/services/IdleUnitPatrolSystem.ts | 131 | 90 | 309 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 124 | 68 | 461 |
| app/screens/game/BuildingInteriorExitRouting.ts | 119 | 54 | 350 |
| app/services/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/services/VillageActivitySystem.ts | 115 | 91 | 333 |
| app/classes/map/terrain/MapTerrainBake.ts | 114 | 122 | 699 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 67 | 27.4 | 24 |
| app/screens/Game.ts | 59 | 210.7 | 553 |
| app/serialization/SaveSerializer.ts | 59 | 208.7 | 236 |
| app/types/save.ts | 58 | 135.2 | 529 |
| app/types/context.ts | 58 | 125.4 | 374 |
| app/config/assetManifest.ts | 57 | 28.3 | 220 |
| app/classes/map/MapGeneration.ts | 56 | 206.4 | 381 |
| app/controllers/HeroController.ts | 53 | 219.7 | 493 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/unit/UnitActions.ts | 47 | 74.9 | 172 |
| app/classes/building/BuildingLifecycle.ts | 44 | 162 | 200 |
| app/classes/Resource.ts | 40 | 208.1 | 500 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 9 dossier(s) avec plus de 24 fichiers TS |
| Dossiers severement charges | OK | 0 dossier(s) avec plus de 48 fichiers TS |
| Dossiers trop volumineux | OK | 0 dossier(s) avec plus de 8000 lignes |
| Dossiers trop branches | WARN | 3 dossier(s) avec plus de 1200 branches approx. |
| Profondeur de dossiers | OK | 0 dossier(s) au-dela de 5 niveaux |
| Index trop lourds | OK | 0 index.ts avec plus de 300 lignes |
| Nomenclature par zone | WARN | 4 fichier(s) ne suivent pas la convention attendue de leur dossier |

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

| Signal | Count | Threshold | Penalty |
| --- | --- | --- | --- |
| Large files | 0 | LOC >= 1000 | 0 |
| Huge files | 0 | LOC >= 1500 | 0 |
| Complex files | 9 | branches >= 120 or max block >= 160 | 7.2 |
| Crowded folders | 9 | files > 24 | 6.3 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 3 | branches > 1200 | 2.4 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 4 | folder naming convention mismatch | 0.8 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/services/world | 69.1 | 36 | 5181 | 1741 | file count > 24, branches > 1200 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/serialization | 52.1 | 40 | 4484 | 1441 | file count > 24, branches > 1200 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/units | 40 | 44 | 3679 | 1026 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/services | 30.9 | 32 | 5371 | 1379 | file count > 24, branches > 1200 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 16 | 32 | 4696 | 681 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 12 | 30 | 2618 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| tools/maps | 4 | 26 | 3116 | 746 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/buildings | 4 | 26 | 1726 | 431 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/classes/unit | 2 | 25 | 4710 | 992 | file count > 24 | Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 44 | 3679 | 1026 |
| app/serialization | 40 | 4484 | 1441 |
| app/services/world | 36 | 5181 | 1741 |
| app/services | 32 | 5371 | 1379 |
| app/ui | 32 | 4696 | 681 |
| app/types | 30 | 2618 | 0 |
| tools/maps | 26 | 3116 | 746 |
| app/lib/buildings | 26 | 1726 | 431 |
| app/classes/unit | 25 | 4710 | 992 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 530 |
| camelCase | 406 |
| mixed | 61 |

### Naming Mismatches

| File | Style | Expected |
| --- | --- | --- |
| app/lib/units/VillageScheduleGate.ts | PascalCase | camelCase |
| app/serialization/SaveCompression.worker.ts | mixed | PascalCase |
| app/ui/modals/ControlsBindings.ts | PascalCase | camelCase |
| app/ui/modals/ControlsSettings.ts | PascalCase | camelCase |

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
