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
    '../../lib/entities/entityHealthDisplay': {
      syncEntityHealthDisplay: entity => overrides.syncEntityHealthDisplay?.(entity),
    },
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
      getDevMapSpace: () => null,
      getSolidDebugColor: () => 0,
      normalizeToggle: (value, current) => (value === 'on' ? true : value === 'off' ? false : !current),
      removeDebugLayer: () => {},
      stopDebugTicker: () => {},
      ...overrides.shared,
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
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

test('entity-bars on resolves visible entities from interior map spaces', () => {
  const calls = []
  const interiorCell = { i: 4, j: 5, spaceId: 'interior:house' }
  const interiorSpace = { grid: [[], [], [], [], []] }
  interiorSpace.grid[4][5] = interiorCell
  const { toggleEntityBars } = loadDebugActions({
    shared: {
      addDebugTicker: (_context, key) => calls.push(['addDebugTicker', key]),
      getCameraCells: () => new Set([interiorCell]),
      getDevMapSpace: (_context, spaceId) => (spaceId === 'interior:house' ? interiorSpace : null),
    },
    syncEntityHealthDisplay: entity => calls.push(['syncEntityHealthDisplay', entity.label]),
  })
  const context = {
    map: {
      debugEntityBarsVisible: false,
      gaia: { units: [], animals: [] },
      grid: [[]],
    },
    players: [
      {
        animals: [],
        buildings: [],
        units: [
          {
            i: 4,
            j: 5,
            label: 'interior-hero',
            selected: true,
            spaceId: 'interior:house',
          },
        ],
      },
    ],
  }

  const result = toggleEntityBars(context, 'on')

  assert.deepEqual(result, { ok: true, message: 'Entity bars: on' })
  assert.equal(context.map.debugEntityBarsVisible, true)
  assert.deepEqual(calls, [
    ['syncEntityHealthDisplay', 'interior-hero'],
    ['addDebugTicker', '_debugEntityBarsTicker'],
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
  assert.match(result.message, /resources 1 total \| 0 camera \| 0 visible \| 0 renderable/)
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

test('perf-report display groups effective renderable display subtrees', () => {
  const { performanceReport } = loadDebugActions()
  const hiddenLayer = {
    children: [{ label: 'hidden-sprite', renderable: true, visible: true }],
    label: 'hidden-layer',
    renderable: true,
    visible: false,
  }
  const visibleLayer = {
    children: [
      { label: 'visible-sprite', renderable: true, visible: true },
      { label: 'culled-sprite', renderable: true, visible: false },
    ],
    label: 'visible-layer',
    renderable: true,
    visible: true,
  }
  const map = {
    children: [hiddenLayer, visibleLayer],
    grid: [[]],
    label: 'map-root',
    resources: new Set(),
    size: 1,
  }
  const context = {
    app: {
      stage: { children: [map], label: 'stage-root', renderable: true, visible: true },
      ticker: { FPS: 120, add: () => {}, remove: () => {}, speed: 1 },
    },
    map,
    performance: {
      snapshot: () => ({
        frames: { samples: 1, averageMs: 8, p95Ms: 8, p99Ms: 8, fps: 120, speed: 1 },
        metrics: {},
        renderStats: [],
        slowFrames: [],
      }),
    },
    players: [],
  }

  const result = performanceReport(context, 'display')

  assert.equal(result.ok, true)
  assert.match(result.message, /Display tree/)
  assert.match(result.message, /stage: nodes 7 \| effective 4 renderable\/4 visible \| flags 7 renderable\/5 visible/)
  assert.match(result.message, /hidden-layer \(Object\) x1: nodes 2 \| effective 0 renderable\/0 visible/)
  assert.match(result.message, /visible-layer \(Object\) x1: nodes 3 \| effective 2 renderable\/2 visible/)
})

test('fps-cap updates the Pixi ticker cap without changing game speed', () => {
  const { setFpsCapDebug } = loadDebugActions()
  const context = {
    app: {
      ticker: {
        FPS: 119.6,
        add: () => {},
        maxFPS: 0,
        minFPS: 10,
        remove: () => {},
        speed: 1,
      },
    },
    map: { grid: [], resources: new Set(), size: 1 },
    players: [],
  }

  const capped = setFpsCapDebug(context, '60')

  assert.equal(capped.ok, true)
  assert.match(capped.message, /FPS cap set: 60/)
  assert.equal(context.app.ticker.maxFPS, 60)
  assert.equal(context.app.ticker.speed, 1)

  const native = setFpsCapDebug(context, 'native')

  assert.equal(native.ok, true)
  assert.match(native.message, /FPS cap set: native/)
  assert.equal(context.app.ticker.maxFPS, 0)
})

test('perf-report never scans cold resources, resolves grid cells or requests lazy sprites', () => {
  const { performanceReport } = loadDebugActions()
  const resource = {
    family: 'resource',
    visible: true,
    renderable: true,
    get sprite() {
      throw new Error('lazy visual created')
    },
  }
  const cell = { i: 1, j: 1, has: resource }
  const animal = {
    visible: true,
    currentCell: cell,
    get sprite() {
      throw new Error('lazy animal visual created')
    },
  }
  const context = {
    performance: {
      snapshot: () => ({ frames: { samples: 1, averageMs: 25, p95Ms: 25, p99Ms: 25, fps: 61, speed: 1 }, metrics: {} }),
    },
    controls: { cameraController: { visibleCells: new Set([cell]) } },
    map: {
      size: 7500,
      get grid() {
        throw new Error('grid accessed')
      },
      resources: {
        size: 857963,
        [Symbol.iterator]() {
          throw new Error('cold resources scanned')
        },
      },
      gaia: { animals: [animal] },
    },
    players: [{ units: [], buildings: [], animals: [animal] }],
  }
  const result = performanceReport(context)
  assert.equal(result.ok, true)
  assert.match(result.message, /resources 857963 total \| 1 camera \| 1 visible \| 1 renderable/)
  assert.match(result.message, /animals 1 total/)
  assert.match(result.message, /window FPS 40.0/)
  resource.visible = undefined
  assert.match(
    performanceReport(context, 'scene').message,
    /resources 857963 total \| 1 camera \| 0 visible \| 0 renderable/
  )
})

test('metric and spike reports do not inspect the scene', () => {
  const { performanceReport } = loadDebugActions()
  const context = {
    performance: { snapshot: () => ({ frames: {}, metrics: {}, slowFrames: [] }) },
    get map() {
      throw new Error('unnecessary scene census')
    },
  }
  assert.equal(performanceReport(context, 'spikes').ok, true)
  assert.equal(performanceReport(context, 'metric missing').ok, false)
})

test('perf-report events and spikes identify the civilization and teleport near a slow frame', () => {
  const { performanceReport } = loadDebugActions()
  const events = [
    { at: 100, name: 'teleport.minimap', details: { toI: 25, toJ: 40 } },
    { at: 300, name: 'ai.slowStep', details: { civilization: 'Kemet', durationMs: 180 } },
  ]
  const context = { performance: { snapshot: () => ({ events, metrics: {}, slowFrames: [{
    at: 350, duration: 250, exclusiveMeasuredMs: 180, untrackedMs: 70, measuredMs: 360,
    phase: 'runtime', phaseFrame: 5, events,
    metrics: [{ name: 'runtime.ai.buildingPlacement', exclusiveMs: 180, totalMs: 180, count: 1 }],
  }] }) } }
  const timeline = performanceReport(context, 'events')
  assert.match(timeline.message, /teleport.minimap.*toI=25.*toJ=40/)
  const spikes = performanceReport(context, 'spikes')
  assert.match(spikes.message, /ai.slowStep 50ms before frame end.*civilization=Kemet/)
  assert.match(spikes.message, /runtime.ai.buildingPlacement/)
})
