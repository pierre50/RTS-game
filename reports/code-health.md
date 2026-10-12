# Code Health Report

Generated: 2026-10-11T16:48:00.815Z

## Global Score

**100/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 20/20 |
| Architecture | 15/15 |
| Hotspots | 10/10 |
| Tests and critical coverage | 10/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 20/20 | 0 |
| Architecture | 15/15 | 0 |
| Hotspots | 10/10 | 0 |
| Tests and critical coverage | 10/10 | 0 |

Largest score loss: **none**. Gate blockers: Quality regressions: fail; 1709 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 11 | 0 |
| 95+ | 6 | 0 |
| 100+ | 0 | 0 |

## Summary

- Files analyzed: 1181
- Total lines: 143822
- Code lines: 133264
- AST branch decisions: 30665
- AST functions/methods: 11532
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
| Behavior tests | PASS | 4117/4117 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2470**. New or worsened findings: **1709**.

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
| function-lines | app/ai/AIStrategyBuilding.ts:113 | 155 | 80 |
| function-lines | app/ai/AIStrategyBuilding.ts:269 | 119 | 80 |

## Critical Test Coverage

Branch coverage: **90.07%** (7531/8361). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/energyRules.ts | 3/5 | 60 |
| app/classes/unit/movement/UnitMovement.ts | 89/138 | 64.49 |
| app/lib/units/village/villageGroundRecovery.ts | 74/113 | 65.48 |
| app/lib/units/unitActionTarget.ts | 7/10 | 70 |
| app/lib/combat/diplomaticAggression.ts | 52/71 | 73.23 |
| app/lib/combat/parry.ts | 29/39 | 74.35 |
| app/lib/units/autonomy/villagerDropoffDistance.ts | 21/28 | 75 |
| app/lib/units/roadJourney.ts | 6/8 | 75 |
| app/lib/combat/combatHit.ts | 65/86 | 75.58 |
| app/lib/units/supplies/npcSupplyStatus.ts | 25/33 | 75.75 |
| app/classes/unit/movement/UnitMoveOrderAdmission.ts | 38/50 | 76 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 91/118 | 77.11 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/serialization/validation/PlayerRecordValidation.ts:115 validatePlayerBuildings | 78 | 4 | 149 |
| app/ui/minimap/MinimapEntityLayer.ts:16 drawMinimapEntities | 77 | 5 | 136 |
| app/serialization/validation/SaveUnitValidators.ts:78 validatePlayerUnits | 76 | 3 | 124 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 116 |
| app/lib/npc/npcRoutineChatter.ts:29 pickNpcRoutineChatterLine | 65 | 4 | 86 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/services/VillagerAutonomySystem.ts:88 VillagerAutonomySystem.check | 55 | 2 | 80 |
| app/classes/map/generation/BlueprintResourceLoading.ts:38 loadBlueprintResourceBatches | 54 | 4 | 111 |
| app/controllers/HeroControllerUpdate.ts:94 updateHeroControllerRuntime | 52 | 3 | 141 |
| app/serialization/validation/SaveAmbientTrafficValidation.ts:6 validateAmbientTraffic | 51 | 3 | 73 |
| app/services/visibility/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/serialization/validation/PlayerRecordValidation.ts | app | 254.9 | 265 | 115 | 156 | 5 | complexite elevee |
| app/controllers/HeroController.ts | runtime | 249.5 | 530 | 78 | 87 | 55 | souvent modifie |
| app/services/tutorial/TutorialOpening.ts | runtime | 247.2 | 351 | 112 | 153 | 4 | complexite elevee |
| app/classes/unit/UnitCombat.ts | runtime | 236.6 | 333 | 77 | 116 | 36 | souvent modifie, beaucoup de dependances |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 235.4 | 659 | 113 | 123 | 5 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 231.1 | 256 | 107 | 149 | 3 | complexite elevee |
| app/services/world/offline/OfflineWorldSimulation.ts | runtime | 230.7 | 338 | 93 | 149 | 4 | beaucoup de dependances |
| app/ui/NpcOrdersManager.ts | ui | 225.5 | 446 | 77 | 96 | 40 | souvent modifie, beaucoup de dependances |
| app/serialization/validation/SaveUnitValidators.ts | app | 224.7 | 217 | 113 | 131 | 3 | complexite elevee |
| app/classes/players/Player.ts | runtime | 213.3 | 288 | 71 | 55 | 42 | souvent modifie, beaucoup de dependances |
| engine/services/BuildingInteriorSpaceDecorations.ts | runtime | 211.6 | 273 | 104 | 141 | 0 | complexite elevee |
| app/services/wildlife/WildlifeSystem.ts | runtime | 211.3 | 309 | 106 | 132 | 1 | complexite elevee |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 659 | 113 | 19 |
| tools/ui-gallery/Gallery.ts | app | 629 | 67 | 30 |
| app/classes/players/AIPlayer.ts | runtime | 578 | 67 | 23 |
| app/lib/audio/settings.ts | library | 576 | 57 | 2 |
| app/lib/lpc/equipmentData.ts | data/config | 575 | 2 | 4 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/classes/map/resources/MapResources.ts | runtime | 558 | 52 | 15 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/screens/Game.ts | ui | 551 | 39 | 37 |
| app/types/save.ts | types | 549 | 0 | 29 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 575 | 2 |
| app/lib/i18n/fr.ts | data/config | 477 | 0 |
| app/lib/i18n/en.ts | data/config | 474 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 425 | 41 |
| app/constants/entities.ts | data/config | 353 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 287 | 0 |
| app/lib/i18n/heroTranslations.ts | data/config | 230 | 0 |
| app/config/playerConfig.ts | data/config | 215 | 15 |
| app/config/assetManifest.ts | data/config | 204 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 193 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 179 | 0 |
| app/lib/lpc/unitEquipmentData.ts | data/config | 138 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/travel/RoadTravelSystem.ts | 119 | 101 | 353 |
| app/services/travel/ambient/AmbientTrafficSystem.ts | 118 | 77 | 311 |
| app/services/spacePortal/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/serialization/validation/PlayerRecordValidation.ts | 115 | 156 | 265 |
| app/classes/map/terrain/MapTerrainBake.ts | 113 | 123 | 659 |
| app/classes/resources/CompactResourceSet.ts | 113 | 27 | 534 |
| app/serialization/validation/SaveUnitValidators.ts | 113 | 131 | 217 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/services/tutorial/TutorialOpening.ts | 112 | 153 | 351 |
| tools/maps/settlements/settlement-roads.cjs | 109 | 87 | 285 |
| app/serialization/ZonedSaveFormat.ts | 107 | 149 | 256 |
| app/services/wildlife/WildlifeSystem.ts | 106 | 132 | 309 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/save.ts | 60 | 144.5 | 549 |
| app/config/assetManifest.ts | 60 | 29.1 | 204 |
| app/types/entities.ts | 59 | 24.2 | 24 |
| app/serialization/SaveSerializer.ts | 57 | 205.9 | 250 |
| app/types/context.ts | 57 | 123.3 | 370 |
| app/controllers/HeroController.ts | 55 | 249.5 | 530 |
| app/screens/Game.ts | 54 | 200.7 | 551 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/map/MapGeneration.ts | 47 | 188.3 | 377 |
| app/ui/InventoryManager.ts | 45 | 163.4 | 369 |
| app/classes/players/Player.ts | 42 | 213.3 | 288 |
| app/classes/building/BuildingLifecycle.ts | 42 | 153.4 | 194 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | OK | 0 dossier(s) avec plus de 24 fichiers TS |
| Dossiers severement charges | OK | 0 dossier(s) avec plus de 48 fichiers TS |
| Dossiers trop volumineux | OK | 0 dossier(s) avec plus de 8000 lignes |
| Dossiers trop branches | OK | 0 dossier(s) avec plus de 1200 branches approx. |
| Profondeur de dossiers | OK | 0 dossier(s) au-dela de 5 niveaux |
| Index trop lourds | OK | 0 index.ts avec plus de 300 lignes |
| Nomenclature par zone | OK | 0 fichier(s) ne suivent pas la convention attendue de leur dossier |

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
| Naming mismatches | 0 | folder naming convention mismatch | 0 |

### Folder Refactor Candidates

No folder currently needs a structural split.

### Crowded Folders

No folder exceeds the current file-count warning.

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 626 |
| camelCase | 476 |
| mixed | 79 |

### Naming Mismatches

No naming mismatch detected for folder-level conventions.

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
