const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const language of ['fr', 'en']) {
  test(`craft labels resolve every forge material in ${language}`, () => {
    const previousStorage = global.localStorage
    global.localStorage = { getItem: () => language }
    try {
      const { getHeroCraftRecipeLabel } = loadTsModule('app/lib/hero/heroCraftLabels.ts')
      const { FORGE_EQUIPMENT_RECIPES } = loadTsModule('app/lib/hero/heroForgeRecipes.ts')
      const materials =
        language === 'fr'
          ? { ceramic: 'pierre', copper: 'cuivre', bronze: 'bronze', iron: 'fer' }
          : { ceramic: 'Stone', copper: 'Copper', bronze: 'Bronze', iron: 'Iron' }
      for (const recipe of FORGE_EQUIPMENT_RECIPES) {
        const label = getHeroCraftRecipeLabel(recipe)
        assert.doesNotMatch(label, /\{[^}]+\}/, recipe.id)
        if (recipe.materialKey) {
          assert.ok(label.includes(materials[recipe.materialKey.replace('forgeMaterial_', '')]), recipe.id)
        }
      }
      const helmet = FORGE_EQUIPMENT_RECIPES.find(recipe => recipe.id === 'helmet_pointed_bronze')
      assert.equal(
        getHeroCraftRecipeLabel(helmet),
        language === 'fr' ? 'Casque conique en bronze' : 'Bronze conical helmet'
      )
      assert.equal(getHeroCraftRecipeLabel({ outputEquipment: 'bow' }), language === 'fr' ? 'Arc' : 'Bow')
    } finally {
      if (previousStorage === undefined) delete global.localStorage
      else global.localStorage = previousStorage
    }
  })
}
