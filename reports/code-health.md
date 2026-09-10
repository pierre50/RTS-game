# Code Health Report

Generated: 2026-09-10T22:55:19.516Z

## Global Score

**91/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 17/20 |
| Architecture | 15/15 |
| Hotspots | 5/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 17/20 | 3 |
| Architecture | 15/15 | 0 |
| Hotspots | 5/10 | 5 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Hotspots (5 points)**. Gate blockers: Quality regressions: fail; 127 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 6 | 0 |
| 95+ | 1 | 5 |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 715
- Total lines: 103863
- Code lines: 95307
- AST branch decisions: 19004
- AST functions/methods: 8024
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
| Behavior tests | PASS | 1973/1973 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **1280**. New or worsened findings: **127**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |
| function-complexity | app/ai/AIEconomy.ts:375 | 17 | 15 |
| function-lines | app/ai/AIEconomy.ts:375 | 112 | 80 |
| function-complexity | app/ai/AIEconomyBuildingMaterials.ts:24 | 18 | 15 |
| double-assertion | app/ai/AIEconomyBuildingMaterials.ts:36 | 1 | 0 |
| function-lines | app/ai/AIEconomyFoodManager.ts:236 | 101 | 80 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:72 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:125 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:231 | 1 | 0 |
| double-assertion | app/ai/AIEconomyFoodManager.ts:268 | 1 | 0 |
| double-assertion | app/ai/AIEconomyHorseCapture.ts:32 | 1 | 0 |
| double-assertion | app/ai/AIThreatManager.ts:25 | 1 | 0 |
| double-assertion | app/ai/AIThreatManager.ts:48 | 1 | 0 |

## Critical Test Coverage

