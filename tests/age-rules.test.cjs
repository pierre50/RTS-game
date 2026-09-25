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

test('training is free at every age, including when old configs contain costs', () => {
  const { getUnitTrainingCost } = loadTsModule('app/lib/training/unitTrainingCost.ts')
  for (const age of [0, 1, 2]) {
    for (const type of ['Fantassin', 'Bowman', 'Priest']) {
      assert.deepEqual(getUnitTrainingCost({ age, config: { units: { [type]: { cost: { food: 50, gold: 20 } } } } }, type), {})
    }
  }
})

test('Bronze arrow recipes never require iron, and starting infantry needs no metal', () => {
  const units = require('../public/assets/data/gameplay/units.json')
  assert.equal(units.Fantassin.cost.copper, undefined)
  assert.equal(units.Fantassin.cost.iron, undefined)
  const { HERO_CRAFT_RECIPES } = loadTsModule(require.resolve('../app/lib/hero/heroCrafting.ts'), {
    mocks: { '../equipment/equipmentLoot': {}, '../resources/playerResourceTotals': {} },
  })
  const bronzeArrows = HERO_CRAFT_RECIPES.find(recipe => recipe.id === 'arrow_bronze')
  assert.equal(bronzeArrows.cost.iron, undefined)
  assert.ok(bronzeArrows.cost.copper > 0)
})
