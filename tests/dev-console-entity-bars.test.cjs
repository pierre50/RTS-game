const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadDebugActions(overrides = {}) {
  const filename = path.join(__dirname, '../app/dev-console/actions/debug.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': { Text: class {} },
    '../../constants': {
      ACTION_TYPES: {},
      CELL_HEIGHT: 16,
      CELL_WIDTH: 32,
      FAMILY_TYPES: { animal: 'animal', resource: 'resource', unit: 'unit' },
      PLAYER_TYPES: {},
      UNIT_TYPES: {},
    },
    '../../ai/unitGroups': {
      classifyMilitaryUnits: () => ({ archers: [], cavalry: [], infantry: [], siege: [] }),
      isAliveUnit: unit => !unit?.isDead,
    },
    '../../lib': {
      canPlayerStillAct: () => true,
      drawRoundedIsoShape: () => {},
      getGaiaAnimals: () => [],
      getRoundedIsoFootprintPoints: () => [],
      getReliefOffset: () => 0,
      isPlayerEliminated: () => false,
      parseTextureRef: texture => texture,
    },
    '../../lib/entities/entityHealthDisplay': { syncEntityHealthDisplay: () => {} },
    './DebugMapRenderers': {
      drawCoordsDebug: () => {},
      drawGridDebug: () => {},
      drawHeroAimDebug: () => {},
      drawHeroCollisionDebug: () => {},
      drawPathDebug: () => {},
      drawSolidDebug: () => {},
      drawTerrainFrameDebug: () => {},
      drawVisionDebug: () => {},
    },
    './DebugOverlayRenderers': {
      ensureAiInfoOverlay: () => {},
      ensurePerfOverlay: () => {},
      ensurePlayerStatsOverlay: () => {},
      isAiDebugPlayer: player => player.type === 'ai',
    },
    './shared': {
      DEBUG_COORDS_LAYER: 'debug-coords',
      DEBUG_GRID_LAYER: 'debug-grid',
      DEBUG_HERO_AIM_LAYER: 'debug-hero-aim',
      DEBUG_HERO_COLLISION_LAYER: 'debug-hero-collision',
      DEBUG_OVERLAY_Z: 1000,
      DEBUG_PATH_LAYER: 'debug-path',
      DEBUG_SOLID_LAYER: 'debug-solid',
      DEBUG_TERRAIN_FRAME_LAYER: 'debug-terrain-frame',
      DEBUG_VISION_LAYER: 'debug-vision',
      addDebugTicker: () => {},
      drawCellDiamond: () => {},
      drawCellStroke: () => {},
      getCameraCells: () => [],
      getDebugContainer: () => ({ removeChildren: () => [] }),
      getDebugLayer: () => ({ clear: () => {} }),
      getSolidDebugColor: () => 0,
      normalizeToggle: (value, current) => (value === 'on' ? true : value === 'off' ? false : !current),
      removeDebugLayer: () => {},
      stopDebugTicker: () => {},
      ...overrides.shared,
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('entity-bars off preserves gameplay health bars on player units', () => {
  const calls = []
  const { toggleEntityBars } = loadDebugActions({
    shared: {
      stopDebugTicker: (_context, key) => calls.push(['stopDebugTicker', key]),
    },
  })
  const context = {
    map: { debugEntityBarsVisible: true, gaia: { units: [], animals: [] } },
    players: [
      {
        units: [
          {
            label: 'player-unit',
            selected: false,
            shouldKeepHealthBarVisible: () => {
              calls.push(['player-unit', 'shouldKeepHealthBarVisible', context.map.debugEntityBarsVisible])
              return !context.map.debugEntityBarsVisible
            },
            drawHealthBar: () => calls.push(['player-unit', 'drawHealthBar']),
            removeHealthBar: () => calls.push(['player-unit', 'removeHealthBar']),
            removeEnergyBar: () => calls.push(['player-unit', 'removeEnergyBar']),
          },
          {
            label: 'debug-only-unit',
            selected: false,
            shouldKeepHealthBarVisible: () => {
              calls.push(['debug-only-unit', 'shouldKeepHealthBarVisible', context.map.debugEntityBarsVisible])
              return false
            },
            drawHealthBar: () => calls.push(['debug-only-unit', 'drawHealthBar']),
            removeHealthBar: () => calls.push(['debug-only-unit', 'removeHealthBar']),
            removeEnergyBar: () => calls.push(['debug-only-unit', 'removeEnergyBar']),
          },
        ],
        buildings: [],
        animals: [],
      },
    ],
  }

  const result = toggleEntityBars(context, 'off')

  assert.deepEqual(result, { ok: true, message: 'Entity bars: off' })
  assert.equal(context.map.debugEntityBarsVisible, false)
  assert.deepEqual(calls, [
    ['stopDebugTicker', '_debugEntityBarsTicker'],
    ['player-unit', 'removeEnergyBar'],
    ['player-unit', 'shouldKeepHealthBarVisible', false],
    ['player-unit', 'drawHealthBar'],
    ['debug-only-unit', 'removeEnergyBar'],
    ['debug-only-unit', 'shouldKeepHealthBarVisible', false],
    ['debug-only-unit', 'removeHealthBar'],
  ])
})
