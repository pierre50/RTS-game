const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getInstanceCameraBounds, getInstanceScreenBounds } = loadTsModule('app/lib/grid/screenBounds.ts')
const { rectangleIntersectsViewport } = loadTsModule('app/lib/graphics/chunkCulling.ts')
const viewport = { visibleLeft: 0, visibleTop: 0, visibleWidth: 800, visibleHeight: 600 }

for (const type of ['Tree', 'House', 'Villager']) {
  test(`${type} stays visible above the screen until its shadow margin exits too`, () => {
    const instance = {
      type,
      x: 100,
      y: -100,
      sprite: { width: 128, height: 256, anchor: { x: 0.5, y: 1 } },
    }
    assert.equal(rectangleIntersectsViewport(getInstanceScreenBounds(instance), viewport), false)
    assert.equal(rectangleIntersectsViewport(getInstanceCameraBounds(instance), viewport), true)
    instance.y = -145
    assert.equal(rectangleIntersectsViewport(getInstanceCameraBounds(instance), viewport), false)
    instance.x = -100
    instance.y = 200
    assert.equal(rectangleIntersectsViewport(getInstanceCameraBounds(instance), viewport), false)
    instance.x = 100
    instance.y = 900
    assert.equal(rectangleIntersectsViewport(getInstanceCameraBounds(instance), viewport), false)
  })
}

test('deferred graphics use the same margin without materializing their sprite', () => {
  const instance = {
    x: 100,
    y: -100,
    deferredSpriteBounds: { width: 128, height: 256, anchor: { x: 0.5, y: 1 } },
    get sprite() {
      throw new Error('should remain deferred')
    },
  }
  assert.equal(rectangleIntersectsViewport(getInstanceCameraBounds(instance), viewport), true)
})
