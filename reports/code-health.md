# Code Health Report

Generated: 2026-08-30T22:38:00.858Z

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

- Files analyzed: 479
- Total lines: 79904
- Code lines: 71225
- Approx branches: 10914
- Approx functions/methods: 9002
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
| app/classes/building/BuildingLifecycle.ts | runtime | 187.1 | 364 | 72 | 75 | 35 | souvent modifie |
| app/lib/lpc/baked.ts | library | 179.5 | 413 | 60 | 99 | 32 | souvent modifie |
| app/controllers/HeroController.ts | runtime | 177.4 | 467 | 47 | 55 | 47 | souvent modifie |
| app/classes/players/Player.ts | runtime | 176.3 | 461 | 76 | 63 | 23 | souvent modifie |
| app/services/rest/UnitRestRules.ts | runtime | 175.6 | 364 | 105 | 29 | 3 | complexite elevee |
| app/screens/Game.ts | ui | 171.9 | 566 | 35 | 32 | 46 | souvent modifie, beaucoup de dependances |
| app/services/SpacePortalSystem.ts | runtime | 171.3 | 313 | 107 | 37 | 1 | complexite elevee |
| app/lib/combat/combatActionConditions.ts | library | 170.6 | 223 | 106 | 24 | 2 | complexite elevee |
| app/controllers/HeroCompanionHorseController.ts | runtime | 169.8 | 431 | 96 | 31 | 5 | score de risque relatif eleve |
| app/services/TributeRaidSystem.ts | runtime | 162.1 | 545 | 87 | 62 | 6 | score de risque relatif eleve |
| app/classes/map/terrain/MapTerrain.ts | runtime | 159.6 | 404 | 77 | 120 | 1 | score de risque relatif eleve |
| app/classes/map/MapGeneration.ts | runtime | 159.2 | 381 | 35 | 19 | 48 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 | 2 |
| app/services/BuildingInteriorSpaceSystem.ts | runtime | 683 | 76 | 20 |
| app/services/WeatherSystem.ts | runtime | 592 | 52 | 12 |
| app/classes/Controls.ts | runtime | 571 | 54 | 19 |
| app/ui/PlayerSetupPanel.ts | ui | 570 | 48 | 8 |
| app/screens/Game.ts | ui | 566 | 35 | 31 |
| app/classes/map/resources/MapResources.ts | runtime | 548 | 82 | 10 |
| app/classes/map/Map.ts | runtime | 547 | 21 | 20 |
| app/services/TributeRaidSystem.ts | runtime | 545 | 87 | 18 |
| app/classes/map/fog/MapFog.ts | runtime | 532 | 69 | 14 |
| app/services/PerformanceMonitor.ts | runtime | 532 | 52 | 0 |
| app/classes/Resource.ts | runtime | 509 | 51 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 748 | 2 |
| app/lib/i18n/en.ts | data/config | 420 | 9 |
| app/lib/i18n/fr.ts | data/config | 420 | 0 |
| app/lib/i18n/entityTooltips.ts | data/config | 286 | 12 |
| app/config/assetManifest.ts | data/config | 235 | 0 |
| app/config/playerConfig.ts | data/config | 224 | 16 |
| app/constants/entities.ts | data/config | 212 | 0 |
| app/constants/environments.ts | data/config | 133 | 8 |
| app/config/name/greek.ts | data/config | 102 | 0 |
| app/config/name/asian.ts | data/config | 94 | 0 |
| app/config/name/roman.ts | data/config | 86 | 0 |
| app/config/name/egyptian.ts | data/config | 79 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/services/SpacePortalSystem.ts | 107 | 37 | 313 |
| app/lib/combat/combatActionConditions.ts | 106 | 24 | 223 |
| app/services/rest/UnitRestRules.ts | 105 | 29 | 364 |
| app/classes/map/terrain/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/controllers/HeroCompanionHorseController.ts | 96 | 31 | 431 |
| app/classes/unit/movement/UnitMovementRouting.ts | 92 | 29 | 359 |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts | 87 | 64 | 137 |
| app/services/TributeRaidSystem.ts | 87 | 62 | 545 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |
| app/classes/unit/movement/UnitHeroDirectMovementCollision.ts | 83 | 30 | 314 |
| app/classes/map/resources/MapResources.ts | 82 | 48 | 548 |
| app/ai/AIEconomyFoodManager.ts | 80 | 19 | 331 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 68 | 27.8 | 23 |
| app/config/assetManifest.ts | 49 | 25.5 | 235 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/classes/map/MapGeneration.ts | 48 | 159.2 | 381 |
| app/controllers/HeroController.ts | 47 | 177.4 | 467 |
| app/screens/Game.ts | 46 | 171.9 | 566 |
| app/classes/unit/UnitActions.ts | 45 | 65.8 | 173 |
| app/serialization/SaveSerializer.ts | 40 | 122.5 | 440 |
| app/types/context.ts | 37 | 81.9 | 317 |
| app/types/save.ts | 36 | 80 | 320 |
| app/classes/building/BuildingLifecycle.ts | 35 | 187.1 | 364 |
| app/lib/lpc/baked.ts | 32 | 179.5 | 413 |

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
| PascalCase | 246 |
| camelCase | 233 |

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
