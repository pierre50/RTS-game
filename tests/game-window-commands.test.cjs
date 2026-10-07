const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function commands(bindings) {
  const { availableCommands } = loadTsModule('app/lib/ui/GameWindowCommands.ts', {
    mocks: {
      '../audio/settings': { getGamepadButtonIndex: action => bindings[action] },
      '../lang': { t: key => key },
      './GameWindowForms': { getWindowField: () => null },
    },
  })
  const primary = {
    dataset: { inventoryTransferSlot: 'true' },
    textContent: 'Transfer',
    matches: () => false,
    querySelector: () => null,
  }
  const row = {
    matches: selector => selector === '.inventory-action-row',
    querySelectorAll: () => [primary],
    closest: () => null,
  }
  return availableCommands({
    getSelected: () => row,
    dismissible: true,
    panel: { querySelectorAll: () => [] },
    dismiss() {},
    scheduleRefresh() {},
    switchPanel() {},
  })
}

test('inventory footer honors remapped transfer buttons and moves conflicting close action', () => {
  const result = commands({ inventoryTransferOne: 1, inventoryTransferAll: 5 })
  assert.equal(result.find(command => command.id === 'primary').pad, 1)
  assert.equal(result.find(command => command.id === 'stack').glyph, 'RB')
  assert.equal(result.find(command => command.id === 'close').pad, 0)
  assert.equal(new Set(result.map(command => command.pad)).size, result.length)
})

test('swapping transfer and stack bindings keeps both actions available', () => {
  const result = commands({ inventoryTransferOne: 2, inventoryTransferAll: 0 })
  assert.equal(result.find(command => command.id === 'primary').pad, 2)
  assert.equal(result.find(command => command.id === 'stack').pad, 0)
  assert.equal(result.find(command => command.id === 'close').pad, 1)
})

test('switching tabs activates and focuses the new tab', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  const tabs = [0, 1, 2].map(index => ({
    disabled: false,
    getAttribute: () => (index === 0 ? 'true' : 'false'),
    click() {
      this.clicked = true
    },
  }))
  const instance = Object.create(GameWindow.prototype)
  instance.panel = { querySelectorAll: () => tabs }
  instance.visible = () => true
  instance.select = (tab, focus) => {
    instance.selected = tab
    assert.equal(focus, true)
  }
  instance.switchPanel(1)
  assert.equal(instance.selected, tabs[1])
  assert.equal(tabs[1].clicked, true)
  instance.switchPanel(-1)
  assert.equal(instance.selected, tabs[2])
})

test('keyboard hold executes once after 850 ms and uses the current action', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  const previousDocument = global.document
  global.document = { activeElement: null }
  try {
    const instance = Object.create(GameWindow.prototype)
    let executions = 0
    instance.commands = [{ id: 'remove', run: () => executions++ }]
    instance.keyboardHolding = { command: { id: 'remove', run: () => assert.fail('stale action') }, since: 100 }
    instance.isTopmost = () => true
    instance.footer = { style: { setProperty() {} } }
    instance.cancelKeyboardHold = () => {
      instance.keyboardHolding = null
    }
    instance.scheduleRefresh = () => {}
    instance.advanceKeyboardHold(949)
    assert.equal(executions, 0)
    instance.advanceKeyboardHold(950)
    instance.advanceKeyboardHold(1200)
    assert.equal(executions, 1)
    assert.equal(instance.keyboardHolding, null)
  } finally {
    global.document = previousDocument
  }
})

test('keyboard hold cancels when editing, covered, disabled or removed', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  const previousDocument = global.document
  try {
    for (const reason of ['editing', 'covered', 'disabled', 'removed']) {
      global.document = { activeElement: { closest: () => (reason === 'editing' ? {} : null) } }
      const instance = Object.create(GameWindow.prototype)
      instance.commands =
        reason === 'removed' ? [] : [{ id: 'remove', disabled: reason === 'disabled', run: () => assert.fail(reason) }]
      instance.keyboardHolding = { command: { id: 'remove' }, since: 0 }
      instance.isTopmost = () => reason !== 'covered'
      instance.cancelKeyboardHold = () => {
        instance.keyboardHolding = null
      }
      instance.advanceKeyboardHold(1000)
      assert.equal(instance.keyboardHolding, null, reason)
    }
  } finally {
    global.document = previousDocument
  }
})

