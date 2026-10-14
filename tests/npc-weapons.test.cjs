const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { Assets } = require('pixi.js')
const equipment = require('../public/assets/data/gameplay/equipment.json')
Assets.cache.set('config', { equipment })
const api = loadTsModule('app/lib/units/combat/npcWeapons.ts')
const stats = loadTsModule('app/lib/equipment/equipmentStats.ts')
const { wearEquippedWeapon } = loadTsModule('app/lib/equipment/equipmentWear.ts', {
  mocks: { '../lang': { t: key => key } },
})
const { canAttack } = loadTsModule('app/lib/combat/combatCapabilities.ts')
const { syncNpcWeaponAppearance } = loadTsModule('app/lib/units/visuals/npcWeaponAppearance.ts')
const arrows = loadTsModule('app/lib/units/combat/unitArrows.ts')

function npc(items, extra = {}) {
  return {
    family: 'unit',
    type: 'Infantry',
    gender: 'female',
    action: 'attack',
    x: 0,
    y: 0,
    i: 0,
    j: 0,
    hitPoints: 20,
    dest: { family: 'unit', type: 'Hero', x: 160, y: 0, i: 5, j: 0, hitPoints: 100 },
    inventory: { npcWeaponsInitialized: true, equipment: [...items] },
    owner: { config: { equipment, units: {} } },
    ...extra,
  }
}

for (const type of ['Infantry', 'Bowman', 'BanditArcher', 'BanditSword', 'BanditChief', 'Chief', 'Priest']) {
  for (const gender of ['male', 'female']) {
    test(`${type} ${gender} chooses from carried items, independent of role and gender`, () => {
      const unit = npc(['dagger_bronze', 'sword_iron', 'bow', 'arrow_ceramic'], { type, gender })
      assert.equal(api.getNpcWeaponChoice(unit).kind, 'ranged')
      assert.deepEqual(api.getNpcActiveCombatEquipment(unit), ['bow', 'quiver', 'arrow_ceramic'])
      assert.equal(stats.getEntityWeaponPower(unit), equipment.bow.weapon.power + equipment.arrow_ceramic.weapon.power)
      unit.dest.x = 30
      assert.equal(api.getNpcWeaponChoice(unit).weapon, 'sword_iron')
      assert.equal(stats.getUnitCombatRange(unit), undefined)
      assert.equal(stats.getEntityWeaponPower(unit), equipment.sword_iron.weapon.power)
      unit.dest.x = 160
      unit.inventory.equipment.pop()
      assert.equal(api.getNpcWeaponChoice(unit).weapon, 'sword_iron')
      assert.equal(canAttack(unit), true)
    })
  }
}

test('a broken weapon switches to the next carried copy, then another weapon, then fists', () => {
  const unit = npc(['sword_iron~uses:1', 'sword_iron~uses:1', 'dagger_bronze~uses:1'])
  for (const expected of ['sword_iron~uses:1', 'sword_iron~uses:1', 'dagger_bronze~uses:1']) {
    assert.equal(api.getNpcWeaponChoice(unit).weapon, expected)
    wearEquippedWeapon(unit, 'melee')
  }
  assert.deepEqual(api.getNpcWeaponChoice(unit), { kind: 'melee', index: -1 })
  assert.equal(stats.getEntityWeaponPower(unit), 0.5)
  assert.equal(canAttack(unit), true)
  assert.equal(unit.inventory.equipment.filter(item => item.endsWith('~condition:0')).length, 3)
})

test('last arrow wears the bow that fired it, then selects the best melee weapon', () => {
  const unit = npc(['bow~uses:1', 'arrow_iron', 'mace_iron'])
  const fired = api.getNpcWeaponChoice(unit)
  assert.equal(arrows.consumeNpcArrow(unit), 'arrow_iron')
  wearEquippedWeapon(unit, 'ranged', fired.index)
  assert.equal(unit.inventory.equipment[0], 'bow~condition:0')
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'mace_iron')
  assert.equal(stats.getEntityWeaponPower(unit), equipment.mace_iron.weapon.power)
})

