const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('closing a window before the gameplay tick consumes B until release', () => {
  const previous = { document: global.document, cancelAnimationFrame: global.cancelAnimationFrame }
  let windowOpen = false
  let openings = 0
  const pad = { index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }
  const options = {
    moduleCache: new Map(),
    mocks: {
      '../lib/audio/settings': {
        getGamepadEnabled: () => true,
        getGamepadButtonIndex: action => (action === 'quests' ? 1 : 15),
      },
      '../lib/input/gamepad': { getActiveGamepad: () => pad, readStick: () => ({ x: 0, y: 0 }), GAMEPAD_AXIS: {} },
      '../lib/hero/heroCursor': { setVirtualCursorVisible() {} },
      '../lang': { t: key => key },
    },
  }
  options.mocks['../audio/settings'] = options.mocks['../lib/audio/settings']
  options.mocks['../input/gamepad'] = options.mocks['../lib/input/gamepad']
  const { GamepadHeroInput } = loadTsModule('app/controllers/GamepadHeroInput.ts', options)
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', options)
  const { GameWindowPadState } = loadTsModule('app/lib/ui/GameWindowNavigation.ts', options)
  global.document = { querySelector: () => (windowOpen ? {} : null), removeEventListener() {} }
  global.cancelAnimationFrame = () => {}
  const input = new GamepadHeroInput({
    context: {
      menu: {
        toggleQuests() {
          windowOpen = true
          openings++
        },
      },
    },
    heroController: { handleKeyUp() {} },
  })
  const closeWindow = () => {
    const window = Object.create(GameWindow.prototype)
    Object.assign(window, {
      getGamepad: () => pad,
      observer: { disconnect() {} },
      panel: { removeEventListener() {} },
      cancelKeyboardHold() {},
    })
    window.destroy()
    windowOpen = false
  }
  try {
    input.update()
    pad.buttons[1].pressed = true
    input.update()
    assert.equal(openings, 1)
    const ui = new GameWindowPadState()
    assert.deepEqual(ui.read(pad, 0).pressed, [])
    input.update()
    pad.buttons[1].pressed = false
    ui.read(pad, 16)
    input.update()

    // The UI sees the closing press first; gameplay last saw B released.
    pad.buttons[1].pressed = true
    assert.deepEqual(ui.read(pad, 32).pressed, [1])
    closeWindow()
    input.update()
    input.update()
    assert.equal(windowOpen, false)
    assert.equal(openings, 1)

    pad.buttons[1].pressed = false
    input.update()
    pad.buttons[1].pressed = true
    input.update()
    assert.equal(openings, 2)

    // The other polling order must also leave the journal closed.
    pad.buttons[1].pressed = false
    input.update()
    pad.buttons[1].pressed = true
    input.update()
    closeWindow()
    input.update()
    assert.equal(openings, 2)
    assert.equal(windowOpen, false)
  } finally {
    Object.assign(global, previous)
  }
})