test('windows render gamepad hints on first paint without waiting for another button press', () => {
  const previous = {
    document: global.document,
    window: global.window,
    MutationObserver: global.MutationObserver,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  }
  let pad = { buttons: [{ pressed: true }], axes: [] }
  let enabled = true
  let gameplay = true
  const makeElement = () => ({
    dataset: {},
    classList: { add() {} },
    setAttribute() {},
    append() {},
    addEventListener() {},
    removeEventListener() {},
    closest: () => (gameplay ? {} : null),
  })
  global.document = { createElement: makeElement, addEventListener() {}, removeEventListener() {} }
  global.window = { addEventListener() {}, removeEventListener() {} }
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  }
  global.requestAnimationFrame = () => 1
  global.cancelAnimationFrame = () => {}
  try {
    const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
      mocks: {
        '../lang': { t: key => key },
        '../audio/settings': { getGamepadEnabled: () => enabled },
        '../input/gamepad': { getActiveGamepad: () => pad },
      },
    })
    const firstPaints = []
    GameWindow.prototype.refresh = function () {
      firstPaints.push(this.panel.dataset.inputMode)
    }
    GameWindow.prototype.cancelKeyboardHold = () => {}
    const open = (expectedPresses = []) => {
      const instance = new GameWindow(
        makeElement(),
        () => {},
        () => true
      )
      if (pad && enabled) {
        pad.buttons[0] = { pressed: true }
        assert.deepEqual(instance.padState.read(pad, 1).pressed, expectedPresses)
      }
      instance.destroy()
    }
    open()
    pad = { buttons: [{ pressed: false }], axes: [] }
    open([0]) // A pressed after opening must work even before the first animation frame.
    pad = null
    open()
    pad = { buttons: [], axes: [] }
    enabled = false
    open()
    gameplay = false
    open()
    assert.deepEqual(firstPaints, ['gamepad', 'gamepad', 'keyboard', 'keyboard', 'gamepad'])
  } finally {
    Object.assign(global, previous)
  }
})

test('panel shortcuts stay within controls device tabs when focus is inside controls', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  let clicked
  const scope = { querySelectorAll: () => deviceTabs }
  const tab = (name, active, local) => ({
    disabled: false,
    getAttribute: () => String(active),
    closest: () => (local ? scope : null),
    click: () => {
      clicked = name
    },
  })
  const deviceTabs = [tab('keyboard', true, true), tab('gamepad', false, true)]
  const outerTabs = [tab('game', false, false), tab('graphics', false, false), tab('controls', true, false)]
  const instance = Object.create(GameWindow.prototype)
  instance.panel = { querySelectorAll: () => [...outerTabs, ...deviceTabs] }
  instance.visible = () => true
  instance.select = () => {}
  instance.selected = { closest: () => scope }
  instance.switchPanel(1)
  assert.equal(clicked, 'gamepad')
  instance.selected = { closest: () => null }
  instance.switchPanel(1)
  assert.equal(clicked, 'game')
})

