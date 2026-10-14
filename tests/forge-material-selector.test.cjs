const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const { FORGE_EQUIPMENT_RECIPES, groupForgeRecipeVariants } = loadTsModule('app/lib/hero/heroForgeRecipes.ts', options)
const { getAvailableHeroCraftRecipes } = loadTsModule('app/lib/hero/heroCrafting.ts', options)

test('leather and wooden equipment share their model row with metal variants', () => {
  const groups = groupForgeRecipeVariants(FORGE_EQUIPMENT_RECIPES)
  for (const [base, bronze] of [
    ['helmet_pointed_leather', 'helmet_pointed_bronze'],
    ['shoulder_legion_leather', 'shoulder_legion_bronze'],
    ['bracers_leather', 'bracers_bronze'],
    ['leg_armor_leather', 'leg_armor_bronze'],
    ['round_shield_wood_slash', 'round_shield_bronze_slash'],
  ]) {
    const group = groups.find(group => group.some(recipe => recipe.id === base))
    assert.ok(
      group.some(recipe => recipe.id === bronze),
      `${base} shares a row with ${bronze}`
    )
    assert.equal(group[0].id, base, 'the basic material is the first choice')
  }
  const leatherArmor = groups.find(group => group.some(recipe => recipe.id === 'armor_leather'))
  assert.deepEqual(
    leatherArmor.map(recipe => recipe.id),
    ['armor_leather']
  )
  const pointed = groups.find(group => group.some(recipe => recipe.id === 'helmet_pointed_leather'))
  assert.equal(pointed[0].id, 'helmet_pointed_leather')
  assert.equal(pointed[1].id, 'helmet_pointed_leather~decor:centurion_crest')
  assert.ok(pointed.findIndex(recipe => recipe.id === 'helmet_pointed_bronze') > 1)
  for (const recipe of FORGE_EQUIPMENT_RECIPES.filter(recipe => recipe.id.startsWith('helmet_pointed_leather~'))) {
    const group = groups.find(group => group.includes(recipe))
    assert.ok(group.some(variant => variant.id === recipe.id.replace('_leather', '_bronze')))
    assert.ok(group.every(variant => variant.id.startsWith('helmet_pointed_')))
  }
  assert.equal(groups.flat().length, FORGE_EQUIPMENT_RECIPES.length)
})

test('material groups preserve distinct helmet models and valid equipment assets', () => {
  const { DYNAMIC_EQUIPMENT_KEYS } = loadTsModule('app/lib/lpc/equipmentData.ts')
  const recipes = getAvailableHeroCraftRecipes({ civ: 'Nord' }, 'forge', { buildingLevel: 1, owner: { civ: 'Hellas' } })
  const groups = groupForgeRecipeVariants(recipes)
  const pointed = groups.find(group => group.some(recipe => recipe.id === 'helmet_pointed_bronze'))
  assert.deepEqual(
    pointed.map(recipe => recipe.id),
    ['helmet_pointed_bronze', 'helmet_pointed_bronze~decor:centurion_crest',
      'helmet_pointed_iron', 'helmet_pointed_iron~decor:centurion_crest']
  )
  for (const group of groups.filter(group => group[0].outputEquipment.startsWith('helmet_'))) {
    assert.equal(new Set(group.map(recipe => recipe.outputEquipment.split('~')[0].replace(/_(leather|ceramic|bronze|iron)$/, ''))).size, 1)
  }
  for (const recipe of FORGE_EQUIPMENT_RECIPES) {
    assert.ok(DYNAMIC_EQUIPMENT_KEYS.includes(recipe.outputEquipment.split('~')[0]))
  }
  assert.equal(groups.filter(group => group[0].category === 'arrows').length, 1)
  assert.equal(groups.filter(group => group[0].category === 'ingots').length, 2)
})

test('forge reuses the shared selector, retains row focus and crafts the selected recipe after changes', t => {
  const previous = global.document
  t.after(() => {
    global.document = previous
  })
  const element = () => ({
    childNodes: [],
    dataset: {},
    attributes: {},
    classList: { add() {} },
    appendChild(child) {
      this.childNodes.push(child)
    },
    replaceChildren(...children) {
      this.childNodes = children
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    addEventListener(name, handler) {
      this[name] = handler
    },
    focus() {},
  })
  global.document = { createElement: element }
  const selectorOptions = {
    moduleCache: new Map(),
    mocks: {
      './HeroForgeInventory': { createForgeRepairInventory() {} },
      './HeroCraftingBody': { HeroCraftingBody: class {} },
      '../../lib/lang': { t: key => key },
      '../lang': { t: key => key },
    },
  }
  const { HeroForgeBody } = loadTsModule('app/ui/hero-building/HeroForgeBody.ts', selectorOptions)
  const { getVariantRow } = loadTsModule('app/lib/ui/VariantRow.ts', selectorOptions)
  const host = Object.create(HeroForgeBody.prototype)
  let crafted
  host.createCraftButton = recipe => {
    const row = element()
    row.title = recipe.id
    row.setAttribute('aria-label', recipe.id)
    row.appendChild({
      craft: () => {
        crafted = recipe.outputEquipment
      },
    })
    return row
  }
  const recipes = groupForgeRecipeVariants(FORGE_EQUIPMENT_RECIPES).find(group =>
    group.some(recipe => recipe.id === 'helmet_pointed_leather')
  )
  const grid = element()
  host.appendMaterialRow(grid, recipes)
  const row = grid.childNodes[0]
  getVariantRow(row).step(1)
  assert.equal(grid.childNodes[0], row)
  row.childNodes[0].craft()
  assert.equal(crafted, 'helmet_pointed_leather~decor:centurion_crest')
  assert.equal(row.title, 'helmet_pointed_leather~decor:centurion_crest')
  const refreshed = element()
  host.appendMaterialRow(refreshed, recipes)
  assert.equal(refreshed.childNodes[0].title, 'helmet_pointed_leather~decor:centurion_crest')
})
