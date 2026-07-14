# Dawn of Empires

Isometric RTS in PixiJS, with a web build via Webpack and desktop packaging via Electron.

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
