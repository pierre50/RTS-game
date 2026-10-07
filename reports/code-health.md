# Code Health Report

Generated: 2026-10-07T14:57:56.752Z

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

Largest score loss: **none**. Gate blockers: Quality regressions: fail; 1362 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 11 | 0 |
| 95+ | 6 | 0 |
| 100+ | 0 | 0 |

## Summary

- Files analyzed: 1081
- Total lines: 132045
- Code lines: 121858
- AST branch decisions: 27481
- AST functions/methods: 10508
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
| Behavior tests | PASS | 3576/3576 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2157**. New or worsened findings: **1362**.

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
| function-lines | app/ai/AIStrategyBuilding.ts:112 | 155 | 80 |
| function-lines | app/ai/AIStrategyBuilding.ts:268 | 118 | 80 |

## Critical Test Coverage

Branch coverage: **90.13%** (6432/7136). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/serialization/AsyncSaveStorage.ts | 0/18 | 0 |
| app/lib/units/energyRules.ts | 3/5 | 60 |
| app/classes/unit/movement/UnitMovement.ts | 84/127 | 66.14 |
| app/lib/combat/diplomaticAggression.ts | 52/71 | 73.23 |
| app/lib/combat/parry.ts | 29/39 | 74.35 |
| app/lib/combat/combatHit.ts | 64/85 | 75.29 |
| app/classes/unit/movement/UnitMoveOrderAdmission.ts | 35/46 | 76.08 |
| app/lib/units/autonomy/villagerDropoffDistance.ts | 20/26 | 76.92 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 91/118 | 77.11 |
| app/serialization/blueprint/WorldMapBlueprintSelection.ts | 28/36 | 77.77 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/serialization/validation/SaveUnitValidators.ts:70 validatePlayerUnits | 76 | 3 | 124 |
| app/ui/minimap/MinimapEntityLayer.ts:15 drawMinimapEntities | 75 | 5 | 135 |
| app/serialization/validation/PlayerRecordValidation.ts:113 validatePlayerBuildings | 71 | 4 | 140 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 116 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/classes/map/generation/BlueprintResourceLoading.ts:38 loadBlueprintResourceBatches | 54 | 4 | 111 |
| app/services/VillagerAutonomySystem.ts:141 VillagerAutonomySystem.check | 54 | 2 | 79 |
| app/services/world/offline/OfflineWorldWork.ts:38 advanceOfflineWorker | 54 | 3 | 153 |
| app/controllers/HeroControllerUpdate.ts:83 updateHeroControllerRuntime | 53 | 3 | 149 |
| app/lib/npc/npcRoutineChatter.ts:27 pickNpcRoutineChatterLine | 52 | 4 | 68 |
| app/services/visibility/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/tutorial/TutorialOpening.ts | runtime | 247.2 | 351 | 112 | 153 | 4 | complexite elevee |
| app/ui/NpcOrdersManager.ts | ui | 241.2 | 453 | 77 | 122 | 38 | souvent modifie |
| app/controllers/HeroController.ts | runtime | 236.3 | 507 | 76 | 65 | 53 | souvent modifie |
| app/serialization/validation/PlayerRecordValidation.ts | app | 234 | 254 | 108 | 147 | 4 | complexite elevee |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 232.4 | 659 | 113 | 123 | 4 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 231.1 | 256 | 107 | 149 | 3 | complexite elevee |
| app/classes/players/Player.ts | runtime | 215.1 | 289 | 73 | 56 | 42 | souvent modifie, beaucoup de dependances |
| engine/services/BuildingInteriorSpaceDecorations.ts | runtime | 211.6 | 273 | 104 | 141 | 0 | complexite elevee |
| app/services/wildlife/WildlifeSystem.ts | runtime | 211.3 | 309 | 106 | 132 | 1 | complexite elevee |
| app/serialization/validation/SaveUnitValidators.ts | app | 211 | 209 | 108 | 131 | 1 | complexite elevee |
| app/classes/Resource.ts | runtime | 208.1 | 500 | 72 | 85 | 40 | souvent modifie |
| app/screens/Game.ts | ui | 206.7 | 551 | 39 | 44 | 57 | souvent modifie, beaucoup de dependances |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 659 | 113 | 19 |
| app/classes/players/AIPlayer.ts | runtime | 575 | 67 | 23 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/lib/audio/settings.ts | library | 565 | 55 | 2 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/screens/Game.ts | ui | 551 | 39 | 37 |
| app/lib/lpc/equipmentData.ts | data/config | 550 | 2 | 3 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/classes/map/Map.ts | runtime | 544 | 22 | 22 |
| app/types/save.ts | types | 533 | 0 | 26 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 550 | 2 |
| app/lib/i18n/fr.ts | data/config | 452 | 0 |
| app/lib/i18n/en.ts | data/config | 448 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 427 | 41 |
| app/constants/entities.ts | data/config | 325 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 287 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/config/assetManifest.ts | data/config | 205 | 0 |
| app/lib/i18n/heroTranslations.ts | data/config | 202 | 0 |
| app/lib/i18n/entityNames.ts | data/config | 189 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 179 | 0 |
| app/lib/lpc/unitEquipmentData.ts | data/config | 173 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/spacePortal/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/services/VillageActivitySystem.ts | 115 | 91 | 333 |
| app/classes/map/terrain/MapTerrainBake.ts | 113 | 123 | 659 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/services/tutorial/TutorialOpening.ts | 112 | 153 | 351 |
| app/lib/ui/GameWindow.ts | 111 | 75 | 497 |
| app/serialization/validation/PlayerRecordValidation.ts | 108 | 147 | 254 |
| app/serialization/validation/SaveUnitValidators.ts | 108 | 131 | 209 |
| app/services/world/StartingVillageLayout.ts | 108 | 100 | 334 |
| app/serialization/ZonedSaveFormat.ts | 107 | 149 | 256 |
| app/classes/resources/CompactResourceSet.ts | 106 | 27 | 505 |
| app/services/wildlife/WildlifeSystem.ts | 106 | 132 | 309 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 62 | 25.4 | 24 |
| app/config/assetManifest.ts | 61 | 29.5 | 205 |
| app/types/save.ts | 59 | 138.5 | 533 |
| app/screens/Game.ts | 57 | 206.7 | 551 |
| app/serialization/SaveSerializer.ts | 56 | 202.7 | 237 |
| app/types/context.ts | 56 | 121.3 | 372 |
| app/controllers/HeroController.ts | 53 | 236.3 | 507 |
| app/classes/map/MapGeneration.ts | 51 | 196.3 | 377 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/building/BuildingLifecycle.ts | 44 | 158.9 | 196 |
| app/classes/unit/UnitActions.ts | 44 | 72.5 | 173 |
| app/ui/InventoryManager.ts | 43 | 149.9 | 337 |

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
| PascalCase | 589 |
| camelCase | 429 |
| mixed | 63 |

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
