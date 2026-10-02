const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { migrateLegacyProgression } = loadTsModule('app/serialization/LegacyProgressionMigration.ts')

test('legacy saves convert ages once into independent building and forge upgrades', () => {
  for (const [version, tiers] of [
    [undefined, [0, 2, 2, 3]],
    [1, [0, 2, 3]],
  ]) {
    tiers.forEach((tier, age) => {
      const player = { age, ageRulesVersion: version, buildings: [{ type: 'House' }] }
      migrateLegacyProgression(player)
      assert.deepEqual(Object.values(player.forgeUpgrades), Array(6).fill(tier))
      assert.equal(player.buildings[0].buildingLevel, age > 0 ? 1 : 0)
      assert.equal('age' in player, false)
      assert.equal('ageRulesVersion' in player, false)
      const once = structuredClone(player)
      migrateLegacyProgression(player)
      assert.deepEqual(player, once)
    })
  }
})

test('explicit upgrades, construction progress and interiors survive legacy migration', () => {
  const player = {
    age: 2,
    ageRulesVersion: 1,
    forgeUpgrades: { axes: 1 },
    buildings: [
      {
        buildingAge: 0,
        assetAge: 1,
        inventory: { resources: { wood: 12 } },
        buildingUpgrade: { targetAge: 1, hitPoints: 40, totalHitPoints: 125, constructionTime: 20 },
        interiorBuildings: [{ type: 'Chest', assetAge: 0 }],
      },
    ],
  }
  migrateLegacyProgression(player)
  assert.equal(player.forgeUpgrades.axes, 1)
  assert.equal(player.forgeUpgrades.weapons, 0)
  assert.equal(player.buildings[0].buildingLevel, 0)
  assert.equal(player.buildings[0].buildingUpgrade.targetLevel, 1)
  assert.equal(player.buildings[0].buildingUpgrade.hitPoints, 40)
  assert.deepEqual(player.buildings[0].inventory.resources, { wood: 12 })
  assert.equal(player.buildings[0].interiorBuildings[0].buildingLevel, 0)
  assert.doesNotMatch(JSON.stringify(player), /"(?:age|ageRulesVersion|buildingAge|assetAge|targetAge)"/)
})

test('training is free at every age, including when old configs contain costs', () => {
  const { getUnitTrainingCost } = loadTsModule('app/lib/training/unitTrainingCost.ts')
  for (const age of [0, 1, 2]) {
    for (const type of ['Fantassin', 'Bowman', 'Priest']) {
      assert.deepEqual(
        getUnitTrainingCost({ age, config: { units: { [type]: { cost: { food: 50, gold: 20 } } } } }, type),
        {}
      )
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
