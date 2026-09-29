const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { setReserveShare, reserveAmounts } = loadTsModule('app/lib/economy/depotReserves.ts')
const {
  settlementStockGoals,
  planCollectiveTasks,
  collectiveHarvestBudget,
  settlementDepotPolicy,
  setSettlementDepotPolicy,
} = loadTsModule('app/lib/economy/collectiveTasks.ts')
const { validateDepotReservePolicy } = loadTsModule('app/serialization/DepotReserveValidation.ts')
function fixture() {
  const center = { type: 'TownCenter', i: 10, j: 10, label: 'tc', isBuilt: true }
  const pit = {
    type: 'StoragePit',
    i: 12,
    j: 10,
    label: 'pit',
    isBuilt: true,
    inventory: { resources: {} },
    reservePolicy: { target: 100, shares: {} },
  }
  const granary = {
    ...pit,
    type: 'Granary',
    i: 14,
    label: 'grain',
    inventory: { resources: {} },
    reservePolicy: { target: 100, shares: {} },
  }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 11,
    j: 10,
    inactif: true,
    inventory: { resources: { wheat: 12 } },
  }
  const owner = { label: 'player', population: 1, populationMax: 1, buildings: [center, pit, granary], units: [unit] }
  return { owner, unit, pit, granary }
}
test('percentages rebalance active resources, keep zeros disabled and allow all zero', () => {
  const initial = { target: 100, shares: { wood: 50, stone: 30, iron: 20, gold: 0 } }
  const adjusted = setReserveShare(initial, 'wood', 60, 'StoragePit')
  assert.equal(adjusted.shares.wood, 60)
  assert.equal(adjusted.shares.stone, 24)
  assert.equal(adjusted.shares.iron, 16)
  assert.equal(adjusted.shares.gold, 0)
  assert.equal(
    Object.values(adjusted.shares).reduce((a, b) => a + b, 0),
    100
  )
  assert.equal(initial.shares.wood, 50)
  const stopped = setReserveShare({ target: 100, shares: { wood: 100 } }, 'wood', 0, 'StoragePit')
  assert.equal(
    Object.values(stopped.shares).every(value => value === 0),
    true
  )
  assert.equal(setReserveShare(stopped, 'stone', 10, 'StoragePit').shares.stone, 100)
})
test('reserve quantities respect exact integer totals and zero target', () => {
  const amounts = reserveAmounts({ target: 100, shares: { wood: 60, stone: 30, iron: 10 } }, 'StoragePit')
  assert.equal(amounts.wood, 60)
  assert.equal(amounts.stone, 30)
  assert.equal(amounts.iron, 10)
  const rounded = reserveAmounts({ target: 7, shares: { wheat: 34, berry: 33, meat: 33 } }, 'Granary')
  assert.deepEqual(rounded, { wheat: 3, berry: 2, meat: 2 })
  assert.equal(
    Object.values(reserveAmounts({ target: 0, shares: { wood: 100 } }, 'StoragePit')).every(n => n === 0),
    true
  )
})
test('disabled reserves stop comfort harvesting while meals and building materials remain covered', () => {
  const { owner, unit, pit } = fixture()
  assert.equal(planCollectiveTasks(owner, [unit]).size, 0)
  unit.collectiveTask = 'wood'
  assert.equal(collectiveHarvestBudget(owner, unit, 'wood'), 0)
  owner.buildings.push({
    type: 'House',
    i: 11,
    j: 12,
    isBuilt: false,
    constructionMaterials: { cost: { wood: 40 }, delivered: {}, consumed: {} },
  })
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'wood')
  assert.equal(collectiveHarvestBudget(owner, unit, 'wood'), 18)
  assert.deepEqual(pit.inventory.resources, {})
  unit.inventory.resources = {}
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'food')
})
test('granary proportions select missing food types and protect personal provisions', () => {
  const { owner, unit, granary } = fixture()
  granary.reservePolicy = { target: 20, shares: { berry: 100 } }
  granary.inventory.resources = { wheat: 100, berry: 298 }
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'berry')
  unit.collectiveTask = 'berry'
  assert.equal(collectiveHarvestBudget(owner, unit, 'berry'), 2)
  assert.equal(collectiveHarvestBudget(owner, unit, 'wheat'), 0)
  unit.inventory.resources = { berry: 12 }
  assert.equal(collectiveHarvestBudget(owner, unit, 'berry'), 2)
  granary.inventory.resources.berry = 300
  assert.equal(planCollectiveTasks(owner, [unit]).size, 0)
})
test('shared proportions fill each completed depot and ignore legacy total targets', () => {
  const { owner, unit, pit } = fixture()
  const second = { ...pit, label: 'second', j: 12 }
  owner.buildings.push(second)
  const policy = { target: 100, shares: { wood: 60, stone: 30, iron: 10 } }
  setSettlementDepotPolicy(owner, pit, policy)
  assert.deepEqual(second.reservePolicy, policy)
  assert.notEqual(second.reservePolicy, pit.reservePolicy)
  assert.equal(settlementStockGoals(owner, unit).wood, 360)
  const restored = JSON.parse(JSON.stringify(owner))
  assert.equal(settlementDepotPolicy(restored, restored.buildings[1]).target, 300)
  assert.equal(settlementStockGoals(restored, restored.units[0]).wood, 360)
})
test('save validation accepts all-zero policies and rejects invalid totals, shares and resources', () => {
  assert.doesNotThrow(() => validateDepotReservePolicy(undefined, 'Granary'))
  assert.doesNotThrow(() => validateDepotReservePolicy({ target: 100, shares: {} }, 'Granary'))
  for (const policy of [
    { target: -1, shares: {} },
    { target: 100, shares: { wheat: 101 } },
    { target: 100, shares: { wheat: 50 } },
    { target: 100, shares: { wood: 100 } },
    { target: NaN, shares: {} },
  ])
    assert.throws(() => validateDepotReservePolicy(policy, 'Granary'), /Invalid depot/)
})

