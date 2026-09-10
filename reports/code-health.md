# Code Health Report

Generated: 2026-09-10T07:33:34.399Z

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

Largest score loss: **Hotspots (5 points)**. Gate blockers: Quality regressions: fail; 45 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 6 | 0 |
| 95+ | 1 | 5 |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 683
- Total lines: 101558
- Code lines: 93125
- AST branch decisions: 18316
- AST functions/methods: 7821
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
| Behavior tests | PASS | 1850/1850 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **1237**. New or worsened findings: **45**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |
| function-lines | app/classes/Resource.ts:94 | 103 | 80 |
| function-complexity | app/classes/building/BuildingTrainingProgress.ts:87 | 17 | 15 |
| function-complexity | app/classes/map/MapSaveRestore.ts:30 | 24 | 15 |
| function-nesting | app/classes/map/MapSaveRestore.ts:30 | 6 | 4 |
| function-complexity | app/classes/map/NeighborScenery.ts:64 | 44 | 15 |
| function-lines | app/classes/map/NeighborScenery.ts:64 | 139 | 80 |
| function-complexity | app/classes/unit/UnitActions.ts:114 | 21 | 15 |
| function-lines | app/classes/unit/UnitCaptureHorseAction.ts:224 | 131 | 80 |
| function-lines | app/controllers/HeroControllerUpdate.ts:87 | 157 | 80 |
| double-assertion | app/dev-console/actions/spawn.ts:116 | 1 | 0 |
| function-complexity | app/lib/combat/combatHit.ts:112 | 28 | 15 |
| function-complexity | app/lib/hero/heroPowerCharge.ts:192 | 17 | 15 |

## Critical Test Coverage

