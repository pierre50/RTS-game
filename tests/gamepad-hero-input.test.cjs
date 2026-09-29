const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadGamepadHeroInput(getGamepad, bindings = {}) {
  const filename = path.join(__dirname, '../app/controllers/GamepadHeroInput.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib/input/gamepad': {
      GAMEPAD_AXIS: { moveX: 0, moveY: 1, aimX: 2, aimY: 3 },
      GAMEPAD_BUTTON: {
        action: 5,
        defense: 4,
        inspect: 8,
        interact: 2,
        inventory: 3,
        toolPrev: 6,
        toolNext: 7,
        dpadUp: 12,
        dpadDown: 13,
        dpadLeft: 14,
        dpadRight: 15,
      },
      GAMEPAD_CURSOR_SPEED: 18,
      getActiveGamepad: getGamepad,
      readStick: () => ({ x: 0, y: 0 }),
    },
    '../lib/hero/heroCursor': {
      setVirtualCursorPosition: () => {},
      setVirtualCursorVisible: () => {},
    },
    '../lib/audio/settings': {
      getGamepadEnabled: () => true,
      getGamepadButtonIndex: action =>
        bindings[action] ??
        {
          heroUp: 12,
          heroDown: 13,
          heroLeft: 14,
          heroRight: 15,
          heroDefense: 4,
          heroInteract: 2,
          inventory: 3,
          heroMountHorse: 10,
          heroDismountHorse: 11,
          quests: 1,
          heroToolPrev: 6,
          heroToolNext: 7,
          heroInspect: 8,
          heroAction: 5,
          placementPlace: 0,
          placementMirror: 2,
          placementCancel: 1,
          inventoryTransferOne: 0,
          inventoryTransferAll: 2,
        }[action],
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.GamepadHeroInput
}

test('gamepad inventory transfer buttons dispatch one/all actions to hovered slots', () => {
  let gamepad = makeGamepad()
  const calls = []
  const previousDocument = global.document
  const previousWindow = global.window
  const slot = {
    dispatchEvent: event => calls.push(event.detail.mode),
  }
  global.window = { scrollX: 0, scrollY: 0 }
  global.document = {
    elementFromPoint: () => ({
      closest: selector => (selector === '[data-inventory-transfer-slot="true"]' ? slot : null),
    }),
  }
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { gamebox: { getBoundingClientRect: () => ({ width: 100, height: 100 }) } },
    mouse: { x: 10, y: 10 },
    heroController: {
      handleKeyDown: () => {},
      handleKeyUp: () => {},
      cycleTool: () => {},
      handlePrimaryPointerDown: () => {},
      handlePointerUp: () => {},
    },
    openHeroEntityInteraction: () => {},
  })

  try {
    input.update()
    gamepad = makeGamepad([0])
    input.update()
    input.update()
    gamepad = makeGamepad()
    input.update()
    gamepad = makeGamepad([2])
    input.update()

    assert.deepEqual(calls, ['one', 'all'])
  } finally {
    global.document = previousDocument
    global.window = previousWindow
  }
})

function makeGamepad(pressed = []) {
  const pressedButtons = new Set(pressed)
  return {
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressedButtons.has(index) })),
  }
}

test('gamepad inspect button opens the hero entity interaction once per press', () => {
  let gamepad = makeGamepad()
  const calls = []
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { app: { screen: { width: 100, height: 100 } } },
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: action => calls.push(['down', action]),
      handleKeyUp: action => calls.push(['up', action]),
      cycleTool: direction => calls.push(['cycle', direction]),
      handlePrimaryPointerDown: () => calls.push('primaryDown'),
      handlePointerUp: () => calls.push('primaryUp'),
    },
    openHeroEntityInteraction: () => calls.push('openInfo'),
  })

  input.update()
  gamepad = makeGamepad([8])
  input.update()
  input.update()
  gamepad = makeGamepad()
  input.update()
  gamepad = makeGamepad([8])
  input.update()

  assert.deepEqual(calls, ['openInfo', 'openInfo'])
})

