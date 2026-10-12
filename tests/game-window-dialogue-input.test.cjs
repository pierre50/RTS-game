const { attachWindowControls } = require('./helpers/windowControls.cjs')
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('A uses the current visible reply without requiring directional navigation', context => {
  const previous = { document: global.document, HTMLButtonElement: global.HTMLButtonElement }
  context.after(() => Object.assign(global, previous))
  global.document = { querySelector: () => null }
  global.HTMLButtonElement = class {
    id = ''
    disabled = false
    isConnected = true
    dataset = { windowLabel: 'Reply' }
    classList = { add() {}, remove() {} }
    matches() {
      return false
    }
    closest() {
      return null
    }
    querySelector() {
      return null
    }
  }
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: {
      '../lang': { t: key => key },
      '../audio/settings': {},
      './GameWindowForms': { enhanceWindowForms() {}, getWindowField: () => null },
      './GameWindowFooter': { renderCommandFooter() {} },
    },
  })
  for (const initial of ['missing', 'replaced', 'disabled']) {
    let replies = 0
    const reply = new global.HTMLButtonElement()
    reply.click = () => {
      replies++
    }
    const oldReply = new global.HTMLButtonElement()
    oldReply.click = () => assert.fail('must not activate an obsolete reply')
    let items = initial === 'missing' ? [] : [initial === 'replaced' ? oldReply : reply]
    reply.disabled = initial === 'disabled'
    const instance = attachWindowControls(Object.create(GameWindow.prototype))
    Object.assign(instance, {
      panel: { querySelectorAll: () => [] },
      footer: { style: { setProperty() {} } },
      selected: null,
      selectedId: '',
      selectedIndex: 0,
      items: () => items,
      renderDetails() {},
      cancelKeyboardHold() {},
      scheduleRefresh() {},
      setMode() {},
      isTopmost: () => true,
    })
    instance.controls.padState = { read: () => ({ pressed: [0], direction: null }) }
    instance.refresh()
    // Opening/layout changes can make a different reply available before observers refresh commands.
    items = [reply]
    reply.disabled = false
    instance.controls.readGamepad({ index: 0, buttons: [], axes: [] }, 16)
    assert.equal(replies, 1, initial)
    assert.equal(instance.selected, reply, initial)
  }
})

test('A consumed by a closing window works on the next press after its release', context => {
  const previousDocument = global.document
  context.after(() => {
    global.document = previousDocument
  })
  global.document = { querySelector: () => null }
  const consumption = loadTsModule('app/lib/input/gamepadConsumption.ts')
  const { GameWindowControls } = loadTsModule('app/lib/ui/GameWindowControls.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {}, '../input/gamepadConsumption': consumption },
  })
  let replies = 0
  const reply = { id: 'primary', label: 'Reply', key: 'Enter', pad: 0, glyph: 'A', run: () => replies++ }
  const controls = new GameWindowControls({
    panel: { querySelectorAll: () => [] },
    footer: { style: { setProperty() {} } },
    commands: [reply],
    selected: null,
    confirmation: null,
    setMode() {},
    refresh() {},
    scheduleRefresh() {},
    move() {},
    execute: command => command.run(),
  })
  const pad = { index: 0, buttons: [{ pressed: true }], axes: [] }
  // The press that launched the game closed a window while A was held.
  consumption.consumeGamepadButtons(pad)
  pad.buttons[0].pressed = false
  controls.padState = { read: () => ({ pressed: [], direction: null }) }
  controls.readGamepad(pad, 16)
  pad.buttons[0].pressed = true
  controls.padState = { read: () => ({ pressed: [0], direction: null }) }
  controls.readGamepad(pad, 32)
  assert.equal(replies, 1)
})
