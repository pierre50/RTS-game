const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class MockContainer {
  constructor() {
    this.children = []
    this.eventMode = null
    this.label = null
    this.parent = null
    this.sortableChildren = false
    this.visible = true
    this.zIndex = 0
  }

  addChild(...children) {
    this.children.push(...children)
    for (const child of children) child.parent = this
    return children[0]
  }

  removeChild(child) {
    this.children = this.children.filter(candidate => candidate !== child)
    child.parent = null
    return child
  }

  sortChildren() {
    this.sorted = true
  }

  destroy() {
    this.destroyed = true
  }
}

class MockMatrix {
  identity() {
    this.translateX = 0
    this.translateY = 0
    return this
  }

  translate(x, y) {
    this.translateX = x
    this.translateY = y
    return this
  }
}

class MockRenderTexture {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.source = { autoGarbageCollect: true }
  }

  static create(options) {
    return new MockRenderTexture(options.width, options.height)
  }

  resize(width, height) {
    this.width = width
    this.height = height
  }

  destroy() {
    this.destroyed = true
  }
}

class MockSprite extends MockContainer {
  constructor(texture) {
    super()
    this.texture = texture
    this.alpha = 1
    this.roundPixels = false
    this.position = {
      set: (x, y) => {
        this.x = x
        this.y = y
      },
    }
  }
}

function loadShadowSystem({ shadowsEnabled = true } = {}) {
  return loadTsModule('app/services/ShadowSystem.ts', {
    mocks: {
      'pixi.js': {
        Container: MockContainer,
        Matrix: MockMatrix,
        RenderTexture: MockRenderTexture,
        Sprite: MockSprite,
      },
      '../constants': { BUCKET_SIZE: 8, CELL_DEPTH: 16, CELL_HEIGHT: 32, CELL_WIDTH: 64 },
      '../lib/audio/settings': { getShadowsEnabled: () => shadowsEnabled },
    },
  })
}

function createContext(renders) {
  return {
    app: {
      renderer: {
        render: options => renders.push(options),
      },
      ticker: {
        add(handler) {
          this.handler = handler
        },
        remove() {},
      },
    },
    controls: {
      getViewportMetrics: () => ({
        visibleHeight: 300,
        visibleLeft: 320,
        visibleTop: 200,
        visibleWidth: 400,
      }),
    },
  }
}

function createMap() {
  const map = new MockContainer()
  map.grid = []
  map.mapType = 'test'
  map.shadowLayer = new MockContainer()
  map.size = 0
  map.spaces = new Map()
  return map
}

test('shadow system renders no shadows while a building interior is active', () => {
  const renders = []
  const { ShadowSystem } = loadShadowSystem()
  const context = createContext(renders)
  const map = createMap()
  const interiorShadowLayer = new MockContainer()
  const interiorScene = new MockContainer()
  map.activeSpaceId = 'interior:test'
  map.spaces.set('interior:test', {
    container: new MockContainer(),
    grid: [],
    id: 'interior:test',
    kind: 'interior',
    origin: { x: 300, y: 120 },
    shadowLayer: interiorShadowLayer,
    shadowRenderContainer: interiorScene,
    size: 0,
  })
  interiorShadowLayer.addChild({ label: 'hero-shadow' }, { label: 'furniture-shadow' })

  const shadows = new ShadowSystem(context, map)
  shadows.update(16)

  assert.equal(shadows.layer.parent, interiorScene)
  assert.equal(shadows.layer.visible, false)
  assert.equal(renders.length, 0)
})

test('shadow system renders no shadows on an interior map', () => {
  const renders = []
  const { ShadowSystem } = loadShadowSystem()
  const context = createContext(renders)
  const map = createMap()
  map.mapType = 'interior'
  map.shadowLayer.addChild({ label: 'villager-shadow' })

  const shadows = new ShadowSystem(context, map)
  shadows.update(16)

  assert.equal(shadows.layer.visible, false)
  assert.equal(renders.length, 0)
})

test('shadow system returns to the outside shadow source when no interior is active', () => {
  const renders = []
  const { ShadowSystem } = loadShadowSystem()
  const context = createContext(renders)
  const map = createMap()
  map.shadowLayer.addChild({ label: 'outside-shadow' })

  const shadows = new ShadowSystem(context, map)
  shadows.update(16)

  assert.equal(shadows.layer.parent, map)
  assert.equal(shadows.layer.visible, true)
  assert.equal(shadows.sprite.x, 320)
  assert.equal(shadows.sprite.y, 203)
  assert.equal(renders[0].container, map.shadowLayer)
})

test('a ticker updates shadows exactly once with or without performance measurement', () => {
  const { ShadowSystem } = loadShadowSystem()
  for (const monitored of [false, true]) {
    const context = createContext([])
    if (monitored) context.performance = { measure: (_name, callback) => callback() }
    const shadows = new ShadowSystem(context, createMap())
    const elapsed = []
    shadows.update = ms => {
      elapsed.push(ms)
    }
    context.app.ticker.handler({ deltaMS: 16 })
    assert.deepEqual(elapsed, [16])
  }
})
