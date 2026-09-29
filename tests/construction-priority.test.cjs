const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { automaticDepositAmount } = loadTsModule('app/lib/resources/resourceDelivery.ts')
const { collectiveHarvestBudget } = loadTsModule('app/lib/economy/collectiveTasks.ts')
function fixture() {
  const site = {
    type: 'House',
    i: 5,
    j: 0,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 100, stone: 50 }, delivered: {}, consumed: {} },
  }
  const depot = { type: 'StoragePit', label: 'pit', i: 2, j: 0, isBuilt: true }
  const owner = { buildings: [site, depot] }
  const unit = {
    type: 'Villager',
    i: 0,
    j: 0,
    owner,
    collectiveTask: 'wood',
    inventory: { resources: { wheat: 12, wood: 18 } },
  }
  return { unit, owner, site, depot }
}
test('automatic deposits keep all useful construction materials and release only excess or unrelated resources', () => {
  const { unit, site } = fixture()
  assert.equal(automaticDepositAmount(unit, 'wood'), 0)
  unit.inventory.resources = { wheat: 12, wood: 12, stone: 6, gold: 3 }
  assert.equal(automaticDepositAmount(unit, 'wood'), 0)
  assert.equal(automaticDepositAmount(unit, 'stone'), 0)
  assert.equal(automaticDepositAmount(unit, 'gold'), 3)
  assert.equal(automaticDepositAmount(unit, 'wheat'), 0)
  site.isBuilt = true
  assert.equal(automaticDepositAmount(unit, 'wood'), 12)
})
test('materials remain protected after entering the depot interior', () => {
  const { unit, depot } = fixture()
  unit.inventory.resources = { wheat: 12, wood: 12, stone: 6 }
  unit.spaceId = 'interior:pit'
  unit.i = 100
  unit.resourceDeliveryState = { building: depot, phase: 'toChest' }
  assert.equal(automaticDepositAmount(unit, 'wood'), 0)
  assert.equal(automaticDepositAmount(unit, 'stone'), 0)
})
test('construction food gathering stops after the urgent daily ration', () => {
  const { unit, owner } = fixture()
  unit.collectiveTask = 'food'
  unit.inventory.resources = { wheat: 1 }
  assert.equal(collectiveHarvestBudget(owner, unit, 'wheat'), 3)
  unit.inventory.resources.wheat = 4
  assert.equal(collectiveHarvestBudget(owner, unit, 'wheat'), 0)
})