Branch coverage: **79.69%** (3749/4704). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitDirectMovement.ts | 46/89 | 51.68 |
| app/serialization/SaveSerializer.ts | 80/141 | 56.73 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 112/197 | 56.85 |
| app/lib/combat/factions.ts | 8/14 | 57.14 |
| app/classes/unit/movement/UnitAffectNewDest.ts | 55/95 | 57.89 |
| app/lib/units/unitHealth.ts | 26/44 | 59.09 |
| app/classes/unit/movement/UnitMovement.ts | 73/121 | 60.33 |
| app/lib/combat/combatAttackLoop.ts | 98/158 | 62.02 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts:74 formatTerrainRelief | 75 | 23 | 65 |
| app/controllers/HeroControllerUpdate.ts:87 updateHeroControllerRuntime | 64 | 3 | 157 |
| app/services/world/OfflineWorldWork.ts:177 advanceOfflineWorker | 59 | 6 | 173 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/services/VillagerAutonomySystem.ts:104 VillagerAutonomySystem.check | 48 | 2 | 70 |
| app/classes/unit/UnitCaptureHorseAction.ts:224 handleCaptureHorseAction | 47 | 3 | 131 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 44 | 4 | 139 |
| app/dev-console/actions/PerformanceDebug.ts:6 performanceReport | 44 | 3 | 65 |
| app/classes/map/terrain/MapTerrainWaterTopology.ts:22 normalizeWaterTopology | 39 | 5 | 106 |
| app/lib/lpc/equipmentPaths.ts:19 equipmentFamilyPath | 39 | 1 | 42 |
| app/services/rest/UnitRestStateTransitions.ts:198 updateMovingRestUnit | 37 | 5 | 54 |
| app/services/FogOfWar.ts:138 updateVisibilityNow | 35 | 4 | 79 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/classes/Resource.ts | runtime | 277.7 | 591 | 97 | 103 | 33 | souvent modifie |
| app/services/world/OfflineWorldWork.ts | runtime | 267.7 | 350 | 123 | 173 | 0 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 224.2 | 507 | 73 | 74 | 51 | souvent modifie |
| app/screens/Game.ts | ui | 212.5 | 569 | 49 | 34 | 54 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | runtime | 211 | 490 | 65 | 59 | 50 | souvent modifie |
| app/ui/NpcOrdersManager.ts | ui | 211 | 508 | 83 | 73 | 23 | souvent modifie |
| app/lib/avatar.ts | library | 208.8 | 493 | 99 | 53 | 16 | souvent modifie |
| app/controllers/HeroCompanionHorseController.ts | runtime | 207.3 | 432 | 119 | 57 | 6 | complexite elevee |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 202.7 | 355 | 90 | 131 | 6 | score de risque relatif eleve |
| app/ui/HeroBuildingMenuManager.ts | ui | 202.5 | 421 | 94 | 79 | 17 | souvent modifie |
| app/dev-console/actions/DebugMapRenderers.ts | tooling | 201.1 | 461 | 112 | 92 | 4 | complexite elevee |
| app/services/SpacePortalSystem.ts | runtime | 196.6 | 364 | 121 | 37 | 2 | complexite elevee |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/classes/Resource.ts | runtime | 277.7 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/NpcOrdersManager.ts | ui | 211 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/avatar.ts | library | 208.8 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/HeroBuildingMenuManager.ts | ui | 202.5 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/building/BuildingTrainingPreview.ts | runtime | 185.8 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/units/villagerAutonomy.ts | library | 181.7 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 663 | 81 | 14 |
| app/classes/Resource.ts | runtime | 591 | 97 | 17 |
| app/classes/map/Map.ts | runtime | 573 | 23 | 22 |
| app/ui/PlayerSetupPanel.ts | ui | 571 | 66 | 8 |
| app/lib/i18n/en.ts | data/config | 569 | 0 | 1 |
| app/lib/i18n/fr.ts | data/config | 569 | 0 | 1 |
| app/screens/Game.ts | ui | 569 | 49 | 34 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/lib/combat/combatFeedback.ts | library | 534 | 100 | 9 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/en.ts | data/config | 569 | 0 |
| app/lib/i18n/fr.ts | data/config | 569 | 0 |
| app/constants/entities.ts | data/config | 273 | 0 |
| app/config/assetManifest.ts | data/config | 217 | 0 |
| app/config/playerConfig.ts | data/config | 213 | 15 |
| app/constants/environments.ts | data/config | 151 | 1 |
| app/lib/i18n/entityTooltips.ts | data/config | 136 | 0 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |
| app/config/gameplay.ts | data/config | 95 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/world/OfflineWorldWork.ts | 123 | 173 | 350 |
| app/services/SpacePortalSystem.ts | 121 | 37 | 364 |
| app/controllers/HeroCompanionHorseController.ts | 119 | 57 | 432 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/screens/game/BuildingInteriorExitRouting.ts | 116 | 60 | 349 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/lib/resources/playerResourceTotals.ts | 110 | 61 | 274 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 107 | 51 | 451 |
| app/services/rest/UnitRestStateTransitions.ts | 106 | 54 | 259 |
| tools/health/analyze.cjs | 103 | 115 | 290 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 101 | 30 | 316 |
| app/lib/combat/combatFeedback.ts | 100 | 61 | 534 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/config/assetManifest.ts | 55 | 27.4 | 217 |
| app/screens/Game.ts | 54 | 212.5 | 569 |
| app/serialization/SaveSerializer.ts | 51 | 224.2 | 507 |
| app/classes/map/MapGeneration.ts | 51 | 184.8 | 395 |
| app/controllers/HeroController.ts | 50 | 211 | 490 |
| app/types/context.ts | 50 | 108.8 | 353 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/types/save.ts | 47 | 103.3 | 373 |
| app/classes/unit/UnitActions.ts | 47 | 75 | 174 |
| app/classes/building/BuildingLifecycle.ts | 42 | 90.3 | 166 |
| app/classes/unit/UnitCombat.ts | 36 | 189.7 | 304 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 2 dossier(s) avec plus de 24 fichiers TS |
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
| Complex files | 2 | branches >= 120 or max block >= 160 | 1.6 |
| Crowded folders | 2 | files > 24 | 1.4 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 2 | folder naming convention mismatch | 0.4 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/services | 2 | 25 | 3934 | 856 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/units | 2 | 25 | 2584 | 651 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/services | 25 | 3934 | 856 |
| app/lib/units | 25 | 2584 | 651 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 357 |
| camelCase | 288 |
| mixed | 38 |

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
