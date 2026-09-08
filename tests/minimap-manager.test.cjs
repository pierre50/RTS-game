const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMinimapManager({ renderUnitHeadAvatar = () => false } = {}) {
  global.document ||= {
    createElement: tag => {
      assert.equal(tag, 'canvas')
      return createCanvas()
    },
  }
  global.getComputedStyle ||= element => ({
    getPropertyValue: name => element?.style?.getPropertyValue?.(name) || '',
  })
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
      canvasDrawStrokeRectangle: (...args) => args[0].strokes.push(args.slice(1)),
      playerCanSeeInstance: () => true,
    },
    '../lib/mapSpaces': {
      getActiveMapSpace: map => {
        const id = map.activeSpaceId || 'outside'
        return map.spaces?.get?.(id) ?? { id: 'outside', grid: map.grid, size: map.size, origin: { x: 0, y: 0 } }
      },
      getEntitySpaceId: instance => instance?.spaceId || 'outside',
    },
    '../../lib/avatar': {
      renderUnitHeadAvatar,
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
    strokes: [],
    images: [],
    clears: 0,
    translate() {},
    drawImage(...args) {
      this.images.push(args)
    },
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
      app: {},
      player,
      players: [player],
      controls: { getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 0, visibleHeight: 0 }) },
    },
    minimapMap: {
      appendChild: canvas => appended.push(canvas),
      style: createStyleDeclaration(),
    },
    terrainMinimap: createCanvas(),
    resourcesMinimap: createCanvas(),
    cameraMinimap: createCanvas(),
    playersMinimap: [],
    ensureMinimapCanvases() {},
  }
}

