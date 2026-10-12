const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getAvailableHeroCraftRecipes, craftHeroRecipe, canCraftHeroRecipe, getMaxHeroCraftCount } =
  loadTsModule('app/lib/hero/heroCrafting.ts')
const { equipmentVisualParts } = loadTsModule('app/lib/equipment/helmetVariants.ts')

const ornaments = {
  Hellas: 'centurion_crest',
  Latium: 'centurion_plumage',
  Sumeria: 'legion_plumage',
  Kemet: 'plumage',
  Xia: 'plumage',
  Nobatia: 'plumage',
  Alba: 'helmet_wings',
  Nord: 'upward_horns_white',
}
const helmets = {
  Hellas: 'barbuta',
  Latium: 'legion',
  Sumeria: 'nasal',
  Nobatia: 'nasal',
  Kemet: 'bascinet_round',
  Xia: 'bascinet_round',
  Alba: 'bascinet_round',
  Nord: 'norman',
}
test('each civilization receives only its shared and cultural helmets with its own ornament', () => {
  for (const [civ, ornament] of Object.entries(ornaments)) {
    const recipes = getAvailableHeroCraftRecipes({ civ }, 'forge', { buildingLevel: 1, owner: { civ } })
    const plain = recipes.filter(recipe => recipe.outputEquipment.startsWith('helmet_') && !recipe.decorated)
    const decorated = recipes.filter(recipe => recipe.decorated)
    assert.equal(plain.length, 4)
    assert.deepEqual(
      new Set(plain.map(recipe => recipe.outputEquipment.replace(/_(leather|bronze|iron)$/, ''))),
      new Set(['helmet_pointed', `helmet_${helmets[civ]}`])
    )
    assert.equal(decorated.length, plain.length)
    assert.equal(new Set(recipes.map(recipe => recipe.id)).size, recipes.length)
    for (const recipe of decorated) {
      const [base, part] = equipmentVisualParts(recipe.outputEquipment)
      assert.equal(part, ornament, civ)
      const original = plain.find(recipe => recipe.outputEquipment === base)
      assert.ok(original)
      assert.equal(recipe.outputCount, 1)
      assert.deepEqual(recipe.cost, { ...original.cost, leather: original.cost.leather + 2 })
    }
  }
  assert.deepEqual(
    getAvailableHeroCraftRecipes({ civ: 'Greek' }, 'forge'),
    getAvailableHeroCraftRecipes({ civ: 'Hellas' }, 'forge')
  )
  assert.ok(getAvailableHeroCraftRecipes({ civ: 'Nord' }, 'campfire').every(recipe => !recipe.decorated))
})

test('a foreign decorated recipe cannot be crafted even if its old UI callback is reused', () => {
  const recipe = getAvailableHeroCraftRecipes({ civ: 'Nord' }, 'forge').find(recipe => recipe.decorated)
  const hero = {
    type: 'Hero',
    inventory: {
      resources: { leather: 100, fiber: 100, bronzeIngot: 100, stone: 100, copperIngot: 100 },
      equipment: [],
    },
  }
  const before = JSON.stringify(hero)
  assert.equal(canCraftHeroRecipe({ civ: 'Alba' }, recipe, hero), false)
  assert.equal(getMaxHeroCraftCount({ civ: 'Alba' }, recipe, hero), 0)
  assert.equal(craftHeroRecipe({ civ: 'Alba' }, hero, recipe), false)
  assert.equal(JSON.stringify(hero), before)
  assert.equal(craftHeroRecipe({ civ: 'Nord' }, hero, recipe), true)
  assert.deepEqual(hero.inventory.equipment, [recipe.outputEquipment])
  assert.equal(hero.inventory.resources.leather, 100 - recipe.cost.leather)
})

test('a foreign forge offers and crafts its owner decoration, not the visiting player decoration', () => {
  const player = { civ: 'Alba' }
  const forge = { i: 0, j: 0, owner: { civ: 'Nord' } }
  const recipes = getAvailableHeroCraftRecipes(player, 'forge', forge)
  const decorated = recipes.filter(recipe => recipe.decorated)
  assert.ok(decorated.length > 0)
  assert.ok(decorated.every(recipe => equipmentVisualParts(recipe.outputEquipment)[1] === 'upward_horns_white'))
  const recipe = decorated[0]
  const hero = {
    type: 'Hero',
    i: 0,
    j: 0,
    inventory: {
      resources: { leather: 100, fiber: 100, bronzeIngot: 100, stone: 100, copperIngot: 100 },
      equipment: [],
    },
  }
  assert.equal(canCraftHeroRecipe(player, recipe, hero, forge), true)
  assert.ok(getMaxHeroCraftCount(player, recipe, hero, forge) > 0)
  assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), true)
  assert.deepEqual(hero.inventory.equipment, [recipe.outputEquipment])
  forge.owner.civ = 'Alba'
  const before = JSON.stringify(hero)
  assert.equal(canCraftHeroRecipe(player, recipe, hero, forge), false)
  assert.equal(getMaxHeroCraftCount(player, recipe, hero, forge), 0)
  assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), false)
  assert.equal(JSON.stringify(hero), before)
  assert.ok(getAvailableHeroCraftRecipes(player, 'forge', { owner: undefined }).every(recipe => !recipe.decorated))
})

test('plain helmets also follow the forge owner and stale foreign recipes are refused', () => {
  const player = { civ: 'Alba' }
  const forge = { i: 0, j: 0, owner: { civ: 'Nord' } }
  const recipes = getAvailableHeroCraftRecipes(player, 'forge', forge)
  assert.ok(recipes.some(recipe => recipe.id === 'helmet_norman_bronze'))
  assert.ok(!recipes.some(recipe => recipe.id.startsWith('helmet_bascinet_round')))
  const recipe = recipes.find(recipe => recipe.id === 'helmet_norman_bronze')
  const hero = {
    type: 'Hero',
    i: 0,
    j: 0,
    inventory: { resources: { leather: 100, fiber: 100, bronzeIngot: 100, stone: 100 }, equipment: [] },
  }
  assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), true)
  forge.owner.civ = 'Alba'
  const before = JSON.stringify(hero)
  assert.equal(canCraftHeroRecipe(player, recipe, hero, forge), false)
  assert.equal(getMaxHeroCraftCount(player, recipe, hero, forge), 0)
  assert.equal(craftHeroRecipe(player, hero, recipe, 1, forge), false)
  assert.equal(JSON.stringify(hero), before)
})