test('building actions expose direct sleep and removal with confirmation', () => {
  const previousButton = global.HTMLButtonElement
  global.HTMLButtonElement = class {}
  try {
    const { availableCommands } = loadTsModule('app/lib/ui/GameWindowCommands.ts', {
      mocks: {
        '../lang': { t: key => key },
        '../audio/settings': {},
        './GameWindowForms': { getWindowField: () => null },
      },
    })
    let sleeping = 0
    const button = (action, remove = false) => ({
      dataset: { windowAction: action },
      title: 'Until morning',
      textContent: action,
      disabled: false,
      isConnected: true,
      querySelector: () => null,
      closest: () => null,
      matches: selector => remove && selector.includes('.entity-delete-building-button'),
      click: () => sleeping++,
    })
    const sleep = button('sleep')
    const removal = button('remove', true)
    const host = {
      getSelected: () => null,
      panel: { querySelectorAll: selector => (selector === '.ui-tab' ? [] : [sleep, removal]) },
      dismissible: true,
      dismiss() {},
      scheduleRefresh() {},
      switchPanel() {},
    }
    let result = availableCommands(host)
    const command = result.find(c => c.id === 'sleep')
    assert.equal(command.pad, 2)
    assert.equal(command.key, 'X')
    assert.equal(command.confirm, true)
    assert.equal(command.hold, undefined)
    assert.equal(command.danger, false)
    assert.equal(
      result.some(c => c.id.startsWith('remove')),
      true
    )
    assert.equal(new Set(result.map(c => c.pad)).size, result.length)
    sleep.disabled = true
    result = availableCommands(host)
    assert.equal(result.find(c => c.id === 'sleep').disabled, true)
    assert.equal(result.find(c => c.id === 'sleep').description, 'Until morning')
    result.find(c => c.id === 'sleep').run()
    assert.equal(sleeping, 0)
    assert.equal(result.find(c => c.id === 'remove-0').danger, true)
    assert.equal(result.find(c => c.id === 'remove-0').pad, 3)
    assert.equal(result.find(c => c.id === 'remove-0').key, 'Y')
    assert.equal(
      result.some(c => c.id === 'other-actions'),
      false
    )
    const upgrade = button('upgrade')
    host.panel.querySelectorAll = selector => (selector === '.ui-tab' ? [] : [upgrade, sleep, removal])
    let upgradeCommand = availableCommands(host).find(c => c.id === 'upgrade')
    assert.equal(upgradeCommand.key, 'U')
    assert.equal(upgradeCommand.pad, 2)
    assert.equal(upgradeCommand.padModifier, 6, 'sleep retains its direct secondary action')
    host.panel.querySelectorAll = selector => (selector === '.ui-tab' ? [] : [upgrade, removal])
    upgradeCommand = availableCommands(host).find(c => c.id === 'upgrade')
    assert.equal(upgradeCommand.padModifier, undefined)
  } finally {
    global.HTMLButtonElement = previousButton
  }
})

test('keyboard and gamepad request confirmation immediately without starting a hold', context => {
  const previousDocument = global.document
  global.document = { querySelector: () => null }
  context.after(() => {
    global.document = previousDocument
  })
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  for (const command of [
    { id: 'sleep', pad: 2, confirm: true },
    { id: 'remove', pad: 3, danger: true },
  ]) {
    const instance = Object.create(GameWindow.prototype)
    instance.renderCommands = () => {}
    instance.scheduleRefresh = () => {}
    instance.refresh = () => {}
    instance.commands = [{ ...command, run: () => assert.fail('must wait for confirmation') }]
    instance.runKeyIntent({ command: instance.commands[0] }, false)
    assert.equal(instance.confirmation.id, command.id)
    assert.equal(instance.keyboardHolding, undefined)
    instance.confirmation = null
    instance.padState = { read: () => ({ pressed: [command.pad], direction: null }) }
    instance.setMode = () => {}
    instance.readGamepad({ buttons: [], axes: [] }, 0)
    assert.equal(instance.confirmation.id, command.id)
    assert.equal(instance.holding, undefined)
  }
})

test('shoulder buttons do not treat recipe categories as tabs', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  const instance = Object.create(GameWindow.prototype)
  instance.panel = {
    querySelectorAll: selector => {
      assert.equal(selector, '.ui-tab')
      return []
    },
  }
  instance.selected = { closest: () => null }
  instance.select = () => assert.fail('recipe selection must not change')
  instance.switchPanel(1)
})

test('craft gamepad combination takes precedence without also crafting one item', () => {
  const { findEnabledPadCommand } = loadTsModule('app/lib/ui/GameWindowInput.ts', {
    mocks: { '../audio/settings': {} },
  })
  const primary = { id: 'primary', pad: 0 }
  const maximum = { id: 'craft-max', pad: 0, padModifier: 6 }
  const commands = [primary, maximum]
  const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }
  assert.equal(findEnabledPadCommand(commands, 0, pad), primary)
  pad.buttons[6].pressed = true
  assert.equal(findEnabledPadCommand(commands, 0, pad), maximum)
  assert.equal(findEnabledPadCommand(commands, 6, pad), null)
  maximum.disabled = true
  assert.equal(findEnabledPadCommand(commands, 0, pad), null)
})
