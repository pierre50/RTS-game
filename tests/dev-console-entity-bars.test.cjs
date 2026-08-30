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
    '../../lib/lpc/lazyEquipmentAssets': {
      getLazyEquipmentLoadStats: () => ({ loaded: 2, pending: 1, total: 5 }),
    },
    '../../lib/playerState': {
      getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [],
    },
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

test('perf-report scene includes gameplay visibility and chunk counts', () => {
  const { performanceReport } = loadDebugActions()
  const cameraCell = { i: 1, j: 1 }
  const outsideCell = { i: 2, j: 2 }
  const grid = [[], [], []]
  grid[1][1] = cameraCell
  grid[2][2] = outsideCell
  const visibleCells = new Set([cameraCell])
  const context = {
    performance: {
      snapshot: () => ({
        frames: { samples: 1, averageMs: 8, p95Ms: 8, p99Ms: 8, fps: 120, speed: 1 },
        metrics: {},
        renderStats: [],
        slowFrames: [],
      }),
    },
    controls: { cameraController: { visibleCells } },
    map: {
      size: 3,
      grid,
      resources: new Set([{ label: 'tree', i: 2, j: 2, visible: true, renderable: true }]),
      gaia: {
        animals: [{ label: 'deer', i: 1, j: 1, currentCell: cameraCell, visible: true, sprite: { renderable: true } }],
      },
      terrainChunkManager: {
        clock: 2,
        chunks: new Map([
          ['0:0', { mounted: true, lastUsed: 2, visualCells: { size: 5 } }],
          ['0:1', { mounted: false, lastUsed: 1, visualCells: null }],
        ]),
        invalidateAll: () => {},
      },
      visibleRenderChunkCount: 1,
      renderChunks: [
        { renderable: true, displayObjects: [{}, {}] },
        { renderable: false, displayObjects: [{}] },
      ],
    },
    players: [
      {
        units: [
          { label: 'hero', i: 1, j: 1, currentCell: cameraCell, visible: true, sprite: { renderable: true } },
          { label: 'worker', i: 2, j: 2, currentCell: outsideCell, visible: false, sprite: { renderable: true } },
        ],
        buildings: [{ label: 'town-center', i: 1, j: 1, currentCell: cameraCell, visible: true, renderable: false }],
        corpses: [{ label: 'corpse', i: 2, j: 2, currentCell: outsideCell, visible: true }],
        animals: [],
      },
    ],
    scheduler: { _tasks: { size: 7 } },
  }

  const result = performanceReport(context, 'scene')

  assert.equal(result.ok, true)
  assert.match(result.message, /Scene breakdown/)
  assert.match(result.message, /cells 9 total \| 1 camera candidates/)
  assert.match(result.message, /units 2 total \| 1 camera \| 1 visible \| 1 renderable/)
  assert.match(result.message, /buildings 1 total \| 1 camera \| 1 visible \| 0 renderable/)
  assert.match(result.message, /resources 1 total \| 0 camera \| 1 visible \| 1 renderable/)
  assert.match(result.message, /animals 1 total \| 1 camera \| 1 visible \| 1 renderable/)
  assert.match(result.message, /corpses 1 total \| 0 camera \| 1 visible \| 1 renderable/)
  assert.match(result.message, /terrain chunks 2 total \| 1 visible \| 1 mounted \| 5 visual cells/)
  assert.match(result.message, /render chunks 2 total \| 1 renderable \| 3 display objects/)
  assert.match(result.message, /equipment atlases 2\/5 loaded \| 1 pending/)
  assert.match(result.message, /scheduler tasks 7/)
})

test('perf-report default output includes the scene breakdown', () => {
  const { performanceReport } = loadDebugActions()
  const context = {
    performance: {
      snapshot: () => ({
        frames: { samples: 1, averageMs: 8, p95Ms: 8, p99Ms: 8, fps: 120, speed: 1 },
        metrics: {},
        renderStats: [],
        slowFrames: [],
      }),
    },
    map: { size: 1, grid: [[{}]], resources: new Set(), gaia: { units: [] } },
    players: [],
  }

  const result = performanceReport(context)

  assert.equal(result.ok, true)
  assert.match(result.message, /Frame interval 1 samples/)
  assert.match(result.message, /Scene breakdown/)
})
