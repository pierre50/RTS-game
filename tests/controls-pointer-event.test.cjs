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
        constructor() {
          this.moveCalls = 0
        }
        cancelWallDraft() {
          return false
        }
        handleMouseMove() {
          this.moveCalls++
        }
        removeMouseBuilding() {}
      },
    },
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
          this.primaryPointerDowns = 0
          this.keyUps = []
          this.stopKeyboardMoveCalls = 0
        }
        isActive() {
          return this.active
        }
        handleKeyDown(action) {
          return typeof action === 'string' && action.startsWith('hero')
        }
        handleKeyUp(action) {
          this.keyUps.push(action)
        }
        update(frameScale) {
          this.lastUpdateFrameScale = frameScale
        }
        handlePrimaryPointerDown() {
          this.primaryPointerDowns++
        }
        handlePointerUp() {}
        setEquippedTool() {}
        stopKeyboardMove() {
          this.stopKeyboardMoveCalls++
        }
        cancelActiveInteraction() {}
        initFromPlayerStart() {
          return false
        }
      },
    },
    '../controllers/GamepadHeroInput': {
      GamepadHeroInput: class {
        constructor() {
          this.moveVector = { dx: 0, dy: 0 }
          this.aimVector = null
          this.connected = false
        }
        update() {}
      },
    },
    '../lib': {
      isometricToCartesian: () => [0, 0],
      pointsDistance: () => 0,
      instanceContactInstance: () => true,
    },
    '../lib/settings': {
      getCameraZoom: () => 1,
      getControlActionForKeyboardEvent: evt => {
        if (evt.key === 'z') return 'heroUp'
        if (evt.key === 'ArrowLeft') return 'cameraLeft'
        return null
      },
    },
    '../lib/heroCursor': {
      setHeroGameCursorEnabled: () => {},
      setVirtualCursorVisible: () => {},
      setVirtualCursorPosition: () => {},
    },
    '../constants': {
      FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal' },
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
      x: 0,
      y: 0,
      size: 10,
      grid: [[{}]],
      setCoordinate() {},
    },
    player: {
      selectedUnits: [],
      selectedBuilding: null,
      selectedUnit: null,
      selectedOther: null,
      unselectAll() {
        this.selectedUnits = []
        this.selectedBuilding = null
        this.selectedUnit = null
        this.selectedOther = null
      },
    },
    menu: {
      updateActionTarget() {},
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

test('uses uncapped speed-scaled ticker delta for hero-controlled unit movement', () => {
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

test('refreshes building preview while hero camera follows the moving hero', () => {
  const { controls, restore } = createControls()
  try {
    controls.heroController.active = true
    controls.heroController.heroUnit = { x: 12, y: 34 }
    controls.mouseBuilding = { type: 'house' }

    controls.onTick({
      elapsedMS: 1000 / 60,
      deltaMS: 1000 / 60,
      deltaTime: 1,
    })

    assert.equal(controls.buildingPlacer.moveCalls, 1)
  } finally {
    restore()
  }
})

test('keyup falls back to the original physical code when Option changes the key value', () => {
  const { controls, restore } = createControls()
  try {
    controls.heroController.active = true
    controls.onKeyDown({
      key: 'z',
      code: 'KeyW',
      target: new MockElement(),
    })

    controls.onKeyUp({
      key: '∑',
      code: 'KeyW',
      target: new MockElement(),
    })

    assert.deepEqual(controls.heroController.keyUps, ['heroUp'])
  } finally {
    restore()
  }
})

test('Option key clears active movement controls', () => {
  const { controls, restore } = createControls()
  try {
    controls.keysPressed.cameraLeft = true
    controls.keyPressedCount = 1
    controls.heroController.active = true

    controls.onKeyDown({
      key: 'Alt',
      altKey: true,
      target: new MockElement(),
    })

    assert.deepEqual(controls.keysPressed, {})
    assert.equal(controls.keyPressedCount, 0)
    assert.equal(controls.heroController.stopKeyboardMoveCalls, 1)
  } finally {
    restore()
  }
})

test('Escape closes hero menus even while the game is paused', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    controls.context.paused = true
    controls.heroController.active = true
    controls.context.menu = {
      isInventoryOpen: () => true,
      closeInventory: () => calls.push('closeInventory'),
      isNpcOrdersOpen: () => false,
      isHeroBuildingMenuOpen: () => false,
      updateActionTarget() {},
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
      updateActionTarget: () => calls.push('updateActionTarget'),
    }

    controls.onKeyDown({
      key: 'Escape',
      target: new MockElement(),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', 'removeMouseBuilding', 'updateActionTarget'])
    assert.equal(controls.mouseBuilding, null)
  } finally {
    restore()
  }
})

test('hero left click attacks instead of opening a building modal', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    controls.heroController.active = true
    controls.context.map.grid[0][0] = {
      has: { family: 'building', select: () => calls.push('select') },
    }
    controls.context.menu.openHeroBuildingMenu = () => {
      calls.push('openHeroBuildingMenu')
      return true
    }

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 0,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault'])
    assert.equal(controls.heroController.primaryPointerDowns, 1)
  } finally {
    restore()
  }
})

test('hero right click opens building selection interaction', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    const building = {
      family: 'building',
      select: () => calls.push('select'),
    }
    controls.heroController.active = true
    controls.context.map.grid[0][0] = { has: building }
    controls.context.menu.openHeroBuildingMenu = target => {
      calls.push(['openHeroBuildingMenu', target])
      return true
    }

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 2,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', ['openHeroBuildingMenu', building], 'select'])
    assert.equal(controls.context.player.selectedBuilding, building)
    assert.equal(controls.heroController.primaryPointerDowns, 0)
  } finally {
    restore()
  }
})

