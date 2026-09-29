const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { planCollectiveTasks, collectiveHarvestBudget, activeConstructionSite } = loadTsModule(
  'app/lib/economy/collectiveTasks.ts',
  { moduleCache }
)
const { constructionAssignment } = loadTsModule('app/lib/economy/constructionAssignments.ts', { moduleCache })
function fixture(costs) {
  const units = Array.from({ length: 100 }, (_, i) => ({
    type: 'Villager',
    label: `v${i}`,
    i: 10,
    j: 10,
    inactif: true,
    inventory: { resources: { meat: 6, berry: 6 } },
  }))
  const sites = costs.map((cost, i) => ({
    type: 'House',
    label: `site${i}`,
    i: 12 + i,
    j: 12,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost, delivered: {}, consumed: {} },
  }))
  const owner = { units, buildings: [{ type: 'TownCenter', i: 5, j: 5, isBuilt: true }, ...sites] }
  return { owner, units, sites }
}
function apply(plan) {
  for (const [unit, task] of plan) {
    unit.collectiveTask = task.job
    unit.autonomousJob = task.job
    unit.inactif = false
  }
}
test('100 villagers staff multiple sites beyond two gatherers without claiming excess materials', () => {
  const { owner, units, sites } = fixture([{ wood: 100 }, { stone: 80 }, { wood: 60 }])
  const plan = planCollectiveTasks(owner, units)
  apply(plan)
  assert.equal(plan.size, 15) // 6 + 5 + 4 useful loads, 18 free slots each
  for (const site of sites) {
    const assigned = [...plan].filter(([, task]) => task.site === site)
    assert.ok(assigned.length > 2)
    const resource = Object.keys(site.constructionMaterials.cost)[0]
    assert.equal(
      assigned.reduce((n, [unit]) => n + collectiveHarvestBudget(owner, unit, resource), 0),
      site.constructionMaterials.cost[resource]
    )
  }
  const repeated = planCollectiveTasks(owner, units)
  assert.equal(repeated.size, plan.size)
  for (const [unit, task] of plan) assert.equal(repeated.get(unit).site, task.site)
})
test('a partial last load returns to its own project and its harvest cannot exceed the claim', () => {
  const { owner, units, sites } = fixture([{ wood: 100 }, { stone: 20 }])
  const plan = planCollectiveTasks(owner, units)
  apply(plan)
  const unit = [...plan].find(([unit, task]) => task.site === sites[1] && constructionAssignment(unit).target === 2)[0]
  unit.inventory.resources.stone = 2
  assert.equal(collectiveHarvestBudget(owner, unit, 'stone'), 0)
  assert.equal(activeConstructionSite(owner, unit), sites[1])
  const next = planCollectiveTasks(owner, units).get(unit)
  assert.equal(next.job, 'construction')
  assert.equal(next.site, sites[1])
})
test('material already in bags or reserved in a pickup reduces new harvest claims', () => {
  const { owner, units, sites } = fixture([{ wood: 100 }])
  units[0].inventory.resources.wood = 18
  units[1].resourceDeliveryState = { building: { label: 'pit' }, pickup: { wood: 18 } }
  const plan = planCollectiveTasks(
    owner,
    units.filter(unit => unit !== units[1]),
    units
  )
  apply(plan)
  const harvest = [...plan].filter(([, task]) => task.job === 'wood')
  assert.equal(
    harvest.reduce((n, [unit]) => n + collectiveHarvestBudget(owner, unit, 'wood'), 0),
    64
  )
  assert.equal(plan.get(units[0]).site, sites[0])
})
test('completed or demolished projects release their workers to another local project', () => {
  const { owner, units, sites } = fixture([{ wood: 100 }, { stone: 100 }])
  const first = planCollectiveTasks(owner, units)
  apply(first)
  sites[0].isDestroyed = true
  const next = planCollectiveTasks(owner, units)
  assert.ok([...next.values()].every(task => task.site === sites[1]))
  assert.equal([...next.values()].filter(task => task.job === 'stone').length, 6)
})

test('prepaid legacy projects can still receive builders', () => {
  const { owner, units, sites } = fixture([{}])
  delete sites[0].constructionMaterials
  const plan = planCollectiveTasks(owner, units)
  assert.ok([...plan.values()].some(task => task.job === 'construction' && task.site === sites[0]))
})

test('a partial bag cannot reserve materials already carried by another builder', () => {
  const { owner, units } = fixture([{ wood: 20 }])
  units[0].inventory.resources.wood = 1
  units[1].inventory.resources.wood = 19
  owner.buildings.push({
    type: 'StoragePit',
    label: 'pit',
    i: 6,
    j: 5,
    isBuilt: true,
    inventory: { resources: { wood: 100 } },
  })
  const plan = planCollectiveTasks(owner, units)
  assert.equal([...plan.values()].filter(task => task.pickup || task.job === 'wood').length, 0)
  assert.equal(plan.get(units[0]).job, 'construction')
  assert.equal(plan.get(units[1]).job, 'construction')
})

test('offline planning uses the same project assignments and bounded loads', () => {
  const { planOfflineCollectiveWork } = loadTsModule('app/services/world/OfflineCollectiveWork.ts', { moduleCache })
  const { owner, units, sites } = fixture([{ wood: 100 }, { stone: 80 }])
  planOfflineCollectiveWork(owner)
  assert.equal(units.filter(unit => unit.collectiveTask === 'wood').length, 6)
  assert.equal(units.filter(unit => unit.collectiveTask === 'stone').length, 5)
  const stoneWorker = units.find(unit => unit.collectiveTask === 'stone')
  assert.equal(activeConstructionSite(owner, stoneWorker), sites[1])
  stoneWorker.inventory.resources.stone = 18
  planOfflineCollectiveWork(owner)
  assert.equal(stoneWorker.collectiveTask, 'construction')
  assert.equal(stoneWorker.dest[2], sites[1].label)
})

test('loaded builders spread across projects instead of all bringing wood to the first one', () => {
  const { owner, units, sites } = fixture([{ wood: 36 }, { wood: 36 }])
  for (const unit of units) unit.inventory.resources.wood = 18
  const plan = planCollectiveTasks(owner, units)
  assert.equal(plan.size, 4)
  for (const site of sites) assert.equal([...plan.values()].filter(task => task.site === site).length, 2)
})
