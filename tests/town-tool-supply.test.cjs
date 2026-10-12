const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { supplyTownTool } = loadTsModule('app/lib/units/supplies/townToolSupply.ts')
function fixture(item = 'axe_ceramic') {
  const center = {
    type: 'TownCenter',
    label: 'town',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { wood: 50, stone: 50, bronzeIngot: 10, ironIngot: 10 } },
  }
  const forge = { type: 'Forge', buildingLevel: 1, label: 'forge', i: 11, j: 10, isBuilt: true }
  const owner = { label: 'player', type: 'Human', isPlayed: true, buildings: [center, forge] }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 12,
    j: 10,
    inventory: { toolsInitialized: true, activeWeapons: { tool: `${item}~condition:0` }, equipment: [] },
  }
  owner.units = [unit]
  return { unit, owner, center, forge }
}
for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
  for (const material of ['ceramic', 'bronze', 'iron']) {
    test(`${family} ${material} replacement preserves the selected tool and charges the recipe materials`, () => {
      const item = `${family}_${material}`
      const f = fixture(item)
      const before = structuredClone(f.center.inventory.resources)
      assert.equal(supplyTownTool(f.unit, f.owner), true)
      assert.equal(f.owner.forgeUpgrades, undefined)
      assert.equal(f.unit.inventory.activeWeapons.tool, item)
      assert.deepEqual(f.unit.inventory.equipment, [])
      before.wood -= 4
      if (material === 'ceramic') before.stone -= 5
      else before[`${material}Ingot`] -= 2
      assert.deepEqual(f.center.inventory.resources, before)
      assert.equal(supplyTownTool(f.unit, f.owner), false)
      const restored = JSON.parse(JSON.stringify(f))
      assert.equal(supplyTownTool(restored.unit, restored.owner), false)
      assert.deepEqual(restored.center.inventory.resources, before)
    })
  }
}
test('forge stock is consumed first, preserving its wear and paying nothing twice', () => {
  const f = fixture('hammer_iron')
  f.forge.inventory = { equipment: ['hammer_iron~condition:0', 'hammer_iron~condition:62', 'axe_iron'] }
  const before = structuredClone(f.center.inventory.resources)
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'hammer_iron~condition:62')
  assert.deepEqual(f.forge.inventory.equipment, ['hammer_iron~condition:0', 'axe_iron'])
  assert.deepEqual(f.center.inventory.resources, before)
})
test('insufficient materials spend nothing and retry successfully when local supplies arrive', () => {
  const f = fixture('pickaxe_bronze')
  f.center.inventory.resources = { wood: 4, bronzeIngot: 1 }
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  assert.deepEqual(f.center.inventory.resources, { wood: 4, bronzeIngot: 1 })
  assert.equal(f.unit.inventory.activeWeapons.tool, 'pickaxe_bronze~condition:0')
  f.center.inventory.resources.bronzeIngot++
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.center.inventory.resources.wood ?? 0, 0)
  assert.equal(f.center.inventory.resources.bronzeIngot ?? 0, 0)
})
test('two residents cannot spend the same materials twice; AI pays the same cost', () => {
  const f = fixture('axe_bronze')
  f.unit.type = 'Swordman'
  f.owner.type = 'AI'
  f.owner.isPlayed = false
  f.center.inventory.resources = { wood: 4, bronzeIngot: 2 }
  const second = structuredClone(f.unit)
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(supplyTownTool(second, f.owner), false)
})
test('no replacement for a working, missing or stowed tool, hero, combat, dead unit, or inaccessible forge', () => {
  for (const change of [
    f => {
      f.unit.inventory.activeWeapons.tool = 'axe_ceramic~uses:1'
    },
    f => {
      delete f.unit.inventory.activeWeapons.tool
    },
    f => {
      f.unit.inventory.toolsStowed = true
    },
    f => {
      f.unit.type = 'Hero'
    },
    f => {
      f.unit.controlMode = 'hero'
    },
    f => {
      f.unit.action = 'attack'
    },
    f => {
      f.unit.action = 'hunt'
    },
    f => {
      f.unit.isFleeing = true
    },
    f => {
      f.unit.combatMode = 'recover'
      f.unit.waitingForEnergyAction = 'attack'
    },
    f => {
      f.unit.isDead = true
    },
    f => {
      f.unit.isDestroyed = true
    },
    f => {
      f.unit.i = 1000
    },
  ]) {
    const f = fixture()
    change(f)
    const before = structuredClone(f)
    assert.equal(supplyTownTool(f.unit, f.owner), false)
    assert.deepEqual(f, before)
  }
})
test('replacement never draws resources from a remote town', () => {
  const f = fixture('axe_bronze')
  f.unit.type = 'Swordman'
  f.center.inventory.resources = {}
  f.owner.buildings.push({
    type: 'TownCenter',
    i: 100,
    j: 100,
    label: 'remote',
    isBuilt: true,
    inventory: { resources: { wood: 100, stone: 100 } },
  })
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  assert.deepEqual(f.owner.buildings[2].inventory.resources, { wood: 100, stone: 100 })
})
test('the live supply tick replaces the tool after combat and refreshes its appearance', () => {
  let refreshed = 0
  const { NpcArrowSupplySystem } = loadTsModule('app/services/world/NpcArrowSupplySystem.ts', {
    mocks: { '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats: () => refreshed++ } },
  })
  const f = fixture()
  let tick
  let appearance = 0
  f.unit.syncAppearanceLayers = () => appearance++
  const system = new NpcArrowSupplySystem({
    players: [f.owner],
    scheduler: {
      add: callback => {
        tick = callback
        return 1
      },
      remove() {},
    },
  })
  f.unit.action = 'attack'
  tick()
  assert.equal(refreshed, 0)
  f.unit.action = null
  tick()
  tick()
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(f.center.inventory.resources.wood, 46)
  assert.equal(refreshed, 1)
  assert.equal(appearance, 1)
  system.destroy()
})
test('offline simulation uses the same paid stone replacement', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const f = fixture()
  f.unit.hitPoints = 20
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
  assert.equal(state.players[0].units[0].inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(state.players[0].buildings[0].inventory.resources.wood, 46)
  assert.equal(state.players[0].buildings[0].inventory.resources.stone, 45)
})

test('manual replacement needs no forge; metal falls back to stone and returns to its requested quality', () => {
  const f = fixture('axe_bronze')
  f.forge.isDestroyed = true
  const broken = f.unit.inventory.activeWeapons.tool
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(f.unit.inventory.toolSupplyTarget, 'axe_bronze')
  assert.deepEqual(f.center.inventory.equipment, [broken])
  const saved = JSON.parse(JSON.stringify(f))
  assert.equal(supplyTownTool(saved.unit, saved.owner), false)
  saved.owner.buildings[1].isDestroyed = false
  assert.equal(supplyTownTool(saved.unit, saved.owner), false)
  saved.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  assert.equal(supplyTownTool(saved.unit, saved.owner), true)
  assert.equal(saved.unit.inventory.activeWeapons.tool, 'axe_bronze')
  assert.equal(saved.unit.inventory.toolSupplyTarget, undefined)
  assert.deepEqual(saved.owner.buildings[0].inventory.equipment, [broken])
})

test('metal stock in a local depot works without a forge and cannot come from another village', () => {
  const f = fixture('hammer_iron')
  f.owner.buildings.pop()
  f.center.inventory.resources = {}
  f.center.inventory.equipment = ['hammer_iron~condition:60']
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'hammer_iron~condition:60')
  assert.deepEqual(f.center.inventory.equipment, ['hammer_iron~condition:0'])
})

