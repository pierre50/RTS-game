# Code Health Report

Generated: 2026-09-12T23:16:25.898Z

## Global Score

**90/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 14/20 |
| Architecture | 15/15 |
| Hotspots | 7/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 14/20 | 6 |
| Architecture | 15/15 | 0 |
| Hotspots | 7/10 | 3 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Structure (6 points)**. Gate blockers: Quality regressions: fail; 328 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 2 | 2 |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 747
- Total lines: 105978
- Code lines: 97417
- AST branch decisions: 20089
- AST functions/methods: 8256
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
| Behavior tests | PASS | 2111/2111 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **1412**. New or worsened findings: **328**.

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
| function-lines | app/ai/AIStrategyBuilding.ts:109 | 108 | 80 |

## Critical Test Coverage

Branch coverage: **80.07%** (4180/5220). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/serialization/SaveUnitValidators.ts | 27/60 | 45 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitDirectMovement.ts | 46/89 | 51.68 |
| app/classes/unit/movement/UnitAffectNewDest.ts | 56/97 | 57.73 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 119/202 | 58.91 |
| app/lib/combat/combatAttackLoop.ts | 98/158 | 62.02 |
| app/serialization/SaveSerializer.ts | 91/145 | 62.75 |
| app/serialization/WorldEconomyValidation.ts | 27/42 | 64.28 |
| app/classes/unit/movement/UnitPathMovement.ts | 65/101 | 64.35 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts:74 formatTerrainRelief | 75 | 23 | 65 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| app/services/world/OfflineWorldWork.ts:198 advanceOfflineWorker | 60 | 6 | 172 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 55 | 4 | 83 |
| app/services/VillagerAutonomySystem.ts:104 VillagerAutonomySystem.check | 48 | 2 | 70 |
| app/classes/unit/UnitCaptureHorseAction.ts:224 handleCaptureHorseAction | 47 | 3 | 131 |
| app/services/world/OfflineWorldBuildingPlanner.ts:66 planOfflineBuildings | 46 | 4 | 110 |
| app/serialization/SaveValidator.ts:39 validateSaveData | 45 | 4 | 99 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 44 | 4 | 139 |
| app/dev-console/actions/PerformanceDebug.ts:6 performanceReport | 44 | 3 | 65 |
| app/services/world/VillageStartingState.ts:42 applyVillageStartingState | 40 | 6 | 107 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/world/OfflineWorldWork.ts | runtime | 273.4 | 370 | 123 | 172 | 2 | complexite elevee |
| app/ui/NpcOrdersManager.ts | ui | 258.3 | 589 | 92 | 98 | 28 | souvent modifie, beaucoup de dependances |
| app/services/TributeRaidSystem.ts | runtime | 247.7 | 547 | 130 | 61 | 13 | complexite elevee, souvent modifie |
| app/serialization/SaveSerializer.ts | app | 240.7 | 533 | 74 | 88 | 55 | souvent modifie |
| app/screens/Game.ts | ui | 226 | 581 | 53 | 33 | 57 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | runtime | 214.3 | 494 | 65 | 59 | 51 | souvent modifie |
| app/lib/resources/playerResourceTotals.ts | library | 213.2 | 307 | 123 | 61 | 7 | complexite elevee |
| app/controllers/HeroCompanionHorseController.ts | runtime | 210.3 | 432 | 119 | 57 | 7 | complexite elevee |
| app/services/SpacePortalSystem.ts | runtime | 210.3 | 370 | 124 | 43 | 5 | complexite elevee |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 205.7 | 355 | 90 | 131 | 7 | score de risque relatif eleve |
| app/classes/Resource.ts | runtime | 201.3 | 512 | 79 | 73 | 35 | souvent modifie |
| app/dev-console/actions/DebugMapRenderers.ts | tooling | 201.1 | 461 | 112 | 92 | 4 | complexite elevee |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/ui/NpcOrdersManager.ts | ui | 258.3 | branches >= 80, churn >= 8 | branches < 80 |
| app/services/TributeRaidSystem.ts | runtime | 247.7 | branches >= 80, churn >= 8 | branches < 80 |
| app/services/rest/UnitRestStateTransitions.ts | runtime | 189.5 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/combat/combatFeedback.ts | library | 184.4 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 701 | 90 | 16 |
| app/lib/i18n/fr.ts | data/config | 596 | 0 | 2 |
| app/lib/i18n/en.ts | data/config | 592 | 0 | 2 |
| app/ui/NpcOrdersManager.ts | ui | 589 | 92 | 26 |
| app/screens/Game.ts | ui | 581 | 53 | 35 |
| app/ui/PlayerSetupPanel.ts | ui | 569 | 66 | 8 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/classes/map/Map.ts | runtime | 551 | 23 | 21 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/services/TributeRaidSystem.ts | runtime | 547 | 130 | 20 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/fr.ts | data/config | 596 | 0 |
| app/lib/i18n/en.ts | data/config | 592 | 0 |
| app/constants/entities.ts | data/config | 274 | 0 |
| app/config/assetManifest.ts | data/config | 219 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityDetails.ts | data/config | 139 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 137 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/gameplay.ts | data/config | 104 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/TributeRaidSystem.ts | 130 | 61 | 547 |
| app/services/SpacePortalSystem.ts | 124 | 43 | 370 |
| app/lib/resources/playerResourceTotals.ts | 123 | 61 | 307 |
| app/services/world/OfflineWorldWork.ts | 123 | 172 | 370 |
| app/controllers/HeroCompanionHorseController.ts | 119 | 57 | 432 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/screens/game/BuildingInteriorExitRouting.ts | 116 | 60 | 349 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 110 | 51 | 451 |
| app/services/rest/UnitRestStateTransitions.ts | 106 | 54 | 259 |
| tools/health/analyze.cjs | 103 | 115 | 290 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 101 | 30 | 316 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/screens/Game.ts | 57 | 226 | 581 |
| app/config/assetManifest.ts | 57 | 28.3 | 219 |
| app/serialization/SaveSerializer.ts | 55 | 240.7 | 533 |
| app/classes/map/MapGeneration.ts | 54 | 186.8 | 333 |
| app/types/context.ts | 53 | 114.9 | 355 |
| app/controllers/HeroController.ts | 51 | 214.3 | 494 |
| app/types/save.ts | 51 | 113.4 | 455 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/classes/unit/UnitActions.ts | 48 | 75.8 | 174 |
| app/classes/building/BuildingLifecycle.ts | 43 | 91.1 | 166 |
| app/classes/unit/UnitCombat.ts | 37 | 191.7 | 304 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 3 dossier(s) avec plus de 24 fichiers TS |
| Dossiers severement charges | OK | 0 dossier(s) avec plus de 48 fichiers TS |
| Dossiers trop volumineux | OK | 0 dossier(s) avec plus de 8000 lignes |
| Dossiers trop branches | OK | 0 dossier(s) avec plus de 1200 branches approx. |
| Profondeur de dossiers | OK | 0 dossier(s) au-dela de 5 niveaux |
| Index trop lourds | OK | 0 index.ts avec plus de 300 lignes |
| Nomenclature par zone | WARN | 2 fichier(s) ne suivent pas la convention attendue de leur dossier |

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

| Signal | Count | Threshold | Penalty |
| --- | --- | --- | --- |
| Large files | 0 | LOC >= 1000 | 0 |
| Huge files | 0 | LOC >= 1500 | 0 |
| Complex files | 4 | branches >= 120 or max block >= 160 | 3.2 |
| Crowded folders | 3 | files > 24 | 2.1 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 2 | folder naming convention mismatch | 0.4 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/lib/units | 12 | 30 | 2756 | 690 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 6 | 27 | 4824 | 669 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 4 | 26 | 2355 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 30 | 2756 | 690 |
| app/ui | 27 | 4824 | 669 |
| app/types | 26 | 2355 | 0 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 394 |
| camelCase | 310 |
| mixed | 43 |

### Naming Mismatches

| File | Style | Expected |
| --- | --- | --- |
| app/lib/ActionScheduler.ts | PascalCase | camelCase |
| app/lib/ui/interactionCellMarker.ts | camelCase | PascalCase |

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