Branch coverage: **79.83%** (3998/5008). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitDirectMovement.ts | 46/89 | 51.68 |
| app/lib/combat/factions.ts | 8/14 | 57.14 |
| app/classes/unit/movement/UnitAffectNewDest.ts | 56/97 | 57.73 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 119/202 | 58.91 |
| app/lib/units/unitHealth.ts | 26/44 | 59.09 |
| app/lib/combat/combatAttackLoop.ts | 98/158 | 62.02 |
| app/lib/units/unitEnergy.ts | 99/159 | 62.26 |
| app/serialization/SaveSerializer.ts | 91/145 | 62.75 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts:74 formatTerrainRelief | 75 | 23 | 65 |
| app/controllers/HeroControllerUpdate.ts:87 updateHeroControllerRuntime | 64 | 3 | 157 |
| app/services/world/OfflineWorldWork.ts:179 advanceOfflineWorker | 59 | 6 | 176 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/services/VillagerAutonomySystem.ts:104 VillagerAutonomySystem.check | 48 | 2 | 70 |
| app/classes/unit/UnitCaptureHorseAction.ts:224 handleCaptureHorseAction | 47 | 3 | 131 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 44 | 4 | 139 |
| app/dev-console/actions/PerformanceDebug.ts:6 performanceReport | 44 | 3 | 65 |
| app/classes/map/terrain/MapTerrainWaterTopology.ts:22 normalizeWaterTopology | 39 | 5 | 106 |
| app/lib/lpc/equipmentPaths.ts:19 equipmentFamilyPath | 39 | 1 | 42 |
| app/services/FogOfWar.ts:139 updateVisibilityNow | 38 | 4 | 85 |
| app/classes/unit/UnitCommands.ts:87 UnitCommands.commonSendTo | 37 | 3 | 76 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/world/OfflineWorldWork.ts | runtime | 271.7 | 355 | 122 | 176 | 1 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 236.1 | 539 | 74 | 87 | 53 | souvent modifie |
| app/screens/Game.ts | ui | 222.7 | 576 | 53 | 33 | 56 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | runtime | 214.3 | 494 | 65 | 59 | 51 | souvent modifie |
| app/serialization/SaveEntityValidators.ts | app | 213.2 | 369 | 118 | 49 | 9 | complexite elevee, souvent modifie |
| app/controllers/HeroCompanionHorseController.ts | runtime | 210.3 | 432 | 119 | 57 | 7 | complexite elevee |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 205.7 | 355 | 90 | 131 | 7 | score de risque relatif eleve |
| app/dev-console/actions/DebugMapRenderers.ts | tooling | 201.1 | 461 | 112 | 92 | 4 | complexite elevee |
| app/classes/Resource.ts | runtime | 197.7 | 508 | 78 | 72 | 34 | souvent modifie |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 197.7 | 349 | 116 | 60 | 5 | complexite elevee |
| app/services/SpacePortalSystem.ts | runtime | 196.4 | 354 | 117 | 37 | 4 | complexite elevee |
| app/controllers/HeroControllerUpdate.ts | runtime | 196.2 | 244 | 71 | 157 | 11 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/serialization/SaveEntityValidators.ts | app | 213.2 | branches >= 80, churn >= 8 | branches < 80 |
| app/services/rest/UnitRestStateTransitions.ts | runtime | 189.5 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/combat/combatFeedback.ts | library | 187.4 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/minimap/MinimapManager.ts | ui | 161.7 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/i18n/en.ts | data/config | 81.3 | LOC >= 600, churn >= 8 | LOC < 600 |
| app/lib/i18n/fr.ts | data/config | 78.3 | LOC >= 600, churn >= 8 | LOC < 600 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 701 | 90 | 16 |
| app/lib/i18n/fr.ts | data/config | 613 | 0 | 1 |
| app/lib/i18n/en.ts | data/config | 611 | 0 | 1 |
| app/screens/Game.ts | ui | 576 | 53 | 34 |
| app/classes/map/Map.ts | runtime | 573 | 23 | 22 |
| app/ui/PlayerSetupPanel.ts | ui | 571 | 66 | 8 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/lib/entities/spriteFragmentBurst.ts | library | 543 | 68 | 5 |
| app/serialization/SaveSerializer.ts | app | 539 | 74 | 16 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/fr.ts | data/config | 613 | 0 |
| app/lib/i18n/en.ts | data/config | 611 | 0 |
| app/constants/entities.ts | data/config | 274 | 0 |
| app/config/assetManifest.ts | data/config | 219 | 0 |
| app/config/playerConfig.ts | data/config | 213 | 15 |
| app/constants/environments.ts | data/config | 151 | 1 |
| app/lib/i18n/entityTooltips.ts | data/config | 139 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |
| app/config/gameplay.ts | data/config | 95 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/world/OfflineWorldWork.ts | 122 | 176 | 355 |
| app/controllers/HeroCompanionHorseController.ts | 119 | 57 | 432 |
| app/serialization/SaveEntityValidators.ts | 118 | 49 | 369 |
| app/services/SpacePortalSystem.ts | 117 | 37 | 354 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/screens/game/BuildingInteriorExitRouting.ts | 116 | 60 | 349 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 110 | 51 | 454 |
| app/lib/resources/playerResourceTotals.ts | 110 | 61 | 274 |
| app/services/rest/UnitRestStateTransitions.ts | 106 | 54 | 259 |
| tools/health/analyze.cjs | 103 | 115 | 290 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 101 | 30 | 316 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/screens/Game.ts | 56 | 222.7 | 576 |
| app/config/assetManifest.ts | 56 | 27.9 | 219 |
| app/serialization/SaveSerializer.ts | 53 | 236.1 | 539 |
| app/classes/map/MapGeneration.ts | 52 | 186.8 | 395 |
| app/controllers/HeroController.ts | 51 | 214.3 | 494 |
| app/types/context.ts | 51 | 110.8 | 353 |
| app/types/save.ts | 49 | 107.9 | 394 |
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
| Complex files | 1 | branches >= 120 or max block >= 160 | 0.8 |
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
| app/lib/units | 6 | 27 | 2729 | 673 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/services | 2 | 25 | 3933 | 855 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/types | 2 | 25 | 2216 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 27 | 2729 | 673 |
| app/services | 25 | 3933 | 855 |
| app/types | 25 | 2216 | 0 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 372 |
| camelCase | 299 |
| mixed | 44 |

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
