const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const load = path => loadTsModule(path, { moduleCache: cache })
const { getPlayerResourceTotals, withdrawChestResources, depositChestResources } = load(
  'app/lib/resources/playerResourceTotals.ts'
)
const { reconcileSettlementResidents } = load('app/lib/territory/settlementResidents.ts')
const { getBaseTerritory } = load('app/lib/territory/baseTerritory.ts')
const { planCollectiveTasks } = load('app/lib/economy/collectiveTasks.ts')
const { collectiveAnchor, belongsToSettlement } = load('app/lib/economy/collectiveConstruction.ts')
const { craftHeroRecipe, getMissingCraftResources } = load('app/lib/hero/heroCrafting.ts')
const { serializeTrainingQueue } = load('app/serialization/TrainingSave.ts')

function fixture(distance = 100) {
  const owner = { label: 'p', isPlayed: true, type: 'Human', units: [], buildings: [] }
  const building = (type, label, i, resources = {}) => {
    const b = { type, label, i, j: 10, spaceId: 'outside', isBuilt: true, owner, inventory: { resources } }
    owner.buildings.push(b)
    return b
  }
  const a = building('TownCenter', 'a', 10)
  const b = building('TownCenter', 'b', 10 + distance)
  const sa = building('StoragePit', 'sa', 11, { wood: 0 })
  const sb = building('StoragePit', 'sb', 11 + distance, { wood: 100 })
  const forge = building('Forge', 'forge', 12)
  const unit = { type: 'Villager', label: 'worker', i: 11, j: 10, inventory: { resources: { wheat: 12 } } }
  owner.units.push(unit)
  reconcileSettlementResidents(owner)
  return { owner, a, b, sa, sb, forge, unit, building }
}

test('a local payment cannot borrow from another town; reports can still aggregate explicitly', () => {
  const { owner, a, b, sa, sb } = fixture()
  assert.equal(getPlayerResourceTotals(owner, { includeHero: false }).wood, 100)
  assert.equal(getPlayerResourceTotals(owner, { includeHero: false, settlement: a }).wood, 0)
  assert.equal(withdrawChestResources(owner, { wood: 1 }, { includeHero: false, settlement: a }), false)
  assert.equal(
    withdrawChestResources(owner, { wood: 1 }, { includeHero: false }),
    false,
    'ambiguous payments fail closed'
  )
  assert.equal(sb.inventory.resources.wood, 100)
  assert.equal(depositChestResources(owner, { wood: 7 }, { settlement: a }), true)
  assert.equal(sa.inventory.resources.wood, 7)
  assert.equal(withdrawChestResources(owner, { wood: 3 }, { includeHero: false, settlement: a }), true)
  assert.equal(sa.inventory.resources.wood, 4)
  assert.equal(getPlayerResourceTotals(owner, { includeHero: false, settlement: b }).wood, 100)
})

test('forge crafting uses the station town and an isolated station only the hero bag', () => {
  const { owner, a, b, sa, sb, forge } = fixture()
  const hero = { type: 'Hero', isChief: true, i: b.i, j: b.j, owner, inventory: { resources: { wood: 2 } } }
  owner.units.push(hero)
  owner.context = { players: [owner], controls: { heroUnit: hero } }
  const recipe = {
    id: 'test-ingot',
    station: 'forge',
    category: 'ingots',
    cost: { wood: 3 },
    // Bronze: iron production is separately gated on the forge level (FORGE_IRON_REQUIRED_LEVEL).
    outputResource: 'bronzeIngot',
    outputEquipment: '',
    outputCount: 1,
  }
  assert.deepEqual(getMissingCraftResources(owner, recipe.cost, hero, forge), { wood: 1 })
  assert.equal(craftHeroRecipe(owner, hero, recipe, 1, forge), false)
  sa.inventory.resources.wood = 3
  assert.equal(craftHeroRecipe(owner, hero, recipe, 1, forge), true)
  assert.equal(sb.inventory.resources.wood, 100)
  assert.equal(hero.inventory.resources.wood, 2)
  const isolated = { i: 400, j: 400 }
  assert.equal(craftHeroRecipe(owner, hero, recipe, 1, isolated), false)
  hero.inventory.resources.wood = 3
  assert.equal(craftHeroRecipe(owner, hero, recipe, 1, isolated), true)
  assert.equal(sb.inventory.resources.wood, 100)
  assert.equal(getPlayerResourceTotals(owner, { includeHero: false, settlement: a }).wood, 0)
})

