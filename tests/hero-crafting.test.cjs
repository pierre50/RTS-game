const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('craft recipes depend on the local forge level rather than player age', () => {
  const { getAvailableHeroCraftRecipes } = loadCrafting()
  const ids = age => getAvailableHeroCraftRecipes({ age }, undefined, { buildingLevel: 1 }).map(recipe => recipe.id)
  assert.deepEqual(ids(0), ids(2))
  for (const id of ['catchingPole', 'arrow_bronze', 'arrow_bronze', 'arrow_iron']) assert.ok(ids(0).includes(id))
})

function getHeroInventory(hero) {
  hero.inventory = hero.inventory ?? {}
  hero.inventory.equipment = hero.inventory.equipment ?? []
  return hero.inventory
}

function addHeroInventoryItem(hero, item, count = 1) {
  const inventory = getHeroInventory(hero)
  for (let index = 0; index < count; index++) inventory.equipment.push(item)
  hero.discoveredItems = hero.discoveredItems ?? []
  hero.discoveredItems.push(item)
  return true
}

function removeHeroInventoryItem(hero, item, count = 1) {
  const inventory = getHeroInventory(hero)
  const indexes = []
  for (let index = 0; index < inventory.equipment.length && indexes.length < count; index++) {
    if (inventory.equipment[index] === item) indexes.push(index)
  }
  if (indexes.length < count) return false
  for (let index = indexes.length - 1; index >= 0; index--) inventory.equipment.splice(indexes[index], 1)
  return true
}

function loadCrafting() {
  return loadModule('app/lib/hero/heroCrafting.ts', {
    '../equipment/equipmentLoot': { addHeroInventoryItem, removeHeroInventoryItem, getHeroInventory },
  })
}

test('single arrows preserve prepaid material portions and match a ten-arrow craft after save/load', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe, getMaxHeroCraftCount } = loadCrafting()
  const { unitData } = loadModule('app/serialization/entity/EntitySaveData.ts', {
    '../../lib': {
      filterObject: (object, keys) =>
        Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]])),
      getEntityMapSpace: () => null,
    },
  })
  for (const id of ['arrow_ceramic', 'arrow_bronze', 'arrow_iron']) {
    const recipe = HERO_CRAFT_RECIPES.find(item => item.id === id)
    const resources = Object.fromEntries(Object.entries(recipe.cost).map(([key, cost]) => [key, cost * 10]))
    let hero = { type: 'Hero', inventory: { resources: { ...resources }, equipment: [] } }
    const batchHero = structuredClone(hero)
    assert.equal(recipe.outputCount, 1)
    assert.equal(craftHeroRecipe({}, batchHero, recipe, 10, { buildingLevel: 1 }), true)
    for (let i = 0; i < 10; i++) {
      assert.equal(getMaxHeroCraftCount({}, recipe, hero, { buildingLevel: 1 }), 10 - i)
      assert.equal(craftHeroRecipe({}, hero, recipe, 1, { buildingLevel: 1 }), true)
      assert.equal(hero.inventory.equipment.length, i + 1)
      if (i === 0) {
        const beforeFailure = JSON.stringify(hero.inventory)
        assert.equal(craftHeroRecipe({}, hero, recipe, 10, { buildingLevel: 1 }), false)
        assert.equal(JSON.stringify(hero.inventory), beforeFailure)
      }
      // The inventory is serialized as part of the unit save state.
      hero = JSON.parse(JSON.stringify(unitData(hero)))
    }
    assert.deepEqual(hero.inventory, batchHero.inventory)
    assert.deepEqual(hero.inventory.resources, {})
    assert.equal(hero.inventory.craftingRemainders, undefined)
    assert.equal(craftHeroRecipe({}, hero, recipe, 1, { buildingLevel: 1 }), false)
  }
})

test('hero craft refuses missing resources without changing inventory or resources', () => {
  const { HERO_CRAFT_RECIPES, canCraftHeroRecipe, craftHeroRecipe, getMissingCraftResources, getHeroCraftPayment } =
    loadCrafting()
  const recipe = HERO_CRAFT_RECIPES.find(item => item.id === 'arrow_iron')
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
  const hero = {
    type: 'Hero',
    inventory: { equipment: ['arrow_ceramic'], resources: { wood: 4, feather: 1, iron: 1 } },
  }

  assert.equal(canCraftHeroRecipe(player, recipe, hero), false)
  assert.deepEqual(getMissingCraftResources(player, getHeroCraftPayment(recipe, hero).cost, hero), { ironIngot: 1 })
  assert.equal(craftHeroRecipe(player, hero, recipe), false)
  assert.deepEqual(player, { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 })
  assert.deepEqual(hero.inventory.resources, { wood: 4, feather: 1, iron: 1 })
  assert.deepEqual(hero.inventory.equipment, ['arrow_ceramic'])
})

