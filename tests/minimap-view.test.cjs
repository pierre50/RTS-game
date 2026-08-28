const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function createElementFactory(created) {
  return tag => {
    const element = {
      tag,
      children: [],
      classList: { add: (...classes) => (element.classes = classes) },
      appendChild: child => element.children.push(child),
      remove: () => {
        element.removed = true
      },
    }
    created.push(tag)
    return element
  }
}

test('minimap view creates canvases lazily', () => {
  const created = []
  const previousDocument = global.document
  global.document = { createElement: createElementFactory(created) }
  try {
    const { MinimapView } = loadTsModule('app/ui/minimap/MinimapView.ts')
    const view = new MinimapView({})

    assert.deepEqual(created, ['div', 'div'])
    assert.equal(view.element.children.length, 0)

    view.ensureCanvases()

    assert.deepEqual(created, ['div', 'div', 'canvas', 'canvas', 'canvas'])
    assert.equal(view.element.children.length, 3)
  } finally {
    global.document = previousDocument
  }
})

test('minimap view releases canvases and player layers', () => {
  const created = []
  const previousDocument = global.document
  global.document = { createElement: createElementFactory(created) }
  try {
    const { MinimapView } = loadTsModule('app/ui/minimap/MinimapView.ts')
    const view = new MinimapView({})
    const { terrain, resources, camera } = view.ensureCanvases()
    const playerLayer = document.createElement('canvas')
    view.players.push({ id: 'minimap-player', canvas: playerLayer, context: {} })

    view.releaseCanvases()

    assert.equal(terrain.removed, true)
    assert.equal(resources.removed, true)
    assert.equal(camera.removed, true)
    assert.equal(playerLayer.removed, true)
    assert.equal(view.terrain, undefined)
    assert.equal(view.resources, undefined)
    assert.equal(view.camera, undefined)
    assert.deepEqual(view.players, [])
  } finally {
    global.document = previousDocument
  }
})
