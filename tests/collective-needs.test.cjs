const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { collectiveNeeds, collectiveWorkerClaims, villageFoodReserve } = loadTsModule(
  'app/lib/economy/collectiveNeeds.ts'
)
const { releaseCollectiveWorker } = loadTsModule('app/ai/AICollectiveWorkers.ts')
const { produceAbstractVillage } = loadTsModule('app/services/world/AbstractVillageEconomy.ts')

test('food is reserved first and one small deficit does not mobilize the entire village', () => {
  const claims = collectiveWorkerClaims(5, { wood: 20, stone: 10 }, { food: 0 }, 5)
  assert.ok(claims.food > 0)
  assert.equal(claims.wood, 1)
  assert.equal(claims.stone, 1)
  assert.ok(Object.values(claims).reduce((a, b) => a + b, 0) <= 5)
  assert.equal(collectiveWorkerClaims(5, { wood: 500 }, {}, 1).wood, 0)
})

test('fulfilled goals leave workers free and spending reopens only the missing task', () => {
  const goals = { food: villageFoodReserve(5, 10), wood: 40, stone: 10 }
  assert.ok(Object.values(collectiveWorkerClaims(5, goals, goals, 5)).every(n => n === 0))
  const claims = collectiveWorkerClaims(5, goals, { ...goals, wood: 35 }, 5)
  assert.equal(claims.wood, 1)
  assert.equal(claims.food, 0)
  assert.equal(claims.stone, 0)
  assert.equal(collectiveNeeds(5, goals, { ...goals, wood: 35 }).find(n => n.resource === 'wood').missing, 5)
})

test('surplus workers deliver cargo without resuming the fulfilled order', () => {
  const available = []
  let delivered = false
  const worker = {
    autonomousJob: 'wood',
    work: 'woodcutter',
    dest: { type: 'Tree' },
    inventory: { resources: { wood: 12 } },
    stop() {
      this.inactif = true
    },
    sendToDelivery() {
      assert.equal(this.dest, null)
      assert.equal(this.autonomousJob, null)
      delivered = true
    },
  }
  releaseCollectiveWorker(worker, available)
  assert.equal(delivered, true)
  assert.equal(available.length, 0)
  assert.equal(worker.inventory.resources.wood, 12)
})

function village(stocks = {}) {
  const player = {
    type: 'AI',
    population: 5,
    populationMax: 5,
    age: 0,
    buildings: [
      {
        type: 'TownCenter',
        label: 'home',
        i: 0,
        j: 0,
        hitPoints: 100,
        isBuilt: true,
        inventory: { resources: stocks },
      },
    ],
    units: [],
  }
  const unit = { type: 'Villager', label: 'worker', i: 0, j: 0 }
  player.units.push(unit)
  const state = { players: [player], resources: [] }
  const report = { gathered: {} }
  const rules = { buildingConfig: () => ({}) }
  return { player, unit, state, report, rules }
}

test('off-screen production stops at food needs instead of producing every resource indefinitely', () => {
  const f = village()
  f.player.buildings.push({ type: 'Granary', i: 2, j: 0, isBuilt: true, inventory: { resources: {} } })
  for (let i = 0; i < 30; i++) produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report, {}, f.rules)
  assert.equal((f.report.gathered.food ?? 0) + (f.report.gathered.wheat ?? 0), 312)
  assert.equal(f.unit.inventory.resources.wheat, 12)
  assert.equal(f.player.buildings.find(building => building.type === 'Granary').inventory.resources.wheat, 300)
  assert.equal(f.report.gathered.wood, undefined)
  assert.equal(f.report.gathered.gold, undefined)
  const before = structuredClone(f.report)
  produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report, {}, f.rules)
  assert.deepEqual(f.report, before)
})

test('regional builders carry a bounded mix to the site without stocking the depot', () => {
  const { advanceMaterialConstruction } = loadTsModule('app/lib/economy/constructionMaterials.ts')
  const f = village()
  f.unit.inventory = { resources: { wheat: 12 } }
  const depot = { type: 'StoragePit', i: 2, j: 0, isBuilt: true, inventory: { resources: {} } }
  const site = {
    type: 'House',
    i: 5,
    j: 0,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 40, stone: 10 }, delivered: {}, consumed: {} },
  }
  f.player.buildings.push(depot, site)
  produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report)
  assert.deepEqual(f.unit.inventory.resources, { wheat: 12, wood: 18 })
  assert.deepEqual(depot.inventory.resources, {})
  const before = structuredClone(f.report)
  produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report)
  assert.deepEqual(f.report, before)
  for (let i = 0; i < 10; i++) {
    site.hitPoints = advanceMaterialConstruction(site, 101, [f.unit.inventory.resources])
    if (site.hitPoints === 101) break
    produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report)
  }
  assert.equal(site.hitPoints, 101)
  assert.deepEqual(site.constructionMaterials.consumed, { wood: 40, stone: 10 })
  assert.deepEqual(depot.inventory.resources, {})
})

test('regional production obeys food proportions, personal provisions and disabled targets', () => {
  const f = village()
  f.unit.inventory = { resources: { berry: 12 } }
  const granary = {
    type: 'Granary',
    i: 2,
    j: 0,
    isBuilt: true,
    inventory: { resources: {} },
    reservePolicy: { target: 20, shares: { berry: 100 } },
  }
  f.player.buildings.push(granary)
  for (let i = 0; i < 100; i++) produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report)
  assert.equal(granary.inventory.resources.berry, 300)
  assert.equal(f.unit.inventory.resources.berry, 12)
  assert.equal(f.report.gathered.berry, 300)
  granary.reservePolicy.shares = {}
  granary.inventory.resources = {}
  const before = structuredClone(f.report)
  produceAbstractVillage(f.state, f.player, f.unit, 1440000, f.report)
  assert.deepEqual(f.report, before)
})
