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
      canvasDrawDiamond: () => {},
      canvasDrawRectangle: (...args) => args[0].rectangles.push(args.slice(1)),
      canvasDrawStrokeRectangle: () => {},
      playerCanSeeInstance: () => true,
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.MinimapManager
}

function createCanvas() {
  const context = {
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
  return {
    appended,
    context: {
      map: { grid, resources: new Set(), revealEverything, size: 2 },
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
  assert.deepEqual(menu.playersMinimap[0].context.rectangles[0], [8, 8, 8, 8, '#00f'])
})
