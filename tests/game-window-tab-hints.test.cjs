const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { renderWindowTabHints, isTabNavigationCommand } = loadTsModule('app/lib/ui/GameWindowTabHints.ts', {
  mocks: {
    './GameWindowElements': {
      getWindowTabScope: (selected, panel) => selected?.scope ?? panel,
      isWindowTabInScope: () => true,
    },
  },
})
const commands = [
  { id: 'previous-tab', key: 'PageUp', glyph: 'LB', label: 'Précédent' },
  { id: 'next-tab', key: 'PageDown', glyph: 'RB', label: 'Suivant' },
  { id: 'close', key: 'Escape', glyph: 'B', label: 'Fermer' },
]

test('tab shortcuts use the active input mode, remain outside focus navigation and leave footer actions intact', t => {
  const previous = global.document
  t.after(() => {
    global.document = previous
  })
  global.document = {
    createElement: tag => ({
      tag,
      dataset: {},
      attributes: {},
      title: '',
      textContent: '',
      setAttribute(key, value) {
        this.attributes[key] = value
      },
      getAttribute(key) {
        return this.attributes[key]
      },
      remove() {
        this.parentElement.children = this.parentElement.children.filter(child => child !== this)
      },
    }),
  }
  const strip = {
    children: [],
    prepend(hint) {
      hint.parentElement = this
      this.children.unshift(hint)
    },
    appendChild(hint) {
      hint.parentElement = this
      this.children.push(hint)
    },
    querySelector(selector) {
      return this.children.find(hint => selector.includes(hint.dataset.tabCommand))
    },
  }
  const tab = () => ({
    matches: () => false,
    closest: selector => (selector === '.ui-tabs' ? strip : null),
    getClientRects: () => [1],
  })
  let tabs = [tab(), tab()]
  const panel = { querySelectorAll: selector => (selector === '.ui-tab' ? tabs : strip.children) }
  renderWindowTabHints(panel, null, commands, 'keyboard')
  const hints = [...strip.children]
  assert.deepEqual(
    hints.map(hint => hint.textContent),
    ['Pg ↑', 'Pg ↓']
  )
  assert.ok(hints.every(hint => hint.tag === 'kbd' && hint.tabIndex === undefined))
  renderWindowTabHints(panel, null, commands, 'gamepad')
  assert.deepEqual(strip.children, hints, 'refreshes reuse existing indicators')
  assert.deepEqual(
    hints.map(hint => hint.textContent),
    ['LB', 'RB']
  )
  assert.equal(hints[0].attributes['aria-label'], 'Précédent : LB')
  assert.deepEqual(
    commands.filter(command => !isTabNavigationCommand(command)).map(command => command.id),
    ['close']
  )
  tabs = [tabs[0]]
  renderWindowTabHints(panel, null, commands, 'gamepad')
  assert.equal(strip.children.length, 0, 'one tab needs no navigation hints')
  tabs.push(tab())
  renderWindowTabHints(panel, null, commands, 'gamepad')
  renderWindowTabHints(panel, null, [], 'gamepad')
  assert.equal(strip.children.length, 0, 'confirmation mode hides unavailable shortcuts')
})
