# Code Health Report

Generated: 2026-10-02T23:56:02.783Z

## Global Score

**77/100 (C)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **INCOMPLETE**.

| Component | Score |
| --- | --- |
| Gates | 17/25 |
| Duplication | 20/20 |
| Structure | 17/20 |
| Architecture | 15/15 |
| Hotspots | 8/10 |
| Tests and critical coverage | 0/10 |

> The score is an indicator, not a certification. Every required check must pass, no cycle or duplication is allowed, and quality debt must not regress. Missing measurements make the audit INCOMPLETE.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 17/25 | 8 |
| Duplication | 20/20 | 0 |
| Structure | 17/20 | 3 |
| Architecture | 15/15 | 0 |
| Hotspots | 8/10 | 2 |
| Tests and critical coverage | 0/10 | 10 |

Largest score loss: **Tests and critical coverage (10 points)**. Gate blockers: Dead code: fail; Behavior tests: fail; Source consistency: error; Quality regressions: fail; 1262 new or worsened debt finding(s); Score 77 below 80.

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 0 | Not reachable through hotspots alone |
| 95+ | 0 | Not reachable through hotspots alone |
| 100+ | 0 | Not reachable through hotspots alone |

## Summary

- Files analyzed: 1039
- Total lines: 128728
- Code lines: 118734
- AST branch decisions: 26607
- AST functions/methods: 10236
- Duplication: 0 clones, 0%
- Import cycles: 0 cycles / baseline 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | PASS |  |
| TypeScript | PASS |  |
| Duplication | PASS | 0 clones, 0% |
| Dead code | FAIL | Command exited with 1 |
| Import cycles | PASS | 0 cycles / baseline gate 0 |
| Typed async rules | PASS |  |
| Behavior tests | FAIL | Command exited with 1 |
| Critical branch coverage | PASS |  |
| Source consistency | ERROR | Source files changed during the audit; rerun on a stable checkout |
| Quality regressions | FAIL |  |

## Regression Control

Baseline: loaded. Existing debt: **2141**. New or worsened findings: **1262**.

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

Branch coverage: **80.85%** (5673/7016). All files in the configured critical domains are included, including files never loaded by tests. Existing per-file coverage cannot decrease; new files require 80% branch coverage.

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
| app/controllers/HeroControllerUpdate.ts:86 updateHeroControllerRuntime | 64 | 3 | 156 |
| tools/maps/LocalMapRelief.ts:10 normalizeLocalMapRelief | 58 | 5 | 139 |
| app/classes/map/generation/BlueprintResourceLoading.ts:38 loadBlueprintResourceBatches | 54 | 4 | 111 |
| app/serialization/validation/PlayerRecordValidation.ts:113 validatePlayerBuildings | 54 | 4 | 109 |
| app/services/VillagerAutonomySystem.ts:141 VillagerAutonomySystem.check | 54 | 2 | 79 |
| app/services/world/offline/OfflineWorldWork.ts:38 advanceOfflineWorker | 54 | 3 | 153 |
| app/lib/npc/npcRoutineChatter.ts:27 pickNpcRoutineChatterLine | 52 | 4 | 68 |
| app/services/visibility/UnitPerception.ts:100 updateVisibilityNow | 51 | 4 | 96 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/ui/NpcOrdersManager.ts | ui | 276.6 | 479 | 82 | 122 | 34 | souvent modifie, beaucoup de dependances |
| app/services/tutorial/TutorialOpening.ts | runtime | 244.2 | 351 | 112 | 153 | 3 | complexite elevee |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 231.1 | 699 | 114 | 122 | 3 | complexite elevee |
| app/serialization/ZonedSaveFormat.ts | app | 231.1 | 256 | 107 | 149 | 3 | complexite elevee |
| app/controllers/HeroController.ts | runtime | 219.7 | 493 | 66 | 59 | 53 | souvent modifie |
| app/classes/players/Player.ts | runtime | 215.9 | 329 | 79 | 56 | 38 | souvent modifie, beaucoup de dependances |
| app/screens/Game.ts | ui | 208.7 | 551 | 39 | 44 | 58 | souvent modifie, beaucoup de dependances |
| app/services/world/VillageWorkSimulation.ts | runtime | 208.5 | 314 | 90 | 147 | 4 | score de risque relatif eleve |
| app/screens/game/BuildingInteriorExitRouting.ts | ui | 208.3 | 350 | 119 | 54 | 7 | complexite elevee |
| app/services/wildlife/WildlifeSystem.ts | runtime | 208.3 | 309 | 106 | 132 | 0 | complexite elevee |
| app/classes/Resource.ts | runtime | 208.1 | 500 | 72 | 85 | 40 | souvent modifie |
| app/classes/unit/UnitCaptureHorseAction.ts | runtime | 205.7 | 355 | 90 | 131 | 7 | score de risque relatif eleve |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

