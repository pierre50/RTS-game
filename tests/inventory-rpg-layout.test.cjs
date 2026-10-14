const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('closing the inventory removes details from the reusable dock before reopening', t => {
  const before = { document: global.document, cancelAnimationFrame: global.cancelAnimationFrame }
  t.after(() => Object.assign(global, before))
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  global.document = { removeEventListener() {} }
  global.cancelAnimationFrame = () => {}
  const dock = { children: [] }
  for (let opening = 0; opening < 3; opening++) {
    const details = { remove: () => dock.children.splice(dock.children.indexOf(details), 1) }
    dock.children.push(details)
    assert.equal(dock.children.length, 1)
    const instance = Object.create(GameWindow.prototype)
    Object.assign(instance, {
      details,
      footer: { remove() {} },
      getGamepad: () => null,
      observer: { disconnect() {} },
      panel: { removeEventListener() {} },
      cancelKeyboardHold() {},
    })
    instance.destroy()
    assert.equal(dock.children.length, 0)
  }
})

function element(id = '') {
  return {
    id,
    children: [],
    dataset: {},
    title: '',
    attributes: {},
    classList: { add() {}, toggle() {} },
    style: { setProperty() {} },
    setAttribute(key, value) {
      this.attributes[key] = value
    },
    getAttribute(key) {
      return this.attributes[key] ?? null
    },
    appendChild(child) {
      if (child.parent) child.parent.children = child.parent.children.filter(value => value !== child)
      child.parent = this
      this.children.push(child)
      return child
    },
    prepend(child) {
      this.children.unshift(child)
    },
    querySelectorAll(selector) {
      if (selector === '.inventory-action-row') return this.children.filter(child => child.id.startsWith('inventory-'))
      return []
    },
    querySelector(selector) {
      return this.children.find(child => `#${child.id}` === selector) ?? null
    },
  }
}

function loadLayout() {
  return loadTsModule('app/ui/inventory/InventoryRpgLayout.ts', {
    mocks: {
      '../../lib/avatar': { renderUnitBodyAvatar() {} },
      '../../lib/lang': { t: key => key },
      './InventoryItemIcons': { createInventorySlingshotStoneIcon: () => element() },
      './InventoryItemRows': { createInventoryResourceRow: () => ({ element: element() }) },
    },
  })
}

test('equipment layout places arrows after ranged with a non-interactive plus', t => {
  const before = global.document
  t.after(() => {
    global.document = before
  })
  global.document = { createElement: () => element() }
  const grid = element()
  for (const slot of ['helmet', 'armor', 'shoulders', 'legs', 'bracers', 'offhand', 'arrow'])
    grid.appendChild(element(`inventory-equipped-${slot}`))
  const weapons = element()
  const slots = new Map(
    ['interact', 'sword', 'bow'].map(tool => [tool, weapons.appendChild(element(`inventory-tool-${tool}`))])
  )
  const host = {
    menu: { context: { controls: { heroUnit: {} }, app: {} } },
    slots,
    equippedPanel: { querySelector: () => grid, querySelectorAll: () => [] },
    weaponPanel: {
      querySelector: selector => (selector === '.inventory-section-list' ? weapons : null),
      querySelectorAll: () => [],
    },
  }
  const sword = slots.get('sword')
  const arrows = grid.querySelector('#inventory-equipped-arrow')
  loadLayout().arrangeInventoryEquipment(host)
  assert.equal(weapons.querySelector('#inventory-tool-sword'), sword)
  assert.equal(weapons.querySelector('#inventory-equipped-arrow'), arrows)
  assert.equal(grid.querySelector('#inventory-equipped-arrow'), null)
  assert.deepEqual(
    weapons.children.map(row => row.id),
    ['inventory-tool-interact', 'inventory-tool-sword', 'inventory-tool-bow', '', 'inventory-equipped-arrow']
  )
  assert.equal(grid.querySelector('#inventory-equipped-helmet').attributes['data-window-default'], '')
  assert.equal(weapons.children.length, 5)
  assert.equal(weapons.children[3].textContent, '+')
  assert.equal(weapons.children[3].attributes['aria-hidden'], 'true')
  assert.equal(arrows.dataset.slotLabel, 'heroEquipmentSlotArrow')
  assert.equal(grid.children.filter(child => child.id).length, 6)
  assert.equal(grid.querySelector('#inventory-equipped-helmet').dataset.slotLabel, 'heroEquipmentSlotHelmet')
})

test('shared selection starts on the default tile and retains the chosen item through refreshes', () => {
  const { findRetainedWindowItem } = loadTsModule('app/lib/ui/GameWindowElements.ts', {
    mocks: {
      '../lang': { t: key => key },
      './GameWindowForms': { getWindowField: () => null },
    },
  })
  const tab = { id: 'tab', hasAttribute: () => false }
  const helmet = { id: 'helmet', hasAttribute: name => name === 'data-window-default' }
  const bow = { id: 'bow', hasAttribute: () => false }
  const items = [tab, helmet, bow]
  assert.equal(findRetainedWindowItem(items, null, '', 0), helmet)
  assert.equal(findRetainedWindowItem(items, bow, 'bow', 2), bow)
  assert.equal(findRetainedWindowItem(items, { id: 'bow' }, 'bow', 2), bow)
  assert.equal(findRetainedWindowItem(items, tab, 'tab', 0), tab)
})