test('hero bow craft spends wood and sinew and adds a bow to the bag', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_CRAFT_RECIPES.find(item => item.id === 'bow')
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0, sinew: 0 }
  const hero = { type: 'Hero', inventory: { resources: { wood: 5, sinew: 2 } } }

  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['bow'])
  assert.deepEqual(hero.discoveredItems, ['bow'])
})

test('hero catching pole craft works from age zero and spends wood and fiber', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_CRAFT_RECIPES.find(item => item.id === 'catchingPole')
  const player = { age: 1, wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0, fiber: 0 }
  const hero = { type: 'Hero', inventory: { resources: { wood: 4, fiber: 2 } } }

  player.age = 0
  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['catchingPole'])
  assert.deepEqual(hero.discoveredItems, ['catchingPole'])
})

test('hero plant crafts spend gathered herbs and add survival items to the bag', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
  const hero = {
    type: 'Hero',
    inventory: {
      resources: { herb: 2, toxicHerb: 2, fiber: 4 },
      equipment: [],
    },
  }

  assert.equal(
    craftHeroRecipe(
      player,
      hero,
      HERO_CRAFT_RECIPES.find(item => item.id === 'healing_poultice')
    ),
    true
  )
  assert.equal(
    craftHeroRecipe(
      player,
      hero,
      HERO_CRAFT_RECIPES.find(item => item.id === 'poison_vial')
    ),
    true
  )
  assert.equal(
    craftHeroRecipe(
      player,
      hero,
      HERO_CRAFT_RECIPES.find(item => item.id === 'fiber_bandage')
    ),
    true
  )

  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['healing_poultice', 'poison_vial', 'fiber_bandage'])
})

test('hero plant healing items are consumed to restore hit points', () => {
  const { useHeroConsumableItem } = loadCrafting()
  const hero = {
    hitPoints: 10,
    totalHitPoints: 30,
    inventory: { equipment: ['healing_poultice', 'fiber_bandage', 'poison_vial'] },
  }

  assert.equal(useHeroConsumableItem(hero, 'healing_poultice'), true)
  assert.equal(hero.hitPoints, 28)
  assert.deepEqual(hero.inventory.equipment, ['fiber_bandage', 'poison_vial'])

  assert.equal(useHeroConsumableItem(hero, 'fiber_bandage'), true)
  assert.equal(hero.hitPoints, 30)
  assert.deepEqual(hero.inventory.equipment, ['poison_vial'])
  assert.equal(useHeroConsumableItem(hero, 'poison_vial'), false)
})

test('crafted placeable items resolve to their building placements', () => {
  const { getPlaceableInventoryBuildingType } = loadModule('app/lib/hero/placeableInventoryItems.ts', {
    '../../constants': { BUILDING_TYPES: { chest: 'Chest', fireCamp: 'FireCamp', trap: 'Trap' } },
    './heroCrafting': { HERO_CAMPFIRE_ITEM: 'campfire', HERO_CHEST_ITEM: 'chest', HERO_TRAP_ITEM: 'trap' },
  })

  assert.equal(getPlaceableInventoryBuildingType('campfire'), 'FireCamp')
  assert.equal(getPlaceableInventoryBuildingType('chest'), 'Chest')
  assert.equal(getPlaceableInventoryBuildingType('trap'), 'Trap')
})

test('camp installations are construction options, not craft recipes', () => {
  const { HERO_CRAFT_RECIPES } = loadCrafting()
  for (const id of ['chest', 'campfire', 'trap'])
    assert.equal(
      HERO_CRAFT_RECIPES.some(recipe => recipe.id === id),
      false
    )
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  for (const [type, cost] of [
    ['Chest', { wood: 10 }],
    ['FireCamp', { wood: 8, stone: 2 }],
    ['Trap', { wood: 5, fiber: 2 }],
  ]) {
    assert.deepEqual(definitions[type].cost, cost)
    assert.equal(definitions[type].instantPlacement, undefined)
    assert.equal(definitions[type].constructionTime, 4)
    assert.equal(definitions[type].inventoryItem, undefined)
  }
})

