const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { supplyTownArrows } = loadTsModule('app/lib/units/supplies/townArrowSupply.ts')
const count = unit => unit.inventory?.equipment?.filter(item => item.startsWith('arrow_')).length ?? 0
function fixture(type = 'Bowman') {
  const center = {
    type: 'TownCenter',
    label: 'town',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { wood: 50, stone: 20, feather: 7 } },
  }
  const forge = { type: 'Forge', label: 'forge', i: 11, j: 10, isBuilt: true }
  const owner = { label: 'player', type: 'Human', isPlayed: true, buildings: [center, forge] }
  const unit = {
    type,
    i: 12,
    j: 10,
    inventory: { equipment: type === 'Villager' ? ['bow'] : [], npcArrows: { initialized: true } },
    owner,
  }
  return { unit, owner, center, forge }
}
test('town supplies pay the shared batch cost, stop at twenty and leave feathers alone', () => {
  const { unit, owner, center } = fixture()
  assert.equal(supplyTownArrows(unit, owner), 20)
  assert.equal(count(unit), 20)
  assert.deepEqual(center.inventory.resources, { wood: 40, stone: 16, feather: 7 })
  assert.equal(supplyTownArrows(unit, owner), 0)
  unit.inventory.equipment.pop()
  assert.equal(supplyTownArrows(unit, owner), 1)
  assert.equal(center.inventory.resources.wood, 35)
})
test('partial batches stay in the local depot, survive saves and are shared without paying twice', () => {
  const f = fixture()
  f.unit.inventory.equipment = Array(19).fill('arrow_iron')
  assert.equal(supplyTownArrows(f.unit, f.owner), 1)
  assert.equal(count(f.center), 9)
  const restored = JSON.parse(JSON.stringify({ owner: f.owner, forge: f.forge }))
  const next = { type: 'Villager', i: 12, j: 10, inventory: { equipment: ['bow'] } }
  assert.equal(supplyTownArrows(next, restored.owner, { hunting: true }), 10)
  assert.equal(restored.owner.buildings[0].inventory.resources.wood, 40)
  assert.equal(count(restored.owner.buildings[0]), 9)
})
test('villagers request supplies for hunting; preview never spends or creates arrows', () => {
  const f = fixture('Villager')
  assert.equal(supplyTownArrows(f.unit, f.owner), 0)
  assert.equal(supplyTownArrows(f.unit, f.owner, { hunting: true, preview: true }), 10)
  assert.equal(count(f.unit), 0)
  assert.equal(f.center.inventory.resources.wood, 50)
  assert.equal(supplyTownArrows(f.unit, f.owner, { hunting: true }), 10)
})
test('dead center, outside town, combat and hero cannot use paid supply', () => {
  for (const change of [
    f => (f.center.isDead = true),
    f => (f.unit.i = 1000),
    f => (f.unit.action = 'attack'),
    f => (f.unit.action = 'hunt'),
    f => {
      f.unit.combatMode = 'recover'
      f.unit.waitingForEnergyAction = 'attack'
      f.unit.dest = {}
    },
    f => (f.unit.type = 'Hero'),
  ]) {
    const f = fixture()
    change(f)
    assert.equal(supplyTownArrows(f.unit, f.owner), 0)
    assert.equal(f.center.inventory.resources.wood, 50)
  }
})
test('visiting archers use only their current town, never their home or hero inventory', () => {
  const f = fixture()
  f.unit.villageHome = { id: 'player:elsewhere', i: 100, j: 100 }
  const remote = {
    type: 'TownCenter',
    label: 'elsewhere',
    i: 100,
    j: 100,
    isBuilt: true,
    inventory: { resources: { wood: 100, stone: 100 } },
  }
  f.owner.buildings.push(remote)
  f.center.inventory.resources = { wood: 5 }
  assert.equal(supplyTownArrows(f.unit, f.owner), 0)
  assert.deepEqual(remote.inventory.resources, { wood: 100, stone: 100 })
  f.center.inventory.resources.stone = 2
  assert.equal(supplyTownArrows(f.unit, f.owner), 10)
  assert.deepEqual(remote.inventory.resources, { wood: 100, stone: 100 })
})
test('supply respects shared bag space and never spends with a full bag', () => {
  const f = fixture()
  f.unit.inventory.resources = { wheat: 27 }
  assert.equal(supplyTownArrows(f.unit, f.owner), 3)
  assert.equal(count(f.center), 7)
  assert.equal(supplyTownArrows(f.unit, f.owner), 0)
  assert.equal(f.center.inventory.resources.wood, 45)
})
test('paid archer training includes twenty arrows once and preserves the rest of the inventory', () => {
  const { trainedInventory } = loadTsModule('app/lib/training/trainedInventory.ts')
  const inventory = { equipment: ['hammer', 'arrow_iron'], resources: { meat: 2 }, npcArrows: { initialized: true } }
  const trained = trainedInventory('Villager', 'Bowman', inventory)
  assert.equal(count({ inventory: trained }), 20)
  assert.equal(trained.equipment[0], 'hammer')
  assert.deepEqual(trained.resources, { meat: 2 })
  assert.equal(inventory.equipment.length, 2)
  trained.equipment = []
  assert.equal(count({ inventory: trainedInventory('Bowman', 'Bowman', trained) }), 0)
})

