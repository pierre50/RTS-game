const assert = require('node:assert/strict')
const test = require('node:test')
const LZString = require('lz-string')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { ZonedSaveStore } = loadTsModule('app/serialization/ZonedSaveStore.ts')
const { partitionSave, assembleSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts')

const entity = (label, i, j, extra = {}) => ({ label, i, j, type: 'Tree', ...extra })
function world() {
  return {
    version: 2,
    world: { size: 1500, seed: 1, pregeneratedBlueprintId: 'fixed-v1' },
    camera: { x: 1, y: 2 },
    runtime: { elapsedMs: 50 },
    config: {},
    resources: [entity('tree-a', 1, 1, { quantity: 30 }), entity('tree-b', 130, 130, { quantity: 40 })],
    animals: [entity('deer', 140, 140, { type: 'Deer', hitPoints: 20 })],
    naturalResourceRespawnSlots: [entity('old-tree', 200, 200, { depletedDay: 3 })],
    players: [
      {
        label: 'human',
        type: 'Human',
        isPlayed: true,
        units: [entity('hero', 2, 2, { type: 'Hero', inventory: [{ type: 'Wood', quantity: 5 }] })],
        buildings: [
          entity('house', 70, 70, { type: 'House', interiorBuildings: [entity('chest', 4, 4, { type: 'Chest' })] }),
        ],
        corpses: [entity('corpse', 80, 80, { type: 'Villager', isDead: true, quantity: 1 })],
        targetKnowledge: [entity('enemy', 300, 300, { family: 'unit', spaceId: 'outside', hitPoints: 5 })],
        views: {
          version: 1,
          stride: 1501,
          chunkSize: 64,
          explored: [{ i: 0, j: 0, bits: 'encoded' }],
          visible: [{ index: 3004, viewBy: ['hero'] }],
        },
        aiState: { enemyUnits: [{ instance: 'enemy', lastSeenAgo: 40 }] },
      },
    ],
  }
}
function memory() {
  const data = new Map()
  const writes = []
  return {
    data,
    writes,
    getItem: key => data.get(key) ?? null,
    setItem(key, value) {
      writes.push(key)
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}
function campaign() {
  return {
    format: 'campaign-v1',
    version: 1,
    currentWorldId: 'home',
    worlds: {
      home: { id: 'home', state: world() },
      away: { id: 'away', state: world() },
    },
    economy: {
      version: 1,
      regions: { unknown: { initialState: world(), terrain: Array(130).fill('....'), elevation: ['0000'] } },
    },
    factions: { human: { relation: 2 } },
    heroParty: {},
    worldGraph: { nodes: {} },
  }
}
const publish = () => {}
const decode = value => JSON.parse(LZString.decompressFromBase64(value))

test('all entities, corpses, regrowth, knowledge, exploration, interiors and offline regions round trip', () => {
  const input = campaign()
  const frozen = JSON.stringify(input)
  const split = partitionSave(input)
  assert.equal(JSON.stringify(input), frozen, 'partition must not mutate the runtime snapshot')
  assert.equal(split.metadata.worlds.home.state.resources.length, 0)
  assert.equal(split.metadata.economy.regions.unknown.terrain.length, 0)
  assert.deepEqual(assembleSave(split.metadata, split.collections, [...split.zones.values()]), input)
  const backend = memory()
  const store = new ZonedSaveStore(backend)
  store.save('save_0', input, publish)
  assert.deepEqual(store.load('save_0'), input)
  assert.deepEqual(new ZonedSaveStore(backend).load('save_0'), input)
})

test('unchanged saves and restarted sessions reuse all zone files', () => {
  const backend = memory()
  let store = new ZonedSaveStore(backend)
  const input = world()
  const first = store.save('save_0', input, publish)
  assert.ok(first.changedZones > 1)
  backend.writes.length = 0
  input.runtime.elapsedMs++
  let result = store.save('save_0', input, publish)
  assert.equal(result.changedZones, 0)
  assert.equal(result.reusedZones, first.changedZones)
  assert.deepEqual(backend.writes, ['save_0'])
  store = new ZonedSaveStore(backend)
  result = store.save('save_0', input, publish)
  assert.equal(result.changedZones, 0)
})

test('movement updates both occupied zones atomically and does not grant new enemy knowledge', () => {
  const backend = memory()
  const store = new ZonedSaveStore(backend)
  const input = world()
  store.save('save_0', input, publish)
  const knowledge = structuredClone(input.players[0].targetKnowledge)
  const prior = structuredClone(input)
  input.players[0].units[0].i = 135
  input.players[0].units[0].j = 135
  const originalWrite = backend.setItem.bind(backend)
  backend.setItem = (key, value) => {
    if (key !== 'save_0') assert.deepEqual(new ZonedSaveStore(backend).load('save_0'), prior)
    originalWrite(key, value)
  }
  const stats = store.save('save_0', input, publish)
  assert.equal(stats.changedZones, 2)
  const loaded = store.load('save_0')
  assert.equal(loaded.players[0].units.filter(u => u.label === 'hero').length, 1)
  assert.equal(loaded.players[0].units[0].i, 135)
  assert.deepEqual(loaded.players[0].targetKnowledge, knowledge)
})

test('tree removal and respawn, looted corpses and animal death persist without reviving deleted entities', () => {
  const backend = memory()
  const store = new ZonedSaveStore(backend)
  const input = world()
  store.save('save_0', input, publish)
  input.resources.shift()
  input.naturalResourceRespawnSlots.push(entity('tree-a', 1, 1, { depletedDay: 4 }))
  input.players[0].corpses = []
  input.animals[0].isDead = true
  input.animals[0].quantity = 7
  store.save('save_0', input, publish)
  assert.deepEqual(store.load('save_0'), input)
  input.naturalResourceRespawnSlots.pop()
  input.resources.push(entity('new-tree', 1, 1, { quantity: 50 }))
  input.animals = []
  store.save('save_0', input, publish)
  assert.deepEqual(store.load('save_0'), input)
  assert.equal(backend.data.size, decode(backend.data.get('save_0')).parts.length + 1, 'obsolete parts are released')
})

test('a failed part, manifest or index write preserves the last completed save and cleans staged parts', () => {
  for (const failure of ['part', 'manifest', 'index', 'write-then-error']) {
    const backend = memory()
    const store = new ZonedSaveStore(backend)
    const input = world()
    store.save('save_0', input, publish)
    const old = structuredClone(input)
    const count = backend.data.size
    input.resources[0].quantity--
    const write = backend.setItem.bind(backend)
    let failed = false
    backend.setItem = (key, value) => {
      if (
        !failed &&
        ((failure === 'part' && key !== 'save_0') ||
          (['manifest', 'write-then-error'].includes(failure) && key === 'save_0'))
      ) {
        failed = true
        if (failure === 'write-then-error') write(key, value)
        throw new Error('disk full')
      }
      write(key, value)
    }
    assert.throws(
      () =>
        store.save('save_0', input, () => {
          if (failure === 'index') throw new Error('index full')
        }),
      /full/
    )
    assert.deepEqual(new ZonedSaveStore(backend).load('save_0'), old)
    assert.equal(backend.data.size, count)
  }
})

test('legacy saves migrate on write; different slots do not share mutable parts', () => {
  const backend = memory()
  const input = world()
  backend.data.set('save_0', LZString.compressToBase64(JSON.stringify(input)))
  const store = new ZonedSaveStore(backend)
  assert.deepEqual(store.load('save_0'), input)
  store.save('save_0', input, publish)
  store.save('save_1', input, publish)
  input.resources = []
  store.save('save_0', input, publish)
  assert.equal(store.load('save_1').resources.length, 2)
  assert.equal(store.load('save_0').resources.length, 0)
})

test('missing, corrupt or foreign chunks fail explicitly, never returning a partial world', () => {
  for (const damage of ['missing', 'corrupt', 'foreign', 'duplicate', 'path']) {
    const backend = memory()
    const store = new ZonedSaveStore(backend)
    store.save('save_0', world(), publish)
    const root = decode(backend.data.get('save_0'))
    const key = root.parts[0][1]
    if (damage === 'missing') backend.data.delete(key)
    if (damage === 'corrupt') backend.data.set(key, 'bad')
    if (damage === 'foreign') {
      const part = decode(backend.data.get(key))
      part.owner = 'save_1'
      backend.data.set(key, LZString.compressToBase64(JSON.stringify(part)))
    }
    if (damage === 'duplicate') root.parts.push(root.parts[0])
    if (damage === 'path') root.collections[0].path = ['__proto__', 'injected']
    backend.data.set('save_0', LZString.compressToBase64(JSON.stringify(root)))
    assert.throws(() => new ZonedSaveStore(backend).load('save_0'), /SAVE_CORRUPT/)
    assert.equal({}.injected, undefined)
  }
})

test('reordering entities changes only ordering pages, without rewriting entity zones', () => {
  const backend = memory()
  const store = new ZonedSaveStore(backend)
  const input = world()
  store.save('save_0', input, publish)
  const old = decode(backend.data.get('save_0'))
  input.resources.reverse()
  const stats = store.save('save_0', input, publish)
  assert.equal(stats.changedZones, 0)
  assert.equal(stats.writtenParts, 1)
  const current = new Map(decode(backend.data.get('save_0')).parts)
  for (const [zone, key] of old.parts) if (JSON.parse(zone)[0] !== 'order') assert.equal(current.get(zone), key)
  assert.deepEqual(store.load('save_0'), input)
})
