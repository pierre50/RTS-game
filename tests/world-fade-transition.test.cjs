const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('world fade animates only opacity and remains black between loading phases', async () => {
  const previousDocument = global.document
  const animations = []
  const root = {
    style: {},
    setAttribute() {},
    remove() { this.removed = true },
    animate(frames, options) {
      animations.push({ frames, options })
      return { finished: Promise.resolve(), cancel() {} }
    },
  }
  global.document = {
    hidden: false,
    createElement: () => root,
    body: { appendChild() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  try {
    const { WorldFadeTransition } = loadTsModule('app/ui/transitions/WorldFadeTransition.ts')
    const fade = new WorldFadeTransition()
    assert.equal(root.style.opacity, '0')
    await fade.conceal()
    assert.equal(root.style.opacity, '1')
    assert.deepEqual(animations[0].frames, [{ opacity: 0 }, { opacity: 1 }])
    await fade.reveal()
    assert.equal(root.style.opacity, '0')
    assert.deepEqual(animations[1].frames, [{ opacity: 1 }, { opacity: 0 }])
    global.document.hidden = true
    await fade.conceal()
    assert.equal(animations[2].options.duration, 0)
    fade.destroy()
    fade.destroy()
    assert.equal(root.removed, true)
  } finally {
    global.document = previousDocument
  }
})
