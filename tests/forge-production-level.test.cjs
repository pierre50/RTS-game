const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { canForgeProduce } = loadTsModule('app/lib/equipment/forgeProduction.ts')
const { HERO_CRAFT_RECIPES, getAvailableHeroCraftRecipes, canCraftHeroRecipe, craftHeroRecipe, getMaxHeroCraftCount } =
  loadTsModule('app/lib/hero/heroCrafting.ts')
const { takeOrCraftTownEquipment } = loadTsModule('app/lib/units/supplies/townSupplies.ts')
const { canRepairEquipment } = loadTsModule('app/lib/equipment/equipmentRepair.ts', {
  mocks: { '../hero/heroActionRange': { isHeroInteractionTargetReachable: () => true } },
})

test('all iron production, including ingots, arrows, weapons and decorated helmets, requires the first forge upgrade', () => {
  const recipes = HERO_CRAFT_RECIPES.filter(r => r.outputResource === 'ironIngot' || r.cost.ironIngot > 0)
  for (const id of ['ironIngot', 'arrow_iron', 'sword_iron', 'axe_iron', 'armor_mail_iron'])
    assert.ok(recipes.some(r => r.id === id))
  assert.ok(recipes.some(r => r.decorated))
  for (const recipe of recipes) {
    assert.equal(canForgeProduce(recipe, { buildingLevel: 0 }), false, recipe.id)
    assert.equal(canForgeProduce(recipe, { buildingLevel: 1 }), true, recipe.id)
    assert.equal(canForgeProduce(recipe, { assetLevel: 1 }), true, recipe.id)
    assert.equal(canForgeProduce(recipe), false, recipe.id)
    const player = { civ: recipe.civilizations?.[0] }
    const hero = {
      type: 'Hero',
      inventory: { resources: Object.fromEntries(Object.keys(recipe.cost).map(k => [k, 100])), equipment: [] },
    }
    const forge = { i: 0, j: 0, buildingLevel: 0, owner: player }
    const before = structuredClone(hero.inventory)
    assert.equal(canCraftHeroRecipe(player, recipe, hero, forge), false)
    assert.equal(getMaxHeroCraftCount(player, recipe, hero, forge), 0)
    assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), false)
    assert.deepEqual(hero.inventory, before)
    forge.buildingLevel = 1
    assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), true, recipe.id)
  }
  assert.ok(!getAvailableHeroCraftRecipes({}, 'forge', { buildingLevel: 0 }).some(r => recipes.includes(r)))
  assert.ok(getAvailableHeroCraftRecipes({}, 'forge', { buildingLevel: 1 }).some(r => r.id === 'ironIngot'))
})

test('local automatic crafting selects the best forge, respects its level and still uses existing iron stock', () => {
  const center = {
    type: 'TownCenter',
    i: 10,
    j: 10,
    isBuilt: true,
    inventory: { resources: { ironIngot: 10, wood: 10, leather: 10 }, equipment: [] },
  }
  const forge = { type: 'Forge', i: 11, j: 10, isBuilt: true, buildingLevel: 0 }
  const owner = { label: 'p', buildings: [center, forge] }
  const unit = { type: 'Fantassin', i: 12, j: 10 }
  const before = structuredClone(center.inventory.resources)
  assert.equal(takeOrCraftTownEquipment(unit, owner, 'sword_iron'), undefined)
  assert.deepEqual(center.inventory.resources, before)
  center.inventory.equipment.push('sword_iron')
  assert.equal(takeOrCraftTownEquipment(unit, owner, 'sword_iron'), 'sword_iron')
  owner.buildings.push({ ...forge, i: 12, buildingLevel: 1 })
  assert.equal(takeOrCraftTownEquipment(unit, owner, 'sword_iron'), 'sword_iron')
  assert.equal(center.inventory.resources.ironIngot, 8)
  const saved = JSON.parse(JSON.stringify(owner))
  assert.equal(takeOrCraftTownEquipment(unit, saved, 'sword_iron'), 'sword_iron')
})

test('base forge can still repair iron and upgrading it does not require iron', () => {
  const hero = {
    type: 'Hero',
    inventory: { resources: { ironIngot: 20, wood: 20, leather: 20 }, equipment: ['sword_iron~condition:50'] },
  }
  assert.equal(
    canRepairEquipment(
      {},
      hero,
      { type: 'Forge', isBuilt: true, buildingLevel: 0 },
      { location: 'bag', key: '0', item: hero.inventory.equipment[0] }
    ),
    true
  )
  const { getBuildingUpgradeCost } = loadTsModule('app/lib/buildings/buildingUpgrade.ts')
  const config = require('../public/assets/data/gameplay/buildings.json').Forge
  const cost = getBuildingUpgradeCost(config, 0, 1)
  assert.equal(cost.iron ?? 0, 0)
  assert.equal(cost.ironIngot ?? 0, 0)
})