test('bows can be replaced by hand but metal weapons require a forge or existing stock', () => {
  const { supplyTownWeapons } = loadTsModule('app/lib/units/supplies/townToolSupply.ts')
  const f = fixture()
  f.owner.buildings.pop()
  f.unit.type = 'Bowman'
  f.unit.inventory.equipment = ['bow~condition:0', 'dagger_bronze~condition:0']
  f.center.inventory.resources.sinew = 2
  f.center.inventory.resources.leather = 2
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.deepEqual(f.unit.inventory.equipment, ['bow', 'dagger_bronze~condition:0'])
  assert.deepEqual(f.center.inventory.equipment, ['bow~condition:0'])
  f.center.inventory.equipment.push('dagger_bronze')
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.deepEqual(f.unit.inventory.equipment, ['bow', 'dagger_bronze'])
})

test('hunters replace an exhausted carried bow by hand without recreating removed weapons', () => {
  const { supplyTownWeapons } = loadTsModule('app/lib/units/supplies/townToolSupply.ts')
  const f = fixture()
  f.owner.buildings.pop()
  f.unit.inventory.equipment = ['bow~condition:0']
  f.center.inventory.resources = { wood: 5, sinew: 2 }
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.deepEqual(f.unit.inventory.equipment, ['bow'])
  f.unit.inventory.equipment = []
  f.center.inventory.resources = { wood: 5, sinew: 2 }
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  assert.deepEqual(f.center.inventory.resources, { wood: 5, sinew: 2 })
})