test('campfire recipes are separate from forge equipment and ammunition', () => {
  const { getAvailableHeroCraftRecipes } = loadCrafting()
  const campfire = getAvailableHeroCraftRecipes({}, 'campfire')
  const forge = getAvailableHeroCraftRecipes({}, 'forge')
  assert.deepEqual(
    campfire.map(recipe => recipe.id),
    ['grilled_meat', 'poison_vial']
  )
  assert.ok(forge.length > 0)
  assert.ok(forge.every(recipe => ['equipment', 'arrows', 'ingots'].includes(recipe.category)))
  assert.ok(campfire.every(recipe => !forge.some(other => other.id === recipe.id)))
})

test('grilled meat costs two meat and can be consumed once to heal without exceeding maximum health', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe, useHeroConsumableItem } = loadCrafting()
  const recipe = HERO_CRAFT_RECIPES.find(recipe => recipe.id === 'grilled_meat')
  const hero = { type: 'Hero', hitPoints: 25, totalHitPoints: 30, inventory: { resources: { meat: 2 }, equipment: [] } }
  assert.equal(craftHeroRecipe({}, hero, recipe), true)
  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['grilled_meat'])
  assert.equal(craftHeroRecipe({}, hero, recipe), false)
  assert.equal(useHeroConsumableItem(hero, 'grilled_meat'), true)
  assert.equal(hero.hitPoints, 30)
  assert.deepEqual(hero.inventory.equipment, [])
  assert.equal(useHeroConsumableItem(hero, 'grilled_meat'), false)
})

test('maximum craft uses the limiting resource and spends all batches atomically', () => {
  const { HERO_CRAFT_RECIPES, getMaxHeroCraftCount, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_CRAFT_RECIPES.find(item => item.id === 'arrow_bronze')
  const player = {}
  const hero = { type: 'Hero', inventory: { resources: { wood: 27, feather: 7, bronzeIngot: 6 }, equipment: [] } }
  assert.equal(getMaxHeroCraftCount(player, recipe, hero), 54)
  assert.equal(craftHeroRecipe(player, hero, recipe, 55), false)
  assert.deepEqual(hero.inventory.resources, { wood: 27, feather: 7, bronzeIngot: 6 })
  assert.equal(craftHeroRecipe(player, hero, recipe, 50), true)
  assert.deepEqual(hero.inventory.resources, { wood: 2, feather: 7, bronzeIngot: 1 })
  assert.deepEqual(hero.inventory.equipment, Array(50).fill('arrow_bronze'))
  assert.equal(getMaxHeroCraftCount(player, recipe, hero), 4)
  for (const count of [0, -1, 1.5, Infinity, NaN]) assert.equal(craftHeroRecipe(player, hero, recipe, count), false)
  assert.equal(getMaxHeroCraftCount(player, recipe, null), 0)
})

test('forge recipes produce supported, equippable metal gear with localized labels and atomic costs', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const { DYNAMIC_EQUIPMENT_KEYS } = loadModule('app/lib/lpc/equipmentData.ts')
  const { getEquipmentSlot, getWeaponSlot } = loadModule('app/lib/equipment/equipmentSlots.ts')
  const { EN_CRAFTING_TRANSLATIONS, FR_CRAFTING_TRANSLATIONS } = loadModule('app/lib/i18n/craftingTranslations.ts')
  assert.equal(new Set(HERO_CRAFT_RECIPES.map(recipe => recipe.id)).size, HERO_CRAFT_RECIPES.length)
  const recipes = HERO_CRAFT_RECIPES.filter(recipe => recipe.forgeGroup && recipe.station === 'forge')
  assert.ok(recipes.length > 0)
  const { equipmentVisualParts } = loadModule('app/lib/equipment/helmetVariants.ts')
  for (const recipe of recipes) {
    assert.equal(recipe.station, 'forge')
    assert.ok(
      equipmentVisualParts(recipe.outputEquipment).every(part => DYNAMIC_EQUIPMENT_KEYS.includes(part)),
      recipe.id
    )
    assert.ok(getEquipmentSlot(recipe.outputEquipment) || getWeaponSlot(recipe.outputEquipment), recipe.id)
    for (const translations of [EN_CRAFTING_TRANSLATIONS, FR_CRAFTING_TRANSLATIONS]) {
      assert.ok(translations[recipe.descriptionKey], recipe.id)
      if (recipe.materialKey) assert.ok(translations[recipe.materialKey], recipe.id)
    }
    const hero = {
      type: 'Hero',
      inventory: {
        resources: Object.fromEntries(Object.entries(recipe.cost).map(([key, value]) => [key, Math.ceil(value)])),
        equipment: [],
      },
    }
    const player = { civ: recipe.civilizations?.[0] }
    assert.equal(craftHeroRecipe(player, hero, recipe, 1, { buildingLevel: 1, owner: player }), true, recipe.id)
    assert.deepEqual(hero.inventory.resources, {})
    assert.deepEqual(hero.inventory.equipment, [recipe.outputEquipment])
    assert.equal(craftHeroRecipe({}, hero, recipe), false)
    assert.deepEqual(hero.inventory.equipment, [recipe.outputEquipment])
  }
  for (const id of ['cape_solid', 'plumage']) {
    assert.equal(
      recipes.some(recipe => recipe.id === id),
      false
    )
  }
})

