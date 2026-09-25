const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { CompactResourceSet, resourceReadValues, resolveResource, materializedResources } = loadTsModule(
  'app/classes/resources/CompactResourceSet.ts',
  { moduleCache }
)

function setup(capacity = 100000, stride = 1000) {
  let created = 0
  const definitions = {
    Tree: { totalQuantity: 100, totalHitPoints: 30 },
    Berrybush: { totalQuantity: 50, totalHitPoints: 10 },
    Wheat: { isAnimated: true },
  }
  const resources = new CompactResourceSet(
    capacity,
    stride,
    'test-world',
    type => definitions[type],
    state => {
      created++
      return {
        ...state,
        family: 'resource',
        clear() {
          this.isDestroyed = true
          resources.delete(this)
        },
      }
    },
    {}
  )
  const add = (i, j, overrides = {}) =>
    resources.addState({ i, j, type: 'Tree', textureName: 'tree_0', isNaturalResource: true, ...overrides })
  return { resources, add, created: () => created }
}

test('one hundred thousand resources occupy compact zones without constructing gameplay objects', () => {
  const { resources, add, created } = setup()
  for (let i = 0; i < 100; i++) for (let j = 0; j < 1000; j++) add(i, j)
  assert.equal(resources.size, 100000)
  assert.equal(created(), 0)
  assert.equal(resources.isSolidAt(22003), true)
  assert.equal(resources.isSolidAt(999999), false)
  let count = 0
  for (const state of resourceReadValues(resources)) {
    count++
    assert.equal(state.quantity, 100)
  }
  assert.equal(count, 100000)
  assert.equal(created(), 0)
  assert.equal([...materializedResources(resources)].length, 0)
  const tree = resources.atCell(22003)
  assert.equal(resources.byLabel(tree.label), tree)
  assert.equal(resources.atCell(22003), tree)
  assert.equal(created(), 1)
  assert.equal(resources.size, 100000)
})

test('chosen offscreen resources preserve identity, depletion and deletion without resurrection', () => {
  const { resources, add } = setup()
  add(4, 5)
  const record = [...resourceReadValues(resources)][0]
  const resource = resolveResource(record)
  resource.quantity = 17
  resource.hitPoints = 0
  resource.textureName = 'cut-tree'
  assert.equal(resolveResource(record), resource)
  assert.equal([...resourceReadValues(resources)][0], resource)
  assert.equal(resources.has(resource), true)
  resource.clear()
  assert.equal(resources.has(resource), false)
  assert.equal(resources.atCell(4005), null)
  assert.equal(resources.byLabel(resource.label), null)
  assert.equal(resources.isSolidAt(4005), false)
  assert.equal(resources.size, 0)
  assert.equal(resources.delete(resource), false)
})

test('save records round trip cold and harvested resources with stable labels', () => {
  const first = setup()
  first.add(1, 2)
  first.add(3, 4, { label: 'legacy-id', type: 'Berrybush', quantity: 5, berrybushFullTextureName: 'berries-full' })
  const tree = first.resources.atCell(1002)
  tree.quantity = 12
  const saved = JSON.parse(
    JSON.stringify(
      [...resourceReadValues(first.resources)].map(r => ({
        i: r.i,
        j: r.j,
        type: r.type,
        label: r.label,
        textureName: r.textureName,
        quantity: r.quantity,
        totalQuantity: r.totalQuantity,
        hitPoints: r.hitPoints,
        ...(r.berrybushFullTextureName ? { berrybushFullTextureName: r.berrybushFullTextureName } : {}),
      }))
    )
  )
  const second = setup()
  for (const state of saved) second.resources.addState(state)
  assert.equal(second.created(), 0)
  assert.equal(second.resources.byLabel(tree.label).quantity, 12)
  assert.equal(second.resources.byLabel('legacy-id').berrybushFullTextureName, 'berries-full')
  assert.equal(second.resources.byLabel('legacy-id').quantity, 5)
})