test('villagers require real materials for every stone replacement without accumulating broken stock', () => {
  for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
    const f = fixture(`${family}_ceramic`)
    f.owner.buildings.pop()
    f.center.inventory.resources = {}
    for (let cycle = 0; cycle < 3; cycle++) {
      f.unit.inventory.activeWeapons.tool = `${family}_ceramic~condition:0`
      assert.equal(supplyTownTool(f.unit, f.owner), false)
      f.unit.inventory.resources = { wood: 4, stone: 5 }
      assert.equal(supplyTownTool(f.unit, f.owner), true)
      assert.equal(f.unit.inventory.activeWeapons.tool, `${family}_ceramic`)
      assert.deepEqual(f.unit.inventory.resources, { wood: 0, stone: 0 })
      assert.deepEqual(f.center.inventory.resources, {})
      assert.deepEqual(f.center.inventory.equipment ?? [], [])
    }
    f.unit.type = 'Swordman'
    f.unit.inventory.activeWeapons.tool = `${family}_ceramic~condition:0`
    assert.equal(supplyTownTool(f.unit, f.owner), false)
  }
})

test('paid stone fallback preserves the metal target until the next break', () => {
  const f = fixture('pickaxe_iron')
  f.owner.buildings.pop()
  f.center.inventory.resources = {}
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  f.unit.inventory.resources = { wood: 4, stone: 5 }
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'pickaxe_ceramic')
  assert.equal(f.unit.inventory.toolSupplyTarget, 'pickaxe_iron')
  for (let cycle = 0; cycle < 3; cycle++) {
    f.unit.inventory.activeWeapons.tool = 'pickaxe_ceramic~condition:0'
    assert.equal(supplyTownTool(f.unit, f.owner), false)
    f.unit.inventory.resources = { wood: 4, stone: 5 }
    assert.equal(supplyTownTool(f.unit, f.owner), true)
    assert.equal(f.unit.inventory.toolSupplyTarget, 'pickaxe_iron')
  }
  assert.deepEqual(f.center.inventory.equipment, ['pickaxe_iron~condition:0'])
  f.center.inventory.equipment.push('pickaxe_iron')
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  f.unit.inventory.activeWeapons.tool = 'pickaxe_ceramic~condition:0'
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'pickaxe_iron')
  assert.equal(f.unit.inventory.toolSupplyTarget, undefined)
})

test('resident without any tools crafts a first stone tool from carried materials', () => {
  const f = fixture()
  delete f.unit.inventory.activeWeapons.tool
  f.unit.villageHome = { i: 12, j: 10 }
  f.owner.buildings = []
  f.unit.inventory.resources = { wood: 4, stone: 4 }
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  assert.deepEqual(f.unit.inventory.resources, { wood: 4, stone: 4 })
  f.unit.inventory.resources.stone++
  f.unit.followingHero = true
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  f.unit.followingHero = false
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.deepEqual(f.unit.inventory.resources, { wood: 0, stone: 0 })
  assert.equal(supplyTownTool(f.unit, f.owner), false)
})

test('resident with a manually unequipped tool does not craft a duplicate', () => {
  const f = fixture()
  delete f.unit.inventory.activeWeapons.tool
  f.unit.villageHome = { i: 12, j: 10 }
  f.unit.inventory.equipment = ['axe_ceramic']
  assert.equal(supplyTownTool(f.unit, f.owner), false)
})
