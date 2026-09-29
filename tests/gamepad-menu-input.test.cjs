const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('Start toggles once per press, including while paused, and respects disabled input and rebinding', () => {
  const previous = {
    document: global.document,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  }
  const frames = new Map()
  let sequence = 0
  let enabled = true
  let listening = false
  let button = 9
  let calls = 0
  let pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }
  global.document = { visibilityState: 'visible', querySelector: () => listening }
  global.requestAnimationFrame = callback => {
    frames.set(++sequence, callback)
    return sequence
  }
  global.cancelAnimationFrame = id => frames.delete(id)
  const tick = () => {
    const [id, callback] = frames.entries().next().value
    frames.delete(id)
    callback()
  }
  try {
    const { GamepadMenuInput } = loadTsModule('app/controllers/GamepadMenuInput.ts', {
      mocks: {
        '../lib/audio/settings': {
          getGamepadEnabled: () => enabled,
          getGamepadButtonIndex: action => {
            assert.equal(action, 'gameMenu')
            return button
          },
        },
        '../lib/input/gamepad': { getActiveGamepad: () => pad },
      },
    })
    const input = new GamepadMenuInput(() => calls++)
    tick()
    pad.buttons[9].pressed = true
    tick()
    tick()
    assert.equal(calls, 1)
    pad.buttons[9].pressed = false
    tick()
    pad.buttons[9].pressed = true
    tick()
    assert.equal(calls, 2)
    enabled = false
    tick()
    enabled = true
    tick()
    assert.equal(calls, 2)
    pad.buttons[9].pressed = false
    tick()
    listening = true
    pad.buttons[9].pressed = true
    tick()
    listening = false
    tick()
    assert.equal(calls, 2)
    button = 10
    tick()
    pad.buttons[10].pressed = true
    tick()
    assert.equal(calls, 3)
    pad = null
    tick()
    input.destroy()
    assert.equal(frames.size, 0)
  } finally {
    Object.assign(global, previous)
  }
})