test('broken bows are skipped even with ammunition, and a spare bow is selected', () => {
  const unit = npc(['bow~condition:0', 'bow~uses:1', 'arrow_bronze'])
  assert.equal(api.getNpcWeaponChoice(unit).index, 1)
  wearEquippedWeapon(unit, 'ranged')
  assert.equal(api.getNpcWeaponChoice(unit).weapon, undefined)
  assert.equal(stats.getUnitCombatRange(unit), undefined)
})

test('inventory migration preserves old wear and never replenishes removed weapons after save/load', () => {
  const unit = npc(['dagger_bronze'], {
    inventory: { equipment: ['dagger_bronze'], npcArrows: { initialized: true } },
    equipmentDurability: { bow: 0 },
  })
  api.initializeNpcWeapons(unit, ['bow', 'dagger_bronze', 'arrow_ceramic', 'quiver'])
  assert.deepEqual(unit.inventory.equipment, ['dagger_bronze', 'bow~condition:0'])
  unit.inventory.equipment = []
  const restored = JSON.parse(JSON.stringify(unit))
  api.initializeNpcWeapons(restored, ['bow', 'dagger_bronze'])
  assert.deepEqual(restored.inventory.equipment, [])
  assert.equal(canAttack(restored), true)
})

test('removing the active weapon changes damage and visuals; restoring an arrow permits shooting again', () => {
  const base = { layers: [{ equipmentKey: 'armor_leather' }, { equipmentKey: 'sword_bronze' }] }
  const unit = npc(['bow', 'arrow_ceramic', 'dagger_iron'], { appearance: base })
  syncNpcWeaponAppearance(unit)
  let keys = unit.appearance.layers.map(layer => layer.equipmentKey)
  assert.ok(keys.includes('bow') && keys.includes('quiver'))
  assert.ok(!keys.includes('sword_bronze') && !keys.includes('dagger_iron'))
  unit.inventory.equipment.splice(0, 1)
  syncNpcWeaponAppearance(unit)
  keys = unit.appearance.layers.map(layer => layer.equipmentKey)
  assert.ok(keys.includes('dagger_iron') && !keys.includes('quiver') && !keys.includes('bow'))
  unit.inventory.equipment = []
  syncNpcWeaponAppearance(unit)
  assert.deepEqual(
    unit.appearance.layers.map(layer => layer.equipmentKey),
    ['armor_leather']
  )
  unit.action = 'farm'
  syncNpcWeaponAppearance(unit)
  assert.equal(unit.appearance, base)
})

test('the controlled hero keeps manual equipment control', () => {
  for (const unit of [npc(['bow'], { type: 'Hero' }), npc(['bow'], { controlMode: 'hero' })]) {
    assert.equal(api.hasNpcWeaponInventory(unit), false)
  }
})

test('corpse loot keeps every remaining weapon copy and its condition without duplicating issued weapons', () => {
  const { getUnitCorpseLootEquipment } = loadTsModule('app/lib/equipment/equipmentLoot.ts', {
    mocks: { '../lang': { t: key => key }, '../lpc': { refreshBakedLpcUnitAssets() {} } },
  })
  const unit = npc(['bow~condition:0', 'sword_iron~condition:45', 'sword_iron', 'arrow_iron'], {
    isDead: true,
    equipment: ['bow', 'sword_iron'],
  })
  unit.owner.config.units.Villager = { equipment: ['bow', 'sword_iron'] }
  const loot = getUnitCorpseLootEquipment(unit)
  assert.deepEqual(loot.sort(), ['arrow_iron', 'bow~condition:0', 'sword_iron', 'sword_iron~condition:45'].sort())
  assert.deepEqual(unit.inventory.equipment, [])
  assert.deepEqual(getUnitCorpseLootEquipment(unit), loot)
})

test('receiving a bow after initialization does not grant a second starting arrow allowance', () => {
  const unit = npc(['sword_iron'])
  arrows.initializeNpcArrows(unit)
  unit.inventory.equipment.push('bow')
  arrows.initializeNpcArrows(unit)
  assert.equal(arrows.hasUnitArrow(unit), false)
  unit.inventory.equipment.push('arrow_ceramic')
  assert.equal(api.getNpcWeaponChoice(unit).kind, 'ranged')
})

