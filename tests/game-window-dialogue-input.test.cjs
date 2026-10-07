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
    const instance = Object.create(GameWindow.prototype)
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
      padState: { read: () => ({ pressed: [0], direction: null }) },
    })
    instance.refresh()
    // Opening/layout changes can make a different reply available before observers refresh commands.
    items = [reply]
    reply.disabled = false
    instance.readGamepad({ index: 0, buttons: [], axes: [] }, 16)
    assert.equal(replies, 1, initial)
    assert.equal(instance.selected, reply, initial)
  }
})