| File | Kind | Risk | Why | Exit Target |
| --- | --- | --- | --- | --- |
| app/ui/NpcOrdersManager.ts | ui | 276.6 | branches >= 80, churn >= 8 | branches < 80 |
| app/lib/npc/npcInteraction.ts | library | 173.3 | branches >= 80, churn >= 8 | branches < 80 |

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 718 | 2 | 3 |
| app/services/weather/WeatherSystem.ts | runtime | 718 | 92 | 16 |
| app/classes/map/terrain/MapTerrainBake.ts | runtime | 699 | 114 | 16 |
| app/classes/players/AIPlayer.ts | runtime | 575 | 67 | 23 |
| app/services/PerformanceMonitor.ts | runtime | 575 | 70 | 0 |
| app/lib/entities/spriteFragmentBurst.ts | library | 558 | 68 | 5 |
| app/lib/audio/settings.ts | library | 555 | 46 | 2 |
| app/screens/Game.ts | ui | 551 | 39 | 37 |
| app/classes/HeroCatchingPoleThrow.ts | runtime | 546 | 89 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 545 | 52 | 15 |
| app/classes/map/Map.ts | runtime | 542 | 22 | 21 |
| app/services/lighting/LightSystem.ts | runtime | 539 | 90 | 9 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 718 | 2 |
| app/lib/i18n/fr.ts | data/config | 443 | 0 |
| app/lib/i18n/en.ts | data/config | 439 | 0 |
| app/serialization/entity/EntitySaveData.ts | data/config | 417 | 41 |
| app/constants/entities.ts | data/config | 325 | 0 |
| app/lib/i18n/questTranslations.ts | data/config | 265 | 0 |
| app/config/assetManifest.ts | data/config | 218 | 0 |
| app/config/playerConfig.ts | data/config | 210 | 15 |
| app/lib/i18n/entityNames.ts | data/config | 189 | 0 |
| app/lib/i18n/entityDetails.ts | data/config | 181 | 0 |
| app/lib/i18n/heroTranslations.ts | data/config | 176 | 0 |
| app/lib/i18n/craftingTranslations.ts | data/config | 129 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/screens/game/BuildingInteriorExitRouting.ts | 119 | 54 | 350 |
| app/services/spacePortal/SpacePortalSystem.ts | 117 | 43 | 362 |
| app/services/VillageActivitySystem.ts | 115 | 91 | 333 |
| app/classes/map/terrain/MapTerrainBake.ts | 114 | 122 | 699 |
| app/dev-console/actions/DebugMapRenderers.ts | 112 | 92 | 461 |
| app/services/tutorial/TutorialOpening.ts | 112 | 153 | 351 |
| app/lib/housing/households.ts | 108 | 73 | 253 |
| app/serialization/ZonedSaveFormat.ts | 107 | 149 | 256 |
| app/classes/resources/CompactResourceSet.ts | 106 | 27 | 505 |
| app/services/wildlife/WildlifeSystem.ts | 106 | 132 | 309 |
| app/services/world/distantVillages/DistantVillageSystem.ts | 106 | 85 | 318 |
| tools/health/analyze.cjs | 103 | 115 | 290 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 65 | 26.6 | 24 |
| app/screens/Game.ts | 58 | 208.7 | 551 |
| app/config/assetManifest.ts | 57 | 28.3 | 218 |
| app/serialization/SaveSerializer.ts | 56 | 202.7 | 236 |
| app/types/save.ts | 56 | 131.3 | 533 |
| app/types/context.ts | 56 | 121.4 | 374 |
| app/controllers/HeroController.ts | 53 | 219.7 | 493 |
| app/classes/map/MapGeneration.ts | 53 | 200.4 | 381 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/unit/UnitActions.ts | 45 | 73.3 | 172 |
| app/classes/building/BuildingLifecycle.ts | 44 | 159 | 201 |
| app/classes/Resource.ts | 40 | 208.1 | 500 |

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
| app/ui | 16 | 32 | 4614 | 656 | file count > 24 | Group related UI panels and overlays into feature folders. |
| app/types | 12 | 30 | 2637 | 0 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/lib/buildings | 8 | 28 | 1739 | 427 | file count > 24 | Split files by feature/domain until the folder has a clear single responsibility. |
| app/classes/unit | 2 | 25 | 4644 | 966 | file count > 24 | Keep Unit as composition root; move movement, actions, resources, experience, and runtime state into narrow modules. |

### Crowded Folders

| Folder | Files | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/units | 45 | 3704 | 1035 |
| app/ui | 32 | 4614 | 656 |
| app/types | 30 | 2637 | 0 |
| app/lib/buildings | 28 | 1739 | 427 |
| app/classes/unit | 25 | 4644 | 966 |

### Naming Styles

| Style | Files |
| --- | --- |
| PascalCase | 560 |
| camelCase | 419 |
| mixed | 60 |

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
