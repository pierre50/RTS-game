const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function node() {
  const classes = new Set()
  return {
    children: [],
    matches: () => false,
    querySelector: () => null,
    parent: null,
    get parentElement() { return this.parent },
    classList: {
      toggle(name, value) {
        if (value) classes.add(name)
        else classes.delete(name)
      },
      contains: name => classes.has(name),
    },
    get childElementCount() {
      return this.children.length
    },
    appendChild(child) {
      if (child.parent) child.parent.children = child.parent.children.filter(value => value !== child)
      child.parent = this
      this.children.push(child)
    },
    replaceChildren(...children) {
      for (const child of this.children) child.parent = null
      this.children = []
      for (const child of children) this.appendChild(child)
    },
  }
}

test('inspection header keeps live nodes, moves compact stats, refreshes targets and disconnects', () => {
  const oldDocument = global.document
  const oldObserver = global.MutationObserver
  let refresh
  let disconnected = false
  global.document = { createElement: node }
  global.MutationObserver = class {
    constructor(callback) {
      refresh = callback
    }
    observe() {}
    disconnect() {
      disconnected = true
    }
  }
  try {
    const { attachInspectionHeader } = loadTsModule('app/ui/InspectionHeader.ts')
    const header = node()
    const panel = node()
    panel.querySelector = () => header
    const content = node()
    const createTarget = () => {
      const info = node()
      const avatar = node()
      const wrapper = node()
      wrapper.appendChild(avatar)
      const health = node()
      health.summary = true
      const stats = node()
      info.replaceChildren(health, stats)
      info.closest = () => ({ querySelector: () => wrapper.children[0] ?? null })
      info.querySelectorAll = selector =>
        info.children.filter(child => child.summary || (child === stats && selector.includes(':scope > .infos')))
      return { info, avatar, health, stats, wrapper }
    }
    const first = createTarget()
    let current = first.info
    content.querySelector = () => current
    const dispose = attachInspectionHeader(panel, content)
    const summary = header.children[0]
    assert.equal(summary.children[0], first.avatar)
    assert.equal(summary.children[1].children[0], first.health)
    assert.equal(summary.children[1].children[1], first.stats)
    assert.deepEqual(first.info.children, [])
    refresh()
    assert.equal(summary.children[1].children[0], first.health)
    const health = node()
    health.summary = true
    first.info.appendChild(health)
    refresh()
    assert.deepEqual(summary.children[1].children, [health])
    const second = createTarget()
    current = second.info
    refresh()
    assert.equal(first.avatar.parent, first.wrapper)
    assert.equal(summary.children[0], second.avatar)
    assert.equal(summary.children[1].children[0], second.health)
    dispose()
    assert.equal(second.avatar.parent, second.wrapper)
    const disposeReopened = attachInspectionHeader(panel, content)
    assert.equal(header.children[1].children[0], second.avatar)
    disposeReopened()
    current = null
    refresh()
    assert.equal(header.children[1].hidden, true)
    assert.equal(panel.classList.contains('has-entity-summary'), false)
    dispose()
    assert.equal(disconnected, true)
  } finally {
    global.document = oldDocument
    global.MutationObserver = oldObserver
  }
})
