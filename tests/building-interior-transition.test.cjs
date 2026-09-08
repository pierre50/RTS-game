const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setupDom(t, { stalledFrames = false } = {}) {
  const previousDocument = global.document
  const previousWindow = global.window
  t.after(() => {
    global.document = previousDocument
    global.window = previousWindow
  })
  const appended = []
  global.window = { setTimeout, clearTimeout, requestAnimationFrame: callback => { if (!stalledFrames) callback() } }
  class Element {
    constructor(tagName) {
      this.attributes = {}
      this.children = []
      this.className = ''
      this.removed = false
      this.style = { setProperty() {} }
      this.tagName = tagName
      this.textContent = ''
      this.classList = {
        add: (...names) => {
          const current = new Set(this.className.split(/\s+/).filter(Boolean))
          for (const name of names) current.add(name)
          this.className = [...current].join(' ')
        },
      }
    }

    append(...children) {
      this.children.push(...children)
    }

    remove() {
      this.removed = true
    }

    setAttribute(name, value) {
      this.attributes[name] = value
    }

    addEventListener() {}
    removeEventListener() {}
  }

  global.document = {
    body: {
      appendChild(element) {
        appended.push(element)
      },
    },
    createElement: tagName => new Element(tagName),
  }
  return { appended }
}

test('building interior door transition is a plain black overlay around the world swap', async t => {
  const { appended } = setupDom(t)
  const { playBuildingInteriorDoorTransition } = loadTsModule('app/ui/BuildingInteriorTransition.ts', {
    mocks: {
      '../lib/lang': { t: key => key },
    },
  })
  const calls = []

  await playBuildingInteriorDoorTransition(() => {
    assert.match(appended[0].className, /is-open/)
    assert.equal(appended[0].removed, false)
    calls.push('swap')
  }, {
    beforeReveal: () => {
      assert.doesNotMatch(appended[0].className, /is-arriving/)
      assert.equal(appended[0].removed, false)
      calls.push('render')
    },
  })

  assert.deepEqual(calls, ['swap', 'render'])
  assert.equal(appended.length, 1)
  assert.match(appended[0].className, /building-interior-transition/)
  assert.match(appended[0].className, /building-interior-transition--door/)
  assert.equal(appended[0].children.length, 0)
  assert.equal(appended[0].removed, true)
})

test('blocking world transition finishes even when animation frames stop arriving', async t => {
  const { appended } = setupDom(t, { stalledFrames: true })
  const { playBuildingInteriorDoorTransition } = loadTsModule('app/ui/BuildingInteriorTransition.ts', {
    mocks: { '../lib/lang': { t: key => key } },
  })
  await playBuildingInteriorDoorTransition(() => {
    assert.match(appended[0].className, /is-open/)
    assert.equal(appended[0].removed, false)
    assert.equal(appended[0].style.pointerEvents, 'auto')
    assert.equal(appended[0].style.zIndex, '20000')
    assert.equal(appended[0].children.length, 0)
  }, { blockInput: true })
  assert.match(appended[0].className, /is-arriving/)
  assert.equal(appended[0].removed, true)
})

test('failed world swap removes the overlay and propagates the error', async t => {
  const { appended } = setupDom(t)
  const { playBuildingInteriorDoorTransition } = loadTsModule('app/ui/BuildingInteriorTransition.ts', {
    mocks: { '../lib/lang': { t: key => key } },
  })
  const failure = new Error('world load failed')
  await assert.rejects(playBuildingInteriorDoorTransition(() => {
    throw failure
  }, { blockInput: true }), error => error === failure)
  assert.equal(appended[0].removed, true)
})
