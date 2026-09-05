# Code Health Report

Generated: 2026-09-05T21:20:58.687Z

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

- Files analyzed: 515
- Total lines: 86311
- Code lines: 76995
- Approx branches: 11956
- Approx functions/methods: 9669
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
| app/classes/building/BuildingLifecycle.ts | runtime | 204.9 | 415 | 75 | 79 | 41 | souvent modifie |
| app/controllers/HeroController.ts | runtime | 197 | 491 | 57 | 59 | 49 | souvent modifie |
| app/lib/combat/combatActionConditions.ts | library | 195 | 239 | 116 | 24 | 5 | complexite elevee |
| app/classes/building/BuildingProduction.ts | runtime | 188.2 | 428 | 77 | 58 | 31 | souvent modifie |
| app/screens/Game.ts | ui | 187.3 | 599 | 37 | 34 | 50 | souvent modifie, beaucoup de dependances |
| app/services/rest/UnitRestRules.ts | runtime | 184.7 | 366 | 105 | 29 | 6 | complexite elevee |
| app/lib/lpc/baked.ts | library | 181.5 | 413 | 60 | 99 | 33 | souvent modifie |
| app/classes/players/Player.ts | runtime | 179.7 | 469 | 76 | 67 | 24 | souvent modifie, beaucoup de dependances |
| app/services/SpacePortalSystem.ts | runtime | 174.6 | 322 | 107 | 37 | 2 | complexite elevee |
| app/controllers/HeroCompanionHorseController.ts | runtime | 172.8 | 431 | 96 | 31 | 6 | score de risque relatif eleve |
| app/services/TributeRaidSystem.ts | runtime | 170 | 560 | 90 | 62 | 7 | score de risque relatif eleve |
| app/classes/Controls.ts | runtime | 167 | 599 | 60 | 78 | 31 | souvent modifie |

## Score Moves

These files currently count against the hotspot score. Clear a hotspot by reducing the listed exit target while keeping churn unchanged.

No risky hotspots currently count against the score.

## Largest Files

| File | Kind | LOC | Branches | Imports |
| --- | --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 750 | 2 | 3 |
| app/classes/Controls.ts | runtime | 599 | 60 | 20 |
| app/screens/Game.ts | ui | 599 | 37 | 34 |
| app/services/weather/WeatherSystem.ts | runtime | 594 | 54 | 12 |
| app/classes/map/resources/MapResources.ts | runtime | 577 | 83 | 11 |
| app/ui/PlayerSetupPanel.ts | ui | 570 | 48 | 8 |
| app/services/TributeRaidSystem.ts | runtime | 560 | 90 | 17 |
| app/classes/map/Map.ts | runtime | 549 | 21 | 20 |
| app/ui/minimap/MinimapManager.ts | ui | 538 | 72 | 7 |
| app/classes/map/fog/MapFog.ts | runtime | 532 | 69 | 14 |
| app/lib/combat/combatFeedback.ts | library | 531 | 73 | 9 |
| app/services/PerformanceMonitor.ts | runtime | 531 | 52 | 0 |

## Data And Config Files

Large data/config/type-heavy files are useful to track, but they should not drive the same refactor decisions as gameplay/runtime files.

| File | Kind | LOC | Branches |
| --- | --- | --- | --- |
| app/lib/lpc/equipmentData.ts | data/config | 750 | 2 |
| app/lib/i18n/en.ts | data/config | 461 | 9 |
| app/lib/i18n/fr.ts | data/config | 461 | 0 |
| app/lib/i18n/entityTooltips.ts | data/config | 288 | 12 |
| app/config/assetManifest.ts | data/config | 244 | 0 |
| app/config/playerConfig.ts | data/config | 224 | 16 |
| app/constants/entities.ts | data/config | 224 | 1 |
| app/constants/environments.ts | data/config | 133 | 8 |
| app/config/name/hellas.ts | data/config | 108 | 0 |
| app/config/name/latium.ts | data/config | 103 | 0 |
| app/config/name/xia.ts | data/config | 98 | 0 |
| app/config/name/kemet.ts | data/config | 79 | 0 |

## Complexity Signals

| File | Branches | Max Block | LOC |
| --- | --- | --- | --- |
| app/lib/combat/combatActionConditions.ts | 116 | 24 | 239 |
| app/services/SpacePortalSystem.ts | 107 | 37 | 322 |
| app/services/rest/UnitRestRules.ts | 105 | 29 | 366 |
| app/classes/map/terrain/MapTerrainGeneration.ts | 96 | 63 | 391 |
| app/controllers/HeroCompanionHorseController.ts | 96 | 31 | 431 |
| app/classes/unit/movement/UnitMovementRoutingRuntime.ts | 90 | 31 | 368 |
| app/services/TributeRaidSystem.ts | 90 | 62 | 560 |
| app/classes/map/terrain/MapTerrainReliefAppearance.ts | 87 | 64 | 137 |
| app/screens/game/BuildingInteriorExitRouting.ts | 85 | 60 | 347 |
| app/classes/players/PlayerTechnologies.ts | 84 | 48 | 298 |
| app/lib/resources/playerResourceTotals.ts | 84 | 20 | 275 |
| app/classes/map/resources/MapResources.ts | 83 | 48 | 577 |

## Git Hotspots

| File | Churn 90d | Risk | LOC |
| --- | --- | --- | --- |
| app/types/entities.ts | 69 | 28.2 | 24 |
| app/config/assetManifest.ts | 51 | 26.5 | 244 |
| app/screens/Game.ts | 50 | 187.3 | 599 |
| app/controllers/HeroController.ts | 49 | 197 | 491 |
| app/lib/i18n/translations.ts | 49 | 19.8 | 8 |
| app/classes/map/MapGeneration.ts | 48 | 159.2 | 381 |
| app/classes/unit/UnitActions.ts | 46 | 68.2 | 176 |
| app/serialization/SaveSerializer.ts | 44 | 132.4 | 457 |
| app/types/context.ts | 43 | 94.5 | 339 |
| app/classes/building/BuildingLifecycle.ts | 41 | 204.9 | 415 |
| app/types/save.ts | 40 | 88.2 | 327 |
| app/dev-console/types.ts | 34 | 76.6 | 342 |

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
| PascalCase | 263 |
| camelCase | 252 |

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