test('ore is smelted into resource stacks and bronze requires tin before crafting equipment', () => {
  const { HERO_CRAFT_RECIPES, craftHeroRecipe, getMaxHeroCraftCount } = loadCrafting()
  const recipe = id => HERO_CRAFT_RECIPES.find(value => value.id === id)
  const hero = { type: 'Hero', inventory: { equipment: [], resources: { copper: 4, tin: 2, wood: 6, leather: 1 } } }
  assert.deepEqual(recipe('bronzeIngot').cost, { copper: 2, tin: 1, wood: 2 })
  assert.equal(craftHeroRecipe({}, hero, recipe('sword_bronze')), false)
  assert.equal(getMaxHeroCraftCount({}, recipe('bronzeIngot'), hero), 2)
  assert.equal(craftHeroRecipe({}, hero, recipe('bronzeIngot'), 2), true)
  assert.deepEqual(hero.inventory.resources, { bronzeIngot: 2, wood: 2, leather: 1 })
  assert.deepEqual(hero.inventory.equipment, [])
  assert.equal(craftHeroRecipe({}, hero, recipe('sword_bronze')), true)
  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['sword_bronze'])
  hero.inventory.resources = { copper: 20, wood: 20 }
  assert.equal(craftHeroRecipe({}, hero, recipe('bronzeIngot')), false)
  assert.deepEqual(hero.inventory.resources, { copper: 20, wood: 20 })
  for (const [id, cost] of [['ironIngot', { iron: 3, wood: 2 }]]) {
    assert.deepEqual(recipe(id).cost, cost)
    hero.inventory.resources = { ...cost }
    assert.equal(craftHeroRecipe({}, hero, recipe(id), 1, { buildingLevel: 1 }), true)
    assert.deepEqual(hero.inventory.resources, { [id]: 1 })
  }
})

test('manual crafting exposes exactly the agreed equipment and remedies without a station', () => {
  const { getAvailableHeroCraftRecipes, craftHeroRecipe, getMaxHeroCraftCount } = loadCrafting()
  const recipes = getAvailableHeroCraftRecipes({ civ: 'Nord' }, 'inventory').filter(recipe => !recipe.decorated)
  assert.deepEqual(
    recipes.map(recipe => recipe.id).sort(),
    [
      'axe_ceramic',
      'pickaxe_ceramic',
      'hammer_ceramic',
      'scythe_ceramic',
      'spear_ceramic',
      'slingshot',
      'bow',
      'catchingPole',
      'arrow_ceramic',
      'armor_leather',
      'helmet_pointed_leather',
      'shoulder_legion_leather',
      'bracers_leather',
      'leg_armor_leather',
      'round_shield_wood_slash',
      'fiber_bandage',
      'healing_poultice',
    ].sort()
  )
  for (const recipe of recipes) {
    for (const station of ['forge', 'campfire'])
      assert.ok(!getAvailableHeroCraftRecipes({}, station).some(other => other.id === recipe.id))
    const hero = {
      type: 'Hero',
      inventory: {
        resources: Object.fromEntries(Object.entries(recipe.cost).map(([key, value]) => [key, Math.ceil(value)])),
        equipment: [],
      },
    }
    assert.equal(getMaxHeroCraftCount({}, recipe, hero), recipe.category === 'arrows' ? 2 : 1, recipe.id)
    assert.equal(craftHeroRecipe({}, hero, recipe), true, recipe.id)
    assert.deepEqual(hero.inventory.resources, {})
    assert.deepEqual(hero.inventory.equipment, Array(recipe.outputCount).fill(recipe.outputEquipment))
    if (recipe.category === 'arrows') assert.equal(craftHeroRecipe({}, hero, recipe), true)
    assert.equal(craftHeroRecipe({}, hero, recipe), false)
  }
})