for (const gender of ['male', 'female']) {
  test(`a ${gender} villager carries war weapons but only fights with tools or light weapons`, () => {
    const unit = npc(['sword_iron', 'spear_iron', 'mace_iron', 'dagger_bronze'], {
      type: 'Villager',
      gender,
    })
    assert.equal(api.getNpcWeaponChoice(unit).weapon, 'dagger_bronze')
    assert.equal(stats.getEntityWeaponPower(unit), equipment.dagger_bronze.weapon.power)
    syncNpcWeaponAppearance(unit)
    assert.deepEqual(
      new Set(unit.appearance.layers.filter(layer => layer.equipmentKey).map(layer => layer.equipmentKey)),
      new Set(['dagger_bronze'])
    )
    unit.inventory.equipment.pop()
    assert.equal(api.getNpcWeaponChoice(unit).weapon, undefined)
    assert.equal(stats.getEntityWeaponPower(unit), 0.5)
    assert.equal(unit.inventory.equipment.length, 3)
    for (const item of [
      'axe_iron',
      'pickaxe_iron',
      'hammer_iron',
      'scythe_iron',
      'dagger_iron',
      'bow',
      'bow_great',
      'bow_recurve',
      'slingshot',
    ]) {
      assert.equal(api.canNpcWieldWeapon(unit, item), true, item)
    }
    unit.inventory.equipment.push('bow', 'arrow_iron')
    assert.equal(api.getNpcWeaponChoice(unit).weapon, 'bow')
    unit.type = 'Infantry'
    unit.dest.x = 30
    assert.equal(api.getNpcWeaponChoice(unit).weapon, 'sword_iron')
  })
}

test('an NPC immediately selects a stronger sword transferred from the hero and falls back when it breaks', () => {
  const { moveInventoryEquipment } = loadTsModule('app/lib/inventory/inventoryContainers.ts')
  const unit = npc(['dagger_bronze'], { type: 'Priest' })
  const sword = 'sword_iron~uses:1'
  const source = { id: 'hero', labelKey: 'hero', inventory: { equipment: [sword] } }
  const destination = { id: 'npc', labelKey: 'npc', inventory: unit.inventory }
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'dagger_bronze')
  assert.equal(moveInventoryEquipment(source, destination, sword), true)
  assert.deepEqual(source.inventory.equipment, [])
  assert.equal(api.getNpcWeaponChoice(unit).weapon, sword)
  assert.equal(stats.getEntityWeaponPower(unit), equipment.sword_iron.weapon.power)
  syncNpcWeaponAppearance(unit)
  assert.ok(unit.appearance.layers.some(layer => layer.equipmentKey === 'sword_iron'))
  wearEquippedWeapon(unit, 'melee')
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'dagger_bronze')
})

test('bandit combat axes migrate once to their issued weapon without restoring missing items', () => {
  for (const [type, replacement] of [
    ['BanditChief', 'mace_bronze'],
    ['BanditSword', 'club_ceramic'],
  ]) {
    const unit = npc(['axe_ceramic~condition:37'], { type })
    api.initializeNpcWeapons(unit, [replacement])
    assert.deepEqual(unit.inventory.equipment, [`${replacement}~condition:37`])
    assert.equal(api.getNpcWeaponChoice(unit).weapon, `${replacement}~condition:37`)
    const restored = JSON.parse(JSON.stringify(unit))
    restored.inventory.equipment = ['axe_iron']
    api.initializeNpcWeapons(restored, [replacement])
    assert.deepEqual(restored.inventory.equipment, ['axe_iron'])
    assert.equal(api.getNpcWeaponChoice(restored).weapon, undefined)
    const empty = npc([], { type })
    api.initializeNpcWeapons(empty, [replacement])
    assert.deepEqual(empty.inventory.equipment, [])
  }
})

