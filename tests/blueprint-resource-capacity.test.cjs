const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { CompactResourceSet, resourceReadValues } = loadTsModule('app/classes/resources/CompactResourceSet.ts')
const { resourceData } = loadTsModule('app/serialization/ResourceSaveData.ts')
const definitions = { Stone: { totalQuantity: 95, assets: 'stone' }, Tree: { totalQuantity: 180, assets: 'tree' } }

function load(resources, packedMode = true) {
  const packed = { stride: 3, types: new Uint8Array(9), flags: new Uint8Array(9), extras: new Map() }
  const { loadBlueprintResourceBatches } = loadTsModule('app/classes/map/generation/BlueprintResourceLoading.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => ({ resources: definitions }) } } },
      '../../../constants': { PASSABLE_RESOURCE_TYPES: new Set() },
      '../../../lib/graphics/textures': { textureRefToString: value => value.sheet },
      '../../../lib/loadDiagnostics': { beginLoadTrace: () => ({ progress() {}, end() {} }) },
      '../../../serialization/blueprint/MapBlueprintDecoding': { TERRAIN_TYPES: ['Grass'] },
      '../../cell/PackedCellRegistry': { getPackedCellStore: () => (packedMode ? packed : null) },
      '../../Resource': { Resource: { spawn: state => ({ ...state, family: 'resource' }) } },
      '../../resources/CompactResourceSet': { CompactResourceSet },
      '../../ResourceTexture': { getTerrainAssets: assets => assets, normalizeResourceTextureRef: value => value },
    },
  })
  const map = { size: 2, grid: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ type: 'Grass' }))) }
  map.context = { app: {}, gamebox: {}, map, scheduler: {} }
  for (const _ of loadBlueprintResourceBatches(map, { resources })) void _
  return map.resources
}

for (const packed of [true, false]) {
  test(`initial capacity comes from each node, including legacy maps (packed=${packed})`, () => {
    const input = [
      { type: 'Stone', i: 0, j: 0, quantity: 23 },
      { type: 'Tree', i: 0, j: 1, quantity: 145 },
      { type: 'Stone', i: 0, j: 2, quantity: 10, totalQuantity: 60 },
      { type: 'Stone', i: 1, j: 0 },
    ]
    const values = [...resourceReadValues(load(input, packed))]
    assert.deepEqual(
      values.map(r => r.totalQuantity),
      [23, 145, 60, 95]
    )
    assert.equal(input[0].totalQuantity, undefined)
  })
}

test('harvesting and saving retain the initial capacity after restoring resource data', () => {
  const original = load([{ type: 'Stone', i: 0, j: 0, quantity: 23 }])
  original.atCell(0).quantity = 18
  const saved = original.saveValues(resourceData)
  assert.equal(saved[0].totalQuantity, 23)
  const restored = new CompactResourceSet(
    1,
    3,
    'restored',
    type => definitions[type],
    state => state,
    {}
  )
  restored.addState(saved[0])
  const value = [...resourceReadValues(restored)][0]
  assert.equal(value.quantity, 18)
  assert.equal(value.totalQuantity, 23)
})

test('legacy capacity signatures remain compatible without accepting arbitrary blueprint changes', () => {
  const old = new CompactResourceSet(
    1,
    3,
    'resource:local:outside:0',
    type => definitions[type],
    state => state,
    {}
  )
  old.addState({ type: 'Stone', i: 0, j: 0, quantity: 23, textureName: 'stone', isNaturalResource: true })
  old.sealBlueprintBaseline()
  const { resourceDelta } = old.saveDelta(resourceData)
  const current = load([{ type: 'Stone', i: 0, j: 0, quantity: 23 }])
  assert.doesNotThrow(() => current.assertBlueprintDelta(resourceDelta))
  assert.throws(() => current.assertBlueprintDelta({ ...resourceDelta, signature: 'wrong' }), /MISMATCH/)
  assert.notEqual(current.saveDelta(resourceData).resourceDelta.signature, resourceDelta.signature)
})
