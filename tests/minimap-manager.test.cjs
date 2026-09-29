const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMinimapManager({ renderUnitHeadAvatar = () => false, hiddenMarkers = new Set() } = {}) {
  global.Image ||= class {
    complete = true
    naturalWidth = 24
  }
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
    './MinimapFilters': {
      minimapOwnerKey: owner => (owner.isPlayed ? 'self' : owner.type),
      isMinimapMarkerHidden: (_context, key) => hiddenMarkers.has(key),
    },
    '../constants': {
      ACTION_TYPES: { flee: 'flee' },
      UNIT_TYPES: { hero: 'Hero', chief: 'Chief', villager: 'Villager' },
      PLAYER_TYPES: { ai: 'AI', bandits: 'Bandits' },
      BUILDING_TYPES: { cave: 'Cave', townCenter: 'TownCenter', fireCamp: 'FireCamp' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', resource: 'resource' },
    },
    '../lib': {
      throttle: fn => fn,
      canvasDrawDiamond: (...args) => args[0].diamonds.push(args.slice(1)),
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
    ellipses: [],
    labels: [],
    paths: [],
    rotations: [],
    moveTo(...args) { this.paths.push(args) },
    lineTo() {},
    closePath() {},
    rect(...args) { this.rectangles.push(args) },
    rotate(angle) { this.rotations.push(angle) },
    strokeRect(...args) { this.strokes.push(args) },
    strokeText() {},
    fillText(...args) {
      this.labels.push(args)
    },
    beginPath() {},
    ellipse(...args) {
      this.ellipses.push(args)
    },
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    clears: 0,
    clearedRects: [],
    fills: [],
    fillRect(...args) { this.fills.push(args) },
    translate() {},
    drawImage(...args) {
      this.images.push(args)
    },
    clearRect(...args) {
      this.clearedRects.push(args)
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

test('minimap uses a readable dark forest terrain color', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  menu.context.map.grid[0][0] = {
    color: '#0F1F0A',
    i: 0,
    j: 0,
    type: 'DarkForest',
    x: 0,
    y: 0,
  }
  const manager = new MinimapManager(menu)
  manager.activate()

  const draw = menu.terrainMinimap.context.diamonds.find(([, , , , color]) => color === '#3D5630')
  assert.ok(draw)
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

  assert.equal(menu.playersMinimap.length, 0)
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

  assert.equal(menu.playersMinimap.length, 0)
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
  menu.context.player.views.isViewed = (i, j) => i === 2 && j === 2
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

test('interior exit marker is visible without exploration and clears when returning outside', () => {
  const menu = createMenu()
  const grid = menu.context.map.grid
  menu.context.map.spaces.set('interior:house', {
    id: 'interior:house',
    kind: 'interior',
    grid,
    size: 2,
    origin: { x: 400, y: 300 },
    exitCell: grid[1][2],
  })
  menu.context.map.activeSpaceId = 'interior:house'
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  const context = menu.resourcesMinimap.context
  assert.equal(context.images.length, 1)
  assert.equal(context.images[0][0].src, 'assets/icons/minimap/exit.svg')
  const expected = manager.geometry.cellToMinimapPoint(grid[1][2], manager.geometry.getMinimapTransform())
  assertClose(context.ellipses[0][0], expected.x)
  assertClose(context.ellipses[0][1], expected.y)

  context.images.length = 0
  const clears = context.clears
  menu.context.map.activeSpaceId = 'outside'
  manager.refreshMiniMap()
  assert.ok(context.clears > clears)
  assert.equal(context.images.length, 0)
})

test('standalone interior maps show their configured exit on the minimap', () => {
  const menu = createMenu()
  menu.context.map.mapType = 'interior'
  menu.context.map.interiorExits = [{ i: 2, j: 1 }]
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  const context = menu.resourcesMinimap.context
  assert.equal(context.images.length, 1)
  assert.equal(context.images[0][0].src, 'assets/icons/minimap/exit.svg')
  const expected = manager.geometry.cellToMinimapPoint(
    menu.context.map.grid[2][1],
    manager.geometry.getMinimapTransform()
  )
  assertClose(context.ellipses[0][0], expected.x)
  assertClose(context.ellipses[0][1], expected.y)
})

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

test('minimap skips an empty camera viewport', () => {
  const { menu, manager } = createLocalMinimap()
  manager.updateCameraMiniMapEvt()
  assert.deepEqual(menu.cameraMinimap.context.strokes, [])
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

test('minimap entity overlay never materializes resources', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  menu.context.map.showResources = true
  for (const key of ['resources', 'gaia']) {
    Object.defineProperty(menu.context.map, key, {
      get() {
        throw new Error(`read ${key}`)
      },
    })
  }
  for (const row of menu.context.map.grid) {
    for (const cell of row)
      Object.defineProperty(cell, 'has', {
        get() {
          throw new Error('materialized resource')
        },
      })
  }
  const manager = new MinimapManager(menu)
  manager.activate()
  manager.updateResourcesMiniMapEvt()
  manager.updatePlayerMiniMapEvt(menu.context.player)
  manager.updateResourceMiniMap({})
  manager.updateTerrainMiniMap(1, 1)
  assert.equal(menu.playersMinimap.length, 0)
  assert.equal(menu.resourcesMinimap.context.rectangles.length, 0)
  assert.ok(menu.terrainMinimap.context.diamonds.length > 0)
})

test('giant terrain overview has bounded reads and remembers exploration between refreshes', () => {
  const MinimapManager = loadMinimapManager()
  const menu = createMenu({ revealEverything: true })
  let reads = 0
  const grid = new Proxy([], {
    get(_target, key) {
      const i = Number(key)
      return new Proxy([], {
        get(_row, column) {
          const j = Number(column)
          reads++
          return { i, j, x: (i - j) * 32, y: (i + j) * 16, color: 'green' }
        },
      })
    },
  })
  menu.context.map.grid = grid
  menu.context.map.size = 7500
  menu.context.map.spaces.set('outside', { id: 'outside', grid, size: 7500, origin: { x: 0, y: 0 } })
  const manager = new MinimapManager(menu)
  manager.activate()
  assert.ok(reads <= 256 * 256, `${reads} terrain reads`)
  menu.context.map.revealEverything = false
  menu.context.player.views.isViewed = (i, j) => i === 1 && j === 2
  manager.updateTerrainMiniMap(1, 2)
  menu.terrainMinimap.context.diamonds.length = 0
  manager.refreshMiniMap()
  assert.equal(menu.terrainMinimap.context.diamonds.length, 1, 'narrow explored path survives refresh')
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

test('discovered towns and caves render with owner and grey backgrounds, and legend filters hide markers', () => {
  const hiddenMarkers = new Set()
  const MinimapManager = loadMinimapManager({ hiddenMarkers })
  const menu = createMenu()
  const building = (type, i, extra = {}) => ({ type, i, j: 1, size: 1, position: { x: i * 10, y: 10 }, ...extra })
  menu.context.player.views.isViewed = i => i === 1
  menu.context.player.views.isVisible = i => i === 1
  menu.context.player.buildings = [building('TownCenter', 1), building('Cave', 1), building('TownCenter', 2)]
  menu.context.players.push({
    type: 'AI',
    units: [{ hitPoints: 10 }],
    colorHex: '#f00',
    buildings: [
      building('TownCenter', 1),
      building('TownCenter', 2),
      building('House', 1),
      building('Cave', 1, { spaceId: 'interior:test' }),
    ],
  })
  menu.context.controls.heroUnit = { position: { x: 10, y: 10 }, owner: menu.context.player }
  const colors = []
  menu.resourcesMinimap.context.fill = function () {
    colors.push(this.fillStyle)
  }
  const manager = new MinimapManager(menu)
  manager.activate()
  assert.deepEqual(colors, ['#00f', '#8f8f8f', '#00f', '#f00', '#f00', '#00f'])
  assert.equal(menu.resourcesMinimap.context.images.length, 4)
  assert.equal(menu.resourcesMinimap.context.images[3][0].src, 'assets/icons/minimap/home.svg')
  colors.length = 0
  menu.context.player.views.isViewed = () => true
  menu.context.player.views.isVisible = () => true
  manager.updateTerrainMiniMap(2, 1)
  assert.deepEqual(colors, ['#00f', '#8f8f8f', '#00f', '#f00', '#f00', '#f00', '#00f'])
  hiddenMarkers.add('caves')
  hiddenMarkers.add('AI')
  colors.length = 0
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(colors, ['#00f', '#00f', '#00f'])
  hiddenMarkers.clear()
  colors.length = 0
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(colors, ['#00f', '#8f8f8f', '#00f', '#f00', '#f00', '#f00', '#00f'])
})

test('bandit camp markers follow live campfires, discovery, filters and destruction', () => {
  const hiddenMarkers = new Set()
  const MinimapManager = loadMinimapManager({ hiddenMarkers })
  const menu = createMenu()
  const fire = { type: 'FireCamp', i: 1, j: 1, size: 1, position: { x: 10, y: 10 } }
  menu.context.players.push({
    type: 'Bandits',
    colorHex: '#222222',
    buildings: [fire],
    units: [{ hitPoints: 10, campPatrolAnchor: { i: 1, j: 1 } }],
  })
  const manager = new MinimapManager(menu)
  manager.activate()
  const images = menu.resourcesMinimap.context.images
  assert.equal(images.length, 0)
  menu.context.player.views.isViewed = () => true
  manager.updatePlayerMiniMapEvt()
  assert.equal(images.length, 1)
  assert.equal(images[0][0].src, 'assets/icons/minimap/camp.svg')
  hiddenMarkers.add('Bandits')
  manager.updatePlayerMiniMapEvt()
  assert.equal(images.length, 1)
  hiddenMarkers.clear()
  fire.isDestroyed = true
  manager.updatePlayerMiniMapEvt()
  assert.equal(images.length, 1)
  fire.isDestroyed = false
  fire.spaceId = 'interior:cave'
  manager.updatePlayerMiniMapEvt()
  assert.equal(images.length, 1)
})

test('surviving AI buildings remain known independently of cleared camps', () => {
  const menu = createMenu({ revealEverything: true })
  const building = (type, i) => ({ type, i, j: 1, size: 1, position: { x: i * 10, y: 10 } })
  const ai = { type: 'AI', colorHex: '#f00', buildings: [building('TownCenter', 1)], units: [{ hitPoints: 10 }] }
  const firstGuard = { hitPoints: 10, campPatrolAnchor: { i: 1, j: 1 } }
  const secondGuard = { hitPoints: 10, banditCampAnchor: { i: 2, j: 1 }, spaceId: 'interior:lair' }
  const bandits = {
    type: 'Bandits',
    colorHex: '#222',
    buildings: [building('FireCamp', 1), building('FireCamp', 2)],
    units: [firstGuard, secondGuard],
  }
  menu.context.players.push(ai, bandits)
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  const images = menu.resourcesMinimap.context.images
  const redraw = () => {
    images.length = 0
    manager.updatePlayerMiniMapEvt()
    return images.map(image => image[0].src.split('/').pop())
  }
  assert.deepEqual(redraw(), ['camp.svg', 'camp.svg', 'home.svg'])
  firstGuard.isDead = true
  assert.deepEqual(redraw(), ['camp.svg', 'home.svg'])
  ai.units[0].combatMode = 'flee'
  assert.deepEqual(redraw(), ['camp.svg', 'home.svg'])
  bandits.units = [] // Dead or converted guards no longer belong to the bandit owner.
  assert.deepEqual(redraw(), ['home.svg'])
  manager.deactivate()
  images.length = 0
  manager.activate()
  assert.equal(images[0][0].src, 'assets/icons/minimap/home.svg')
})

test('resizing the open minimap adjusts terrain detail and releases its observer on close', t => {
  const original = global.ResizeObserver
  let onResize
  let disconnected = 0
  global.ResizeObserver = class {
    constructor(callback) {
      onResize = callback
    }
    observe() {}
    disconnect() {
      disconnected++
    }
  }
  t.after(() => {
    global.ResizeObserver = original
  })
  const menu = createMenu({ revealEverything: true })
  let width = 180
  menu.minimapMap.getBoundingClientRect = () => ({ width, height: width / 2 })
  const grid = new Proxy([], {
    get(_target, key) {
      const i = Number(key)
      return new Proxy([], {
        get(_row, column) {
          const j = Number(column)
          return { i, j, x: (i - j) * 32, y: (i + j) * 16, color: 'green' }
        },
      })
    },
  })
  menu.context.map.grid = grid
  menu.context.map.size = 7500
  menu.context.map.spaces.set('outside', { id: 'outside', grid, size: 7500, origin: { x: 0, y: 0 } })
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  const canvas = menu.terrainMinimap.context
  const smallCount = canvas.diamonds.length
  canvas.diamonds.length = 0
  onResize()
  assert.equal(canvas.diamonds.length, 0, 'unchanged size does not repaint')
  width = 600
  onResize()
  assert.ok(canvas.diamonds.length > smallCount)
  assert.ok(canvas.diamonds.length <= 512 * 512)
  menu.context.map.revealEverything = false
  menu.context.player.views.isViewed = (i, j) => i === 1 && j === 2
  manager.updateTerrainMiniMap(1, 2)
  canvas.diamonds.length = 0
  width = 180
  onResize()
  assert.equal(canvas.diamonds.length, 1, 'discovered paths survive a changed sample density')
  manager.deactivate()
  assert.equal(disconnected, 1)
  canvas.diamonds.length = 0
  width = 600
  onResize()
  assert.equal(canvas.diamonds.length, 0)
})

test('completed player base appears through fog and its filter is independent of the hero', () => {
  const hiddenMarkers = new Set()
  const menu = createMenu()
  const center = { type: 'TownCenter', i: 1, j: 1, size: 1, isBuilt: false, position: { x: 10, y: 10 } }
  menu.context.player.buildings = [center]
  menu.context.controls.heroUnit = { position: { x: 20, y: 20 }, owner: menu.context.player }
  const manager = new (loadMinimapManager({ hiddenMarkers }))(menu)
  manager.activate()
  const context = menu.resourcesMinimap.context
  const images = context.images
  const redraw = () => {
    images.length = 0
    context.rotations.length = 0
    manager.updatePlayerMiniMapEvt()
    return [...images.map(image => image[0].src.split('/').pop()), ...context.rotations.map(() => 'hero')]
  }
  assert.deepEqual(redraw(), ['hero'])
  center.isBuilt = true
  assert.deepEqual(redraw(), ['home.svg', 'hero'])
  hiddenMarkers.add('base')
  assert.deepEqual(redraw(), ['hero'])
  hiddenMarkers.clear()
  hiddenMarkers.add('self')
  assert.deepEqual(redraw(), ['home.svg'])
  hiddenMarkers.clear()
  center.isDead = true
  assert.deepEqual(redraw(), ['hero'])
})


test('own markers show buildings below units and hide dead, sheltered and other-space units', () => {
  const hiddenMarkers = new Set()
  const menu = createMenu()
  const position = { x: 10, y: 10 }
  const unit = (type, extra = {}) => ({ type, position, ...extra })
  const hero = unit('Hero', { degree: 270, owner: menu.context.player })
  menu.context.controls.heroUnit = hero
  menu.context.player.buildings = [{ type: 'House', position, selected: true }]
  menu.context.player.units = [
    unit('Villager'), unit('Fantassin', { selected: true }), hero,
    unit('Villager', { isDead: true }), unit('Bowman', { isDestroyed: true }),
    unit('Villager', { shelterState: { status: 'inside' } }),
    unit('Villager', { spaceId: 'interior:house' }),
  ]
  const context = menu.resourcesMinimap.context
  const kinds = []
  context.rect = () => kinds.push('building')
  context.ellipse = () => kinds.push('circle')
  context.moveTo = () => kinds.push('arrow')
  const manager = new (loadMinimapManager({ hiddenMarkers }))(menu)
  manager.activate()
  // Selection halo, building, villager, selection halo, troop, hero.
  assert.deepEqual(kinds, ['circle', 'building', 'circle', 'circle', 'arrow', 'arrow'])
  assert.deepEqual(context.rotations, [Math.PI / 2])
  kinds.length = 0
  hiddenMarkers.add('self')
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(kinds, [])
})


test('terrain colors stay unchanged when building vision changes and unknown terrain stays hidden', () => {
  const menu = createMenu()
  let visible = true
  menu.context.player.views.isViewed = (i, j) => i === 1 && j === 1
  menu.context.player.views.isVisible = () => visible
  menu.context.map.grid[1][1].color = '#647B2F'
  const context = menu.terrainMinimap.context
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  visible = false
  manager.refreshMiniMap()
  assert.deepEqual(context.diamonds.map(draw => draw[4]), ['#647B2F', '#647B2F'])
  const count = context.diamonds.length
  manager.updateTerrainMiniMap(0, 0)
  assert.equal(context.diamonds.length, count)
})

test('camera shading clears the viewport without an outline or terrain repaint', () => {
  const { menu, manager } = createLocalMinimap()
  const transform = manager.geometry.getMinimapTransform()
  menu.context.controls.getViewportMetrics = () => ({
    visibleLeft: transform.originX + 20, visibleTop: transform.originY + 30,
    visibleWidth: 80, visibleHeight: 60,
  })
  manager.updateCameraMiniMapEvt()
  const shading = menu.cameraMinimap.context
  assert.deepEqual(shading.strokes, [])
  assert.deepEqual(shading.fills.at(-1), [-transform.translate, 0, transform.canvasWidth, transform.canvasHeight])
  const [x, y, width, height] = shading.clearedRects.at(-1)
  assertClose(x, manager.geometry.toMinimapX(20, transform))
  assertClose(y, manager.geometry.toMinimapY(30, transform))
  assertClose(width, 80 / transform.factor)
  assertClose(height, 60 / transform.factor)
  const terrainDraws = menu.terrainMinimap.context.diamonds.length
  menu.context.controls.getViewportMetrics = () => ({
    visibleLeft: transform.originX + 40, visibleTop: transform.originY + 30,
    visibleWidth: 80, visibleHeight: 60,
  })
  manager.updateCameraMiniMapEvt()
  assertClose(shading.clearedRects.at(-1)[0], manager.geometry.toMinimapX(40, transform))
  assert.equal(menu.terrainMinimap.context.diamonds.length, terrainDraws)
})


test('AI units disappear outside vision and building memories survive hidden destruction, even with minimap closed', () => {
  const hiddenMarkers = new Set()
  const menu = createMenu()
  let visible = false
  menu.context.player.views.isViewed = () => true
  menu.context.player.views.isVisible = () => visible
  const house = { label: 'house', type: 'House', i: 1, j: 1, size: 1, position: { x: 10, y: 10 } }
  const ai = { type: 'AI', colorHex: '#f00', buildings: [house], units: [
    { type: 'Villager', i: 1, j: 1, position: { x: 10, y: 10 } },
    { type: 'Fantassin', i: 1, j: 1, position: { x: 15, y: 10 } },
  ] }
  menu.context.players.push(ai)
  const context = menu.resourcesMinimap.context
  const draws = []
  context.fill = function () { draws.push([this.fillStyle, this.filter]) }
  const manager = new (loadMinimapManager({ hiddenMarkers }))(menu)
  manager.activate()
  assert.deepEqual(draws, []) // Exploring terrain alone reveals no new enemy building.
  manager.deactivate()
  visible = true
  manager.updatePlayerMiniMapEvt() // Vision notifications record discovery while closed.
  visible = false
  ai.buildings = []
  house.isDestroyed = true
  manager.activate()
  assert.deepEqual(draws, [['#f00', 'brightness(55%)']])
  draws.length = 0
  hiddenMarkers.add('AI')
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(draws, [])
  hiddenMarkers.clear()
  visible = true
  manager.updatePlayerMiniMapEvt()
  assert.equal(draws.length, 2) // Old building cleared; only the two visible units remain.
  draws.length = 0
  visible = false
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(draws, [])
})

test('loaded building memories stay dark without a live building and clear only after revisiting', () => {
  const menu = createMenu()
  menu.context.player.minimapBuildingMemory = JSON.parse(JSON.stringify([{
    id: 'destroyed', spaceId: 'outside', x: 10, y: 10, i: 1, j: 1, size: 1,
    color: '#f00', ownerKey: 'AI', town: false,
  }, {
    id: 'room', spaceId: 'interior:house', x: 10, y: 10, i: 1, j: 1, size: 1,
    color: '#f00', ownerKey: 'AI', town: false,
  }]))
  let visible = false
  menu.context.player.views.isVisible = () => visible
  const context = menu.resourcesMinimap.context
  const draws = []
  context.fill = function () { draws.push(this.filter) }
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  assert.deepEqual(draws, ['brightness(55%)'])
  assert.equal(menu.context.player.minimapBuildingMemory.length, 2)
  draws.length = 0
  visible = true
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(draws, [])
  assert.deepEqual(menu.context.player.minimapBuildingMemory.map(entry => entry.id), ['room'])
})


test('loading does not erase building observations before live entities have been restored', () => {
  const menu = createMenu()
  menu.context.map.ready = false
  menu.context.player.views.isVisible = () => true
  const memory = [{ id: 'house', spaceId: 'outside', x: 10, y: 10, i: 1, j: 1, size: 1,
    color: '#f00', ownerKey: 'AI', town: false }]
  menu.context.player.minimapBuildingMemory = memory
  const manager = new (loadMinimapManager())(menu)
  manager.updatePlayerMiniMapEvt()
  assert.deepEqual(menu.context.player.minimapBuildingMemory, memory)
})

test('an offscreen player gatherer stays on the minimap and its marker follows live travel', () => {
  const menu = createMenu()
  menu.context.player.views.isViewed = () => false
  menu.context.player.views.isVisible = () => false
  menu.context.controls.instanceInCamera = () => false
  const worker = { type: 'Villager', position: { x: 10, y: 10 }, visible: false, renderable: false }
  menu.context.player.units = [worker]
  const context = menu.resourcesMinimap.context
  const points = []
  let markerPoint
  context.translate = (x, y) => { markerPoint = [x, y] }
  context.ellipse = () => points.push(markerPoint)
  const manager = new (loadMinimapManager())(menu)
  manager.activate()
  assert.equal(points.length, 1)
  const start = points[0]
  worker.position = { x: 50, y: 80 }
  manager.updatePlayerMiniMapEvt()
  assert.equal(points.length, 2)
  assert.notDeepEqual(points[1], start)
})
