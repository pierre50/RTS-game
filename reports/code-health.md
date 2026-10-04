# Code Health Report

Generated: 2026-10-04T16:43:35.657Z

## Global Score

**95/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **FAIL**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 17/20 |
| Architecture | 15/15 |
| Hotspots | 9/10 |
| Tests and critical coverage | 9/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 17/20 | 3 |
| Architecture | 15/15 | 0 |
| Hotspots | 9/10 | 1 |
| Tests and critical coverage | 9/10 | 1 |

Largest score loss: **Structure (3 points)**. Gate blockers: Quality regressions: fail; 1280 new or worsened debt finding(s).

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 6 | 0 |
| 95+ | 1 | 0 |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 1053
- Total lines: 129564
- Code lines: 119471
- AST branch decisions: 26805
- AST functions/methods: 10305
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
| Behavior tests | PASS | 3376/3376 passed |
| Critical branch coverage | PASS |  |
| Source consistency | PASS |  |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2156**. New or worsened findings: **1280**.

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

Branch coverage: **81.05%** (5694/7025). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

| File | Branches covered | Percent |
| --- | --- | --- |
| app/lib/units/autonomy/villagerJobDiagnostics.ts | 0/28 | 0 |
| app/lib/units/unitActionTarget.ts | 0/11 | 0 |
| app/lib/units/unitPlacement.ts | 0/8 | 0 |
| app/serialization/AsyncSaveStorage.ts | 0/18 | 0 |
| app/lib/units/walkAround.ts | 12/32 | 37.5 |
| app/serialization/validation/CampaignRecordValidation.ts | 22/56 | 39.28 |
| app/serialization/validation/SaveUnitValidators.ts | 68/154 | 44.15 |
| app/classes/unit/movement/UnitBlockedApproach.ts | 29/60 | 48.33 |
| app/lib/units/unitLocomotion.ts | 2/4 | 50 |
| app/classes/unit/movement/UnitDirectMovement.ts | 52/87 | 59.77 |
| app/lib/units/energyRules.ts | 3/5 | 60 |
| app/serialization/CaveSave.ts | 51/85 | 60 |

## Function Complexity

