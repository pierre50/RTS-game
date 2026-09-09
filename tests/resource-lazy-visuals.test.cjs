const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const counts = { sprites: 0, shadows: 0, textureChoices: 0 }
  class Instance {
    constructor(context) {
      this.context = context
      this.children = []
      this.isDead = false
      this.isDestroyed = false
    }
    assignProperties(values) {
      Object.assign(this, values)
    }
    addChild(child) {
      this.children.push(child)
    }
    destroy() {
      this.destroyed = true
    }
  }
  const { Resource } = loadTsModule('app/classes/Resource.ts', {
    mocks: {
      './Instance': { Instance },
      '../ui/entity/ResourceInterface': { ResourceInterface: class {} },
      '../config/gameplay': { NATURAL_RESOURCE_REGROWTH_BY_TYPE: {} },
      '../lib': {
        cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
        getEntityMapSpace: () => null,
        getGroundReliefLevel: cell => cell.z,
        getReliefLiftPixels: z => z * 16,
        getInstanceZIndex: () => 0,
        attachEntityShadowsToMapSpace() {},
      },
      '../lib/audio/settings': { onVisualSettingsChange: () => () => {} },
      './ResourceTexture': { getResourceConfig: () => ({ resources: { Tree: { totalQuantity: 10 } } }) },
      './ResourceSpriteFactory': {
        prepareStaticResourceTexture(resource) {
          counts.textureChoices++
          resource.textureName = 'tree_0'
          return { texture: { width: 128, height: 256, defaultAnchor: { x: 0.5, y: 1 } } }
        },
        createResourceSprite() {
          counts.sprites++
          return { scale: { set() {} }, position: {}, on() {}, skew: {} }
        },
      },
      './ResourceVisuals': {
        createShadow: () => {
          counts.shadows++
          return { destroy() {} }
        },
        syncShadow() {},
        shouldUseWindMotion: () => false,
        startWindMotion() {},
        stopWindMotion() {},
        syncVisualSettings() {},
      },
    },
  })
  const cell = { type: 'Grass', z: 0 }
  const context = { map: { grid: [[cell]], addToInstanceBucket() {} } }
  const resource = new Resource({ type: 'Tree', i: 0, j: 0 }, context)
  return { resource, cell, counts }
}

test('unseen trees occupy the map with a stable texture but allocate no sprite or shadow', () => {
  const { resource, cell, counts } = setup()
  assert.equal(cell.has, resource)
  assert.equal(cell.solid, true)
  assert.equal(resource.quantity, 10)
  assert.equal(resource.textureName, 'tree_0')
  resource.syncShadow()
  resource.syncVisualSettings()
  const { getInstanceScreenBounds } = loadTsModule('app/lib/grid/screenBounds.ts')
  assert.deepEqual(getInstanceScreenBounds(resource), { minX: -64, minY: -256, width: 128, height: 256 })
  assert.equal(counts.sprites, 0)
  assert.equal(counts.shadows, 0)
  resource.visible = true
  resource.syncShadow()
  assert.equal(counts.sprites, 1)
  assert.equal(counts.shadows, 1)
  resource.syncShadow()
  assert.equal(counts.sprites, 1)
})

test('removing an unseen tree never materializes its graphics; explicit use materializes once', () => {
  const a = setup()
  a.resource.destroy()
  assert.equal(a.counts.sprites, 0)
  assert.equal(a.counts.shadows, 0)
  const b = setup()
  const sprite = b.resource.sprite
  assert.equal(b.counts.sprites, 1)
  assert.equal(b.resource.sprite, sprite)
})
