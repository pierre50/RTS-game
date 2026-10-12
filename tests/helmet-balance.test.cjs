const test = require('node:test')
const assert = require('node:assert/strict')
const { loadGenerationTs } = require('../tools/maps/load-generation-ts.cjs')
const { FORGE_EQUIPMENT_RECIPES } = loadGenerationTs('app/lib/hero/heroForgeRecipes.ts')
const equipment = require('../public/assets/data/gameplay/equipment.json')

const helmets = [
  ['pointed', 2, 2, 1],
  ['nasal', 3, 3, 1],
  ['norman', 3, 3, 1],
  ['bascinet_round', 3, 3, 2],
  ['legion', 4, 4, 2],
  ['barbuta', 5, 5, 2],
]

test('iron helmet protection and forge prices follow the agreed coverage tiers', () => {
  for (const [family, armor, ingots, leather] of helmets) {
    assert.equal(equipment[`helmet_${family}_iron`].armor, armor)
    for (const material of ['bronze', 'iron']) {
      const recipe = FORGE_EQUIPMENT_RECIPES.find(r => r.id === `helmet_${family}_${material}`)
      assert.deepEqual(
        recipe.cost,
        material === 'ceramic' ? { stone: ingots * 3, leather } : { [`${material}Ingot`]: ingots, leather }
      )
    }
  }
})

test('decorated helmets keep the base recipe and add only two leather', () => {
  for (const recipe of FORGE_EQUIPMENT_RECIPES.filter(r => r.decorated)) {
    const base = FORGE_EQUIPMENT_RECIPES.find(r => r.id === recipe.id.split('~')[0])
    assert.deepEqual(recipe.cost, { ...base.cost, leather: base.cost.leather + 2 })
    const ornament = recipe.outputEquipment.split('~decor:')[1]
    assert.equal(equipment[ornament]?.armor ?? 0, 0)
  }
})
