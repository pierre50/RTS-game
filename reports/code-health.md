# Code Health Report

Generated: 2026-09-15T09:25:10.134Z

## Global Score

**87/100 (B)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 13/20 |
| Architecture | 15/15 |
| Hotspots | 5/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 13/20 | 7 |
| Architecture | 15/15 | 0 |
| Hotspots | 5/10 | 5 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Structure (7 points)**. Gate blockers: Quality regressions: fail; 428 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 1 | 5 |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 788
- Total lines: 108739
- Code lines: 99969
- AST branch decisions: 20932
- AST functions/methods: 8516
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
| Behavior tests | PASS | 2273/2273 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **1493**. New or worsened findings: **428**.

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

Branch coverage: **80.29%** (4336/5400). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/serialization/SaveUnitValidators.ts | 27/60 | 45 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
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
| app/classes/map/terrain/MapTerrainReliefAppearance.ts:74 formatTerrainRelief | 75 | 23 | 65 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| app/services/world/VillageStartingState.ts:53 applyVillageStartingState | 62 | 6 | 149 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 60 | 4 | 88 |
| app/services/world/OfflineWorldWork.ts:198 advanceOfflineWorker | 60 | 6 | 172 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/serialization/SaveValidator.ts:39 validateSaveData | 53 | 4 | 109 |
| app/services/VillagerAutonomySystem.ts:122 VillagerAutonomySystem.check | 48 | 2 | 71 |
| app/classes/unit/UnitCaptureHorseAction.ts:224 handleCaptureHorseAction | 47 | 3 | 131 |
| app/services/FogOfWar.ts:122 updateVisibilityNow | 46 | 4 | 91 |
| app/services/world/OfflineWorldBuildingPlanner.ts:66 planOfflineBuildings | 46 | 4 | 110 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 44 | 4 | 139 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/TributeRaidSystem.ts | runtime | 300.7 | 591 | 159 | 61 | 15 | complexite elevee, souvent modifie |
| app/ui/NpcOrdersManager.ts | ui | 300.6 | 582 | 110 | 103 | 31 | complexite elevee, souvent modifie, beaucoup de dependances |
| app/services/world/OfflineWorldWork.ts | runtime | 273.4 | 370 | 123 | 172 | 2 | complexite elevee |
| app/services/quests/NeutralVillageQuests.ts | runtime | 255.4 | 341 | 157 | 52 | 3 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 242.7 | 533 | 74 | 88 | 56 | souvent modifie |
| app/lib/resources/playerResourceTotals.ts | library | 234.6 | 324 | 135 | 62 | 8 | complexite elevee, souvent modifie |
| app/screens/Game.ts | ui | 224.2 | 599 | 48 | 39 | 59 | souvent modifie, beaucoup de dependances |
| app/services/world/VillageStartingState.ts | runtime | 215.8 | 220 | 93 | 161 | 2 | score de risque relatif eleve |
| app/controllers/HeroController.ts | runtime | 214.3 | 494 | 65 | 59 | 51 | souvent modifie |
| app/controllers/HeroCompanionHorseController.ts | runtime | 210.3 | 432 | 119 | 57 | 7 | complexite elevee |
| app/services/SpacePortalSystem.ts | runtime | 210.3 | 370 | 124 | 43 | 5 | complexite elevee |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 205.7 | 355 | 90 | 131 | 7 | score de risque relatif eleve |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/services/TributeRaidSystem.ts | runtime | 300.7 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/NpcOrdersManager.ts | ui | 300.6 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/resources/playerResourceTotals.ts | library | 234.6 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/combat/combatFeedback.ts | library | 184.4 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/npc/npcInteraction.ts | library | 153.7 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/units/villagerAutonomyTargeting.ts | library | 153.6 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 701 | 90 | 16 |
| app/screens/Game.ts | ui | 599 | 48 | 36 |
| app/services/TributeRaidSystem.ts | runtime | 591 | 159 | 22 |
| app/ui/NpcOrdersManager.ts | ui | 582 | 110 | 28 |
| app/ui/PlayerSetupPanel.ts | ui | 569 | 66 | 8 |
| app/lib/i18n/fr.ts | data/config | 559 | 0 | 3 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/lib/i18n/en.ts | data/config | 557 | 0 | 3 |
| app/classes/map/Map.ts | runtime | 551 | 23 | 21 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/fr.ts | data/config | 559 | 0 |
| app/lib/i18n/en.ts | data/config | 557 | 0 |
| app/constants/entities.ts | data/config | 274 | 0 |
| app/config/assetManifest.ts | data/config | 219 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/questTranslations.ts | data/config | 177 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 139 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 137 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/gameplay.ts | data/config | 104 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/TributeRaidSystem.ts | 159 | 61 | 591 |
| app/services/quests/NeutralVillageQuests.ts | 157 | 52 | 341 |
| app/lib/resources/playerResourceTotals.ts | 135 | 62 | 324 |
| app/services/SpacePortalSystem.ts | 124 | 43 | 370 |
| app/services/world/OfflineWorldWork.ts | 123 | 172 | 370 |
| app/controllers/HeroCompanionHorseController.ts | 119 | 57 | 432 |
| app/screens/game/BuildingInteriorExitRouting.ts | 117 | 53 | 344 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 110 | 51 | 451 |
| app/ui/NpcOrdersManager.ts | 110 | 103 | 582 |
| tools/health/analyze.cjs | 103 | 115 | 290 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/screens/Game.ts | 59 | 224.2 | 599 |
| app/config/assetManifest.ts | 58 | 28.7 | 219 |
| app/serialization/SaveSerializer.ts | 56 | 242.7 | 533 |
| app/types/context.ts | 55 | 119 | 359 |
| app/classes/map/MapGeneration.ts | 54 | 186.8 | 333 |
| app/types/save.ts | 53 | 117.6 | 464 |
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
| Nomenclature par zone | WARN | 3 fichier(s) ne suivent pas la convention attendue de leur dossier |

### Structure Debt

These signals now reduce the Structure score. This makes the report stricter: a folder can be technically valid but still count as architecture debt when it becomes a catch-all.

| Signal | Count | Threshold | Penalty |
| --- | --- | --- | --- |
| Large files | 0 | LOC >= 1000 | 0 |
| Huge files | 0 | LOC >= 1500 | 0 |
| Complex files | 6 | branches >= 120 or max block >= 160 | 4.8 |
| Crowded folders | 3 | files > 24 | 2.1 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 3 | folder naming convention mismatch | 0.6 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/lib/units | 16 | 32 | 2952 | 742 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 10 | 29 | 5028 | 715 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 6 | 27 | 2404 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 32 | 2952 | 742 |
| app/ui | 29 | 5028 | 715 |
| app/types | 27 | 2404 | 0 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 423 |
| camelCase | 322 |
| mixed | 43 |

### Naming Mismatches

| File | Style | Expected |
| --- | --- | --- |
| app/lib/ActionScheduler.ts | PascalCase | camelCase |
| app/lib/resources/NaturalResourcePlacement.ts | PascalCase | camelCase |
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
