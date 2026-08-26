# Code Health Report

Generated: 2026-08-26T18:16:24.292Z

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

- Files analyzed: 415
- Total lines: 67704
- Code lines: 60215
- Approx branches: 8998
- Approx functions/methods: 7648
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
| app/ai/AIStrategy.ts | app | 163.6 | 363 | 79 | 48 | 18 | souvent modifie |
| app/services/TributeRaidSystem.ts | runtime | 163 | 580 | 97 | 62 | 1 | score de risque relatif eleve |
| app/ui/ActionSpecFactory.ts | ui | 161.5 | 432 | 69 | 99 | 16 | souvent modifie |
| app/lib/combat/combatActionConditions.ts | library | 160 | 220 | 103 | 24 | 0 | complexite elevee |
| app/classes/map/terrain/MapTerrain.ts | runtime | 157.6 | 404 | 77 | 120 | 0 | score de risque relatif eleve |
| app/classes/building/BuildingLifecycle.ts | runtime | 157 | 320 | 62 | 74 | 28 | souvent modifie |
| app/screens/Game.ts | ui | 155.6 | 580 | 29 | 45 | 41 | souvent modifie, beaucoup de dependances |
| app/classes/map/MapGeneration.ts | runtime | 155.2 | 381 | 35 | 19 | 46 | souvent modifie |
| app/classes/map/terrain/MapTerrainGeneration.ts | runtime | 153.8 | 391 | 96 | 63 | 0 | score de risque relatif eleve |
| app/classes/Projectile.ts | runtime | 151.4 | 426 | 33 | 124 | 28 | souvent modifie |
| app/lib/lpc/baked.ts | library | 151.3 | 284 | 46 | 99 | 30 | souvent modifie |
| app/classes/players/Player.ts | runtime | 150.6 | 429 | 65 | 62 | 20 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 739 | 2 | 2 |
| app/ui/PlayerSetupPanel.ts | ui | 592 | 51 | 7 |
| app/services/WeatherSystem.ts | runtime | 586 | 44 | 12 |
| app/screens/Game.ts | ui | 580 | 29 | 33 |
| app/services/TributeRaidSystem.ts | runtime | 580 | 97 | 16 |
| app/ui/InventoryManager.ts | ui | 580 | 59 | 17 |
| app/classes/map/fog/MapFog.ts | runtime | 554 | 69 | 13 |
| app/classes/map/resources/MapResources.ts | runtime | 548 | 82 | 10 |
| app/classes/Controls.ts | runtime | 524 | 36 | 18 |
| app/classes/map/Map.ts | runtime | 522 | 17 | 19 |
| app/services/PerformanceMonitor.ts | runtime | 513 | 47 | 0 |
| app/classes/Resource.ts | runtime | 502 | 50 | 13 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 739 | 2 |
| app/lib/i18n/en.ts | data/config | 399 | 8 |
| app/lib/i18n/fr.ts | data/config | 399 | 0 |
| app/config/assetManifest.ts | data/config | 289 | 0 |
| app/lib/i18n/entityTooltips.ts | data/config | 284 | 11 |
| app/config/playerConfig.ts | data/config | 206 | 13 |
| app/constants/entities.ts | data/config | 195 | 0 |
| app/constants/environments.ts | data/config | 133 | 8 |
| app/config/name/greek.ts | data/config | 102 | 0 |
| app/config/name/asian.ts | data/config | 94 | 0 |
| app/config/name/roman.ts | data/config | 86 | 0 |
| app/config/name/egyptian.ts | data/config | 79 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/lib/combat/combatActionConditions.ts | 103 | 24 | 220 |
| app/services/TributeRaidSystem.ts | 97 | 62 | 580 |
| app/classes/map/terrain/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts | 87 | 64 | 137 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |
| app/classes/map/resources/MapResources.ts | 82 | 48 | 548 |
| app/ai/AIEconomyFoodManager.ts | 80 | 19 | 331 |
| app/classes/map/terrain/MapTerrainReliefContinuity.ts | 80 | 35 | 252 |
| app/lib/units/villagerAutonomy.ts | 80 | 48 | 241 |
| app/ai/AIStrategy.ts | 79 | 48 | 363 |
| app/classes/unit/movement/UnitMovementRouting.ts | 79 | 26 | 276 |
| app/classes/map/terrain/MapTerrain.ts | 77 | 120 | 404 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 66 | 26.8 | 17 |
| app/lib/i18n/translations.ts | 48 | 19.4 | 8 |
| app/classes/map/MapGeneration.ts | 46 | 155.2 | 381 |
| app/classes/unit/UnitActions.ts | 45 | 65.8 | 173 |
| app/config/assetManifest.ts | 45 | 25.2 | 289 |
| app/screens/Game.ts | 41 | 155.6 | 580 |
| app/controllers/HeroController.ts | 41 | 141.5 | 400 |
| app/serialization/SaveSerializer.ts | 35 | 100.8 | 392 |
| app/types/save.ts | 33 | 73.8 | 311 |
| app/types/context.ts | 31 | 19.3 | 275 |
| app/lib/lpc/baked.ts | 30 | 151.3 | 284 |
| app/classes/unit/UnitCombat.ts | 29 | 131.5 | 238 |

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
| PascalCase | 209 |
| camelCase | 206 |

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
