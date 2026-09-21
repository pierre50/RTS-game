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
