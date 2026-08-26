const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadGamepadHeroInput(getGamepad) {
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
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.GamepadHeroInput
}

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
