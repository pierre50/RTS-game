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

test('hero arrow craft recipes spend global resources and add arrows to the hero bag', () => {
  const { HERO_ARROW_CRAFT_RECIPES, craftHeroRecipe } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'arrow_copper')
  const player = { wood: 8, food: 0, stone: 0, gold: 0, copper: 3, iron: 0 }
  const hero = {}

  assert.equal(craftHeroRecipe(player, hero, recipe), true)
  assert.equal(player.wood, 3)
  assert.equal(player.copper, 1)
  assert.equal(hero.inventory.equipment.length, 20)
  assert(hero.inventory.equipment.every(item => item === 'arrow_copper'))
})

test('hero craft refuses missing resources without changing inventory or resources', () => {
  const { HERO_ARROW_CRAFT_RECIPES, canCraftHeroRecipe, craftHeroRecipe, getMissingCraftResources } = loadCrafting()
  const recipe = HERO_ARROW_CRAFT_RECIPES.find(item => item.id === 'arrow_iron')
  const player = { wood: 4, food: 0, stone: 0, gold: 0, copper: 0, iron: 1 }
  const hero = { inventory: { equipment: ['arrow_ceramic'] } }

  assert.equal(canCraftHeroRecipe(player, recipe), false)
  assert.deepEqual(getMissingCraftResources(player, recipe.cost), { wood: 1, iron: 1 })
  assert.equal(craftHeroRecipe(player, hero, recipe), false)
  assert.deepEqual(player, { wood: 4, food: 0, stone: 0, gold: 0, copper: 0, iron: 1 })
  assert.deepEqual(hero.inventory.equipment, ['arrow_ceramic'])
})