function createStyleDeclaration() {
  const properties = new Map()
  return {
    getPropertyValue: name => properties.get(name) ?? '',
    removeProperty: name => properties.delete(name),
    setProperty: (name, value) => properties.set(name, value),
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

test('exterior minimap uses a square canvas only with a local layout', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  menu.context.map.localGridLayout = { columns: 3, rows: 9 }
  const manager = new MinimapManager(menu)
  manager.activate()

  assert.equal(menu.terrainMinimap.width, menu.terrainMinimap.height)
  assert.equal(menu.resourcesMinimap.width, menu.resourcesMinimap.height)
  assert.equal(menu.cameraMinimap.width, menu.cameraMinimap.height)
})

test('legacy exterior minimap retains its isometric canvas', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  menu.context.map.grid[0][0].color = 'origin'
  menu.context.map.grid[1][0].color = 'east'
  menu.context.map.grid[0][1].color = 'south'
  const manager = new MinimapManager(menu)
  manager.activate()
  manager.revealTerrainMinimap()

  assert.equal(menu.terrainMinimap.width, menu.terrainMinimap.height * 2)

  const draws = new Map(menu.terrainMinimap.context.diamonds.map(([x, y, width, height, color]) => [color, { x, y }]))

  assert.ok(draws.get('east').x > draws.get('origin').x)
  assert.ok(draws.get('south').x < draws.get('east').x)
  assert.ok(draws.get('south').y > draws.get('origin').y)
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

test('minimap draws player unit head avatars when available', () => {
  const avatarCanvas = createCanvas()
  const renderedUnits = []
  const MinimapManager = loadMinimapManager({
    renderUnitHeadAvatar: (app, unit, canvas) => {
      renderedUnits.push({ app, unit, canvas })
      canvas.width = avatarCanvas.width
      canvas.height = avatarCanvas.height
      return true
    },
  })
  const menu = createMenu()
  const manager = new MinimapManager(menu)
  manager.getMinimapParams = () => ({ factor: 1, translate: 0 })
  manager.activate()
  const unit = { family: 'unit', position: { x: 12, y: 12 } }

  manager.updatePlayerMiniMapEvt({
    label: 'player',
    colorHex: '#00f',
    buildings: [],
    units: [unit],
  })

  const layer = menu.playersMinimap[0]
  assert.equal(renderedUnits.length, 1)
  assert.equal(renderedUnits[0].app, menu.context.app)
  assert.equal(renderedUnits[0].unit, unit)
  assert.equal(layer.context.rectangles.length, 0)
  assert.equal(layer.context.images.length, 1)
  assert.equal(layer.context.images[0][3], 24)
  assert.equal(layer.context.images[0][4], 24)
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

function createLocalMinimap(layout = { columns: 9, rows: 33 }) {
  const menu = createMenu({ revealEverything: true })
  const grid = []
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns - (row % 2); column++) {
      const i = column + Math.ceil(row / 2)
      const j = layout.columns - 1 - column + Math.floor(row / 2)
      grid[i] ||= []
      grid[i][j] = { i, j, x: (i - j) * 32, y: (i + j) * 16, color: `${column}:${row}` }
    }
  }
  const size = grid.length - 1
  Object.assign(menu.context.map, { grid, size, localGridLayout: layout })
  menu.context.map.spaces.set('outside', { id: 'outside', kind: 'outside', grid, size, origin: { x: 0, y: 0 } })
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  return { menu, manager }
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
}

test('local minimap projects sparse terrain uniformly in world coordinates and inverts CSS-scaled clicks', () => {
  const { menu, manager } = createLocalMinimap()
  const draws = menu.terrainMinimap.context.diamonds
  assert.equal(draws.length, 9 * 17 + 8 * 16)
  const rect = { left: 30, top: 50, width: 420, height: 280 }
  for (const [x, y, width, height, color] of draws) {
    const [column, row] = color.split(':').map(Number)
    const worldX = (2 * column - 8 + (row % 2)) * 32
    const worldY = (8 + row) * 16
    const centerY = y + (height - 1) / 2
    assertClose(x, 24 + (worldX + 256) * 2.25)
    assertClose(centerY, 24 + (worldY - 128) * 2.25)
    assertClose(width - 1, (height - 1) * 2)
    const cropX = 12
    const cropY = 14
    const point = manager.getMinimapWorldPoint(
      rect.left + (x / 1200) * (rect.width + cropX * 2) - cropX,
      rect.top + (centerY / 1200) * (rect.height + cropY * 2) - cropY,
      rect
    )
    assert.ok(Math.abs(point.x - worldX) < 1e-8)
    assert.ok(Math.abs(point.y - worldY) < 1e-8)
  }
  assert.deepEqual(manager.getMinimapWorldPoint(-1000, -1000, rect), { x: -256, y: 128 })
  assert.deepEqual(manager.getMinimapWorldPoint(1000, 1000, rect), { x: 256, y: 640 })
})

test('local minimap markers follow actual fractional positions and camera overlay uses the same scale', () => {
  const { menu, manager } = createLocalMinimap()
  menu.context.player.units = [{ family: 'unit', i: 9, j: 9, position: { x: 12.5, y: 180.25 } }]
  manager.updatePlayerMiniMapEvt(menu.context.player)
  const [x, y, width, height] = menu.playersMinimap[0].context.rectangles.at(-1)
  assertClose(x + width / 2, 24 + (12.5 + 256) * 2.25)
  assertClose(y + height / 2, 24 + (180.25 - 128) * 2.25)
  menu.context.controls.getViewportMetrics = () => ({
    visibleLeft: -60,
    visibleTop: 100,
    visibleWidth: 120,
    visibleHeight: 80,
  })
  manager.updateCameraMiniMapEvt()
  menu.cameraMinimap.context.strokes
    .at(-1)
    .slice(0, 4)
    .forEach((value, index) => assertClose(value, [465, -38.99999999999999, 270, 180][index]))
})

test('rectangular local layouts retain uniform scale with centered unused space', () => {
  const { manager, menu } = createLocalMinimap({ columns: 9, rows: 17 })
  const edge = menu.terrainMinimap.context.diamonds.find(draw => draw[4] === '0:0')
  assertClose(edge[0], 24)
  assertClose(edge[1] + (edge[3] - 1) / 2, 312)
  const point = manager.getMinimapWorldPoint(150, 150, { left: 0, top: 0, width: 300, height: 300 })
  assertClose(point.x, 0)
  assertClose(point.y, 256)
})

test('interior minimap uses the active interior local layout', () => {
  const { menu, manager } = createLocalMinimap()
  menu.context.map.spaces.set('interior:house', {
    id: 'interior:house',
    kind: 'interior',
    size: 1,
    grid: [],
    origin: { x: 500, y: 600 },
    localGridLayout: { columns: 2, rows: 5 },
  })
  menu.context.map.activeSpaceId = 'interior:house'
  manager.initMiniMap()
  assert.equal(menu.terrainMinimap.width, menu.terrainMinimap.height)
  assert.equal(menu.minimapMap.style.clipPath, '')
})
