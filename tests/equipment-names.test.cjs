const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const language of ['fr', 'en']) {
  test(`every equipment and crafting output has a canonical ${language} name`, () => {
    const moduleCache = new Map()
    const load = path =>
      loadTsModule(path, {
        moduleCache,
        mocks: { '../lang': { getLang: () => language, t: key => key } },
      })
    const { EQUIPMENT_NAMES } = load('app/lib/i18n/equipmentNames.ts')
    const { DYNAMIC_EQUIPMENT_KEYS } = load('app/lib/lpc/equipmentData.ts')
    const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCrafting.ts')
    const { getHeroCraftRecipeLabel } = load('app/lib/hero/heroCraftLabels.ts')
    const { equipmentVisualParts } = load('app/lib/equipment/helmetVariants.ts')
    const { formatEquipmentLootLabel, formatEquipmentStackLabel } = load('app/lib/equipment/equipmentSlots.ts')
    for (const key of DYNAMIC_EQUIPMENT_KEYS) {
      assert.ok(EQUIPMENT_NAMES[key]?.[language], key)
    }
    for (const recipe of HERO_CRAFT_RECIPES) {
      if (recipe.outputResource) {
        assert.equal(getHeroCraftRecipeLabel(recipe), recipe.outputResource)
        continue
      }
      const parts = equipmentVisualParts(recipe.outputEquipment)
      for (const key of parts) assert.ok(EQUIPMENT_NAMES[key]?.[language], key)
      const expected = parts.map(key => EQUIPMENT_NAMES[key][language]).join(' · ')
      assert.equal(getHeroCraftRecipeLabel(recipe), expected, recipe.id)
      assert.equal(formatEquipmentLootLabel(recipe.outputEquipment), expected, recipe.id)
      assert.equal(formatEquipmentLootLabel(`${recipe.outputEquipment}~condition:0`), expected, recipe.id)
      assert.equal(formatEquipmentStackLabel(recipe.outputEquipment, 3), `${expected} x3`, recipe.id)
    }
    assert.equal(formatEquipmentLootLabel('sword_ceramic'), language === 'fr' ? 'Épée en bronze' : 'Bronze sword')
    assert.equal(
      formatEquipmentLootLabel('round_shield_iron_slash'),
      language === 'fr' ? 'Bouclier en bois renforcé de fer' : 'Iron reinforced wooden shield'
    )
    for (const key of ['unknown_sword', '__proto__', 'constructor', '']) {
      assert.equal(formatEquipmentLootLabel(key), language === 'fr' ? 'Équipement inconnu' : 'Unknown equipment')
    }
  })
}

test('equipment labels read the current language on each call', () => {
  let language = 'fr'
  const { getEquipmentDisplayName } = loadTsModule('app/lib/equipment/equipmentNames.ts', {
    mocks: { '../lang': { getLang: () => language } },
  })
  assert.equal(getEquipmentDisplayName('sword_ceramic'), 'Épée en bronze')
  language = 'en'
  assert.equal(getEquipmentDisplayName('sword_ceramic'), 'Bronze sword')
})
