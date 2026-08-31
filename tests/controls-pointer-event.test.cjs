const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadControls() {
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
        stopMouseMove() {}
        updateMouseMove() {}
        getViewportRect() {
          return {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
            visibleLeft: 0,
            visibleTop: 0,
            visibleWidth: 100,
            visibleHeight: 100,
          }
        }
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
        cancel() {}
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
          this.secondaryPointerDowns = 0
          this.keyDowns = []
          this.keyUps = []
          this.stopKeyboardMoveCalls = 0
        }
        isActive() {
          return this.active
        }
        handleKeyDown(action) {
          this.keyDowns.push(action)
          return typeof action === 'string' && action.startsWith('hero')
        }
        handleKeyUp(action) {
          this.keyUps.push(action)
        }
        update(frameScale) {
          this.lastUpdateFrameScale = frameScale
        }
        updateCriticalHealthEffects() {}
        updateOcclusionFade() {}
        handlePrimaryPointerDown() {
          this.primaryPointerDowns++
        }
        handleSecondaryPointerDown() {
          this.secondaryPointerDowns++
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
      isometricToCartesian: (x, y) => [Math.round((x / 32 + y / 16) / 2), Math.round((y / 16 - x / 32) / 2)],
      getReliefOffset: () => 0,
      pointsDistance: () => 0,
      instanceContactInstance: () => true,
    },
    '../lib/mapSpaces': {
      getActiveInteractionSpace: () => null,
      getEntityMapPoint: instance => ({ x: instance.x, y: instance.y }),
      getSpaceLocalPointFromMapPoint: (_space, point) => point,
    },
    '../lib/audio/settings': {
      DISPLAY_SCALE: 1,
      getCameraZoom: () => 1,
      getControlActionForKeyboardEvent: evt => {
        if (evt.key === 'z') return 'heroUp'
        if (evt.key === 'e') return 'heroInteract'
        if (evt.key === 'i') return 'inventory'
        if (evt.key === ' ') return 'heroDefense'
        if (evt.key === 'Shift') return 'heroDismountHorse'
        if (evt.key === 'ArrowLeft') return 'cameraLeft'
        return null
      },
    },
    '../lib/hero/heroCursor': {
      setHeroGameCursorEnabled: () => {},
      setVirtualCursorVisible: () => {},
      setVirtualCursorPosition: () => {},
    },
    '../lib/hero/heroActionRange': {
      isHeroInteractionTargetReachable: () => true,
    },
    '../lib/hero/heroProximityInteractions': {
      resolveHeroNpcProximityInteraction: () => null,
    },
    '../lib/hero/heroTools': {
      findFacingEntity: () => null,
    },
    '../lib/npc/npcInteraction': {
      isTalkableNpc: () => false,
    },
    '../lib/npc/npcChatter': {
      pickForeignNpcChatterLine: () => '',
      pickNpcChatterLine: () => '',
    },
    '../constants': {
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal' },
      IS_MOBILE: false,
      TOUCH_DRAG_THRESHOLD: 10,
    },
  }
  const localRequire = request => {
    if (request === '../controllers/TouchInputController') {
      return loadTsFile(path.join(__dirname, '../app/controllers/TouchInputController.ts'))
    }
    if (request === '../controllers/PointerInputController') {
      return loadTsFile(path.join(__dirname, '../app/controllers/PointerInputController.ts'))
    }
    if (request === '../controllers/HeroInteractionController') {
      return loadTsFile(path.join(__dirname, '../app/controllers/HeroInteractionController.ts'))
    }
    if (request === './ControlsKeyboard') {
      return loadTsFile(path.join(__dirname, '../app/classes/ControlsKeyboard.ts'))
    }
    return Object.hasOwn(mocks, request) ? mocks[request] : require(request)
  }
  const loadTsFile = filename => {
    const source = fs.readFileSync(filename, 'utf8')
    const { code } = babel.transformSync(source, {
      filename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const module = { exports: {} }
    new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
    return module.exports
  }
  return loadTsFile(path.join(__dirname, '../app/classes/Controls.ts')).default
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
    return { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 }
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

function createGrid(size, elevated = new Map()) {
  return Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => {
      const z = elevated.get(`${i},${j}`) ?? 0
      return {
        i,
        j,
        x: (i - j) * 32,
        y: (i + j) * 16 - z * 16,
        z,
      }
    })
  )
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

test('picks the visually elevated terrain cell under the cursor', () => {
  const { controls, restore } = createControls()
  try {
    const grid = createGrid(8, new Map([['4,4', 3]]))
    controls.context.map.size = 8
    controls.context.map.grid = grid
    controls.mouse.x = grid[4][4].x
    controls.mouse.y = grid[4][4].y

    assert.equal(controls.getCellUnderCursor(), grid[4][4])
  } finally {
    restore()
  }
})

test('time skip blocks hero-controlled unit movement', () => {
  const { controls, restore } = createControls()
  try {
    controls.context.timeSkip = { active: true }
    controls.heroController.active = true
    controls.heroController.heroUnit = { x: 12, y: 34 }

    controls.onTick({
      elapsedMS: 1000 / 60,
      deltaMS: (1000 / 60) * 8,
      deltaTime: 8,
    })

    assert.equal(controls.isHeroControlActive(), false)
    assert.equal(controls.isInteractionBlocked(), true)
    assert.equal(controls.heroController.lastUpdateFrameScale, null)
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

test('inventory key closes inventory even while the game is paused', () => {
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
    }

    controls.onKeyDown({
      key: 'i',
      code: 'KeyI',
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

test('hero right click no longer opens building selection interaction', () => {
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

    assert.deepEqual(calls, ['preventDefault'])
    assert.equal(controls.context.player.selectedBuilding, null)
    assert.equal(controls.heroController.primaryPointerDowns, 0)
    assert.equal(controls.heroController.secondaryPointerDowns, 1)
  } finally {
    restore()
  }
})

test('hero entity interaction opens building selection interaction', () => {
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

    assert.equal(controls.openHeroEntityInteraction(building), true)

    assert.deepEqual(calls, [['openHeroBuildingMenu', building], 'select'])
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

test('hero control-click stays a primary hero action on macOS', () => {
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
      preventDefault: () => calls.push('preventDefault'),
    })

    assert.deepEqual(calls, ['preventDefault'])
    assert.equal(controls.heroController.primaryPointerDowns, 1)
    assert.equal(controls.heroController.secondaryPointerDowns, 0)
  } finally {
    restore()
  }
})

test('hero defense key is handled by hero controller', () => {
  const { controls, restore } = createControls()
  try {
    controls.heroController.active = true

    controls.onKeyDown({
      key: ' ',
      code: 'Space',
      preventDefault() {},
      target: new MockElement(),
    })
    controls.onKeyUp({
      key: ' ',
      code: 'Space',
      target: new MockElement(),
    })

    assert.deepEqual(controls.heroController.keyUps, ['heroDefense'])
  } finally {
    restore()
  }
})

test('Shift dismount action is handled without enabling slow walk', () => {
  const { controls, restore } = createControls()
  try {
    controls.heroController.active = true

    controls.onKeyDown({
      key: 'Shift',
      code: 'ShiftLeft',
      preventDefault() {},
      target: new MockElement(),
    })
    controls.onKeyUp({
      key: 'Shift',
      code: 'ShiftLeft',
      preventDefault() {},
      target: new MockElement(),
    })

    assert.deepEqual(controls.heroController.keyDowns, ['heroDismountHorse'])
    assert.deepEqual(controls.heroController.keyUps, ['heroDismountHorse'])
    assert.equal(controls.shiftKeyActive, false)
  } finally {
    restore()
  }
})

test('hero entity interaction opens info modal for units', () => {
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

    assert.equal(controls.openHeroEntityInteraction(unit), true)

    assert.deepEqual(calls, [['openEntityInfoModal', unit]])
  } finally {
    restore()
  }
})

test('hero entity interaction on self does not open info modal', () => {
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

    assert.equal(controls.openHeroEntityInteraction(hero), false)

    assert.deepEqual(calls, [])
  } finally {
    restore()
  }
})
