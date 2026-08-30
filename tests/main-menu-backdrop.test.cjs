const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class MockGraphics {
  constructor() {
    this.drawnRects = []
    this.filters = []
  }

  clear() {
    this.drawnRects = []
    return this
  }

  rect(x, y, width, height) {
    this.drawnRects.push({ x, y, width, height })
    return this
  }

  fill() {
    return this
  }

  circle() {
    return this
  }

  poly() {
    return this
  }

  moveTo() {
    return this
  }

  lineTo() {
    return this
  }

  stroke() {
    return this
  }
}

class MockContainer {
  constructor() {
    this.children = []
    this.eventMode = 'auto'
    this.label = ''
    this.sortableChildren = false
  }

  addChild(child) {
    this.children.push(child)
    return child
  }

  destroy() {}
}

class MockSprite {
  constructor(texture) {
    this.texture = texture
    this.anchor = { set() {} }
    this.scale = { set: value => (this._scale = value) }
    this.alpha = 1
    this.eventMode = 'auto'
    this.height = texture?.height ?? 1
    this.mask = null
    this.width = texture?.width ?? 1
    this.x = 0
    this.y = 0
  }
}

function loadBackdrop() {
  return loadTsModule('app/screens/MainMenuBackdrop.ts', {
    mocks: {
      'pixi.js': {
        Assets: { load: async () => ({ width: 100, height: 50, source: {} }) },
        Container: MockContainer,
        FillGradient: class {
          constructor(options) {
            this.options = options
          }
        },
        Graphics: MockGraphics,
        Sprite: MockSprite,
        Texture: {
          from: () => ({ width: 8, height: 256 }),
        },
      },
      'pixi-filters': {
        GodrayFilter: class {
          constructor(options) {
            this.options = options
            this.angle = options.angle
            this.time = 0
          }
        },
      },
    },
  })
}

test('main menu backdrop redraws sky when renderer screen size changes', () => {
  const previousDocument = global.document
  const previousWindow = global.window

  global.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        fillStyle: '',
      }),
    }),
  }
  global.window = {
    matchMedia: () => ({ matches: false }),
  }

  try {
    const { MainMenuBackdrop } = loadBackdrop()
    const ticker = {
      add(handler) {
        this.handler = handler
      },
      remove() {},
    }
    const app = {
      screen: { width: 800, height: 450 },
      stage: { addChildAt() {} },
      ticker,
    }
    const backdrop = new MainMenuBackdrop(app)

    assert.deepEqual(backdrop.sky.drawnRects.at(-1), { x: 0, y: 0, width: 800, height: 450 })

    app.screen.width = 1200
    app.screen.height = 700
    ticker.handler({ deltaMS: 16.67 })

    assert.deepEqual(backdrop.sky.drawnRects.at(-1), { x: 0, y: 0, width: 1200, height: 700 })
  } finally {
    global.document = previousDocument
    global.window = previousWindow
  }
})
