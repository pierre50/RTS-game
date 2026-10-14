const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule: load } = require('./helpers/loadTsModule.cjs')
const { startingVillagerInventory } = load('app/lib/economy/startingProvisions.ts')
const { supplyTownWeapons } = load('app/lib/units/supplies/townToolSupply.ts')
const { returnOfflineWorkerForTool } = load('app/services/world/offline/OfflineToolReturn.ts')
const { travelMs } = load('app/services/world/work/OfflineWorkResources.ts')
function fixture(type = 'Bowman', equipment = []) {
  const town = {
    type: 'TownCenter',
    label: 'town',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { wood: 100, stone: 100, bronzeIngot: 100, ironIngot: 100, sinew: 100, leather: 100 } },
  }
  // Upgraded forge (FORGE_IRON_REQUIRED_LEVEL): iron weapons can be produced.
  const forge = { type: 'Forge', label: 'forge', i: 11, j: 10, isBuilt: true, buildingLevel: 1 }
  const owner = { type: 'Human', label: 'player', buildings: [town, forge] }
  const unit = { type, i: 12, j: 10, inventory: { equipment, toolsInitialized: true, activeWeapons: {} } }
  return { town, forge, owner, unit }
}
test('new residents balance local tool roles without changing existing inventories', () => {
  const residents = []
  for (let i = 0; i < 8; i++)
    residents.push({
      type: 'Villager',
      i: 10,
      j: 10,
      inventory: startingVillagerInventory(residents, { i: 10, j: 10 }),
    })
  assert.deepEqual(
    residents.map(u => u.inventory.activeWeapons.tool),
    [
      'axe_ceramic',
      'pickaxe_ceramic',
      'hammer_ceramic',
      'scythe_ceramic',
      'axe_ceramic',
      'pickaxe_ceramic',
      'hammer_ceramic',
      'scythe_ceramic',
    ]
  )
  for (const unit of residents)
    assert.equal(unit.inventory.equipment.filter(item => /^(axe|pickaxe|hammer|scythe)_/.test(item)).length, 3)
  const before = structuredClone(residents)
  assert.equal(startingVillagerInventory(residents, { i: 1000, j: 1000 }).activeWeapons.tool, 'axe_ceramic')
  assert.deepEqual(residents, before)
})
test('a usable spare prevents spending even with several broken weapons', () => {
  const f = fixture('Fantassin', ['sword_iron~condition:0', 'mace_bronze~condition:0', 'dagger_bronze'])
  const before = structuredClone(f)
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  assert.deepEqual(f, before)
})
test('only one primary weapon is renewed; subsequent ticks and reloads do not renew the spares', () => {
  const f = fixture('Fantassin', ['sword_iron~condition:0', 'mace_bronze~condition:0', 'dagger_bronze~condition:0'])
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.equipment.filter(s => s.endsWith('~condition:0')).length, 2)
  const saved = JSON.parse(JSON.stringify(f))
  assert.equal(supplyTownWeapons(saved.unit, saved.owner), false)
  assert.deepEqual(saved, f)
})
for (const type of ['Bowman', 'BanditArcher']) {
  test(`${type} independently maintains a bow and a dagger, ignoring unrelated swords`, () => {
    const f = fixture(type, ['bow~condition:0', 'dagger_bronze~condition:0', 'dagger_iron~condition:0', 'sword_bronze'])
    assert.equal(supplyTownWeapons(f.unit, f.owner), true)
    assert.ok(f.unit.inventory.equipment.includes('bow'))
    assert.ok(f.unit.inventory.equipment.includes('dagger_iron'))
    assert.ok(f.unit.inventory.equipment.includes('dagger_bronze~condition:0'))
    assert.equal(f.town.inventory.resources.sinew, 98)
    assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  })
}
test('a healthy bow does not mask the need for a broken dagger, and vice versa', () => {
  for (const items of [
    ['bow', 'dagger_bronze~condition:0'],
    ['bow~condition:0', 'dagger_bronze'],
  ]) {
    const f = fixture('Bowman', items)
    assert.equal(supplyTownWeapons(f.unit, f.owner), true)
    assert.deepEqual(f.unit.inventory.equipment, ['bow', 'dagger_bronze'])
  }
})
test('offline return consumes travel time across saves, then replaces the tool on arrival', () => {
  const f = fixture('Villager')
  f.unit.i = 40
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  const point = { i: 12, j: 10 }
  const config = { speed: 1 }
  const duration = travelMs(f.unit, point, config)
  const spatial = {
    reachable: () => true,
    findNear: () => point,
    move(unit, to) {
      Object.assign(unit, to)
    },
  }
  returnOfflineWorkerForTool(f.owner, f.unit, duration / 2, config, spatial)
  assert.equal(f.unit.i, 40)
  assert.equal(f.town.inventory.resources.wood, 100)
  const restored = JSON.parse(JSON.stringify(f))
  returnOfflineWorkerForTool(restored.owner, restored.unit, duration / 2 + 1, config, spatial)
  assert.equal(restored.unit.i, 12)
  assert.equal(restored.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(restored.owner.buildings[0].inventory.resources.wood, 96)
  assert.equal(restored.unit.offlineWork, undefined)
})
test('offline return cannot cross disconnected terrain or replace a manually removed tool', () => {
  const f = fixture('Villager')
  f.unit.i = 40
  const spatial = {
    reachable: () => false,
    findNear() {
      throw Error('unreachable')
    },
    move() {
      throw Error('unreachable')
    },
  }
  returnOfflineWorkerForTool(f.owner, f.unit, 100000, {}, spatial)
  assert.equal(f.unit.i, 40)
  spatial.reachable = () => true
  spatial.findNear = () => ({ i: 12, j: 10 })
  spatial.move = (unit, point) => Object.assign(unit, point)
  returnOfflineWorkerForTool(f.owner, f.unit, 100000, {}, spatial)
  assert.equal(f.unit.i, 40)
  assert.equal(f.unit.inventory.activeWeapons.tool, undefined)
  assert.equal(f.town.inventory.resources.wood, 100)
})

test('the real offline simulation returns an exhausted remote worker before buying its replacement', () => {
  const { simulateOfflineWorld } = load('app/services/world/offline/OfflineWorldSimulation.ts')
  const f = fixture('Villager')
  f.unit.i = 100
  f.unit.label = 'remote-worker'
  f.unit.hitPoints = 20
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  f.unit.collectiveTask = 'wood'
  f.unit.autonomousJob = 'wood'
  f.unit.collectiveHome = { i: 10, j: 10 }
  f.owner.units = [f.unit]
  const state = { players: [f.owner], resources: [], animals: [] }
  const config = { speed: 1, totalHitPoints: 20 }
  const options = {
    terrain: Array.from({ length: 121 }, () => Array.from({ length: 121 }, () => ({ category: 'Grass' }))),
    unitConfig: () => config,
    buildingConfig: () => ({}),
    buildingCapacity: () => 1000,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    runtimeOwnsMeals: true,
    runtimeOwnsDailyEvents: true,
    runtimeOwnsTraining: true,
  }
  simulateOfflineWorld(state, { ...options, fromElapsedMs: 0, toElapsedMs: 1 })
  assert.equal(f.unit.i, 100)
  assert.equal(f.town.inventory.resources.wood, 100)
  simulateOfflineWorld(state, { ...options, fromElapsedMs: 1, toElapsedMs: 120000 })
  assert.ok(Math.hypot(f.unit.i - 10, f.unit.j - 10) <= 6)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(f.town.inventory.resources.wood, 96)
})
