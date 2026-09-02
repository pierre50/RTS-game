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

function getHeroInventory(hero) {
  hero.inventory = hero.inventory ?? {}
  hero.inventory.equipment = hero.inventory.equipment ?? []
  return hero.inventory
}

function loadCrafting() {
  return loadModule('app/lib/hero/heroCrafting.ts', {
    '../equipment/equipmentLoot': { getHeroInventory },
  })
}

test('hero arrow craft recipes spend hero bag resources and add arrows to the hero bag', () => {
  const { HERO_ARROW_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'arrow_copper')
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
  const hero = { type: 'Hero', inventory: { resources: { wood: 8, copper: 3 } } }

  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.deepEqual(hero.inventory.resources, { wood: 3, copper: 1 })
  assert.equal(hero.inventory.equipment.length, 20)
  assert(hero.inventory.equipment.every(item => item === 'arrow_copper'))
})

test('hero craft refuses missing resources without changing inventory or resources', () => {
  const { HERO_ARROW_CRAFT_RECIPES, canCraftHeroRecipe, craftHeroRecipe, getMissingCraftResources } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'arrow_iron')
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
  const hero = { type: 'Hero', inventory: { equipment: ['arrow_ceramic'], resources: { wood: 4, iron: 1 } } }

  assert.equal(canCraftHeroRecipe(player, recipe, hero), false)
  assert.deepEqual(getMissingCraftResources(player, recipe.cost, hero), { wood: 1, iron: 1 })
  assert.equal(craftHeroRecipe(player, hero, recipe), false)
  assert.deepEqual(player, { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 })
  assert.deepEqual(hero.inventory.resources, { wood: 4, iron: 1 })
  assert.deepEqual(hero.inventory.equipment, ['arrow_ceramic'])
})

test('hero chest craft can spend chest resources and adds a placeable chest to the bag', () => {
  const { HERO_ARROW_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'chest')
  const player = { label: 'p1', wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0, buildings: [] }
  player.buildings = [{ owner: player, type: 'Chest', inventory: { resources: { wood: 12 } } }]
  const hero = { owner: player, type: 'Hero' }

  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.deepEqual(player.buildings[0].inventory.resources, { wood: 7 })
  assert.deepEqual(hero.inventory.equipment, ['chest'])
})

test('hero campfire craft spends resources and adds a placeable campfire to the bag', () => {
  const { HERO_ARROW_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'campfire')
  const player = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
  const hero = { type: 'Hero', inventory: { resources: { wood: 8, stone: 2 } } }

  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(hero.inventory.equipment, ['campfire'])
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