test('hero control-click opens building selection interaction on macOS', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    const building = {
      family: 'building',
      select: () => calls.push('select'),
    }
    controls.heroController.active = true
    controls.context.map.grid[0][0] = { has: building }
    controls.context.menu.openHeroBuildingMenu = target => {
      calls.push(['openHeroBuildingMenu', target])
      return true
    }

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 0,
      ctrlKey: true,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', ['openHeroBuildingMenu', building], 'select'])
    assert.equal(controls.context.player.selectedBuilding, building)
    assert.equal(controls.heroController.primaryPointerDowns, 0)
  } finally {
    restore()
  }
})

test('hero context menu is suppressed inside the game', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    controls.heroController.active = true

    controls.onContextMenu({
      clientX: 10,
      clientY: 10,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
      stopImmediatePropagation: () => calls.push('stopImmediatePropagation'),
    })

    assert.deepEqual(calls, ['preventDefault', 'stopPropagation', 'stopImmediatePropagation'])
  } finally {
    restore()
  }
})

test('hero control-click suppresses delayed context menu even after modal opens', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    const building = { family: 'building', select() {} }
    controls.heroController.active = true
    controls.context.map.grid[0][0] = { has: building }
    controls.context.menu.openHeroBuildingMenu = () => true

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 0,
      ctrlKey: true,
      target: new MockElement({ inGame: true }),
      preventDefault: () => {},
    })

    controls.onContextMenu({
      clientX: 10,
      clientY: 10,
      target: new MockElement({ inGame: false }),
      preventDefault: () => calls.push('preventDefault'),
      stopPropagation: () => calls.push('stopPropagation'),
      stopImmediatePropagation: () => calls.push('stopImmediatePropagation'),
    })

    assert.deepEqual(calls, ['preventDefault', 'stopPropagation', 'stopImmediatePropagation'])
  } finally {
    restore()
  }
})

test('hero right click opens info modal for units', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    const unit = { family: 'unit' }
    controls.heroController.active = true
    controls.heroController.heroUnit = { family: 'unit' }
    controls.context.map.grid[0][0] = { has: unit }
    controls.context.menu.openEntityInfoModal = target => {
      calls.push(['openEntityInfoModal', target])
      return true
    }

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 2,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault', ['openEntityInfoModal', unit]])
  } finally {
    restore()
  }
})

test('hero right click on self does not open info modal', () => {
  const { controls, restore } = createControls()
  try {
    const calls = []
    const hero = { family: 'unit' }
    controls.heroController.active = true
    controls.heroController.heroUnit = hero
    controls.context.map.grid[0][0] = { has: hero }
    controls.context.menu.openEntityInfoModal = target => {
      calls.push(['openEntityInfoModal', target])
      return true
    }

    controls.onMouseDown({
      pageX: 10,
      pageY: 10,
      button: 2,
      target: new MockElement({ inGame: true }),
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault'])
  } finally {
    restore()
  }
})
