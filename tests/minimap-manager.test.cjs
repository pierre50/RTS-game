const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMinimapManager() {
  global.document ||= {
    createElement: tag => {
      assert.equal(tag, 'canvas')
      return createCanvas()
    },
  }
  const filename = path.join(__dirname, '../app/ui/minimap/MinimapManager.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', resource: 'resource' },
    },
    '../lib': {
      throttle: fn => fn,
      throttleByKey: fn => fn,
      canvasDrawDiamond: (...args) => args[0].diamonds.push(args.slice(1)),
      canvasDrawRectangle: (...args) => args[0].rectangles.push(args.slice(1)),
      canvasDrawStrokeRectangle: () => {},
      playerCanSeeInstance: () => true,
    },
    '../lib/mapSpaces': {
      getActiveMapSpace: map => {
        const id = map.activeSpaceId || 'outside'
        return map.spaces?.get?.(id) ?? { id: 'outside', grid: map.grid, size: map.size, origin: { x: 0, y: 0 } }
      },
      getEntitySpaceId: instance => instance?.spaceId || 'outside',
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.MinimapManager
}

function createCanvas() {
  const context = {
    diamonds: [],
    rectangles: [],
    clears: 0,
    translate() {},
    clearRect() {
      this.clears++
    },
  }
  return {
    width: 0,
    height: 0,
    getContext: () => context,
    context,
  }
}

function createMenu({ revealEverything = false, playerLabel = 'player' } = {}) {
  const appended = []
  const player = {
    label: playerLabel,
    colorHex: '#00f',
    buildings: [],
    units: [],
    views: { isViewed: () => false },
  }
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ color: 'green', i, j, x: i * 10, y: j * 10 }))
  )
  const map = { grid, resources: new Set(), revealEverything, size: 2, spaces: new Map(), activeSpaceId: null }
  map.spaces.set('outside', { id: 'outside', grid, size: 2, origin: { x: 0, y: 0 } })
  return {
    appended,
    context: {
      map,
      player,
      players: [player],
      controls: { getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 0, visibleHeight: 0 }) },
    },
    minimapMap: {
      appendChild: canvas => appended.push(canvas),
      style: {},
    },
    terrainMinimap: createCanvas(),
    resourcesMinimap: createCanvas(),
    cameraMinimap: createCanvas(),
    playersMinimap: [],
    ensureMinimapCanvases() {},
  }
}

test('minimap does not create player layers for other owners', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()

  manager.updatePlayerMiniMapEvt({
    label: 'ally',
    colorHex: '#00f',
    buildings: [],
    units: [],
  })

  assert.equal(
    menu.playersMinimap.some(layer => layer.id === 'minimap-ally'),
    false
  )
})

test('minimap ignores redraw requests while inactive', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })

  manager.updateResourcesMiniMapEvt()
  manager.updateCameraMiniMapEvt()
  manager.updatePlayerMiniMapEvt({
    label: 'player',
    colorHex: '#00f',
    buildings: [],
    units: [{ family: 'unit', position: { x: 12, y: 12 } }],
  })

  assert.equal(menu.resourcesMinimap.context.clears, 0)
  assert.equal(menu.cameraMinimap.context.clears, 0)
  assert.equal(menu.playersMinimap.length, 0)
})

test('minimap clears stale non-player layers instead of redrawing them', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  const canvas = createCanvas()
  menu.playersMinimap.push({ id: 'minimap-ally', canvas, context: canvas.context })
  manager.activate()

  manager.updatePlayerMiniMapEvt({
    label: 'ally',
    colorHex: '#00f',
    buildings: [{ position: { x: 10, y: 10 } }],
    units: [{ position: { x: 12, y: 12 } }],
  })

  assert.equal(canvas.context.clears, 1)
  assert.equal(canvas.context.rectangles.length, 0)
})

test('minimap does not draw animal markers on player layers', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()

  manager.updatePlayerMiniMapEvt({
    label: 'player',
    colorHex: '#00f',
    buildings: [],
    units: [
      { family: 'animal', position: { x: 10, y: 10 } },
      { family: 'unit', position: { x: 12, y: 12 } },
    ],
  })

  assert.equal(menu.playersMinimap.length, 1)
  assert.equal(menu.playersMinimap[0].context.rectangles.length, 1)
  assert.equal(menu.playersMinimap[0].context.rectangles[0][2], 8)
  assert.equal(menu.playersMinimap[0].context.rectangles[0][3], 8)
  assert.equal(menu.playersMinimap[0].context.rectangles[0][4], '#00f')
})

