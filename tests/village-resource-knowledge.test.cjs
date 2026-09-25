const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { CompactResourceSet, resolveResource } = loadTsModule('app/classes/resources/CompactResourceSet.ts', {
  moduleCache,
})
const { villageResources, villageAnimals, updateVillageResource } = loadTsModule(
  'app/services/world/VillageResourceKnowledge.ts',
  { moduleCache }
)

function setup() {
  let created = 0
  const resources = new CompactResourceSet(
    10000,
    5000,
    'test',
    () => ({ totalQuantity: 100 }),
    state => {
      created++
      return { ...state, family: 'resource' }
    },
    {}
  )
  const map = { resources, instanceBuckets: [], grid: [] }
  const add = (i, j) => resources.addState({ i, j, type: 'Tree', textureName: 'tree' })
  const bucket = entity => {
    const i = Math.floor(entity.i / 8),
      j = Math.floor(entity.j / 8)
    map.instanceBuckets[i] ??= []
    map.instanceBuckets[i][j] ??= new Set()
    map.instanceBuckets[i][j].add(entity)
  }
  const owner = (...points) => {
    const centers = points.map(([i, j], n) => ({ i, j, label: `center${n}`, isBuilt: true }))
    return { context: { map }, centers, buildingsByTypes: () => centers, getHomeAnchor: () => centers[0] ?? null }
  }
  const read = (ai, now = 0) => [...villageResources(ai, now)]
  return { resources, map, add, bucket, owner, read, created: () => created }
}

test('5000-cell maps use bounded local reads without global iteration or materialization', () => {
  const s = setup()
  s.add(100, 100)
  s.add(130, 100)
  s.add(130, 101)
  for (let i = 0; i < 4000; i++) s.add(1000 + i, 4000)
  s.resources[Symbol.iterator] =
    s.resources.materializedValues =
    s.resources.readValues =
      () => {
        throw Error('global scan')
      }
  const values = s.read(s.owner([100, 100]))
  assert.deepEqual(
    values.map(v => [v.i, v.j]),
    [
      [100, 100],
      [130, 100],
    ]
  )
  assert.equal(s.created(), 0)
})

test('overlapping villages share live quantities, depletion and regrowth without rebuilding', () => {
  const s = setup()
  s.add(110, 100)
  const a = s.owner([100, 100]),
    b = s.owner([120, 100])
  const cold = s.read(a)[0]
  s.read(b)
  s.resources.readArea = () => {
    throw Error('unexpected rebuild')
  }
  const actual = resolveResource(cold)
  actual.quantity = 0
  assert.equal(s.read(a, 100)[0], actual)
  assert.equal(s.read(b, 100)[0].quantity, 0)
  actual.quantity = 25
  assert.equal(s.read(a, 200)[0].quantity, 25)
  s.resources.delete(actual)
  actual.isDestroyed = true
  updateVillageResource(s.map, actual)
  assert.equal(s.read(a, 300).length, 0)
  assert.equal(s.read(b, 300).length, 0)
})

test('local creation updates only nearby indexes, while several villages keep separate territories', () => {
  const s = setup()
  s.add(100, 100)
  s.add(500, 500)
  const a = s.owner([100, 100], [500, 500]),
    b = s.owner([1000, 1000])
  assert.equal(s.read(a).length, 2)
  s.read(b)
  s.resources.readArea = () => {
    throw Error('unexpected rebuild')
  }
  const wheat = { i: 101, j: 100, type: 'Wheat', family: 'resource', quantity: 50 }
  updateVillageResource(s.map, wheat)
  assert.equal(s.read(a, 100).length, 3)
  assert.equal(s.read(b, 100).length, 0)
  a.centers.shift()
  assert.deepEqual(
    s.read(a, 200).map(r => r.i),
    [500]
  )
})

test('animal searches use local buckets and follow animals crossing the territory boundary', () => {
  const s = setup(),
    ai = s.owner([100, 100])
  const animal = { i: 105, j: 100, family: 'animal' }
  s.bucket(animal)
  s.bucket({ i: 500, j: 500, family: 'animal' })
  s.map.gaia = {
    get animals() {
      throw Error('global animal scan')
    },
  }
  assert.deepEqual([...villageAnimals(ai)], [animal])
  animal.i = 131
  assert.equal([...villageAnimals(ai)].length, 0)
})

test('daily fallback reconciles at most one existing village every 250 ms', () => {
  const s = setup(),
    a = s.owner([100, 100]),
    b = s.owner([500, 500])
  s.read(a)
  s.read(b)
  let scans = 0
  const original = s.resources.readArea.bind(s.resources)
  s.resources.readArea = (...args) => {
    scans++
    return original(...args)
  }
  s.read(a, 20000)
  s.read(b, 20000)
  assert.equal(scans, 1)
  s.read(b, 20250)
  assert.equal(scans, 2)
})

test('bursts of changed cells are processed in bounded batches', () => {
  const s = setup(),
    ai = s.owner([100, 100])
  s.read(ai)
  for (let n = 0; n < 100; n++)
    updateVillageResource(s.map, { i: 95 + Math.floor(n / 10), j: 95 + (n % 10), family: 'resource', type: 'Tree' })
  assert.equal(s.read(ai, 100).length, 64)
  assert.equal(s.read(ai, 200).length, 100)
})

test('changing the map rebuilds knowledge and drops old subscriptions', () => {
  const s = setup(),
    ai = s.owner([100, 100])
  s.add(100, 100)
  s.read(ai)
  const next = setup()
  next.add(101, 100)
  ai.context.map = next.map
  assert.deepEqual(
    s.read(ai).map(r => r.i),
    [101]
  )
})
