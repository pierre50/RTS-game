const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { notifyHeroHealthChanged } = loadTsModule('app/lib/units/unitHealth.ts')

test('health changes refresh only the active hero HUD without changing health', () => {
  const calls = []
  const context = { controls: {}, menu: { updateHeroStatus: unit => calls.push(unit.hitPoints) } }
  const hero = { hitPoints: 7, context }
  context.controls.heroUnit = hero
  notifyHeroHealthChanged(hero)
  notifyHeroHealthChanged({ hitPoints: 5, context })
  assert.deepEqual(calls, [7])
  assert.equal(hero.hitPoints, 7)
})
