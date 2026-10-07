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

test('up/down stay in the same list, while horizontal navigation can change columns', () => {
  const columns = [
    { x: 50, y: 50, left: 0, right: 100 },
    { x: 50, y: 100, left: 0, right: 100 },
    { x: 180, y: 50, left: 130, right: 230 },
    { x: 180, y: 100, left: 130, right: 230 },
    { x: 180, y: 150, left: 130, right: 230 },
  ]
  assert.equal(findDirectionalTarget(columns, 1, 0, 1), 1)
  assert.equal(findDirectionalTarget(columns, 1, 1, 0), 3)
  assert.equal(findDirectionalTarget(columns, 4, 0, -1), 3)
  assert.equal(findDirectionalTarget(columns, 0, 0, 1), 1)
})

test('right-stick reading prefers details, skips hidden pages, and can scroll a read-only body', () => {
  const { scrollWindowInformation } = loadTsModule('app/lib/ui/GameWindowScroll.ts')
  const area = (hidden, height = 400) => ({
    scrollTop: 0,
    scrollHeight: height,
    clientHeight: 100,
    closest: () => hidden,
    getClientRects: () => [1],
  })
  const hidden = area(true)
  const details = area(false)
  const body = area(false)
  const panel = { querySelectorAll: () => [hidden, details, body] }
  assert.equal(scrollWindowInformation(panel, 30), true)
  assert.equal(details.scrollTop, 30)
  assert.equal(body.scrollTop, 0)
  assert.equal(hidden.scrollTop, 0)
  details.scrollHeight = 100
  assert.equal(scrollWindowInformation(panel, 40), true)
  assert.equal(body.scrollTop, 40)
})

test('construction tab reaches the left catalogue even when the tab is above right-side details', () => {
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '@pixi/sound': { sound: {} }, './GameWindowForms': { getWindowField: () => null } },
  })
  const strip = { getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 40 }) }
  const tab = {
    getBoundingClientRect: () => ({ x: 600, y: 0, width: 180, height: 40 }),
    closest: selector => (selector === '.ui-tabs' ? strip : null),
    matches: selector => selector === '.ui-tab' || selector === '.ui-tab[aria-selected="true"]',
  }
  const row = y => ({
    getBoundingClientRect: () => ({ x: 20, y, width: 340, height: 44 }),
    closest: () => null,
    matches: () => false,
  })
  const first = row(80),
    second = row(140)
  const window = Object.create(GameWindow.prototype)
  Object.assign(window, {
    selected: tab,
    items: () => [tab, first, second],
    select(next) {
      this.selected = next
    },
  })
  window.move(0, 1)
  assert.equal(window.selected, first)
  window.move(0, 1)
  assert.equal(window.selected, second)
  window.move(0, -1)
  assert.equal(window.selected, first)
  window.move(0, -1)
  assert.equal(window.selected, tab)
})

test('right stick scrolls the Town Center report and technologies in their own scroll container', () => {
  const { scrollWindowInformation } = loadTsModule('app/lib/ui/GameWindowScroll.ts')
  const body = { scrollTop: 0, scrollHeight: 2000, clientHeight: 400, closest: () => null, getClientRects: () => [1] }
  const selected = {
    closest: selector => {
      assert.ok(selector.includes('.hero-building-menu-body'))
      return body
    },
  }
  assert.equal(scrollWindowInformation({ querySelectorAll: () => [] }, 120, selected), true)
  assert.equal(body.scrollTop, 120)
})
