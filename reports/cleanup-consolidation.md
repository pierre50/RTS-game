# Cleanup Consolidation

Generated: 2026-08-24

## Scope

This cleanup pass focused on stabilizing tests, removing permanent debug noise, adding code-health tooling, and reducing the largest TypeScript hotspots through low-risk extractions.

## Validation

All project gates are currently green:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | OK |
| `pnpm lint` | OK |
| `pnpm duplication` | OK, 0 clones |
| `pnpm audit:report` | OK |
| `pnpm test` | OK, 651/651 |

## Code Health Snapshot

Latest audit score: **65/100 (D)**.

The score is still limited by structure and hotspots, but the automated gates are now clean:

| Component | Score |
| --- | --- |
| Gates | 30/30 |
| Duplication | 25/25 |
| Structure | 0/25 |
| Hotspots | 0/10 |
| Type/Lint confidence | 10/10 |

## Measured Size Changes

Compared with the initial hotspot list:

| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `app/classes/map/MapGeneration.ts` | 2006 | 1093 | -913 |
| `app/classes/unit/index.ts` | 1608 | 1264 | -344 |
| `app/classes/unit/UnitMovement.ts` | 1412 | 1134 | -278 |
| `app/classes/unit/UnitActions.ts` | 1358 | 1073 | -285 |
| `app/lib/heroTools.ts` | 1612 | 1369 | -243 |
| `app/screens/Game.ts` | 1253 | 1163 | -90 |

Total reduction across these original hotspots: **-2153 lines**.

New extracted modules:

| File | Lines | Purpose |
| --- | ---: | --- |
| `app/classes/map/MapTerrainGeneration.ts` | 390 | Terrain generation algorithms extracted from map generation |
| `app/classes/unit/UnitAppearanceLayers.ts` | 225 | Unit carried/equipment appearance layers |
| `app/classes/unit/UnitBanditDebug.ts` | 165 | Bandit/unit debug helpers behind flags |
| `app/classes/unit/UnitMovementDebug.ts` | 145 | Movement debug helpers behind flags |

## Main Changes

- Added a repeatable audit command: `pnpm audit:report`.
- Added duplication scanning: `pnpm duplication`, currently 0 duplicated clones.
- Fixed dead-code/lint issues and kept TypeScript clean.
- Stabilized CJS test loaders/mocks after TypeScript module extraction.
- Fixed isolated regressions around campaign save, unit experience, bandit camp tooltip behavior, animal attack frames, and water border animation.
- Moved permanent debug logs behind explicit debug flags.
- Split large methods/modules without changing public behavior where possible.

## Current Top Hotspots

From `reports/code-health.md`:

| Rank | File | Risk |
| ---: | --- | ---: |
| 1 | `app/classes/unit/UnitMovement.ts` | 641.6 |
| 2 | `app/classes/map/MapTerrain.ts` | 586.4 |
| 3 | `app/classes/unit/UnitActions.ts` | 530.4 |
| 4 | `app/lib/heroTools.ts` | 500.2 |
| 5 | `app/controllers/HeroController.ts` | 478.2 |

## Commit Preparation Notes

Include in the cleanup commit:

- `app/classes/animal/AnimalCombat.ts`
- `app/classes/animal/index.ts`
- `app/classes/map/MapGeneration.ts`
- `app/classes/map/MapTerrainGeneration.ts`
- `app/classes/unit/UnitActions.ts`
- `app/classes/unit/UnitAppearanceLayers.ts`
- `app/classes/unit/UnitBanditDebug.ts`
- `app/classes/unit/UnitMovement.ts`
- `app/classes/unit/UnitMovementDebug.ts`
- `app/classes/unit/index.ts`
- `reports/code-health.json`
- `reports/code-health.md`
- `reports/cleanup-consolidation.md`
- `tests/animal-combat.test.cjs`
- `tests/movement-actions.test.cjs`
- `tests/unit-movement-work-sync.test.cjs`
- `tools/generate-maps.cjs`

Review separately before staging:

- `public/haven.mid`
- `public/main_theme_v2.mid`

These MIDI files are untracked and do not appear to be part of the cleanup/refactor work.

## Recommended Next Step

Stop broad refactoring for now. Commit this stabilized cleanup as one coherent batch, then pick a single next target in a separate branch or commit. The best next target by audit signal is `app/classes/map/MapTerrain.ts`.
