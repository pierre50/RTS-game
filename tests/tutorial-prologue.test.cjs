const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const savedDocument = global.document
  const savedWindow = global.window
  const timers = new Map()
  let id = 0
  let completeNarration
  const delays = []
  class Element {
    children = []
    classes = new Set()
    classList = { add: value => this.classes.add(value) }
    setAttribute() {}
    addEventListener() {}
    append(...children) { this.children.push(...children) }
    appendChild(child) { this.children.push(child) }
    focus() { global.document.activeElement = this }
    blur() { if (global.document.activeElement === this) global.document.activeElement = null }
    remove() { this.removed = true }
  }
  global.document = { createElement: () => new Element(), body: new Element(), activeElement: null }
  global.window = { setTimeout: (fn, delay) => { delays.push(delay); timers.set(++id, fn); return id }, clearTimeout: key => timers.delete(key) }
  const { TutorialPrologue } = loadTsModule('app/ui/TutorialPrologue.ts', {
    mocks: { './SpokenTextReveal': { SpokenTextReveal: class { revealing = true; show(_blocks, _voice, complete) { completeNarration = complete } stop() {} revealAll() { const previous = this.revealing; this.revealing = false; return previous } } }, '../lib/lang': { t: key => key } },
  })
  return { TutorialPrologue, timers, delays, complete: () => completeNarration(), restore() { global.document = savedDocument; global.window = savedWindow } }
}

for (const skip of [false, true]) {
  test(`prologue resolves skip=${skip}, keeps the scene covered, then cleans up`, async () => {
    const f = fixture()
    try {
      const prologue = new f.TutorialPrologue()
      const choice = prologue.chooseSkip()
      const button = prologue.root.children[1]
      if (skip) button.onclick()
      else {
        assert.equal(prologue.root.children.length, 2, 'only narration and skip are displayed')
        f.complete()
        const [timerId, advance] = [...f.timers.entries()][0]
        f.timers.delete(timerId)
        advance()
      }
      assert.equal(await choice, skip)
      assert.notEqual(button.disabled, true)
      assert.equal(button.inert, true)
      assert.equal(button.tabIndex, -1)
      assert.ok(prologue.root.classes.has('tutorial-prologue--waiting'))
      assert.equal(prologue.root.classes.has('tutorial-prologue--read'), false)
      assert.equal(button.onclick, null)
      assert.equal(prologue.root.removed, undefined)
      assert.equal(f.timers.size, 0)
      const reveal = prologue.reveal()
      assert.ok(prologue.root.classes.has('tutorial-prologue--read'))
      assert.ok(prologue.root.classes.has('tutorial-prologue--reveal'))
      ;[...f.timers.values()][0]()
      await reveal
      assert.equal(prologue.root.removed, true)
    } finally { f.restore() }
  })
}


test('automatic continue waits for the complete narration then three seconds', async () => {
  const f = fixture()
  try {
    const prologue = new f.TutorialPrologue()
    const choice = prologue.chooseSkip()
    assert.equal(f.timers.size, 0)
    f.complete()
    assert.deepEqual(f.delays, [3000])
    ;[...f.timers.values()][0]()
    assert.equal(await choice, false)
    assert.equal(prologue.root.children.some(child => child.className === 'tutorial-prologue__loading'), false)
    assert.equal(prologue.root.classes.has('tutorial-prologue--read'), false)
    assert.equal(prologue.root.classes.has('tutorial-prologue--reveal'), false)
    assert.equal(prologue.root.removed, undefined)
    prologue.destroy()
  } finally { f.restore() }
})

test('skip cancels automatic continuation and stale callbacks cannot change the choice', async () => {
  const f = fixture()
  try {
    const prologue = new f.TutorialPrologue()
    const choice = prologue.chooseSkip()
    f.complete()
    const stale = [...f.timers.values()][0]
    prologue.root.children[1].onclick()
    assert.equal(f.timers.size, 0)
    stale()
    f.complete()
    assert.equal(await choice, true)
    assert.equal(f.timers.size, 0)
    prologue.destroy()
  } finally { f.restore() }
})