test('gamepad L1 holds and releases hero defense', () => {
  let gamepad = makeGamepad()
  const calls = []
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { app: { screen: { width: 100, height: 100 } } },
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: action => calls.push(['down', action]),
      handleKeyUp: action => calls.push(['up', action]),
      cycleTool: direction => calls.push(['cycle', direction]),
      handlePrimaryPointerDown: () => calls.push('primaryDown'),
      handlePointerUp: () => calls.push('primaryUp'),
    },
    openHeroEntityInteraction: () => calls.push('openInfo'),
  })

  input.update()
  gamepad = makeGamepad([4])
  input.update()
  input.update()
  gamepad = makeGamepad()
  input.update()

  assert.deepEqual(calls, [
    ['down', 'heroDefense'],
    ['up', 'heroDefense'],
  ])
})

test('gamepad X holds and releases hero direction lock', () => {
  let gamepad = makeGamepad()
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { app: { screen: { width: 100, height: 100 } } },
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: () => {},
      handleKeyUp: () => {},
      cycleTool: () => {},
      handlePrimaryPointerDown: () => {},
      handlePointerUp: () => {},
    },
    openHeroEntityInteraction: () => {},
  })

  input.update()
  assert.equal(input.directionLockActive, false)

  gamepad = makeGamepad([2])
  input.update()
  assert.equal(input.directionLockActive, true)

  gamepad = makeGamepad()
  input.update()
  assert.equal(input.directionLockActive, false)
})

test('game windows consume controller buttons and release world actions only once', () => {
  let gamepad = makeGamepad()
  let modalOpen = false
  const previousDocument = global.document
  global.document = { querySelector: () => (modalOpen ? {} : null) }
  const calls = []
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { gamebox: { getBoundingClientRect: () => ({ width: 100, height: 100 }) } },
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: action => calls.push(`down:${action}`),
      handleKeyUp: action => calls.push(`up:${action}`),
      handlePointerUp: () => calls.push('release'),
      handlePrimaryPointerDown: () => calls.push('attack'),
      cycleTool: () => calls.push('tool'),
    },
    openHeroEntityInteraction: () => calls.push('inspect'),
  })
  try {
    input.update()
    gamepad = makeGamepad([12])
    input.update()
    modalOpen = true
    gamepad = makeGamepad([3, 5, 12])
    input.update()
    input.update()
    assert.deepEqual(calls, ['down:heroUp', 'up:heroUp'])
    assert.deepEqual(input.moveVector, { dx: 0, dy: 0 })
    modalOpen = false
    input.update()
    assert.equal(calls.includes('attack'), false)
    assert.equal(calls.includes('down:inventory'), false)
  } finally {
    global.document = previousDocument
  }
})

test('placement consumes A/X/B without attacking or opening another interaction', () => {
  let gamepad = makeGamepad()
  const calls = []
  const modes = []
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: {},
    mouse: { x: 0, y: 0 },
    mouseBuilding: {},
    buildingPlacer: {
      confirmPlacement: () => calls.push('place'),
      toggleMirror: () => calls.push('mirror'),
      cancelPlacement: () => calls.push('cancel'),
      setPlacementGamepad: value => modes.push(value),
    },
    heroController: {
      handleKeyDown: () => calls.push('world'),
      handleKeyUp() {},
      cycleTool: () => calls.push('tool'),
      handlePrimaryPointerDown: () => calls.push('attack'),
      handlePointerUp() {},
    },
    openHeroEntityInteraction: () => calls.push('interact'),
  })
  input.update()
  for (const index of [2, 0, 1]) {
    gamepad = makeGamepad([index])
    input.update()
    input.update()
    gamepad = makeGamepad()
    input.update()
  }
  assert.deepEqual(calls, ['mirror', 'place', 'cancel'])
  assert.equal(modes[0], true)
  gamepad = null
  input.update()
  assert.equal(modes.at(-1), false)
  gamepad = makeGamepad()
  input.update()
  assert.equal(modes.at(-1), true)
})