test('zone search returns exactly the same nearest valid candidates and tie order as a full scan', () => {
  const { resources, add, created } = setup(5000, 512)
  for (let n = 0; n < 5000; n++) add(Math.floor(n / 100) * 9, (n % 100) * 5, { quantity: n % 7 ? 100 : 0 })
  for (const point of [
    { i: 3, j: 9 },
    { i: 210, j: 230 },
    { i: 500, j: 500 },
  ]) {
    const accepts = r => r.quantity > 0 && r.i % 3 === 0
    const distance = r => Math.abs(r.i - point.i) + Math.abs(r.j - point.j)
    const expected = [...resources.readValues('Tree')]
      .filter(accepts)
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, 18)
    const actual = resources.nearest('Tree', point.i, point.j, 18, accepts).sort((a, b) => distance(a) - distance(b))
    assert.deepEqual(
      actual.map(r => r.label),
      expected.map(r => r.label)
    )
  }
  assert.equal(created(), 0)
})

test('dynamic additions, animated crops, iteration and clear retain Set behavior', () => {
  const { resources, add, created } = setup()
  add(1, 1)
  add(2, 2, { type: 'Wheat' })
  assert.equal(created(), 1)
  const dynamic = { type: 'Tree', label: 'planted', i: 3, j: 3 }
  resources.add(dynamic).add(dynamic)
  assert.equal(resources.size, 3)
  assert.equal([...resources].length, 3)
  assert.equal(created(), 2)
  assert.equal(resources.delete(dynamic), true)
  resources.clear()
  assert.equal(resources.size, 0)
  assert.equal(resources.atCell(1001), null)
  assert.equal([...resources].length, 0)
})

test('deleted and cleared materialized handles can be explicitly re-added', () => {
  const { resources, add } = setup()
  add(1, 1)
  const tree = resources.atCell(1001)
  resources.delete(tree)
  resources.add(tree)
  assert.equal(resources.size, 1)
  assert.equal(resources.has(tree), true)
  resources.clear()
  resources.add(tree)
  assert.equal(resources.size, 1)
  assert.equal(resources.has(tree), true)
  assert.equal(resources.delete(tree), true)
  assert.equal(resources.size, 0)
})

test('projectiles collide with cold trees and saved targets resolve the same handle', () => {
  const { findTreeSegmentCollision } = loadTsModule('app/lib/treeCollision.ts', { moduleCache })
  const { cartesianToIsometric } = loadTsModule('app/lib/maths.ts', { moduleCache })
  const { getDest } = loadTsModule('app/classes/map/MapSaveReferences.ts', { moduleCache })
  const { resources, add, created } = setup()
  add(20, 20)
  add(30, 30)
  const map = { resources, grid: [], context: { players: [] }, instanceBuckets: [] }
  const [x, y] = cartesianToIsometric(20, 20)
  const previous = { x: x - 20, y }
  const current = { x: x + 20, y }
  assert.equal(findTreeSegmentCollision(map, previous, current, { currentAltitude: 200 }), null)
  assert.equal(created(), 0)
  const collision = findTreeSegmentCollision(map, previous, current)
  assert.ok(collision)
  assert.equal(collision.i, 20)
  assert.equal(created(), 1)
  assert.equal(getDest(collision.label, map), collision)
  assert.equal(created(), 1)
  collision.clear()
  assert.equal(findTreeSegmentCollision(map, previous, current), null)
})

test('resource zone indices load on demand and evict without losing mutations or identity', () => {
  const { resources, add, created } = setup(100, 6400)
  for (let zone = 0; zone < 100; zone++) add(zone * 64, 0)
  assert.equal(resources.residentZoneCount, 0)
  assert.equal(created(), 0)
  const first = resources.atCell(0)
  first.quantity = 7
  for (let zone = 1; zone < 100; zone++) assert.equal(resources.hasAtCell(zone * 64 * 6400), true)
  assert.equal(resources.residentZoneCount, 64)
  assert.equal(created(), 1)
  assert.equal(resources.atCell(0), first)
  assert.equal(resources.atCell(0).quantity, 7)
  resources.delete(first)
  for (let zone = 1; zone < 100; zone++) resources.hasAtCell(zone * 64 * 6400)
  assert.equal(resources.atCell(0), null)
  assert.equal(resources.residentZoneCount, 64)
})

