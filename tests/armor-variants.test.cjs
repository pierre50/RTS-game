const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const variants = loadTsModule('app/lib/equipment/armorVariants.ts')
const condition = loadTsModule('app/lib/equipment/equipmentCondition.ts')
const slots = loadTsModule('app/lib/equipment/equipmentSlots.ts')
const torso = 'armor_mail_iron'
const shoulder = 'shoulder_legion_iron'
const combined = `${torso}~decor:cape_solid+${shoulder}`
const worn = item => condition.withEquipmentDurability(item, 25)

test('legacy torso splits into independently worn pieces, removes capes and preserves damage', () => {
  assert.deepEqual(variants.bundleEquipmentParts([worn(combined), 'cape_solid', shoulder]), [
    worn(torso),
    worn(shoulder),
    shoulder,
  ])
  assert.ok(slots.HERO_EQUIPMENT_SLOTS.includes('shoulders'))
  assert.ok(!slots.HERO_EQUIPMENT_SLOTS.includes('cape'))
  assert.equal(slots.getEquipmentSlot('cape_solid'), null)
})

test('equipped migration is idempotent, preserves existing shoulders and stores extra pieces', () => {
  const inventory = {
    equipped: { armor: worn(combined), cape: 'cape_solid' },
    equippedCounts: { armor: 1, cape: 1 },
    equipment: [combined, 'cape_solid'],
  }
  variants.migrateEquipmentInventory(inventory)
  assert.deepEqual(inventory.equipped, { armor: worn(torso), shoulders: worn(shoulder) })
  assert.deepEqual(inventory.equippedCounts, { armor: 1, shoulders: 1 })
  assert.deepEqual(inventory.equipment, [torso, shoulder])
  const saved = JSON.stringify(inventory)
  variants.migrateEquipmentInventory(inventory)
  assert.equal(JSON.stringify(inventory), saved)
  const occupied = { equipped: { armor: worn(combined), shoulders: shoulder }, equipment: [] }
  variants.migrateEquipmentInventory(occupied)
  assert.deepEqual(occupied.equipped, { armor: worn(torso), shoulders: shoulder })
  assert.deepEqual(occupied.equipment, [worn(shoulder)])
})

test('shoulders can be looted and equipped without taking the torso', () => {
  const loot = loadTsModule('app/lib/equipment/equipmentLoot.ts', {
    mocks: { './equipmentStats': { refreshUnitEquipmentStats() {} }, '../lpc': { refreshBakedLpcUnitAssets() {} } },
  })
  const corpse = { isDead: true, lootEquipment: [worn(combined)] }
  const hero = { inventory: { equipment: [] } }
  assert.deepEqual(loot.getUnitCorpseLootEquipment(corpse), [worn(torso), worn(shoulder)])
  assert.equal(loot.pickupCorpseEquipment(corpse, hero, worn(shoulder)), true)
  assert.deepEqual(corpse.lootEquipment, [worn(torso)])
  assert.equal(loot.equipHeroInventoryItem(hero, worn(shoulder)), true)
  assert.deepEqual(hero.inventory.equipped, { shoulders: worn(shoulder) })
  assert.equal(loot.unequipHeroInventorySlot(hero, 'shoulders'), true)
  assert.deepEqual(hero.inventory.equipment, [worn(shoulder)])
})

test('helmet decorations stay bundled and standalone shoulders never merge into torsos', () => {
  assert.deepEqual(variants.bundleEquipmentParts([torso, shoulder, 'helmet_legion_iron', 'plumage']), [
    torso,
    shoulder,
    'helmet_legion_iron~decor:plumage',
  ])
  const { equipmentVisualParts } = loadTsModule('app/lib/equipment/helmetVariants.ts')
  assert.deepEqual(equipmentVisualParts(combined), [torso, shoulder])
})
