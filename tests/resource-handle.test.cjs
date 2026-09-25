const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createResourceHandle, attachResourceView, hasResourceView, destroyLogicalResourceViews } = loadTsModule(
  'app/classes/resources/ResourceHandle.ts'
)
function fixture() {
  const counts = { created: 0, released: 0 }
  const map = {},
    state = {
      context: { map },
      visible: false,
      isDestroyed: false,
      label: 'tree-1',
      quantity: 100,
      textureName: 'tree',
    }
  const handle = createResourceHandle(state, {
    method(key) {
      if (key === 'harvest')
        return function () {
          this.quantity -= 10
        }
    },
    bounds: () => ({ width: 64, height: 128 }),
    sync() {},
    create(handle) {
      counts.created++
      const view = {
        visible: true,
        destroy() {
          this.destroyed = true
        },
      }
      attachResourceView(handle, view)
      handle.sprite = { texture: handle.textureName }
      return view
    },
    release(handle, view) {
      counts.released++
      view.destroy()
      delete handle.sprite
    },
  })
  return { handle, counts, map }
}
test('resource identity, occupancy and harvesting survive repeated view eviction', () => {
  const { handle, counts } = fixture(),
    cell = { has: handle, solid: true },
    target = handle
  handle.harvest()
  assert.equal(handle.quantity, 90)
  assert.equal(counts.created, 0)
  for (let i = 0; i < 10; i++) {
    handle.visible = true
    handle.syncShadow()
    assert.equal(hasResourceView(handle), true)
    handle.harvest()
    handle.textureName = 'cut-tree'
    handle.visible = false
    handle.syncShadow()
    assert.equal(hasResourceView(handle), false)
    assert.equal(cell.has, target)
    assert.equal(cell.solid, true)
  }
  assert.deepEqual(counts, { created: 10, released: 10 })
  assert.equal(handle.quantity, -10)
  handle.visible = true
  handle.syncShadow()
  assert.equal(handle.sprite.texture, 'cut-tree')
})
test('serialization bounds and map cleanup do not materialize unseen resources', () => {
  const { handle, counts, map } = fixture()
  assert.ok('deferredSpriteBounds' in handle)
  assert.equal(handle.deferredSpriteBounds.width, 64)
  destroyLogicalResourceViews(map)
  assert.equal(counts.created, 0)
  handle.visible = true
  handle.syncShadow()
  destroyLogicalResourceViews(map)
  assert.deepEqual(counts, { created: 1, released: 1 })
  handle.isDestroyed = true
  assert.equal(handle.sprite, undefined)
  assert.equal(counts.created, 1)
})

test('a failed view initialization is cleaned up and can be retried on the same handle', () => {
  let attempts = 0,
    released = 0
  const handle = createResourceHandle(
    { visible: true, isDestroyed: false },
    {
      method() {},
      bounds: () => ({}),
      sync() {},
      create(handle) {
        const view = { visible: true, destroy() {} }
        attachResourceView(handle, view)
        if (++attempts === 1) throw new Error('texture not ready')
        handle.sprite = {}
        return view
      },
      release() {
        released++
      },
    }
  )
  assert.throws(() => handle.syncShadow(), /texture not ready/)
  assert.equal(hasResourceView(handle), false)
  assert.equal(released, 1)
  handle.syncShadow()
  assert.equal(hasResourceView(handle), true)
  assert.equal(attempts, 2)
})