test('residents keep their town after moving, JSON reload and collective replanning', () => {
  const { owner, a, b, unit } = fixture()
  unit.i = b.i
  reconcileSettlementResidents(owner)
  assert.equal(unit.villageHome.id, 'p:a')
  assert.equal(collectiveAnchor(owner, unit), a)
  const saved = JSON.parse(
    JSON.stringify({ label: owner.label, units: owner.units, buildings: owner.buildings.map(({ owner, ...b }) => b) })
  )
  reconcileSettlementResidents(saved)
  planCollectiveTasks(saved, saved.units)
  assert.equal(saved.units[0].villageHome.id, 'p:a')
  assert.equal(belongsToSettlement(saved, saved.units[0].villageHome, saved.buildings[1]), false)
})

test('destroying a center does not annex its residents or depots into an overlapping town', () => {
  const { owner, a, b, sa, unit } = fixture(20)
  sa.inventory.resources.wood = 9
  a.isDestroyed = true
  unit.i = b.i
  reconcileSettlementResidents(owner)
  assert.equal(unit.villageHome.id, 'p:a')
  assert.equal(sa.townCenterId, 'p:a')
  assert.equal(getBaseTerritory(sa, [owner]), null)
  assert.equal(belongsToSettlement(owner, collectiveAnchor(owner, unit), b), false)
  assert.equal(getPlayerResourceTotals(owner, { includeHero: false, settlement: b }).wood, 100)
  assert.equal(sa.inventory.resources.wood, 9)
})

test('unfinished centers and isolated buildings do not create a town', () => {
  const owner = {
    label: 'p',
    units: [{ type: 'Villager', i: 5, j: 5 }],
    buildings: [{ type: 'TownCenter', label: 'new', i: 5, j: 5, isBuilt: false }],
  }
  reconcileSettlementResidents(owner)
  assert.equal(owner.units[0].villageHome, undefined)
  owner.buildings[0].isBuilt = true
  reconcileSettlementResidents(owner)
  assert.equal(owner.units[0].villageHome.id, 'p:new')
})

test('training serialization preserves the resident town', () => {
  const { unit } = fixture()
  const saved = serializeTrainingQueue([{ type: 'Bowman', trainee: unit, extra: { villageHome: unit.villageHome } }])
  assert.deepEqual(saved[0].trainee.villageHome, unit.villageHome)
  assert.deepEqual(saved[0].extra.villageHome, unit.villageHome)
})

test('offline deliveries return to the resident town even when the other depot is nearer', () => {
  const { owner, a, b, sa, sb, unit } = fixture()
  unit.i = b.i
  unit.inventory.resources.wood = 8
  const { deliverOfflineInventory } = load('app/services/world/work/OfflineWorkResources.ts')
  const spatial = {
    reachable: () => true,
    findNear: target => ({ i: target.i, j: target.j }),
    move: (unit, point) => Object.assign(unit, point),
  }
  deliverOfflineInventory(owner, unit, 1000000, { speed: 1.5 }, spatial)
  assert.equal(sa.inventory.resources.wood, 8)
  assert.equal(sb.inventory.resources.wood, 100)
  assert.equal(unit.inventory.resources.wood, undefined)
  assert.equal(unit.villageHome.id, `p:${a.label}`)
})

test('offline catch-up rejects a saved pickup from another town', () => {
  const { owner, sb, unit } = fixture()
  unit.resourceDelivery = { building: sb.label, pickup: { wood: 5 } }
  const { advanceOfflineWorker } = load('app/services/world/offline/OfflineWorldWork.ts')
  const state = { players: [owner], resources: [] }
  advanceOfflineWorker(
    state,
    owner,
    0,
    unit,
    10000,
    1,
    { reachable: () => true, findNear: target => target },
    { unitConfig: () => ({}) },
    {}
  )
  assert.equal(unit.resourceDelivery, undefined)
  assert.equal(unit.inventory.resources.wood, undefined)
  assert.equal(sb.inventory.resources.wood, 100)
})