test('save snapshots reuse cold zones and preserve depletion, additions, deletion and array order', () => {
  const { partitionSave, assembleSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts', { moduleCache })
  const { cloneSaveSnapshot } = loadTsModule('app/serialization/SaveSnapshot.ts', { moduleCache })
  const { resources, add, created } = setup()
  add(1, 1, { label: 'duplicate' })
  add(130, 130, { label: 'duplicate' })
  let serialized = 0
  const serialize = resource => {
    serialized++
    return { label: resource.label, type: resource.type, i: resource.i, j: resource.j, quantity: resource.quantity }
  }
  const record = () => ({ resources: resources.saveValues(serialize), animals: [], players: [] })
  const first = record()
  const firstSplit = partitionSave(first)
  assert.deepEqual(assembleSave(firstSplit.metadata, firstSplit.collections, [...firstSplit.zones.values()]), first)
  assert.equal(created(), 0)
  assert.equal(serialized, 2)
  assert.equal(record().resources, first.resources)
  assert.equal(serialized, 2)
  const snapshot = cloneSaveSnapshot(first)
  const tree = resources.atCell(1001)
  tree.quantity = 7
  const next = record()
  assert.equal(snapshot.resources[0].quantity, 100)
  assert.equal(next.resources[0].quantity, 7)
  const nextSplit = partitionSave(next)
  const coldKey = [...firstSplit.zones.keys()].find(key => key.includes('entities:2:2'))
  assert.ok(coldKey)
  assert.equal(nextSplit.zones.get(coldKey), firstSplit.zones.get(coldKey))
  assert.deepEqual(assembleSave(nextSplit.metadata, nextSplit.collections, [...nextSplit.zones.values()]), next)
  resources.delete(tree)
  add(200, 200)
  resources.add({ label: 'dynamic', type: 'Wheat', i: 3, j: 3, quantity: 2 })
  const final = record()
  const split = partitionSave(final)
  assert.deepEqual(assembleSave(split.metadata, split.collections, [...split.zones.values()]), final)
  assert.equal(final.resources.length, 3)
  assert.equal(final.resources[0].i, 130)
  resources.clear()
  assert.deepEqual(record().resources, [])
})

test('blueprint deltas skip untouched resources and round-trip harvest, deletion, additions and animated state', () => {
  const { resourceData } = loadTsModule('app/serialization/ResourceSaveData.ts')
  const { resources, add, created } = setup(100000, 1000)
  for (let i = 0; i < 100; i++) for (let j = 0; j < 1000; j++) add(i, j)
  resources.sealBlueprintBaseline()
  let visited = 0
  const serialize = resource => {
    visited++
    return resourceData(resource)
  }
  const untouched = resources.saveDelta(serialize)
  assert.equal(visited, 0)
  assert.equal(created(), 0)
  assert.deepEqual(untouched.resources, [])
  assert.deepEqual(untouched.resourceDelta.removed, [])
  assert.deepEqual(untouched.resourceDelta.updated, [])
  const chopped = resources.atCell(1001)
  chopped.quantity = 4
  const deleted = resources.atCell(1002)
  resources.delete(deleted)
  resources.add({ label: 'planted', i: 105, j: 2, type: 'Wheat', quantity: 7, sprite: { currentFrame: 2 } })
  visited = 0
  const changed = JSON.parse(JSON.stringify(resources.saveDelta(serialize)))
  assert.equal(visited, 3, 'only the live changed handle, its baseline and the dynamic resource are serialized')
  assert.equal(changed.resourceDelta.updated.length, 1)
  assert.equal(changed.resourceDelta.updated[0].state.quantity, 4)
  assert.deepEqual(changed.resourceDelta.removed, [1002])
  assert.equal(changed.resources[0].currentFrame, 2)
  const copy = setup(100000, 1000)
  for (let i = 0; i < 100; i++) for (let j = 0; j < 1000; j++) copy.add(i, j)
  copy.resources.sealBlueprintBaseline()
  copy.resources.restoreDelta(changed.resourceDelta, changed.resources, () => {})
  assert.equal(copy.resources.hasAtCell(1002), false)
  assert.equal(copy.resources.atCell(1001).quantity, 4)
  assert.equal(copy.created(), 2, 'only the changed tree and added wheat materialize during restore')
  assert.equal(copy.resources.size, resources.size)
  const expanded = copy.resources.expandDelta(changed.resourceDelta, changed.resources, resourceData)
  const migrated = copy.resources.deltaFromFullSave(expanded, resourceData)
  assert.deepEqual(migrated, changed)
  assert.throws(
    () => copy.resources.restoreDelta({ ...changed.resourceDelta, signature: 'bad' }, [], () => {}),
    /BLUEPRINT_MISMATCH/
  )
  assert.throws(
    () => copy.resources.restoreDelta({ ...changed.resourceDelta, removed: [1002, 1002] }, [], () => {}),
    /CORRUPT/
  )
})