test('the live supply tick replenishes archers after combat, without moving them or refilling the hero', () => {
  const { NpcArrowSupplySystem } = loadTsModule('app/services/world/NpcArrowSupplySystem.ts')
  const f = fixture()
  let tick
  let removed
  f.owner.units = [f.unit]
  const system = new NpcArrowSupplySystem({
    players: [f.owner],
    scheduler: {
      add: callback => {
        tick = callback
        return 42
      },
      remove: id => {
        removed = id
      },
    },
  })
  f.unit.action = 'attack'
  tick()
  assert.equal(count(f.unit), 0)
  f.unit.action = 'follow'
  f.unit.combatMode = 'attack' // The last combat mode can outlive the actual attack.
  f.unit.dest = { type: 'Hero' }
  tick()
  assert.equal(count(f.unit), 20)
  assert.deepEqual([f.unit.i, f.unit.j], [12, 10])
  tick()
  assert.equal(f.center.inventory.resources.wood, 40)
  system.destroy()
  assert.equal(removed, 42)
})

test('detached simulation uses the same town payment and stock as the live tick', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const f = fixture()
  f.owner.units = [{ ...f.unit, owner: undefined, label: 'archer', hitPoints: 20, totalHitPoints: 20 }]
  const state = JSON.parse(JSON.stringify({ players: [f.owner], resources: [], animals: [] }))
  simulateOfflineWorld(state, {
    fromElapsedMs: 0,
    toElapsedMs: 1000,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({}),
    buildingConfig: () => ({}),
    buildingCapacity: () => 300,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    runtimeOwnsMeals: true,
    runtimeOwnsDailyEvents: true,
    runtimeOwnsTraining: true,
  })
  assert.equal(count(state.players[0].units[0]), 20)
  assert.deepEqual(state.players[0].buildings[0].inventory.resources, { wood: 40, stone: 16, feather: 7 })
})

test('empty hunters can select prey when a forge can supply them, without spending during selection', () => {
  const { canVillagerAutonomouslyHunt } = loadTsModule('app/lib/units/autonomy/villagerHunting.ts')
  const { getResourceActionConditions } = loadTsModule('app/lib/combat/resourceActionConditions.ts')
  const f = fixture('Villager')
  const prey = { family: 'animal', type: 'Deer', hitPoints: 10, quantity: 20 }
  assert.equal(canVillagerAutonomouslyHunt(f.unit, prey), true)
  assert.equal(getResourceActionConditions(f.unit, prey).hunt(), true)
  assert.equal(count(f.unit), 0)
  assert.equal(f.center.inventory.resources.wood, 50)
  f.center.inventory.resources = {}
  assert.equal(canVillagerAutonomouslyHunt(f.unit, prey), false)
  assert.equal(getResourceActionConditions(f.unit, prey).hunt(), false)
})

test('a hunt movement order obtains its arrows before leaving the town', () => {
  const f = fixture('Villager')
  let routedWith
  const { UnitMovementRouting } = loadTsModule('app/classes/unit/movement/UnitMovementRoutingRuntime.ts', {
    mocks: {
      [require.resolve('../app/lib/index.ts')]: { getMiningActions: () => [] },
      './UnitMoveOrderAdmission': { admitMoveOrder: () => true, resolveAttackOrder: () => null },
      '../../../lib/mapSpaces': { getEntitySpaceMapLike: () => ({}) },
      '../../../lib/units/combat/targetPursuit': {
        routeToRememberedTarget: unit => {
          routedWith = count(unit)
          return true
        },
      },
    },
  })
  f.unit.getActionCondition = () => true
  new UnitMovementRouting(f.unit).sendToEvt({ type: 'Deer', family: 'animal', i: 20, j: 10 }, 'hunt')
  assert.equal(routedWith, 10)
  assert.equal(f.center.inventory.resources.wood, 45)
})

test('manual arrows supply player and AI villages without a forge at the same cost', () => {
  for (const type of ['Human', 'AI']) {
    const f = fixture()
    f.owner.type = type
    f.owner.isPlayed = type === 'Human'
    f.owner.buildings.pop()
    assert.equal(supplyTownArrows(f.unit, f.owner), 20)
    assert.equal(f.center.inventory.resources.wood, 40)
    assert.equal(f.center.inventory.resources.stone, 16)
  }
})

