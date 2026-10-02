const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const storageMocks = { getPlayerResourceTotals: ai => ai, hasPlayerResourceChests: () => false }
const { canSpendWithReserve, addBuildingReserve } = loadTsModule('app/ai/AIStrategyEconomy.ts', {
  mocks: { '../lib/resources/playerResourceTotals': storageMocks },
})
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
  assert.deepEqual(demand, { wood: 80, stone: 20 })
})
