const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { findDirectionalTarget, GameWindowPadState } = loadTsModule('app/lib/ui/GameWindowNavigation.ts')

function pad(pressed = [], axes = [0, 0]) {
  return { axes, buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })) }
}

test('spatial navigation follows responsive grids and stops at their edges', () => {
  const slots = [
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: 160, y: 0 },
    { x: 0, y: 80 },
    { x: 80, y: 80 },
  ]
  assert.equal(findDirectionalTarget(slots, 1, 0, 1), 4)
  assert.equal(findDirectionalTarget(slots, 1, 1, 0), 2)
  assert.equal(findDirectionalTarget(slots, 0, -1, 0), 0)
  assert.equal(findDirectionalTarget([], -1, 1, 0), -1)
})

test('vertical settings navigation visits zoom before brightness despite different field widths', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: {
      '@pixi/sound': { sound: {} },
      './GameWindowForms': { getWindowField: () => null },
    },
  })
  const item = (x, y, row = false) => ({
    getBoundingClientRect: () => ({ x, y, width: 20, height: 20 }),
    closest: () => (row ? { getBoundingClientRect: () => ({ x: 0, y, width: 400, height: 20 }) } : null),
    matches: selector => !row && (selector === '.ui-tab' || selector === '.ui-tab[aria-selected="true"]'),
  })
  const tab = item(100, 0)
  const zoom = item(300, 60, true)
  const brightness = item(200, 110, true)
  const shadows = item(380, 160, true)
  const window = Object.create(GameWindow.prototype)
  Object.assign(window, {
    selected: tab,
    items: () => [tab, zoom, brightness, shadows],
    select(next) {
      this.selected = next
    },
  })
  for (const expected of [zoom, brightness, shadows]) {
    window.move(0, 1)
    assert.equal(window.selected, expected)
  }
  for (const expected of [brightness, zoom, tab]) {
    window.move(0, -1)
    assert.equal(window.selected, expected)
  }
})

test('opening a window with a held button cannot execute an action', () => {
  const state = new GameWindowPadState()
  assert.deepEqual(state.read(pad([3]), 0).pressed, [])
  assert.deepEqual(state.read(pad([3]), 16).pressed, [])
  state.read(pad(), 32)
  assert.deepEqual(state.read(pad([3]), 48).pressed, [3])
  state.reset()
  assert.deepEqual(state.read(pad([0]), 64).pressed, [])
})

test('dpad and stick repeat navigation without repeating actions', () => {
  const state = new GameWindowPadState()
  state.read(pad(), 0)
  assert.deepEqual(state.read(pad([15, 0]), 16), { pressed: [0, 15], direction: [1, 0] })
  assert.equal(state.read(pad([15, 0]), 32).direction, null)
  assert.deepEqual(state.read(pad([15, 0]), 400), { pressed: [], direction: [1, 0] })
  state.read(pad(), 420)
  assert.deepEqual(state.read(pad([], [0, -0.8]), 440).direction, [0, -1])
  assert.equal(state.read(pad([], [0.2, 0.2]), 460).direction, null)
})
