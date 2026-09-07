# Code Health Report

Generated: 2026-09-07T22:05:09.853Z

## Global Score

**100/100 (A)**

Minimum required score: **80/100**. Target score: **90/100**. Quality gate: **PASS**.

| Component | Score |
| --- | --- |
| Gates | 25/25 |
| Duplication | 20/20 |
| Structure | 20/20 |
| Architecture | 15/15 |
| Hotspots | 10/10 |
| Type/Lint confidence | 10/10 |

> Architecture is scored separately from the baseline gate: staying at or below the baseline keeps the check green, but existing cycles still reduce the global quality score.

## Why Not Higher?

| Component | Score | Lost |
| --- | --- | --- |
| Gates | 25/25 | 0 |
| Duplication | 20/20 | 0 |
| Structure | 20/20 | 0 |
| Architecture | 15/15 | 0 |
| Hotspots | 10/10 | 0 |
| Type/Lint confidence | 10/10 | 0 |

Main blocker: **0 risky hotspot(s)**. The hotspot score is **10/10**, so this is the current ceiling.

| Target Score | Max Risky Hotspots | Hotspots To Clear |
| --- | --- | --- |
| 91+ | 11 | 0 |
| 95+ | 6 | 0 |
| 100+ | 0 | 0 |

## Summary

- Files analyzed: 542
- Total lines: 89886
- Code lines: 80278
- Approx branches: 12521
- Approx functions/methods: 9994
- Duplication: 0 clones, 0%
- Import cycles: 0 cycles / baseline 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| ESLint | OK |  |
| TypeScript | OK |  |
| Duplication | OK | 0 clones, 0% |
| Dead code | OK |  |
| Import cycles | OK | 0 cycles / baseline gate 0 |

## Top Priorities

| File | Kind | Risk | LOC | Branches | Max Block | Churn 90d | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| app/lib/combat/combatActionConditions.ts | library | 205.8 | 251 | 119 | 24 | 7 | complexite elevee |
| app/classes/building/BuildingLifecycle.ts | runtime | 204.9 | 415 | 75 | 79 | 41 | souvent modifie |
| app/screens/Game.ts | ui | 200.7 | 579 | 42 | 34 | 52 | souvent modifie, beaucoup de dependances |
| app/controllers/HeroController.ts | runtime | 197 | 491 | 57 | 59 | 49 | souvent modifie |
| app/classes/building/BuildingProduction.ts | runtime | 193.7 | 429 | 78 | 58 | 33 | souvent modifie |
| app/classes/players/Player.ts | runtime | 189.1 | 497 | 77 | 75 | 27 | souvent modifie, beaucoup de dependances |
| app/classes/map/resources/MapResources.ts | runtime | 187.7 | 728 | 105 | 52 | 4 | complexite elevee |
| app/lib/lpc/baked.ts | library | 183.5 | 413 | 60 | 99 | 34 | souvent modifie |
| app/classes/map/terrain/MapTerrain.ts | runtime | 178.3 | 414 | 87 | 123 | 1 | score de risque relatif eleve |
| app/services/SpacePortalSystem.ts | runtime | 174.6 | 322 | 107 | 37 | 2 | complexite elevee |
| app/controllers/HeroCompanionHorseController.ts | runtime | 172.8 | 431 | 96 | 31 | 6 | score de risque relatif eleve |
| app/classes/Controls.ts | runtime | 167 | 599 | 60 | 78 | 31 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 750 | 2 | 3 |
| app/classes/map/resources/MapResources.ts | runtime | 728 | 105 | 13 |
| app/ui/minimap/MinimapManager.ts | ui | 639 | 82 | 8 |
| app/services/weather/WeatherSystem.ts | runtime | 638 | 58 | 13 |
| app/classes/Controls.ts | runtime | 599 | 60 | 20 |
| app/screens/Game.ts | ui | 579 | 42 | 36 |
| app/classes/map/Map.ts | runtime | 575 | 21 | 22 |
| app/ui/PlayerSetupPanel.ts | ui | 570 | 48 | 8 |
| app/classes/map/fog/MapFog.ts | runtime | 547 | 74 | 14 |
| app/classes/Resource.ts | runtime | 539 | 54 | 15 |
| app/lib/combat/combatFeedback.ts | library | 531 | 73 | 9 |
| app/services/PerformanceMonitor.ts | runtime | 531 | 52 | 0 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 750 | 2 |
| app/lib/i18n/en.ts | data/config | 527 | 22 |
| app/lib/i18n/fr.ts | data/config | 527 | 0 |
| app/lib/i18n/entityTooltips.ts | data/config | 302 | 12 |
| app/constants/entities.ts | data/config | 273 | 1 |
| app/config/assetManifest.ts | data/config | 240 | 0 |
| app/config/playerConfig.ts | data/config | 227 | 17 |
| app/constants/environments.ts | data/config | 151 | 8 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |
| app/config/gameplay.ts | data/config | 91 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/lib/combat/combatActionConditions.ts | 119 | 24 | 251 |
| app/services/SpacePortalSystem.ts | 107 | 37 | 322 |
| app/classes/map/resources/MapResources.ts | 105 | 52 | 728 |
| app/classes/map/terrain/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/controllers/HeroCompanionHorseController.ts | 96 | 31 | 431 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 92 | 31 | 371 |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts | 90 | 65 | 139 |
| app/classes/map/terrain/MapTerrain.ts | 87 | 123 | 414 |
| app/classes/map/terrain/MapTerrainReliefContinuity.ts | 87 | 35 | 259 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 87 | 30 | 316 |
| app/screens/game/BuildingInteriorExitRouting.ts | 85 | 60 | 348 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/config/assetManifest.ts | 54 | 27.6 | 240 |
| app/screens/Game.ts | 52 | 200.7 | 579 |
| app/classes/map/MapGeneration.ts | 50 | 161.9 | 377 |
| app/controllers/HeroController.ts | 49 | 197 | 491 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/serialization/SaveSerializer.ts | 48 | 140.5 | 460 |
| app/types/context.ts | 47 | 102.7 | 349 |
| app/classes/unit/UnitActions.ts | 46 | 68.2 | 176 |
| app/types/save.ts | 44 | 96.8 | 350 |
| app/classes/building/BuildingLifecycle.ts | 41 | 204.9 | 415 |
| app/classes/unit/UnitCombat.ts | 35 | 160.9 | 277 |

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
| PascalCase | 284 |
| camelCase | 258 |

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

- Complexity is an approximation based on branch keywords/operators; use it as a prioritization signal.
- Churn is based on Git commits from the last 90 days.
- Import-cycle baseline avoids making existing architecture debt fail the audit, while preventing regressions.
- The score is intentionally project-local: it rewards passing checks, low duplication, smaller modules, and lower-risk hotspots.
