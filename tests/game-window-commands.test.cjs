const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function commands(bindings) {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
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
  const instance = Object.create(GameWindow.prototype)
  instance.selected = row
  instance.dismissible = true
  instance.panel = { querySelectorAll: () => [] }
  return instance.availableCommands()
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
