const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setupDom() {
  const appended = []
  global.window = global.window || {}
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
  }

  global.document = {
    body: {
      appendChild(element) {
        appended.push(element)
      },
    },
    createElement: tagName => new Element(tagName),
  }
  global.window.requestAnimationFrame = callback => callback()
  global.window.setTimeout = callback => {
    callback()
    return 1
  }
  return { appended }
}

test('building interior door transition is a plain black overlay around the world swap', async () => {
  const { appended } = setupDom()
  const { playBuildingInteriorDoorTransition } = loadTsModule('app/ui/BuildingInteriorTransition.ts', {
    mocks: {
      '../lib/lang': { t: key => key },
    },
  })
  const calls = []

  await playBuildingInteriorDoorTransition(() => {
    calls.push('swap')
  })

  assert.deepEqual(calls, ['swap'])
  assert.equal(appended.length, 1)
  assert.match(appended[0].className, /building-interior-transition/)
  assert.match(appended[0].className, /building-interior-transition--door/)
  assert.equal(appended[0].children.length, 0)
  assert.equal(appended[0].removed, true)
})
