# Code Health Report

Generated: 2026-09-08T18:45:20.882Z

## Global Score

**85/100 (B)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **INCOMPLETE**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 20/20 |
| Architecture | 15/15 |
| Hotspots | 5/10 |
| Tests and critical coverage | 0/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 20/20 | 0 |
| Architecture | 15/15 | 0 |
| Hotspots | 5/10 | 5 |
| Tests and critical coverage | 0/10 | 10 |

Largest score loss: **Tests and critical coverage (10 points)**. Gate blockers: Behavior tests: fail; Source consistency: error.

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 0 | Not reachable through hotspots alone |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 653
- Total lines: 99477
- Code lines: 91177
- AST branch decisions: 17513
- AST functions/methods: 7656
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
| Behavior tests | FAIL | Command exited with 1 |
| Critical branch coverage | PASS |  |
| Source consistency | ERROR | Source files changed during the audit; rerun on a stable checkout |
| Quality regressions | PASS |  |

## Regression Control

Baseline: loaded. Existing debt: **1282**. New or worsened findings: **0**.

| Rule | File | Value | Limit |
| --- | --- | --- | --- |

## Critical Test Coverage

Branch coverage: **78.55%** (3411/4342). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/lib/units/walkAround.ts | 0/32 | 0 |
| app/serialization/SaveSerializer.ts | 54/116 | 46.55 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitDirectMovement.ts | 46/89 | 51.68 |
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
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 155 |
| app/classes/unit/UnitCaptureHorseAction.ts:218 handleCaptureHorseAction | 47 | 3 | 121 |
| app/dev-console/actions/PerformanceDebug.ts:6 performanceReport | 44 | 3 | 65 |
| app/classes/map/NeighborScenery.ts:64 buildNeighborScenery | 43 | 4 | 136 |
| app/classes/map/terrain/MapTerrainWaterTopology.ts:22 normalizeWaterTopology | 39 | 5 | 106 |
| app/lib/lpc/equipmentPaths.ts:19 equipmentFamilyPath | 38 | 1 | 41 |
| app/services/rest/UnitRestStateTransitions.ts:198 updateMovingRestUnit | 37 | 5 | 54 |
| app/services/FogOfWar.ts:138 updateVisibilityNow | 35 | 4 | 79 |
| app/serialization/SaveValidator.ts:35 validateSaveData | 34 | 4 | 74 |
| app/classes/unit/UnitCommands.ts:80 UnitCommands.commonSendTo | 33 | 3 | 70 |
| app/lib/npc/npcGoToDispatch.ts:133 sendNpcToCell | 30 | 4 | 64 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/ui/InventoryManager.ts | ui | 224.1 | 608 | 79 | 85 | 28 | souvent modifie |
| app/screens/Game.ts | ui | 212.5 | 569 | 49 | 34 | 54 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | runtime | 209 | 491 | 65 | 59 | 49 | souvent modifie |
| app/ui/HeroBuildingMenuManager.ts | ui | 207.1 | 423 | 97 | 79 | 17 | souvent modifie |
| app/ui/NpcOrdersManager.ts | ui | 205 | 507 | 81 | 73 | 22 | souvent modifie |
| app/controllers/HeroCompanionHorseController.ts | runtime | 204.3 | 431 | 117 | 57 | 6 | complexite elevee |
| app/lib/avatar.ts | library | 203.8 | 472 | 98 | 50 | 15 | souvent modifie |
| app/dev-console/actions/DebugMapRenderers.ts | tooling | 201.1 | 461 | 112 | 92 | 4 | complexite elevee |
| app/serialization/SaveSerializer.ts | app | 198.9 | 475 | 58 | 69 | 50 | souvent modifie |
| app/lib/resources/playerResourceTotals.ts | library | 195.9 | 275 | 116 | 61 | 5 | complexite elevee |
| app/lib/entities/spriteTextures.ts | library | 195.1 | 506 | 104 | 83 | 8 | complexite elevee, souvent modifie |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 194.7 | 348 | 116 | 60 | 4 | complexite elevee |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/ui/InventoryManager.ts | ui | 224.1 | LOC >= 600, churn >= 8 | LOC < 600 |
| app/ui/HeroBuildingMenuManager.ts | ui | 207.1 | branches >= 80, churn >= 8 | branches < 80 |
| app/ui/NpcOrdersManager.ts | ui | 205 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/avatar.ts | library | 203.8 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/entities/spriteTextures.ts | library | 195.1 | branches >= 80, churn >= 8 | branches < 80 |
| app/classes/building/BuildingTrainingPreview.ts | runtime | 185.8 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 753 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 638 | 79 | 13 |
| app/ui/InventoryManager.ts | ui | 608 | 79 | 22 |
| app/classes/map/Map.ts | runtime | 575 | 23 | 22 |
| app/ui/PlayerSetupPanel.ts | ui | 570 | 66 | 8 |
| app/screens/Game.ts | ui | 569 | 49 | 34 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 82 | 14 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/classes/Resource.ts | runtime | 541 | 74 | 16 |
| app/lib/i18n/en.ts | data/config | 541 | 0 | 1 |
| app/lib/i18n/fr.ts | data/config | 541 | 0 | 1 |
| app/lib/combat/combatFeedback.ts | library | 534 | 100 | 9 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 753 | 2 |
| app/lib/i18n/en.ts | data/config | 541 | 0 |
| app/lib/i18n/fr.ts | data/config | 541 | 0 |
| app/lib/i18n/entityTooltips.ts | data/config | 306 | 0 |
| app/constants/entities.ts | data/config | 273 | 0 |
| app/config/playerConfig.ts | data/config | 227 | 17 |
| app/config/assetManifest.ts | data/config | 217 | 0 |
| app/constants/environments.ts | data/config | 151 | 1 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |
| app/config/gameplay.ts | data/config | 91 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/controllers/HeroCompanionHorseController.ts | 117 | 57 | 431 |
| app/dev-console/actions/PerformanceDebug.ts | 116 | 65 | 418 |
| app/lib/resources/playerResourceTotals.ts | 116 | 61 | 275 |
| app/screens/game/BuildingInteriorExitRouting.ts | 116 | 60 | 348 |
| app/services/SpacePortalSystem.ts | 115 | 37 | 322 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 107 | 51 | 451 |
| app/services/rest/UnitRestStateTransitions.ts | 105 | 54 | 259 |
| app/lib/entities/spriteTextures.ts | 104 | 83 | 506 |
| tools/health/analyze.cjs | 103 | 115 | 290 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 101 | 30 | 316 |
| app/lib/combat/combatFeedback.ts | 100 | 61 | 534 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/config/assetManifest.ts | 55 | 27.4 | 217 |
| app/screens/Game.ts | 54 | 212.5 | 569 |
| app/serialization/SaveSerializer.ts | 50 | 198.9 | 475 |
| app/classes/map/MapGeneration.ts | 50 | 167.6 | 377 |
| app/types/context.ts | 50 | 108.9 | 355 |
| app/controllers/HeroController.ts | 49 | 209 | 491 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/types/save.ts | 46 | 101 | 360 |
| app/classes/unit/UnitActions.ts | 46 | 69.7 | 176 |
| app/classes/building/BuildingLifecycle.ts | 41 | 89.4 | 165 |
| app/classes/unit/UnitCombat.ts | 35 | 181.9 | 299 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | OK | 0 dossier(s) avec plus de 24 fichiers TS |
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
| Complex files | 0 | branches >= 120 or max block >= 160 | 0 |
| Crowded folders | 0 | files > 24 | 0 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 2 | folder naming convention mismatch | 0.4 |

### Folder Refactor Candidates

No folder currently needs a structural split.

### Crowded Folders

No folder exceeds the current file-count warning.

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 344 |
| camelCase | 276 |
| mixed | 33 |

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
