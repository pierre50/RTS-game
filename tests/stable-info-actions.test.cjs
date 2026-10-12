const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { renderWithStableInfoActions } = loadTsModule('app/ui/inspection/StableInfoActions.ts')
class Element {
  constructor(label = '') {
    this.nodeType = 1
    this.classes = new Set()
    this.classList = { add: value => this.classes.add(value), contains: value => this.classes.has(value) }
    this.label = label
    this.childNodes = []
    this.replacements = 0
  }
  appendChild(child) {
    this.childNodes.push(child)
  }
  replaceChildren(...children) {
    this.childNodes = children
    this.replacements++
  }
  isEqualNode(other) {
    return this.label === other.label && [...this.classes].join(',') === [...other.classes].join(',')
  }
}
test('live refresh retains the same pause button and its click handler until its state changes', () => {
  const previous = global.document
  global.document = { createElement: () => new Element() }
  try {
    const actions = new Element()
    let paused = false
    const render = container => {
      const button = new Element(paused ? 'Resume' : 'Pause')
      button.click = () => {
        paused = !paused
      }
      container.appendChild(button)
    }
    renderWithStableInfoActions(actions, render)
    const original = actions.childNodes[0]
    original.classList.add('is-window-selected')
    for (let update = 0; update < 30; update++) renderWithStableInfoActions(actions, render)
    assert.equal(actions.childNodes[0], original)
    assert.equal(actions.replacements, 1)
    original.click()
    renderWithStableInfoActions(actions, render)
    assert.equal(actions.childNodes[0].label, 'Resume')
    assert.ok(actions.childNodes[0].classList.contains('is-window-selected'))
    assert.equal(actions.replacements, 2)
    actions.childNodes[0].click()
    renderWithStableInfoActions(actions, render)
    assert.equal(actions.childNodes[0].label, 'Pause')
  } finally {
    global.document = previous
  }
})
