const test = require('node:test')
const assert = require('node:assert/strict')
const { loadGenerationTs: load } = require('../tools/maps/load-generation-ts.cjs')
const { isCurrentEquipment, migrateEquipmentRecord } = load('app/lib/equipment/equipmentMaterials.ts')
const { DYNAMIC_EQUIPMENT_KEYS, dynamicEquipmentForUnit, dynamicEquipmentForWork } = load('app/lib/lpc/equipment.ts')
const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')
const { FORGE_FAMILIES } = load('app/lib/equipment/forgeUpgrades.ts')
const { getMarketEquipmentOffers } = load('app/lib/equipment/equipmentMarket.ts')
const definitions = require('../public/assets/data/gameplay/equipment.json')
const parts = item => item.split('~condition:')[0].split(/~decor:|\+/)
const current = item => {
  for (const part of parts(item)) {
    assert.ok(isCurrentEquipment(part), item)
    assert.ok(DYNAMIC_EQUIPMENT_KEYS.includes(part), item)
    assert.ok(Object.hasOwn(definitions, part), item)
  }
}

test('all generated loadouts, market offers and forge gear use valid materials', () => {
  DYNAMIC_EQUIPMENT_KEYS.forEach(current)
  for (const recipe of HERO_CRAFT_RECIPES.filter(r => r.forgeGroup || r.category === 'arrows'))
    current(recipe.outputEquipment)
  for (const civ of ['Hellas', 'Latium', 'Kemet', 'Sumeria', 'Xia', 'Alba', 'Nord', 'Nobatia']) {
    getMarketEquipmentOffers({ civilization: civ }).forEach(offer => current(offer.equipment))
    for (let tier = 0; tier < 4; tier++) {
      const owner = { forgeUpgrades: Object.fromEntries(FORGE_FAMILIES.map(f => [f, tier])) }
      for (let level = 0; level <= 20; level++) {
        for (const unit of ['Chief', 'Fantassin', 'Bowman', 'Priest', 'BanditChief', 'BanditSword', 'BanditArcher'])
          dynamicEquipmentForUnit(unit, owner, level, civ).forEach(current)
      }
      for (const work of ['heroSword', 'woodcutter', 'stoneminer', 'goldminer', 'builder', 'farmer', 'hunter'])
        dynamicEquipmentForWork(work, owner).forEach(current)
    }
  }
  assert.ok(!HERO_CRAFT_RECIPES.some(r => r.id === 'armor_mail_bronze'))
  assert.ok(HERO_CRAFT_RECIPES.some(r => r.id === 'armor_mail_iron'))
  assert.deepEqual(HERO_CRAFT_RECIPES.find(r => r.id === 'round_shield_wood_slash').cost, { wood: 6, leather: 2 })
})

test('legacy inventories and corpse stock migrate without repairing or dropping quantities', () => {
  const player = {
    units: [
      {
        inventory: {
          equipment: ['sword_ceramic~condition:0', 'arrow_copper', 'arrow_copper'],
          equipped: { helmet: 'helmet_legion_copper~decor:centurion_plumage~condition:40' },
          equippedCounts: { arrow: 12 },
          activeWeapons: { melee: 'sword_copper' },
        },
      },
    ],
    corpses: [{ lootEquipment: ['armor_mail_bronze~condition:20'], equipmentDurability: { armor_mail_bronze: 20 } }],
    buildings: [
      {
        marketStock: ['round_shield_ceramic_slash', 'round_shield_ceramic_slash'],
        interiorBuildings: [{ inventory: { equipment: ['helmet_barbarian_ceramic'] } }],
      },
    ],
  }
  const bag = player.units[0].inventory.equipment
  migrateEquipmentRecord(player)
  assert.equal(player.units[0].inventory.equipment, bag)
  assert.deepEqual(player.units[0].inventory.equipment, ['sword_bronze~condition:0', 'arrow_ceramic', 'arrow_ceramic'])
  assert.equal(player.units[0].inventory.equipped.helmet, 'helmet_pointed_leather~decor:legion_plumage~condition:40')
  assert.equal(player.units[0].inventory.activeWeapons.melee, 'sword_bronze')
  assert.equal(player.units[0].inventory.equippedCounts.arrow, 12)
  assert.deepEqual(player.corpses[0].lootEquipment, ['armor_leather~condition:20'])
  assert.deepEqual(player.corpses[0].equipmentDurability, { armor_leather: 20 })
  assert.deepEqual(player.buildings[0].marketStock, ['round_shield_wood_slash', 'round_shield_wood_slash'])
  const once = structuredClone(player)
  migrateEquipmentRecord(player)
  assert.deepEqual(player, once)
})
