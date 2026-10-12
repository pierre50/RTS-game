const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  getEquipmentSlot,
  getWeaponSlot,
  HERO_EQUIPMENT_SLOTS,
  getHeroEquipmentSlotLabelKey,
  formatEquipmentLootLabel,
  formatEquipmentStackLabel,
} = loadTsModule('app/lib/equipment/equipmentSlots.ts')

test('equipment classification distinguishes armor, helmet decorations and weapon slots', () => {
  const armor = {
    helmet_iron: 'helmet',
    cloth_hood_red: 'helmet',
    cape_red: null,
    armor_iron: 'armor',
    leg_iron: 'legs',
    shoulder_iron: 'shoulders',
    bracers_iron: 'bracers',
    round_shield_wood: 'offhand',
    arrow_wood: 'arrow',
  }
  for (const [item, slot] of Object.entries(armor)) assert.equal(getEquipmentSlot(item), slot, item)
  for (const prefix of [
    'upward_horns',
    'helmet_wings',
    'plumage',
    'centurion_crest',
    'centurion_plumage',
    'legion_plumage',
    'crest',
  ]) {
    const expected = 'helmetDecor'
    assert.equal(getEquipmentSlot(prefix), expected)
    assert.equal(getEquipmentSlot(`${prefix}_red`), expected)
  }
  for (const [item, slot] of Object.entries({
    quiver: null,
    catchingPole: 'melee',
    bow: 'ranged',
    bow_recurve: 'ranged',
    sword_iron: 'melee',
    axe_iron: 'tool',
    pickaxe_bronze: 'tool',
    hammer_copper: 'tool',
    scythe_ceramic: 'tool',
    longsword: 'melee',
    spear_iron: 'melee',
    cane: 'melee',
    longstick: 'melee',
  })) {
    assert.equal(getWeaponSlot(item), slot, item)
    assert.equal(getEquipmentSlot(item), null, item)
  }
  for (const item of ['', 'unknown', 'crestfallen']) assert.equal(getEquipmentSlot(item), null)
  assert.equal(getWeaponSlot('armor_iron'), null)
  for (const slot of HERO_EQUIPMENT_SLOTS) assert.match(getHeroEquipmentSlotLabelKey(slot), /^heroEquipmentSlot/)
})

test('loot labels use catalog names and display stack counts only above one', () => {
  assert.equal(formatEquipmentLootLabel('sword_iron'), 'Épée en fer')
  assert.equal(formatEquipmentLootLabel('unknown'), 'Équipement inconnu')
  assert.equal(formatEquipmentLootLabel(''), 'Équipement inconnu')
  assert.equal(formatEquipmentStackLabel('arrow_ceramic'), 'Flèche en pierre')
  assert.equal(formatEquipmentStackLabel('arrow_ceramic', 3), 'Flèche en pierre x3')
})
