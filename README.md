# Dawn of Empires

RTS isométrique en PixiJS avec build web via Webpack et packaging desktop via Electron.

## Prérequis

- Node.js `>= 20`
- `pnpm`

## Installation

```bash
pnpm install
```

## Développement

```bash
pnpm start
```

Alias disponible :

```bash
pnpm dev
```

## Build web

```bash
pnpm build
```

Pour un build de développement :

```bash
pnpm build:dev
```

## Package desktop

```bash
pnpm dist
```

Alias historique conservé :

```bash
pnpm compile
```

## Déploiement GitHub Pages

```bash
pnpm deploy
```

## Outils

Formater le code :

```bash
pnpm format
```

Nettoyer le dossier de build :

```bash
pnpm clean
```

## Structure utile

- `app/` : code source du jeu
- `app/config/assetManifest.ts` : manifest des bundles chargés au démarrage
- `public/assets/` : assets statiques copiés au build
- `public/assets/data/` : JSON organisés par domaine (`gameplay/`, `civilizations/`, `technologies/`)
- `webpack.config.js` et `webpack.env.js` : configuration et résolution d’environnement du build
- `main.js` : point d’entrée Electron

## Conventions de nommage

- `PascalCase.ts` : classes, écrans, services, contrôleurs et composants UI principaux.
- `camelCase.ts` : helpers, factories, configurations et utilitaires.
- `kebab-case.test.cjs` : tests Node.
- `index.ts` : point d’entrée public d’un dossier, sans y cacher des dépendances hors domaine.
