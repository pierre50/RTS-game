const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { migrateSavedAge } = loadTsModule('app/lib/objectives/ageRules.ts')

test('legacy ages migrate once without demoting Bronze or Iron saves', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map(age => migrateSavedAge(age)),
    [0, 1, 1, 2]
  )
  assert.deepEqual(
    [0, 1, 2].map(age => migrateSavedAge(age, 1)),
    [0, 1, 2]
  )
})

test('Bronze formations and arrow recipes never require iron, and starting infantry needs no metal', () => {
  const { UNIT_TRAINING_AGE_METAL_COST } = loadTsModule('app/constants/unitTrainingAgeCost.ts')
  const units = require('../public/assets/data/gameplay/units.json')
  assert.equal(units.Fantassin.cost.copper, undefined)
  assert.equal(units.Fantassin.cost.iron, undefined)
  for (const cost of Object.values(UNIT_TRAINING_AGE_METAL_COST)) {
    assert.equal(cost[1].iron, undefined)
    assert.ok(cost[1].copper > 0)
    assert.ok(cost[2].iron > 0)
  }
  const { HERO_CRAFT_RECIPES } = loadTsModule(require.resolve('../app/lib/hero/heroCrafting.ts'), {
    mocks: { '../equipment/equipmentLoot': {}, '../resources/playerResourceTotals': {} },
  })
  const bronzeArrows = HERO_CRAFT_RECIPES.find(recipe => recipe.id === 'arrow_bronze')
  assert.equal(bronzeArrows.cost.iron, undefined)
  assert.ok(bronzeArrows.cost.copper > 0)
})
