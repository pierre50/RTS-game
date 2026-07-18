const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadControls() {
  const filename = path.join(__dirname, '../app/classes/Controls.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Container: class {
        addChild() {}
        removeChild() {}
        destroy() {}
      },
      Graphics: class {},
    },
    '../controllers/CameraController': {
      CameraController: class {
        constructor() {
          this.camera = { x: 0, y: 0 }
        }
        set() {}
        updateMouseMove() {}
      },
    },
    '../controllers/BuildingPlacer': {
      BuildingPlacer: class {
        cancelWallDraft() {
          return false
        }
        removeMouseBuilding() {}
      },
    },
    '../controllers/SelectionManager': { SelectionManager: class {} },
    '../controllers/RallyPointController': {
      RallyPointController: class {
        constructor() {
          this.active = false
        }
      },
    },
    '../controllers/HeroController': {
      HeroController: class {
        constructor() {
          this.heroUnit = null
          this.equippedTool = null
          this.active = false
          this.lastUpdateFrameScale = null
        }
        isActive() {
          return this.active
        }
        handleKeyDown() {
          return false
        }
        handleKeyUp() {}
        update(frameScale) {
          this.lastUpdateFrameScale = frameScale
        }
        handlePrimaryPointerDown() {}
        handlePointerUp() {}
        setEquippedTool() {}
        stopKeyboardMove() {}
        cancelActiveInteraction() {}
        initFromPlayerStart() {
          return false
        }
      },
    },
    '../lib': {
      isometricToCartesian: () => [0, 0],
      pointsDistance: () => 0,
    },
    '../lib/settings': { getCameraZoom: () => 1 },
    '../lib/heroCursor': { setHeroGameCursorEnabled: () => {} },
    '../lib/unitControl': { hasRtsCommandableUnits: units => Boolean(units?.length) },
    '../constants': {
      IS_MOBILE: false,
      TOUCH_DRAG_THRESHOLD: 10,
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.default
}

class MockElement {
  constructor({ inGame = false, tagName = 'CANVAS' } = {}) {
    this.inGame = inGame
    this.tagName = tagName
  }
  closest(selector) {
    return selector === '#game' && this.inGame ? this : null
  }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 100 }
  }
}

function createControls() {
  const previousDocument = global.document
  const previousElement = global.Element
  const previousWindow = global.window

  global.Element = MockElement
  global.document = {
    addEventListener() {},
    removeEventListener() {},
  }
  global.window = {
    addEventListener() {},
    removeEventListener() {},
  }

  const Controls = loadControls()
  const gamebox = new MockElement({ inGame: true })
  const controls = new Controls({
    app: {
      screen: { width: 100, height: 100 },
      ticker: { add() {}, remove() {} },
    },
    gamebox,
    map: {
      size: 10,
      setCoordinate() {},
    },
    player: {
      selectedUnits: [],
    },
    menu: {
      updateBottombar() {},
    },
  })

  return {
    controls,
    restore() {
      global.document = previousDocument
      global.Element = previousElement
      global.window = previousWindow
    },
  }
}

test('accepts Pixi pointer events whose DOM target is stored on nativeEvent', () => {
  const { controls, restore } = createControls()
  try {
    const pixiSpriteTarget = {}
    const canvasTarget = new MockElement({ inGame: true })

    assert.equal(
      controls.isMouseInApp({
        pageX: 10,
        pageY: 10,
        target: pixiSpriteTarget,
        nativeEvent: { clientX: 10, clientY: 10, target: canvasTarget },
      }),
      true
    )
  } finally {
    restore()
  }
})

test('falls back to native pointer coordinates when no DOM target is available', () => {
  const { controls, restore } = createControls()
  try {
    assert.equal(
      controls.isMouseInApp({
        pageX: 10,
        pageY: 10,
        target: {},
        nativeEvent: { clientX: 10, clientY: 10 },
      }),
      true
    )
    assert.equal(
      controls.isMouseInApp({
        pageX: 200,
        pageY: 200,
        target: {},
        nativeEvent: { clientX: 200, clientY: 200 },
      }),
      false
    )
  } finally {
    restore()
  }
})

test('uses uncapped speed-scaled ticker delta for ARPG hero movement', () => {
  const { controls, restore } = createControls()
  try {
    controls.heroController.active = true
    controls.heroController.heroUnit = { x: 12, y: 34 }

    controls.onTick({
      elapsedMS: 1000 / 60,
      deltaMS: (1000 / 60) * 8,
      deltaTime: 8,
    })

    assert.equal(controls.heroController.lastUpdateFrameScale, 8)
  } finally {
    restore()
  }
})

test('Escape closes ARPG menus even while the game is paused', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    controls.context.paused = true
    controls.heroController.active = true
    controls.context.menu = {
      isInventoryOpen: () => true,
      closeInventory: () => calls.push('closeInventory'),
      isNpcOrdersOpen: () => false,
      isArpgBuildingMenuOpen: () => false,
      updateBottombar() {},
    }

    controls.onKeyDown({
      key: 'Escape',
      target: new MockElement(),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', 'closeInventory'])
  } finally {
    restore()
  }
})

test('Escape cancels active building placement', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    controls.mouseBuilding = { type: 'house' }
    controls.removeMouseBuilding = () => {
      calls.push('removeMouseBuilding')
      controls.mouseBuilding = null
    }
    controls.context.menu = {
      updateBottombar: () => calls.push('updateBottombar'),
    }

    controls.onKeyDown({
      key: 'Escape',
      target: new MockElement(),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', 'removeMouseBuilding', 'updateBottombar'])
    assert.equal(controls.mouseBuilding, null)
  } finally {
    restore()
  }
})
