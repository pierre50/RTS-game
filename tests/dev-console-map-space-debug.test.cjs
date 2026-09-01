const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class MockContainer {
  constructor() {
    this.children = []
    this.destroyed = false
    this.eventMode = 'auto'
    this.label = ''
    this.zIndex = 0
  }

  addChild(child) {
    if (child.parent && child.parent !== this) child.parent.removeChild(child)
    child.parent = this
    this.children.push(child)
    return child
  }

  removeChild(child) {
    this.children = this.children.filter(candidate => candidate !== child)
    child.parent = null
    return child
  }

  removeChildren() {
    const children = this.children
    this.children = []
    children.forEach(child => {
      child.parent = null
    })
    return children
  }

  getChildByLabel(label) {
    return this.children.find(child => child.label === label) ?? null
  }

  destroy() {
    this.destroyed = true
  }
}

class MockGraphics extends MockContainer {
  clear() {}
  poly() {}
  fill() {}
  closePath() {}
  stroke() {}
  moveTo() {}
  lineTo() {}
  circle() {}
}

class MockText extends MockContainer {
  constructor(options) {
    super()
    this.text = options.text
    this.style = options.style
    this.anchor = { set: (x, y) => (this.anchorValue = [x, y]) }
    this.x = 0
    this.y = 0
  }
}

function loadDebugMapRenderers(libOverrides = {}) {
  return loadTsModule(path.join(__dirname, '../app/dev-console/actions/DebugMapRenderers.ts'), {
    mocks: {
      'pixi.js': { Container: MockContainer, Graphics: MockGraphics, Text: MockText },
      '../../constants': {
        CELL_HEIGHT: 16,
        CELL_WIDTH: 32,
        FAMILY_TYPES: { animal: 'animal', building: 'building', resource: 'resource', unit: 'unit' },
      },
      '../../classes/unit/movement/UnitHeroDirectMovementCollision': {
        createHeroTerrainCollisionBlocker: cell => ({ collisionPoints: [], family: 'terrain', i: cell.i, j: cell.j }),
        getHeroCollisionFootprintPoints: () => [],
        isHeroTerrainCollisionCell: () => false,
      },
      '../../classes/unit/movement/UnitMovementDebug': {
        getLastDirectMoveDebugSnapshot: () => null,
      },
      './DebugOverlayRenderers': {
        ensureDebugOverlay: () => ({ textContent: '' }),
      },
      '../../lib': {
        addEntityToMapSpaceContainer: () => {},
        canPlaceBuildingAt: () => false,
        drawRoundedIsoShape: () => {},
        getMapSpace: (map, spaceId = 'outside') =>
          map.spaces?.get(spaceId || 'outside') ?? map.spaces?.get('outside') ?? null,
        getReliefOffset: () => 0,
        getRoundedIsoFootprintPoints: () => [],
        parseTextureRef: () => ({ frame: 0, sheet: 'terrain' }),
        pointIsInsidePolygon: () => false,
        ...libOverrides,
      },
    },
  })
}

test('coords debug renders in the active interior map-space container', () => {
  const { drawCoordsDebug } = loadDebugMapRenderers()
  const map = new MockContainer()
  const outsideLayer = new MockContainer()
  outsideLayer.label = 'debugCoordsLayer'
  map.addChild(outsideLayer)

  const interiorContainer = new MockContainer()
  const interiorCell = { i: 2, j: 3, spaceId: 'interior:house', x: 64, y: 40, z: 1 }
  map.grid = [[{ i: 0, j: 0, x: 0, y: 0, z: 0 }]]
  map.size = 1
  map.resources = new Set()
  map.activeSpaceId = 'interior:house'
  map.spaces = new Map([
    ['outside', { container: map, grid: map.grid, id: 'outside', kind: 'outside', origin: { x: 0, y: 0 }, size: 1 }],
    [
      'interior:house',
      {
        container: interiorContainer,
        grid: [[interiorCell]],
        id: 'interior:house',
        kind: 'interior',
        mapType: 'interior',
        origin: { x: 1000, y: 500 },
        size: 1,
      },
    ],
  ])

  drawCoordsDebug({
    controls: { cameraController: { visibleCells: new Set([interiorCell]) } },
    map,
    player: {},
    players: [],
  })

  assert.equal(map.getChildByLabel('debugCoordsLayer'), null)
  assert.equal(outsideLayer.destroyed, true)
  const layer = interiorContainer.getChildByLabel('debugCoordsLayer')
  assert.ok(layer)
  assert.equal(layer.children.length, 1)
  assert.equal(layer.children[0].text, '2,3\nz1')
  assert.deepEqual([layer.children[0].x, layer.children[0].y], [64, 33])
})

test('hero collision debug draws resource blockers at their logical collision position', () => {
  const drawn = []
  const centers = []
  const points = [
    { x: 90, y: 84 },
    { x: 122, y: 100 },
    { x: 90, y: 116 },
    { x: 58, y: 100 },
  ]
  const { drawHeroCollisionDebug } = loadDebugMapRenderers({
    drawRoundedIsoShape: (_layer, shapePoints) => drawn.push(shapePoints),
    getReliefOffset: entity => entity.reliefLift ?? 0,
    getRoundedIsoFootprintPoints: () => points,
  })
  const map = new MockContainer()
  const hero = { family: 'unit', i: 2, j: 2, x: 64, y: 64 }
  const wheat = {
    family: 'resource',
    i: 3,
    isDestroyed: false,
    j: 3,
    reliefLift: -24,
    size: 1,
    type: 'Wheat',
    x: 90,
    y: 100,
  }
  map.grid = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => ({
      i,
      j,
      category: 'Grass',
      has: null,
      solid: false,
      x: i * 10,
      y: j * 10,
    }))
  )
  map.grid[3][3].has = wheat
  map.resources = new Set([wheat])
  map.size = 6

  const originalCircle = MockGraphics.prototype.circle
  MockGraphics.prototype.circle = function circle(x, y, radius) {
    centers.push({ x, y, radius })
  }

  try {
    drawHeroCollisionDebug({
      controls: { cameraController: { visibleCells: new Set(map.grid.flat()) }, heroUnit: hero },
      map,
      player: { units: [hero] },
      players: [{ units: [hero] }],
    })
  } finally {
    MockGraphics.prototype.circle = originalCircle
  }

  assert.deepEqual(drawn[0], points)
  assert.deepEqual(centers[0], { x: 90, y: 100, radius: 3 })
})
