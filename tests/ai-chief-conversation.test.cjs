const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('a chief stays in conversation until a hostile requires village defense', () => {
  const { handleAIChiefGuard } = loadTsModule('app/classes/players/AIPlayerBehavior.ts', { mocks: {
    '../../lib/units/interiorCombat': { hasInteriorCombatRoute: () => false },
    '../../ai/AITheftDefense': { isInteriorTheftDefender: () => false },
  } })
  const orders = []
  const chief = { label: 'chief', i: 20, j: 20, lookingAtHero: true, sendTo: (...args) => orders.push(args) }
  const anchor = { i: 0, j: 0, isBuilt: true }
  let hostiles = []
  const ai = { context: {}, getNow: () => 100, getLivingChiefs: () => [chief], getVisibleHostilesNear: () => hostiles }
  assert.equal(handleAIChiefGuard(ai, [anchor]), 0)
  assert.deepEqual(orders, [])
  hostiles = [{ label: 'attacker' }]
  assert.equal(handleAIChiefGuard(ai, [anchor]), 1)
  assert.deepEqual(orders, [[hostiles[0], 'attack']])
  assert.equal(chief.lookingAtHero, false)
})
