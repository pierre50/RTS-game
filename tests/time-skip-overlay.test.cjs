const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('sleep shows only the active controller hint and adapts to disconnect or disable', () => {
  let connected = true
  let enabled = true
  const { updateTimeSkipOverlay } = loadTsModule('app/ui/timeSkip/TimeSkipOverlay.ts', {
    mocks: {
      '../../lib/audio/settings': { getGamepadEnabled: () => enabled },
      '../../lib/input/gamepad': { getActiveGamepad: () => (connected ? {} : null) },
      '../../lib/input/gamepadGlyph': {},
      '../../lib/lang': {},
    },
  })
  const overlay = { gamepadHint: {}, keyboardHint: {}, label: {}, fill: { style: {} } }
  updateTimeSkipOverlay(overlay, 0.5, 2)
  assert.equal(overlay.keyboardHint.hidden, true)
  assert.equal(overlay.gamepadHint.hidden, false)
  for (const disconnect of [true, false]) {
    connected = !disconnect
    enabled = disconnect
    updateTimeSkipOverlay(overlay, 0.5, 2)
    assert.equal(overlay.keyboardHint.hidden, false)
    assert.equal(overlay.gamepadHint.hidden, true)
  }
})
