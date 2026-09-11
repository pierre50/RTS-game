const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { worldEconomyFactors } = loadTsModule('app/config/worldEconomyBalance.ts')

test('economic randomness is repeatable and varies by day and faction', () => {
  const first = worldEconomyFactors('medium', '4242:hellas', 2)
  assert.deepEqual(first, worldEconomyFactors('medium', '4242:hellas', 2))
  assert.notEqual(first.workEfficiency, worldEconomyFactors('medium', '4242:hellas', 3).workEfficiency)
  assert.notEqual(first.workEfficiency, worldEconomyFactors('medium', '4242:nord', 2).workEfficiency)
  assert.deepEqual(first, worldEconomyFactors('unknown', '4242:hellas', 2))
})

test('difficulty scales bounded efficiency and arrival chances monotonically', () => {
  const arrivals = { easy: 0, medium: 0, hard: 0 }
  for (let day = 1; day <= 1000; day++) {
    const easy = worldEconomyFactors('easy', 'seed', day)
    const medium = worldEconomyFactors('medium', 'seed', day)
    const hard = worldEconomyFactors('hard', 'seed', day)
    assert.ok(easy.workEfficiency < medium.workEfficiency)
    assert.ok(medium.workEfficiency < hard.workEfficiency)
    assert.ok(medium.workEfficiency >= 0.9 && medium.workEfficiency <= 1.1)
    assert.ok(!easy.arrivalsAllowed || medium.arrivalsAllowed)
    assert.equal(hard.arrivalsAllowed, true)
    arrivals.easy += Number(easy.arrivalsAllowed)
    arrivals.medium += Number(medium.arrivalsAllowed)
    arrivals.hard += Number(hard.arrivalsAllowed)
  }
  assert.ok(arrivals.easy < arrivals.medium && arrivals.medium < arrivals.hard)
})
