const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }

test('maces have two named, equippable materials in one forge row and in market stock', () => {
  const { FORGE_EQUIPMENT_RECIPES, groupForgeRecipeVariants } = loadTsModule(
    'app/lib/hero/heroForgeRecipes.ts',
    options
  )
  const { getMarketEquipmentOffers, resetMarketEquipmentStock } = loadTsModule(
    'app/lib/equipment/equipmentMarket.ts',
    options
  )
  const { getWeaponSlot } = loadTsModule('app/lib/equipment/equipmentSlots.ts', options)
  const { EQUIPMENT_NAMES } = loadTsModule('app/lib/i18n/equipmentNames.ts', options)
  const recipes = FORGE_EQUIPMENT_RECIPES.filter(recipe => recipe.id.startsWith('mace_'))
  assert.deepEqual(
    recipes.map(recipe => recipe.id),
    ['mace_bronze', 'mace_iron']
  )
  assert.equal(groupForgeRecipeVariants(recipes).length, 1)
  const market = { buildingLevel: 2, owner: { civ: 'Alba' } }
  resetMarketEquipmentStock(market)
  for (const material of ['bronze', 'iron']) {
    const id = `mace_${material}`
    assert.equal(getWeaponSlot(id), 'melee')
    assert.ok(EQUIPMENT_NAMES[id].fr.startsWith('Masse'))
    assert.ok(EQUIPMENT_NAMES[id].en.endsWith('mace'))
    assert.ok(
      getMarketEquipmentOffers({ buildingLevel: 2 }, market.marketStock).some(
        offer => offer.equipment === id && offer.goldValue > 0
      )
    )
    assert.deepEqual(recipes.find(recipe => recipe.id === id).cost, { [`${material}Ingot`]: 2, wood: 3, leather: 1 })
  }
})

test('mace combat, wear, repairs and forge upgrades use the selected material', () => {
  const { getEquipmentCombatStats } = loadTsModule('app/lib/equipment/equipmentStats.ts', options)
  const { getEquipmentRepairCost } = loadTsModule('app/lib/equipment/equipmentRepair.ts', options)
  const { withEquipmentDurability, isBrokenCombatWeapon } = loadTsModule(
    'app/lib/equipment/equipmentCondition.ts',
    options
  )
  const { resolveForgeEquipment } = loadTsModule('app/lib/equipment/forgeUpgrades.ts', options)
  const { wearEquippedWeapon } = loadTsModule('app/lib/equipment/equipmentWear.ts', options)
  const definitions = require('../public/assets/data/gameplay/equipment.json')
  for (const [material, power] of [
    ['bronze', 10],
    ['iron', 12],
  ]) {
    const id = `mace_${material}`
    assert.equal(getEquipmentCombatStats([id], definitions).weaponPower, power)
    assert.equal(isBrokenCombatWeapon(withEquipmentDurability(id, 0)), true)
    assert.equal(getEquipmentCombatStats([withEquipmentDurability(id, 0)], definitions).weaponPower, 0)
    assert.deepEqual(getEquipmentRepairCost(withEquipmentDurability(id, 50)), {
      [`${material}Ingot`]: 1,
      wood: 1,
      leather: 1,
    })
    const hero = { type: 'Hero', inventory: { activeWeapons: { melee: id } } }
    wearEquippedWeapon(hero, 'melee')
    assert.equal(hero.inventory.activeWeapons.melee, `${id}~uses:${material === 'bronze' ? 599 : 899}`)
  }
  assert.equal(resolveForgeEquipment('mace_bronze', { forgeUpgrades: { weapons: 0 } }), 'mace_bronze')
  assert.equal(resolveForgeEquipment('mace_bronze', { forgeUpgrades: { weapons: 3 } }), 'mace_iron')
})

test('mace runtime aliases resolve to generated walking, slash and death frames', () => {
  const { dynamicEquipmentAliases, dynamicEquipmentAsset } = loadTsModule('app/lib/lpc/equipment.ts', options)
  const atlas = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../public/assets/graphics/equipments/weapon/mace/texture.json'), 'utf8')
  )
  for (const id of ['mace_bronze', 'mace_iron']) {
    assert.ok(dynamicEquipmentAsset(id).src.includes('/weapon/mace/'))
    const aliases = dynamicEquipmentAliases().filter(alias => alias.alias.startsWith(`equipments/${id}/`))
    assert.equal(aliases.length, 8)
    for (const alias of aliases) {
      assert.ok(
        Object.keys(atlas.frames).some(key => key.endsWith(alias.frameSuffix)),
        alias.alias
      )
      if (alias.alias.endsWith('/action')) assert.equal(alias.animationSpeed, 0.25)
    }
  }
})
