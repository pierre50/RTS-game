const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const load = file => loadTsModule(file, options)
const condition = load('app/lib/equipment/equipmentCondition.ts')
const { wearEquippedWeapon } = load('app/lib/equipment/equipmentWear.ts')
const { getEquipmentRepairCost } = load('app/lib/equipment/equipmentRepair.ts')
const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')

test('weapons break on their exact last contact or shot and preserve the budget through saves', () => {
  for (const [item, uses, kind] of [
    ['spear_ceramic', 300, 'melee'],
    ['spear_bronze', 600, 'melee'],
    ['spear_iron', 900, 'melee'],
    ['sword_bronze', 600, 'melee'],
    ['sword_iron', 900, 'melee'],
    ['dagger_bronze', 600, 'melee'],
    ['dagger_iron', 900, 'melee'],
    ['mace_bronze', 600, 'melee'],
    ['mace_iron', 900, 'melee'],
    ['bow', 600, 'ranged'],
    ['bow_great', 600, 'ranged'],
    ['bow_recurve', 600, 'ranged'],
    ['slingshot', 300, 'ranged'],
  ]) {
    let unit = { type: 'Hero', inventory: { activeWeapons: { [kind]: item } } }
    assert.equal(condition.getEquipmentRemainingUses(item), uses)
    assert.equal(condition.getEquipmentRemainingUses(item + '~condition:50'), uses / 2)
    for (let n = 1; n < uses; n++) wearEquippedWeapon(unit, kind)
    assert.equal(condition.getEquipmentRemainingUses(unit.inventory.activeWeapons[kind]), 1, item)
    unit = JSON.parse(JSON.stringify(unit))
    wearEquippedWeapon(unit, kind)
    assert.equal(condition.isBrokenCombatWeapon(unit.inventory.activeWeapons[kind]), true, item)
    assert.equal(condition.withEquipmentDurability(unit.inventory.activeWeapons[kind], 100), item)
  }
})

test('legacy NPC percentage storage loses exactly one contact on each hit', () => {
  const api = loadTsModule('app/lib/equipment/equipmentWear.ts', {
    mocks: {
      './equipmentStats': {
        getConfiguredEntityEquipment: unit => [
          condition.withEquipmentDurability('sword_iron', unit.equipmentDurability.sword_iron),
        ],
        refreshUnitEquipmentStats() {},
      },
    },
  })
  const npc = { equipmentDurability: { sword_iron: 100 } }
  for (let i = 1; i <= 900; i++) {
    api.wearEquippedWeapon(npc, 'melee')
    const item = condition.withEquipmentDurability('sword_iron', npc.equipmentDurability.sword_iron)
    assert.equal(condition.getEquipmentRemainingUses(item), 900 - i)
  }
})

test('weapon repairs scale with their own recipe, never exceeding any ingredient of a new weapon', () => {
  const recipes = HERO_CRAFT_RECIPES.filter(r =>
    /^(sword_|spear_|mace_|dagger_|bow|slingshot$)/.test(r.outputEquipment)
  )
  for (const recipe of recipes) {
    for (const percent of [0, 20, 50, 99, 100]) {
      const actual = getEquipmentRepairCost(condition.withEquipmentDurability(recipe.outputEquipment, percent))
      const expected =
        percent === 100
          ? {}
          : Object.fromEntries(
              Object.entries(recipe.cost)
                .filter(([, n]) => n > 0)
                .map(([key, n]) => [key, Math.ceil(((n / recipe.outputCount) * 0.5 * (100 - percent)) / 100)])
            )
      assert.deepEqual(actual, expected, `${recipe.id} at ${percent}%`)
      for (const [key, n] of Object.entries(actual)) assert.ok(n <= recipe.cost[key] / recipe.outputCount)
    }
  }
  assert.deepEqual(getEquipmentRepairCost('bow~condition:0'), { wood: 3, sinew: 1 })
  for (const item of ['bow_great', 'bow_recurve'])
    assert.deepEqual(getEquipmentRepairCost(item + '~condition:0'), getEquipmentRepairCost('bow~condition:0'))
  assert.deepEqual(getEquipmentRepairCost('axe_ceramic~condition:0'), { stone: 6, wood: 2 })
  assert.deepEqual(getEquipmentRepairCost('armor_leather~condition:0'), { leather: 6 })
})

test('repair rounds ingredients after exact contact arithmetic, not percentage conversion', () => {
  const item = condition.withEquipmentRemainingUses('spear_iron', 600)
  assert.equal(getEquipmentRepairCost(item).wood, 1)
})