const { offlineResourceWork } = loadTsModule('app/services/world/OfflineWorldWork.ts')
test('offline gathering selects the requested food and animal material', () => {
  const unit = { type: 'Villager', autonomousJob: 'food', collectiveTask: 'berry' }
  assert.equal(offlineResourceWork({}, unit, { type: 'Berrybush', quantity: 30 }, 3), 'forager')
  assert.equal(offlineResourceWork({}, unit, { type: 'Wheat', quantity: 30, currentFrame: 3 }, 3), undefined)
  unit.collectiveTask = 'leather'
  const carcass = { type: 'Deer', isDead: true, quantity: 0, inventory: { resources: { leather: 2 } } }
  assert.equal(offlineResourceWork({}, unit, carcass, 3), 'hunter')
  unit.collectiveTask = 'meat'
  assert.equal(offlineResourceWork({}, unit, carcass, 3), undefined)
})

test('legacy craft shares are accepted on load but no longer used for comfort reserves', () => {
  const { normalizeDepotReservePolicy, depotReserveResources } = loadTsModule('app/lib/economy/depotReserves.ts')
  const legacy = { target: 100, shares: { wood: 30, stone: 20, fiber: 50 } }
  assert.doesNotThrow(() => validateDepotReservePolicy(legacy, 'StoragePit'))
  const policy = normalizeDepotReservePolicy(legacy, 'StoragePit')
  assert.equal(policy.shares.wood, 60)
  assert.equal(policy.shares.stone, 40)
  assert.equal(policy.shares.fiber, undefined)
  assert.deepEqual(depotReserveResources('StoragePit'), ['wood', 'stone', 'gold', 'copper', 'iron'])
  assert.deepEqual(depotReserveResources('Granary'), ['wheat', 'berry', 'meat'])
  assert.equal(
    Object.values(normalizeDepotReservePolicy({ target: 100, shares: { fiber: 100 } }, 'StoragePit').shares).every(
      n => n === 0
    ),
    true
  )
})
