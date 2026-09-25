const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { Container, Sprite } = require('pixi.js')

function setup(logical = false) {
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
        getEntityCell: resource => resource.context.map.grid[resource.i][resource.j],
        uuidv4: () => 'stable-resource-id',
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
          return new Sprite()
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
  const cell = { type: 'Grass', z: 0, corpses: new Set() }
  const map = Object.assign(new Container(), {
    grid: [[cell]],
    resources: new Set(),
    addToInstanceBucket() {},
    removeFromInstanceBucket() {},
  })
  const context = { map }
  const resource = logical
    ? Resource.spawn({ type: 'Tree', i: 0, j: 0, textureName: 'tree_0' }, context)
    : new Resource({ type: 'Tree', i: 0, j: 0 }, context)
  map.resources.add(resource)
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

test('logical resource frees its container and reconstructs visuals without replacing the gameplay target', () => {
  const { resource, cell, counts } = setup(true)
  const target = resource
  assert.equal(resource.context.map.children.length, 0)
  assert.equal(cell.has, target)
  resource.quantity -= 3
  resource.visible = true
  resource.syncShadow()
  const firstSprite = resource.sprite
  assert.equal(resource.context.map.children.length, 1)
  assert.equal(counts.sprites, 1)
  resource.visible = false
  resource.syncShadow()
  assert.equal(resource.context.map.children.length, 0)
  assert.equal(firstSprite.destroyed, true)
  assert.equal(cell.has, target)
  assert.equal(resource.quantity, 7)
  resource.visible = true
  resource.syncShadow()
  assert.notEqual(resource.sprite, firstSprite)
  assert.equal(resource.quantity, 7)
  let destroyed = 0
  resource.once('destroyed', () => destroyed++)
  resource.visible = false
  resource.syncShadow()
  assert.equal(destroyed, 0)
  resource.destroy()
  assert.equal(destroyed, 1)
  assert.equal(counts.sprites, 2)
})

test('clearing an unseen logical resource frees occupancy without constructing a view', () => {
  const { resource, cell, counts } = setup(true)
  resource.getFootprintCells = () => [cell]
  resource.clear()
  assert.equal(cell.has, null)
  assert.equal(cell.solid, false)
  assert.equal(resource.context.map.resources.size, 0)
  assert.equal(resource.isDestroyed, true)
  assert.equal(counts.sprites, 0)
  assert.equal(resource.context.map.children.length, 0)
})
