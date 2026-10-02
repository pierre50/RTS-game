const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { collectiveNeeds, collectiveWorkerClaims, villageFoodReserve } = loadTsModule(
  'app/lib/economy/collectiveNeeds.ts'
)
const { releaseCollectiveWorker } = loadTsModule('app/ai/AICollectiveWorkers.ts')
const { planOfflineCollectiveWork } = loadTsModule('app/services/world/offline/OfflineCollectiveWork.ts')

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
  return { player, unit, state }
}

test('offline priorities skip missing or unreachable supplies and choose an available material', () => {
  const f = village()
  f.unit.inventory = { resources: { wheat: 12 } }
  f.player.buildings.push({ type: 'StoragePit', i: 2, j: 0, isBuilt: true, inventory: { resources: {} } })
  const resources = [
    { type: 'Tree', i: 40, j: 0, quantity: 100, hitPoints: 0 },
    { type: 'Stone', i: 3, j: 0, quantity: 10, hitPoints: 10 },
  ]
  planOfflineCollectiveWork(f.player, false, {
    resources,
    spatial: { reachable: (_unit, target) => target.i < 30 },
    rules: { wheatMatureFrame: 5 },
    playerIndex: 0,
  })
  assert.equal(f.unit.collectiveTask, 'stone')
  resources[1].quantity = 0
  planOfflineCollectiveWork(f.player, false, {
    resources,
    spatial: { reachable: () => false },
    rules: { wheatMatureFrame: 5 },
    playerIndex: 0,
  })
  assert.equal(f.unit.collectiveTask, null)
})

test('offline workers can withdraw actual provisions without any natural food source', () => {
  const f = village()
  const granary = {
    type: 'Granary',
    label: 'grain',
    i: 2,
    j: 0,
    isBuilt: true,
    inventory: { resources: { wheat: 12 } },
  }
  f.player.buildings.push(granary)
  planOfflineCollectiveWork(f.player, false, {
    resources: [],
    spatial: { reachable: () => true },
    rules: { wheatMatureFrame: 5 },
    playerIndex: 0,
  })
  assert.equal(f.unit.collectiveTask, 'food')
  assert.equal(f.unit.resourceDelivery.pickup.food, 12)
  assert.equal(granary.inventory.resources.wheat, 12, 'planning reserves a trip, not an instant transfer')
})
