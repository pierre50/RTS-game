const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { Texture, TextureSource, Rectangle } = require('pixi.js')
const { resourceVisualTexture } = loadTsModule('app/lib/graphics/resourceMirroring.ts')
const MIRRORED_RESOURCE_TYPES = [
  'GroundWood',
  'GroundStone',
  'MedicinalHerb',
  'ToxicHerb',
  'FiberPlant',
  'Berrybush',
  'Wheat',
]
const probeTexture = new Texture({ source: new TextureSource({ width: 16, height: 16 }) })
const isResourceMirrored = resource => resourceVisualTexture(resource, probeTexture) !== probeTexture
const { resourceData } = loadTsModule('app/serialization/ResourceSaveData.ts')
const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts')

function mirroredResource() {
  for (let i = 0; i < 100; i++) {
    const resource = { type: 'GroundWood', i, j: 3, textureName: '001_resources/ground' }
    if (isResourceMirrored(resource)) return resource
  }
  throw new Error('No mirrored fixture')
}

test('allowed resources have a stable roughly 50% distribution, not an alternating pattern', () => {
  for (const type of MIRRORED_RESOURCE_TYPES) {
    const choices = Array.from({ length: 2000 }, (_, i) => isResourceMirrored({ type, i, j: 12 }))
    const count = choices.filter(Boolean).length
    assert.ok(count > 900 && count < 1100, `${type}: ${count}`)
    assert.ok(choices.some((value, i) => i > 0 && choices[i - 1] === value))
  }
  for (const type of ['Tree', 'Forge', 'sign', 'arrow_iron', 'poison_vial'])
    assert.equal(isResourceMirrored({ type, i: 1, j: 2 }), false)
})

test('orientation survives ordinary and packed saves, quantity changes and texture updates', () => {
  const resource = mirroredResource()
  const saved = JSON.parse(JSON.stringify(resourceData(resource)))
  assert.equal(isResourceMirrored(saved), true)
  assert.equal(isResourceMirrored({ ...saved, quantity: 0, textureName: '002_resources/ground' }), true)
  const collection = new CompactResourceSet(
    4,
    200,
    'blueprint',
    () => ({ totalQuantity: 1 }),
    state => ({ ...state }),
    {}
  )
  collection.addState(resource)
  collection.sealBlueprintBaseline()
  assert.equal(isResourceMirrored(collection.atCell(resource.i * 200 + resource.j)), true)
})

for (const rotate of [0, 2, 4, 6])
  test(`UV reflection keeps geometry and atlas textures unchanged (rotation ${rotate})`, () => {
    const original = new Texture({
      source: new TextureSource({ width: 64, height: 64 }),
      frame: new Rectangle(4, 6, 12, 18),
      orig: new Rectangle(0, 0, 24, 30),
      trim: new Rectangle(2, 3, 12, 18),
      rotate,
      defaultAnchor: { x: 0.4, y: 0.8 },
    })
    const before = { ...original.uvs }
    const reflected = resourceVisualTexture(mirroredResource(), original)
    assert.notEqual(reflected, original)
    assert.equal(reflected.source, original.source)
    assert.deepEqual(reflected.orig, original.orig)
    assert.deepEqual(reflected.trim, original.trim)
    assert.deepEqual(reflected.defaultAnchor, original.defaultAnchor)
    assert.deepEqual(original.uvs, before)
    for (const [output, input] of [
      [0, 1],
      [1, 0],
      [2, 3],
      [3, 2],
    ]) {
      assert.equal(reflected.uvs[`x${output}`], before[`x${input}`])
      assert.equal(reflected.uvs[`y${output}`], before[`y${input}`])
    }
    assert.equal(resourceVisualTexture(mirroredResource(), original), reflected)
    assert.equal(resourceVisualTexture({ type: 'sign', i: 0, j: 0 }, original), original)
  })
