const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { RESOURCE_TYPES, WORK_TYPES, ACTION_TYPES } = loadTsModule('app/constants/index.ts')
const storageMocks = { getPlayerResourceTotals: ai => ai, hasPlayerResourceChests: () => false }
const { assignAIBuildingMaterials } = loadTsModule('app/ai/AIEconomyBuildingMaterials.ts', {
  mocks: {
    '../lib/resources/playerResourceTotals': storageMocks,
    '../lib/units/playerTargetKnowledge': { knownTarget: (_owner, target) => target, playerSeesTarget: () => true },
  },
})
const { canSpendWithReserve, addBuildingReserve } = loadTsModule('app/ai/AIStrategyEconomy.ts', {
  mocks: { '../lib/resources/playerResourceTotals': storageMocks },
})
function fixture(demand) {
  const ai = {
    age: 1,
    wood: 100,
    stone: 100,
    fiber: 0,
    leather: 0,
    strategy: { getEconomicDemand: () => demand },
    foundedResources: {},
    foundedAnimals: new Set(),
    foundedDeadAnimals: new Set(),
  }
  const economy = { ai, isLocationSafe: () => true, sendVillagerExploring: () => true }
  const worker = {
    i: 0,
    j: 0,
    inactif: true,
    sendToBerrybush(target) {
      this.dest = target
      this.inactif = false
    },
    sendToTakeMeat(target) {
      this.dest = target
      this.inactif = false
    },
    sendToHunt(target) {
      this.dest = target
      this.inactif = false
    },
  }
  return { ai, economy, worker }
}

test('construction reserve checks include fiber and leather', () => {
  const strategy = { ai: { wood: 100, stone: 100, fiber: 3, leather: 1 } }
  assert.equal(canSpendWithReserve(strategy, { wood: 80, stone: 40, fiber: 4 }), false)
  assert.equal(canSpendWithReserve(strategy, { wood: 60, stone: 15, leather: 2 }), false)
  strategy.ai.fiber = 4
  assert.equal(canSpendWithReserve(strategy, { wood: 80, stone: 40, fiber: 4 }), true)
  assert.equal(canSpendWithReserve(strategy, { fiber: 4 }, { fiber: 1 }), false)
})

test('economic demand reads the correct construction tier', () => {
  const strategy = { ai: { age: 1, config: { buildings: require('../public/assets/data/gameplay/buildings.json') } } }
  const demand = {}
  addBuildingReserve(strategy, demand, 'House', 2)
  assert.deepEqual(demand, { wood: 120, stone: 60, fiber: 8 })
})

test('missing fiber reserves a worker for a known safe plant', () => {
  const { ai, economy, worker } = fixture({ fiber: 4 })
  const plant = { type: RESOURCE_TYPES.fiberPlant, i: 1, j: 1, quantity: 3 }
  ai.foundedResources[RESOURCE_TYPES.fiberPlant] = new Set([plant])
  const assigned = assignAIBuildingMaterials(economy, [worker])
  assert.ok(assigned.has(worker))
  assert.equal(worker.dest, plant)
  ai.fiber = 4
  assert.equal(assignAIBuildingMaterials(economy, [worker]).size, 0)
})

test('leather demand prefers a carcass and excludes horses and birds', () => {
  const { ai, economy, worker } = fixture({ leather: 2 })
  const deer = { type: 'Deer', i: 2, j: 2, isDead: true, quantity: 20 }
  ai.foundedDeadAnimals.add(deer)
  ai.foundedAnimals = new Set([
    { type: 'Horse', i: 0, j: 0, quantity: 20 },
    { type: 'BlackGrouse', i: 0, j: 0, quantity: 20 },
  ])
  assignAIBuildingMaterials(economy, [worker])
  assert.equal(worker.dest, deer)
})

test('material demand can borrow a woodcutter but leaves builders and combat alone', () => {
  const { ai, economy, worker } = fixture({ fiber: 4 })
  const plant = { type: RESOURCE_TYPES.fiberPlant, i: 1, j: 1, quantity: 3 }
  ai.foundedResources[RESOURCE_TYPES.fiberPlant] = new Set([plant])
  Object.assign(worker, { inactif: false, work: WORK_TYPES.woodcutter, action: ACTION_TYPES.chopwood })
  const builder = { ...worker, action: ACTION_TYPES.build }
  const fighter = { ...worker, action: ACTION_TYPES.attack }
  const reserved = assignAIBuildingMaterials(economy, [builder, fighter, worker])
  assert.deepEqual([...reserved], [worker])
})