test('soldiers use their equipment tier while hunters keep stone, and metal stock needs no forge', () => {
  const f = fixture()
  f.unit.inventory.equipment = ['dagger_bronze']
  f.center.inventory.resources.bronzeIngot = 2
  assert.equal(supplyTownArrows(f.unit, f.owner), 20)
  assert.equal(f.unit.inventory.equipment.filter(item => item === 'arrow_bronze').length, 20)
  assert.equal(f.center.inventory.resources.bronzeIngot ?? 0, 0)
  assert.equal(f.center.inventory.resources.stone, 20)
  f.owner.buildings.pop()
  f.unit.inventory.equipment = ['dagger_bronze']
  f.center.inventory.resources = {}
  f.center.inventory.equipment = ['arrow_bronze', 'arrow_bronze']
  assert.equal(supplyTownArrows(f.unit, f.owner, { preview: true }), 2)
  assert.equal(count(f.unit), 0)
  assert.equal(supplyTownArrows(f.unit, f.owner), 2)
  f.unit.type = 'Villager'
  f.unit.inventory.equipment = ['axe_iron', 'bow']
  f.center.inventory.resources = { wood: 5, stone: 2, ironIngot: 5 }
  assert.equal(supplyTownArrows(f.unit, f.owner, { hunting: true }), 10)
  assert.equal(f.unit.inventory.equipment.filter(item => item === 'arrow_ceramic').length, 10)
  assert.equal(f.center.inventory.resources.ironIngot, 5)
})

test('town factions cannot bypass local production with the daily free allowance', () => {
  const { replenishNpcArrows } = loadTsModule('app/lib/units/combat/unitArrows.ts')
  const f = fixture()
  f.owner.type = 'AI'
  f.owner.isPlayed = false
  replenishNpcArrows(f.unit, 5, f.owner)
  assert.equal(count(f.unit), 0)
})

test('idle residents return home for supplies without interrupting orders or retrying every tick', () => {
  const { NpcArrowSupplySystem } = loadTsModule('app/services/world/NpcArrowSupplySystem.ts')
  const f = fixture()
  f.owner.buildings.pop()
  f.unit.i = 100
  f.unit.j = 100
  f.unit.inactif = true
  f.unit.villageHome = { i: 10, j: 10 }
  let tick
  let requests = 0
  f.unit.sendToEvt = target => {
    assert.equal(target, f.center)
    requests++
  }
  f.owner.units = [f.unit]
  const scheduler = {
    elapsedMs: 0,
    add: callback => {
      tick = callback
      return 1
    },
    remove() {},
  }
  const system = new NpcArrowSupplySystem({ players: [f.owner], scheduler })
  f.unit.action = 'follow'
  tick()
  assert.equal(requests, 0)
  f.unit.action = null
  tick()
  tick()
  assert.equal(requests, 1)
  assert.equal(count(f.unit), 0)
  f.unit.i = 12
  f.unit.j = 10
  tick()
  assert.equal(count(f.unit), 20)
  assert.equal(requests, 1)
  system.destroy()
})

test('offline return spends travel time before collecting local supplies without a forge', () => {
  const { returnOfflineWorkerForTool } = loadTsModule('app/services/world/offline/OfflineToolReturn.ts')
  const f = fixture()
  f.owner.buildings.pop()
  f.unit.i = 100
  f.unit.j = 100
  f.unit.villageHome = { i: 10, j: 10 }
  const spatial = {
    reachable: () => true,
    findNear: () => ({ i: 12, j: 10 }),
    move: (unit, point) => Object.assign(unit, point),
  }
  returnOfflineWorkerForTool(f.owner, f.unit, 1, { speed: 1.5 }, spatial)
  assert.equal(count(f.unit), 0)
  assert.equal(f.unit.i, 100)
  assert.equal(f.unit.offlineWork.milliseconds, 1)
  returnOfflineWorkerForTool(f.owner, f.unit, 1000000, { speed: 1.5 }, spatial)
  assert.equal(f.unit.i, 12)
  assert.equal(count(f.unit), 20)
  assert.equal(f.center.inventory.resources.wood, 40)
})

test('bowless and broken-bow villagers cannot request or preview paid arrows', () => {
  for (const equipment of [[], ['bow~condition:0'], ['slingshot']]) {
    const f = fixture('Villager')
    f.unit.inventory.equipment = equipment
    const stock = structuredClone(f.center.inventory)
    assert.equal(supplyTownArrows(f.unit, f.owner, { hunting: true, preview: true }), 0)
    assert.equal(supplyTownArrows(f.unit, f.owner, { hunting: true }), 0)
    assert.equal(count(f.unit), 0)
    assert.deepEqual(f.center.inventory, stock)
  }
})

test('iron arrow production requires the local forge upgrade in previews and saved simulation', () => {
  const f = fixture()
  f.unit.inventory.equipment = ['sword_iron']
  f.center.inventory.resources = { wood: 50, ironIngot: 5 }
  assert.equal(supplyTownArrows(f.unit, f.owner, { preview: true }), 0)
  assert.equal(supplyTownArrows(f.unit, f.owner), 0)
  assert.deepEqual(f.center.inventory.resources, { wood: 50, ironIngot: 5 })
  f.forge.buildingLevel = 1
  const saved = JSON.parse(JSON.stringify({ unit: f.unit, owner: f.owner }))
  assert.equal(supplyTownArrows(saved.unit, saved.owner), 20)
  assert.equal(saved.unit.inventory.equipment.filter(item => item === 'arrow_iron').length, 20)
  assert.equal(saved.owner.buildings[0].inventory.resources.ironIngot, 3)
})