test('tools in an NPC bag never substitute for weapons; an equipped tool can still strike', () => {
  const unit = npc(['axe_iron', 'pickaxe_iron', 'hammer_iron', 'scythe_iron'])
  assert.equal(api.getNpcWeaponChoice(unit).weapon, undefined)
  unit.inventory.activeWeapons = { tool: unit.inventory.equipment.shift() }
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'axe_iron')
  assert.equal(api.getNpcWeaponChoice(unit).index, -2)
  assert.equal(stats.getEntityWeaponPower(unit), equipment.axe_iron.weapon.power)
})

test('Bandit1 loadout and appearance use a mace, Bandit2 the stone club', () => {
  const { createPlayerData } = loadTsModule('app/config/playerConfig.ts')
  const { dynamicEquipmentForUnit, dynamicEquipmentAsset } = loadTsModule('app/lib/lpc/equipment.ts')
  const config = createPlayerData({ units: {}, buildings: {}, projectiles: {}, equipment }, 'Alba')
  for (const [type, weapon] of [
    ['BanditChief', 'mace_bronze'],
    ['BanditSword', 'club_ceramic'],
  ]) {
    assert.ok(config.units[type].equipment.includes(weapon))
    assert.ok(!config.units[type].equipment.some(item => item.startsWith('axe_')))
    assert.ok(dynamicEquipmentForUnit(type, {}, 0, 'Alba').includes(weapon))
    const unit = npc([], { type, inventory: {}, owner: { config } })
    api.initializeNpcWeapons(unit, config.units[type].equipment)
    assert.equal(api.getNpcWeaponChoice(unit).weapon, weapon)
    syncNpcWeaponAppearance(unit)
    assert.ok(unit.appearance.layers.some(layer => layer.equipmentKey === weapon))
  }
  const fs = require('node:fs')
  const path = require('node:path')
  const asset = dynamicEquipmentAsset('axe_ceramic')
  assert.ok(asset.src.includes('/tool/axe/'))
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', asset.src)))
})

for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
  test(`a villager fights with its equipped ${family}, with correct damage, appearance and wear`, () => {
    const unit = npc(['axe_iron'], { type: 'Villager' })
    unit.inventory.activeWeapons = { tool: `${family}_bronze~uses:1` }
    assert.equal(api.getNpcWeaponChoice(unit).weapon, `${family}_bronze~uses:1`)
    assert.equal(stats.getEntityWeaponPower(unit), equipment[`${family}_bronze`].weapon.power)
    syncNpcWeaponAppearance(unit)
    assert.ok(unit.appearance.layers.some(layer => layer.equipmentKey === `${family}_bronze`))
    wearEquippedWeapon(unit, 'melee')
    assert.equal(unit.inventory.activeWeapons.tool, `${family}_bronze~condition:0`)
    assert.equal(api.getNpcWeaponChoice(unit).weapon, undefined)
    assert.equal(stats.getEntityWeaponPower(unit), 0.5)
    syncNpcWeaponAppearance(unit)
    assert.ok(!unit.appearance.layers.some(layer => layer.equipmentKey === `${family}_bronze`))
  })
}

test('usable combat weapon takes priority over a stronger tool; broken weapons fall back to that tool', () => {
  const unit = npc(['dagger_bronze'], { type: 'Villager' })
  unit.owner = { config: { equipment: { ...equipment, dagger_bronze: { weapon: { power: 1 } } } } }
  unit.inventory.activeWeapons = { tool: 'axe_iron' }
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'dagger_bronze')
  unit.inventory.equipment[0] = 'dagger_bronze~condition:0'
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'axe_iron')
  unit.inventory.toolsStowed = true
  assert.equal(api.getNpcWeaponChoice(unit).weapon, undefined)
})

test('a ranged NPC uses its tool at contact or when ammunition runs out', () => {
  const unit = npc(['bow', 'arrow_ceramic'], { type: 'Villager' })
  unit.inventory.activeWeapons = { tool: 'pickaxe_bronze' }
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'bow')
  unit.dest.x = 10
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'pickaxe_bronze')
  unit.dest.x = 160
  unit.inventory.equipment.pop()
  assert.equal(api.getNpcWeaponChoice(unit).weapon, 'pickaxe_bronze')
})