test('custom hero and placement bindings dispatch the mapped actions and release held actions', () => {
  let gamepad = makeGamepad()
  const calls = []
  const bindings = {
    heroUp: 15,
    heroDown: 14,
    heroLeft: 13,
    heroRight: 12,
    heroInteract: 0,
    heroDefense: 2,
    inventory: 1,
    heroMountHorse: 6,
    heroDismountHorse: 7,
    quests: 3,
    heroToolPrev: 10,
    heroToolNext: 11,
    heroInspect: 9,
    heroAction: 8,
    placementPlace: 3,
    placementMirror: 4,
    placementCancel: 5,
  }
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad, bindings)
  const controls = {
    context: {},
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: action => calls.push(`down:${action}`),
      handleKeyUp: action => calls.push(`up:${action}`),
      cycleTool: direction => calls.push(`tool:${direction}`),
      handlePrimaryPointerDown: () => calls.push('attack'),
      handlePointerUp: () => calls.push('release'),
    },
    openHeroEntityInteraction: () => calls.push('inspect'),
    buildingPlacer: {
      confirmPlacement: () => calls.push('place'),
      toggleMirror: () => calls.push('mirror'),
      cancelPlacement: () => calls.push('cancel'),
      setPlacementGamepad() {},
    },
  }
  const input = new GamepadHeroInput(controls)
  function press(index) {
    gamepad = makeGamepad([index])
    input.update()
    input.update()
    gamepad = makeGamepad()
    input.update()
  }
  input.update()
  for (const action of ['heroUp', 'heroDown', 'heroLeft', 'heroRight', 'heroInteract', 'heroDefense', 'inventory']) {
    calls.length = 0
    press(bindings[action])
    assert.deepEqual(calls, [`down:${action}`, `up:${action}`])
  }
  calls.length = 0
  for (const action of ['heroToolPrev', 'heroToolNext', 'heroInspect', 'heroAction']) press(bindings[action])
  assert.deepEqual(calls, ['tool:-1', 'tool:1', 'inspect', 'attack', 'release'])
  controls.mouseBuilding = {}
  calls.length = 0
  for (const action of ['placementPlace', 'placementMirror', 'placementCancel']) press(bindings[action])
  assert.deepEqual(calls, ['place', 'mirror', 'cancel'])
})

test('disconnect and suspension release held world actions and consume buttons used in menus', () => {
  let gamepad = makeGamepad()
  const calls = []
  const bindings = { heroDefense: 4 }
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad, bindings)
  const input = new GamepadHeroInput({
    context: {},
    mouse: { x: 0, y: 0 },
    heroController: {
      cancelActiveInteraction: () => calls.push('cancel'),
      handleKeyDown: action => calls.push(`down:${action}`),
      handleKeyUp: action => calls.push(`up:${action}`),
      handlePrimaryPointerDown: () => calls.push('attack'),
      handlePointerUp: () => calls.push('release'),
      cycleTool() {},
    },
    openHeroEntityInteraction() {},
  })
  input.update()
  gamepad = makeGamepad([4, 5, 12])
  input.update()
  calls.length = 0
  gamepad = null
  input.update()
  input.update()
  assert.deepEqual(calls, ['cancel', 'up:heroUp', 'up:heroDefense', 'release'])
  assert.deepEqual(input.moveVector, { dx: 0, dy: 0 })
  gamepad = makeGamepad([5])
  input.suspend()
  calls.length = 0
  input.update()
  assert.deepEqual(calls, [])
  gamepad = makeGamepad()
  input.update()
  gamepad = makeGamepad([4])
  input.update()
  calls.length = 0
  bindings.heroDefense = 0
  input.update()
  assert.deepEqual(calls, ['up:heroDefense'])
})

test('horse controls and quest journal have usable controller buttons', () => {
  let gamepad = makeGamepad()
  const calls = []
  const GamepadHeroInput = loadGamepadHeroInput(() => gamepad)
  const input = new GamepadHeroInput({
    context: { menu: { toggleQuests: () => calls.push('quests') } },
    mouse: { x: 0, y: 0 },
    heroController: {
      handleKeyDown: action => calls.push(action),
      handleKeyUp() {},
      handlePrimaryPointerDown() {},
      handlePointerUp() {},
      cycleTool() {},
    },
    openHeroEntityInteraction() {},
  })
  input.update()
  for (const button of [10, 11, 1]) {
    gamepad = makeGamepad([button])
    input.update()
    input.update()
    gamepad = makeGamepad()
    input.update()
  }
  assert.deepEqual(calls, ['heroMountHorse', 'heroDismountHorse', 'quests'])
})
