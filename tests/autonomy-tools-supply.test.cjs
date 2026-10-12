const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule: load } = require('./helpers/loadTsModule.cjs')
const { planCollectiveTasks } = load('app/lib/economy/collectiveTasks.ts')
const { constructionCargoReserve, readyConstructionSite } = load('app/lib/economy/collectiveConstruction.ts')
const { supplyTownWeapons } = load('app/lib/units/supplies/townToolSupply.ts')
function fixture(tool = 'axe_ceramic') {
  const center = {
    type: 'TownCenter',
    label: 'town',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { wheat: 100, wood: 0, stone: 0, bronzeIngot: 20, leather: 20 } },
  }
  const forge = { type: 'Forge', label: 'forge', i: 11, j: 10, isBuilt: true }
  const site = {
    type: 'House',
    i: 12,
    j: 12,
    label: 'site',
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 100,
    constructionMaterials: { cost: { wood: 20, stone: 10 }, delivered: {}, consumed: {} },
  }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 12,
    j: 10,
    inactif: true,
    inventory: { toolsInitialized: true, activeWeapons: { tool }, resources: { wheat: 12 }, equipment: [] },
  }
  const owner = {
    label: 'player',
    type: 'Human',
    population: 1,
    populationMax: 1,
    units: [unit],
    buildings: [center, forge, site],
  }
  return { unit, owner, center, forge, site }
}
test('an incomplete tool set defers construction work to tool preparation', () => {
  for (const [tool, job] of [
    ['axe_ceramic', 'wood'],
    ['pickaxe_ceramic', 'stone'],
  ]) {
    const f = fixture(tool)
    const { canAutonomouslyWork } = load('app/lib/equipment/workTools.ts')
    assert.equal(canAutonomouslyWork(f.unit, job), true)
    assert.equal(
      planCollectiveTasks(f.owner, [f.unit], [f.unit], (unit, task) => canAutonomouslyWork(unit, task)).size,
      0
    )
    const { constructionToolPreparation } = load('app/lib/units/supplies/toolPreparation.ts')
    assert.ok(constructionToolPreparation(f.unit, f.owner).needed.includes('hammer'))
  }
})
test('no tool, broken tool or stowed tool cannot claim construction or depot work', () => {
  for (const tool of [undefined, 'axe_ceramic~condition:0', 'hammer_iron~condition:0']) {
    const f = fixture(tool)
    f.unit.inventory.activeWeapons.tool = tool
    assert.equal(planCollectiveTasks(f.owner, [f.unit]).size, 0)
    assert.equal(readyConstructionSite(f.owner, f.unit), undefined)
  }
  const f = fixture()
  f.unit.inventory.toolsStowed = true
  assert.equal(planCollectiveTasks(f.owner, [f.unit]).size, 0)
})
test('hammer workers fetch building materials; axe workers deliver cargo to depots instead of trying to build', () => {
  const f = fixture('hammer_ceramic')
  f.center.inventory.resources.wood = 20
  f.center.inventory.resources.stone = 10
  f.owner.buildings.push({
    type: 'StoragePit',
    label: 'depot',
    i: 11,
    j: 11,
    isBuilt: true,
    inventory: { resources: { wood: 20, stone: 10 } },
  })
  const task = planCollectiveTasks(f.owner, [f.unit]).get(f.unit)
  assert.equal(task.job, 'construction')
  assert.ok(task.pickup)
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic'
  f.unit.inventory.resources.wood = 10
  assert.equal(readyConstructionSite(f.owner, f.unit), undefined)
  assert.equal(constructionCargoReserve(f.owner, f.unit, 'wood'), 0)
})
test('a soldier replaces a broken weapon in town at recipe cost, once, without replacing missing weapons', () => {
  const f = fixture()
  f.unit.type = 'Fantassin'
  f.unit.inventory.equipment = ['mace_bronze~condition:0', 'axe_iron~condition:0']
  f.center.inventory.resources.wood = 10
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.deepEqual(f.unit.inventory.equipment, ['mace_bronze', 'axe_iron~condition:0'])
  assert.equal(f.center.inventory.resources.wood, 7)
  assert.equal(f.center.inventory.resources.bronzeIngot, 18)
  assert.equal(f.center.inventory.resources.leather, 19)
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  f.unit.inventory.equipment = []
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
})
test('a soldier waits until returning, outside combat, with resources or a spare weapon in the forge', () => {
  const f = fixture()
  f.unit.type = 'Fantassin'
  f.unit.inventory.equipment = ['mace_bronze~condition:0']
  f.unit.i = 1000
  f.forge.inventory = { equipment: ['mace_bronze~condition:60'] }
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  f.unit.i = 12
  f.unit.action = 'attack'
  assert.equal(supplyTownWeapons(f.unit, f.owner), false)
  f.unit.action = null
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.equipment[0], 'mace_bronze~condition:60')
  assert.deepEqual(f.forge.inventory.equipment, [])
  assert.equal(f.center.inventory.resources.bronzeIngot, 20)
})

test('archers also recraft their exhausted bow using the existing wood and sinew recipe', () => {
  const f = fixture()
  f.unit.type = 'Bowman'
  f.unit.inventory.equipment = ['bow~condition:0']
  f.center.inventory.resources.wood = 5
  f.center.inventory.resources.sinew = 2
  assert.equal(supplyTownWeapons(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.equipment[0], 'bow')
  assert.equal(f.center.inventory.resources.wood ?? 0, 0)
  assert.equal(f.center.inventory.resources.sinew ?? 0, 0)
})

test('a villager preparing a replacement does not start unrelated idle gathering', () => {
  let gathered = 0
  const { updateCollectiveVillage } = load('app/services/CollectiveVillageWork.ts', {
    mocks: {
      '../lib/units/autonomy/villagerGathering': {
        clearVillagerGathering() {},
        isVillagerGathering: () => false,
        gatherIdleVillager: () => gathered++,
      },
    },
  })
  const f = fixture('axe_ceramic~condition:0')
  f.unit.owner = f.owner
  f.unit.context = { dayNight: { state: { hour: 10, minute: 0 } } }
  f.unit.collectiveTask = 'wood'
  f.unit.autonomousJob = 'wood'
  f.unit.stop = () => {
    f.unit.action = null
    f.unit.dest = null
    f.unit.inactif = true
  }
  assert.equal(updateCollectiveVillage(f.owner), 0)
  assert.equal(gathered, 0)
  assert.equal(f.unit.collectiveTask, null)
  assert.equal(f.unit.autonomousJob, null)
})

test('tool changes and breakage invalidate planning, ordinary wear does not', () => {
  const { collectiveVillageEventSnapshot } = load('app/services/CollectiveVillageEvents.ts')
  const f = fixture()
  f.unit.owner = f.owner
  f.unit.context = { dayNight: { state: { hour: 10, minute: 0 } } }
  const before = collectiveVillageEventSnapshot(f.owner)
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic~uses:1'
  assert.equal(collectiveVillageEventSnapshot(f.owner), before)
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic~condition:0'
  assert.notEqual(collectiveVillageEventSnapshot(f.owner), before)
  f.unit.inventory.activeWeapons.tool = 'pickaxe_ceramic'
  assert.notEqual(collectiveVillageEventSnapshot(f.owner), before)
})