| Function | Complexity | Nesting | Lines |
| --- | --- | --- | --- |
| app/serialization/validation/SaveUnitValidators.ts:61 validatePlayerUnits | 76 | 3 | 124 |
| app/ui/minimap/MinimapEntityLayer.ts:15 drawMinimapEntities | 75 | 5 | 135 |
| app/serialization/QuestSave.ts:4 validateQuestJournal | 70 | 4 | 99 |
| app/lib/terrain/reliefAppearance.ts:4 getReliefAppearance | 65 | 20 | 53 |
| app/serialization/validation/PlayerRecordValidation.ts:113 validatePlayerBuildings | 65 | 4 | 127 |
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/classes/map/generation/BlueprintResourceLoading.ts:38 loadBlueprintResourceBatches | 54 | 4 | 111 |
| app/services/VillagerAutonomySystem.ts:141 VillagerAutonomySystem.check | 54 | 2 | 79 |
| app/services/world/offline/OfflineWorldWork.ts:38 advanceOfflineWorker | 54 | 3 | 153 |
| app/lib/npc/npcRoutineChatter.ts:27 pickNpcRoutineChatterLine | 52 | 4 | 68 |
| app/services/visibility/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/services/tutorial/TutorialOpening.ts | runtime | 247.2 | 351 | 112 | 153 | 4 | complexite elevee |
| app/ui/NpcOrdersManager.ts | ui | 235.5 | 449 | 77 | 120 | 36 | souvent modifie |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 231.1 | 699 | 114 | 122 | 3 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 231.1 | 256 | 107 | 149 | 3 | complexite elevee |
| app/controllers/HeroController.ts | runtime | 219.7 | 493 | 66 | 59 | 53 | souvent modifie |
| app/classes/players/Player.ts | runtime | 217.9 | 329 | 79 | 56 | 39 | souvent modifie, beaucoup de dependances |
| app/services/world/VillageWorkSimulation.ts | runtime | 216 | 317 | 91 | 147 | 6 | score de risque relatif eleve |
| engine/services/BuildingInteriorSpaceDecorations.ts | runtime | 211.6 | 273 | 104 | 141 | 0 | complexite elevee |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 211.3 | 350 | 119 | 54 | 8 | complexite elevee, souvent modifie |
| app/services/wildlife/WildlifeSystem.ts | runtime | 211.3 | 309 | 106 | 132 | 1 | complexite elevee |
| app/serialization/validation/PlayerRecordValidation.ts | app | 211.2 | 241 | 102 | 134 | 3 | complexite elevee |
| app/classes/Resource.ts | runtime | 208.1 | 500 | 72 | 85 | 40 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 211.3 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 699 | 114 | 16 |
| app/classes/players/AIPlayer.ts | runtime | 575 | 67 | 23 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/lib/audio/settings.ts | library | 551 | 46 | 2 |
| app/screens/Game.ts | ui | 551 | 39 | 37 |
| app/lib/lpc/equipmentData.ts | data/config | 550 | 2 | 3 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/classes/map/Map.ts | runtime | 542 | 22 | 21 |
| app/types/save.ts | types | 535 | 0 | 25 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 550 | 2 |
| app/lib/i18n/fr.ts | data/config | 444 | 0 |
| app/lib/i18n/en.ts | data/config | 440 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 421 | 41 |
| app/constants/entities.ts | data/config | 325 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 265 | 0 |
| app/config/assetManifest.ts | data/config | 213 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityNames.ts | data/config | 189 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 181 | 0 |
| app/lib/i18n/heroTranslations.ts | data/config | 176 | 0 |
| app/lib/lpc/unitEquipmentData.ts | data/config | 173 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/screens/game/BuildingInteriorExitRouting.ts | 119 | 54 | 350 |
| app/services/spacePortal/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/services/VillageActivitySystem.ts | 115 | 91 | 333 |
| app/classes/map/terrain/MapTerrainBake.ts | 114 | 122 | 699 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/services/tutorial/TutorialOpening.ts | 112 | 153 | 351 |
| app/lib/ui/GameWindow.ts | 107 | 75 | 480 |
| app/serialization/ZonedSaveFormat.ts | 107 | 149 | 256 |
| app/services/world/StartingVillageLayout.ts | 107 | 89 | 292 |
| app/classes/resources/CompactResourceSet.ts | 106 | 27 | 505 |
| app/services/wildlife/WildlifeSystem.ts | 106 | 132 | 309 |
| app/services/world/distantVillages/DistantVillageSystem.ts | 106 | 85 | 318 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 61 | 25 | 24 |
| app/config/assetManifest.ts | 59 | 28.9 | 213 |
| app/screens/Game.ts | 57 | 206.7 | 551 |
| app/types/save.ts | 56 | 131.4 | 535 |
| app/types/context.ts | 55 | 119.4 | 374 |
| app/serialization/SaveSerializer.ts | 54 | 198.7 | 236 |
| app/controllers/HeroController.ts | 53 | 219.7 | 493 |
| app/classes/map/MapGeneration.ts | 50 | 194.4 | 381 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/unit/UnitActions.ts | 43 | 71.7 | 172 |
| app/classes/building/BuildingLifecycle.ts | 42 | 155 | 199 |
| app/ui/InventoryManager.ts | 42 | 147.9 | 336 |

## Project Hygiene

| Rule | Status | Detail |
| --- | --- | --- |
| Dossiers trop charges | WARN | 5 dossier(s) avec plus de 24 fichiers TS |
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
| Crowded folders | 5 | files > 24 | 3.5 |
| Severely crowded folders | 0 | files > 48 | 0 |
| High LOC folders | 0 | LOC > 8000 | 0 |
| High branch folders | 0 | branches > 1200 | 0 |
| Deep folders | 0 | depth > 5 | 0 |
| Heavy index files | 0 | index.ts LOC > 300 | 0 |
| Naming mismatches | 0 | folder naming convention mismatch | 0 |

### Folder Refactor Candidates

| Folder | Risk | Files | LOC | Branches | Why | Suggested Split |
| --- | --- | --- | --- | --- | --- | --- |
| app/lib/units | 42 | 45 | 3704 | 1035 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/ui | 18 | 33 | 4692 | 682 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 12 | 30 | 2641 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/buildings | 6 | 27 | 1717 | 425 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/classes/unit | 2 | 25 | 4644 | 966 | file count > 24 | Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 45 | 3704 | 1035 |
| app/ui | 33 | 4692 | 682 |
| app/types | 30 | 2641 | 0 |
| app/lib/buildings | 27 | 1717 | 425 |
| app/classes/unit | 25 | 4644 | 966 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 571 |
| camelCase | 421 |
| mixed | 61 |

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
