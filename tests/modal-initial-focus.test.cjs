const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('reopening a tabbed modal focuses its active tab even when the header is mounted after construction', context => {
  const previousDocument = global.document
  const previousFrame = global.requestAnimationFrame
  context.after(() => {
    global.document = previousDocument
    global.requestAnimationFrame = previousFrame
  })
  let initialFrame
  let focused
  const makeElement = () => ({
    isConnected: true,
    appendChild() {},
    setAttribute() {},
    addEventListener() {},
    focus() {
      focused = this
    },
    contains: () => true,
    querySelector: () => null,
  })
  global.document = { createElement: makeElement, body: makeElement(), addEventListener() {} }
  global.requestAnimationFrame = callback => {
    initialFrame = callback
  }
  const { Modal } = loadTsModule('app/lib/ui/Modal.ts', {
    mocks: { '../lang': { t: key => key }, './GameWindow': {}, '../maths': {} },
  })
  const modal = Object.create(Modal.prototype)
  modal._build()
  const info = makeElement()
  const minimap = makeElement()
  let active = minimap
  modal._panel.querySelector = selector => (selector.includes('aria-selected') ? active : info)
  modal._getFocusableElements = () => [info, minimap]
  initialFrame()
  assert.equal(focused, minimap, 'Minimap is active; Info must not receive the initial focus')
  active = null
  initialFrame()
  assert.equal(focused, info, 'non-tabbed windows keep their existing selected item')
})