test('minimap skips non-player units when the whole map is revealed', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()

  manager.updatePlayerMiniMapEvt({
    label: 'ally',
    colorHex: '#f00',
    buildings: [{ position: { x: 10, y: 10 }, size: 1 }],
    units: [{ family: 'unit', position: { x: 12, y: 12 } }],
  })

  const layer = menu.playersMinimap.find(playerLayer => playerLayer.id === 'minimap-ally')
  assert.ok(layer)
  assert.equal(layer.context.rectangles.length, 1)
  assert.equal(layer.context.rectangles[0][2], 12)
  assert.equal(layer.context.rectangles[0][3], 12)
  assert.equal(layer.context.rectangles[0][4], '#f00')
})

test('minimap draws discovered terrain from the active interior space', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const interiorGrid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      category: i === 2 && j === 2 ? 'Land' : 'Water',
      color: i === 2 && j === 2 ? 'red' : 'blue',
      i,
      j,
      terrainHidden: i !== 2 || j !== 2,
      x: i * 20,
      y: j * 20,
      spaceId: 'interior:house',
    }))
  )
  menu.context.map.spaces.set('interior:house', {
    id: 'interior:house',
    kind: 'interior',
    grid: interiorGrid,
    size: 4,
    origin: { x: 400, y: 300 },
  })
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()

  menu.terrainMinimap.context.diamonds.length = 0
  menu.context.map.activeSpaceId = 'interior:house'
  manager.updateTerrainMiniMap(2, 2)

  const [x, y, width, height, color] = menu.terrainMinimap.context.diamonds[0]
  assert.equal(menu.terrainMinimap.context.diamonds.length, 1)
  assert.equal(Number.isFinite(x), true)
  assert.equal(Number.isFinite(y), true)
  assert.ok(width < 300)
  assert.ok(height < 150)
  assert.equal(color, 'red')
})

test('interior minimap leaves non-floor water filler transparent', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const interiorGrid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      category: 'Water',
      color: 'blue',
      i,
      j,
      terrainHidden: true,
      x: i * 20,
      y: j * 20,
      spaceId: 'interior:house',
    }))
  )
  menu.context.map.spaces.set('interior:house', {
    id: 'interior:house',
    kind: 'interior',
    grid: interiorGrid,
    size: 1,
    origin: { x: 400, y: 300 },
  })
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()

  menu.terrainMinimap.context.diamonds.length = 0
  menu.context.map.activeSpaceId = 'interior:house'
  manager.updateTerrainMiniMap(1, 1)

  assert.equal(menu.terrainMinimap.context.diamonds.length, 0)
})

test('interior minimap scales unit and building markers with the active room', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu()
  const interiorGrid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      category: 'Land',
      color: 'red',
      i,
      j,
      terrainHidden: false,
      x: i * 20,
      y: j * 20,
      spaceId: 'interior:house',
    }))
  )
  menu.context.map.spaces.set('interior:house', {
    id: 'interior:house',
    kind: 'interior',
    grid: interiorGrid,
    size: 1,
    origin: { x: 400, y: 300 },
  })
  menu.context.map.activeSpaceId = 'interior:house'
  const manager = new MinimapManager(menu)
  manager.activate()

  manager.updatePlayerMiniMapEvt({
    label: 'player',
    colorHex: '#00f',
    buildings: [{ position: { x: 20, y: 20 }, size: 2, spaceId: 'interior:house' }],
    units: [{ family: 'unit', position: { x: 24, y: 24 }, spaceId: 'interior:house' }],
  })

  const [buildingMarker, unitMarker] = menu.playersMinimap[0].context.rectangles
  assert.ok(buildingMarker[2] > unitMarker[2])
  assert.ok(unitMarker[2] > 8)
  assert.equal(buildingMarker[4], '#00f')
  assert.equal(unitMarker[4], '#00f')
})
