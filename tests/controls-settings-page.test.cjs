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

test('settings expose both devices as top-level tabs and keep every binding accessible', () => {
  const previousWindow = global.window
  global.window = { ...previousWindow, dispatchEvent: () => {} }
  const previous = global.document
  global.document = { createElement: element, createTextNode: text => ({ ...element('text'), textContent: text }) }
  const header = element('header')
  header.insertBefore = child => header.children.unshift(child)
  const panel = element()
  panel.appendChild(header)
  panel.querySelector = selector => (selector === '.modal-header' ? header : null)
  const moduleCache = new Map()
  try {
    const { openSettingsModal } = loadTsModule('app/ui/modals/settingsPanel.ts', {
      moduleCache,
      mocks: {
        '@pixi/sound': { sound: {} },
        '../../lib': {
          Modal: class {
            constructor({ content }) {
              this._panel = panel
              panel.appendChild(content)
            }
          },
        },
        '../../lib/ui/Modal': { Modal: class {} },
      },
    })
    openSettingsModal()
    const nodes = all(panel)
    const keyboard = nodes.find(node => node.dataset.tabPage === 'keyboard')
    const gamepad = nodes.find(node => node.dataset.tabPage === 'gamepad')
    const tabs = all(header).filter(node => node.dataset.tab)
    assert.deepEqual(
      tabs.map(node => node.dataset.tab),
      ['game', 'graphics', 'keyboard', 'gamepad']
    )
    assert.equal(nodes.filter(node => node.dataset.tab).length, 4, 'no nested tabs remain')
    assert.equal(keyboard.attributes['aria-hidden'], 'true')
    assert.equal(gamepad.attributes['aria-hidden'], 'true')
    tabs.find(node => node.dataset.tab === 'gamepad').click()
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
    assert.equal(new Set(actions).size, 21)
    assert.equal(actions.length, 21)
    assert.ok(actions.includes('heroDirectAttack'))
    assert.deepEqual(
      all(groups[3])
        .filter(node => node.dataset.bindingAction)
        .map(node => node.dataset.bindingAction),
      ['destinationConfirm', 'destinationCancel']
    )
    const constructionToggle = groups[1].children[0].children[0]
    constructionToggle.click()
    assert.equal(groups[1].children[1].hidden, false)
    assert.equal(constructionToggle.attributes['aria-expanded'], 'true')
    constructionToggle.click()
    assert.equal(groups[1].children[1].hidden, true)
    nodes.find(node => node.dataset.tab === 'keyboard').click()
    assert.equal(keyboard.attributes['aria-hidden'], 'false', 'keyboard page opens from the main tab bar')
    const settings = loadTsModule('app/lib/audio/settings.ts', { moduleCache })
    const defaultKeyboard = settings.getKeyBindings()
    const defaultGamepad = settings.getGamepadBindings()
    settings.rebindKeyboardKey('heroUp', { key: 'i', code: 'KeyI' })
    settings.rebindGamepadButton('heroInteract', 17)
    for (const page of [keyboard, gamepad]) {
      const resets = all(page).filter(node => node.className === 'settings-reset-button ui-btn')
      assert.equal(resets.length, 1, 'one reset button per device')
      assert.equal(page.children.at(-1), resets[0], 'reset appears at the end of the page')
      resets[0].click()
      if (page === keyboard) {
        assert.deepEqual(settings.getKeyBindings(), defaultKeyboard)
        assert.equal(
          settings.getGamepadBindings().heroInteract,
          'Button17',
          'keyboard reset preserves gamepad bindings'
        )
        const up = all(keyboard).find(node => node.dataset.bindingAction === 'heroUp')
        assert.equal(up.children[0].textContent, settings.getControlKeyLabel(defaultKeyboard.heroUp))
      } else {
        assert.deepEqual(settings.getGamepadBindings(), defaultGamepad)
      }
    }
  } finally {
    global.document = previous
    global.window = previousWindow
  }
})
