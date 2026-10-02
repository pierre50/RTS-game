const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element(tag = 'div') {
  const classes = new Set()
  const result = {
    tag,
    children: [],
    dataset: {},
    attributes: {},
    listeners: {},
    textContent: '',
    hidden: false,
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      toggle: (value, active) => (active ? classes.add(value) : classes.delete(value)),
      contains: value => classes.has(value),
    },
    setAttribute(key, value) {
      this.attributes[key] = value
    },
    appendChild(child) {
      this.children.push(child)
    },
    append(...children) {
      this.children.push(...children)
    },
    replaceChildren(...children) {
      this.children = children
    },
    addEventListener(name, callback) {
      this.listeners[name] = callback
    },
    click() {
      this.listeners.click?.()
    },
  }
  return result
}
function all(root) {
  return [root, ...root.children.flatMap(all)]
}

test('controls use separate devices, collapse secondary groups, and keep every binding accessible', () => {
  const previous = global.document
  global.document = { createElement: element, createTextNode: text => ({ ...element('text'), textContent: text }) }
  let connected = false
  try {
    const { buildControlsPage } = loadTsModule('app/ui/modals/controlsSettings.ts', {
      mocks: {
        '@pixi/sound': { sound: {} },
        '../../lib/input/gamepad': { getActiveGamepad: () => (connected ? {} : null) },
        '../../lib/ui/Modal': { Modal: class {} },
      },
    })
    const panel = element()
    const activate = buildControlsPage(panel)
    const nodes = all(panel)
    const keyboard = nodes.find(node => node.dataset.tabPage === 'keyboard')
    const gamepad = nodes.find(node => node.dataset.tabPage === 'gamepad')
    assert.equal(keyboard.attributes['aria-hidden'], 'false')
    assert.equal(gamepad.attributes['aria-hidden'], 'true')
    connected = true
    activate()
    assert.equal(gamepad.attributes['aria-hidden'], 'false')
    const groups = gamepad.children.filter(node => node.tag === 'section')
    assert.equal(groups.length, 4)
    assert.deepEqual(
      groups.map(group => group.children[1].hidden),
      [false, true, true, true]
    )
    const actions = all(gamepad)
      .filter(node => node.dataset.bindingAction)
      .map(node => node.dataset.bindingAction)
    assert.equal(new Set(actions).size, 20)
    assert.equal(actions.length, 20)
    assert.deepEqual(
      all(groups[3])
        .filter(node => node.dataset.bindingAction)
        .map(node => node.dataset.bindingAction),
      ['heroUp', 'heroDown', 'heroLeft', 'heroRight']
    )
    const constructionToggle = groups[1].children[0].children[0]
    constructionToggle.click()
    assert.equal(groups[1].children[1].hidden, false)
    assert.equal(constructionToggle.attributes['aria-expanded'], 'true')
    constructionToggle.click()
    assert.equal(groups[1].children[1].hidden, true)
    nodes.find(node => node.dataset.tab === 'keyboard').click()
    activate()
    assert.equal(keyboard.attributes['aria-hidden'], 'false', 'explicit device choice wins over automatic detection')
  } finally {
    global.document = previous
  }
})
