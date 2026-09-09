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
