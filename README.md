# Dawn of Empires

Isometric strategy adventure in PixiJS, with a web build via Webpack and desktop packaging via Electron.

## Requirements

- Node.js `>= 20`
- `pnpm`

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm start
```

Available alias:

```bash
pnpm dev
```

This serves the browser build only. To iterate on the desktop (Electron) build with hot-reload, without rebuilding and reinstalling the packaged app every time:

```bash
pnpm electron:dev
```

This starts the webpack dev server and an Electron window pointed at it; changes to the renderer code reload live in the window.

## Web build

```bash
pnpm build
```

For a development build:

```bash
pnpm build:dev
```

## Desktop package

```bash
pnpm dist
```

Historical alias kept for compatibility:

```bash
pnpm compile
```

## GitHub Pages deployment

```bash
pnpm deploy
```

## Tools

Format the code:

```bash
pnpm format
```

Clean the build folder:

```bash
pnpm clean
```

Run the code health check:

```bash
pnpm health
```

This refreshes `reports/code-health.md` and `reports/code-health.json`. `pnpm check`
and `pnpm audit:report` run the same full audit. A score of 80 or more is necessary
but is not sufficient: every mandatory check must pass. Tool failures, missing
measurements, skipped tests and source changes during an audit cannot produce PASS.
Failed commands retain their full output under `reports/health-logs/`.

The audit checks application and engine TypeScript, Electron entry points, and
JavaScript tools; ESLint also checks test files. It runs the behavior tests with a
five-minute limit per test file. AST analysis measures each function independently:
complexity above 15, nesting above 4 and length above 80 lines are tracked as debt.
Comments and strings do not contribute branch decisions.

Additional debt rules track `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
unhandled/misused promises, unsafe type escapes and suppression comments. Imports
from engine, classes, services, serialization, combat and unit helpers into UI or
screens are recorded, including re-exports and literal dynamic imports. Existing
violations are visible; new or worsened violations fail the regression gate.

Branch coverage includes **all** TypeScript files in combat helpers, unit helpers,
unit movement and serialization, including files never loaded by tests. Existing
per-file percentages cannot fall below the baseline; new files require 80% branch
coverage. This is targeted coverage, not whole-game or end-to-end coverage.

The checked-in `reports/health-baseline.json` is a reviewed debt reference. Normal
audits never overwrite it. To explicitly accept the current measured debt:

```bash
pnpm health:baseline --baseline-reason="Explain why this debt is accepted"
```

The initial baseline may record measured debt while behavior tests fail, provided
all other mandatory checks and coverage collection succeed on unchanged source.
Its metadata preserves the failing test status; partial coverage is a lower bound.
Tests always remain blocking. Updating an existing baseline requires passing tests
as well as every other mandatory check. This does not erase the debt or guarantee
that the overall score meets 80. Refresh the baseline after reviewed improvements
to retain the stricter limits. Unchanged function bodies can move without losing
their identity, and one existing exception cannot exempt multiple functions.

`pnpm check:quick` runs types, lint and dead-code checks without claiming a full
health verdict. `node tools/audit-report.cjs --skip-checks` and `--quick` generate
explicitly INCOMPLETE diagnostic reports and exit unsuccessfully.

## Modal UI reports

Generate screenshots of the game's modal windows and screens:

```bash
pnpm ui:png
```

Open `reports/ui-gallery/index.html` to browse the PNG captures. The export also
writes `manifest.json` with dimensions, overflows and errors. Captures use demo
data and default to 1600 × 1000 pixels.

```bash
pnpm ui:png --list
pnpm ui:png --only 02-forge,03-marche,12-dialogue
pnpm ui:png --width 1920 --height 1080 --lang en
```

`pnpm ui:gallery` only builds the interactive gallery in `build/ui-gallery`.
Use `--no-build` with `ui:png` to reuse an existing build; rebuild after code or
style changes. See [the UI gallery documentation](tools/ui-gallery/README.md).

## Interior editor

Generate and serve the interior preview and furniture editor:

```bash
pnpm interiors:preview --serve
```

Open <http://127.0.0.1:8880>. Choose a building, its level when available and the
AI layout, then enable **Modifier les meubles**. Move, add, rotate or remove
furniture, adjust the room size and click **Enregistrer pour le jeu** to save
the layout in `app/config/interiorLayoutPositions.json`. Rebuild the game to
distribute the updated layouts; furniture already stored in a save is retained.

```bash
pnpm interiors:preview --serve --port 8881
pnpm interiors:preview
```

The command without `--serve` generates `reports/interiors/index.html` for local
viewing and PNG export, but saving edits requires the server. Rerun the command
and reload the page after code or sprite changes. See
[the interior editor documentation](tools/interiors-preview/README.md).

## Economy report

Generate the economy audit from the current game data:

```bash
pnpm economy:audit
```

Open `reports/economy/index.html`. The report covers building costs, resources,
crafting, equipment, tool yields and durability, supply sources and progression
scenarios. `reports/economy/economy.json` contains the data and source fingerprints.
The audit reads the current files without modifying the game or maps.

```bash
pnpm economy:audit --map public/maps/worlds/world-test-1000/maps/world-test-1000-r0-0.map --zone-size 64
pnpm economy:audit --save /path/to/partie.json
pnpm economy:audit --capture /path/to/economy-flow.json
```

To measure a play session, open the game console with Enter and run:

```text
economy-flow start
```

After playing, inspect, stop and export the capture:

```text
economy-flow show
economy-flow stop
economy-flow export
```

Load the downloaded `economy-flow.json` in **Bilan joué** in the HTML report, or
pass it with `--capture`. Export before reloading or quitting the game: captures
are not stored in game saves. Use `--out` to change the report output folder and
`--help` for all options. See [the economy audit documentation](docs/economy-audit.md)
for measurement limits and objective timing commands.

## Useful structure

- `app/`: game source code
- `app/config/assetManifest.ts`: manifest of bundles loaded at startup
- `public/assets/`: static assets copied at build time
- `public/assets/data/`: JSON organized by domain (`gameplay/`, `civilizations/`, `technologies/`)
- `webpack.config.js` and `webpack.env.js`: build configuration and environment resolution
- `main.js`: Electron entry point

## Naming conventions

- `PascalCase.ts`: classes, screens, services, controllers, and main UI components.
- `camelCase.ts`: helpers, factories, configs, and utilities.
- `kebab-case.test.cjs`: Node tests.
- `index.ts`: a folder's public entry point, without hiding out-of-domain dependencies in it.
