const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const load = file => loadTsModule(file, options)
const keys = ['spear_ceramic', 'spear_bronze', 'spear_iron']

test('spears craft by material, equip as melee, wear and repair without copper', () => {
  const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')
  const { getWeaponSlot } = load('app/lib/equipment/equipmentSlots.ts')
  const { isBrokenCombatWeapon } = load('app/lib/equipment/equipmentCondition.ts')
  const { getEquipmentRepairCost } = load('app/lib/equipment/equipmentRepair.ts')
  for (const [index, key] of keys.entries()) {
    const recipe = HERO_CRAFT_RECIPES.find(r => r.id === key)
    assert.equal(recipe.station, index === 0 ? 'inventory' : 'forge')
    assert.deepEqual(recipe.cost, {
      wood: 6,
      fiber: 1,
      [index === 0 ? 'stone' : index === 1 ? 'bronzeIngot' : 'ironIngot']: index === 0 ? 3 : 1,
    })
    assert.equal(getWeaponSlot(key), 'melee')
    assert.equal(isBrokenCombatWeapon(`${key}~condition:0`), true)
    assert.ok(
      Object.keys(getEquipmentRepairCost(`${key}~condition:40`)).includes(
        index === 0 ? 'stone' : index === 1 ? 'bronzeIngot' : 'ironIngot'
      )
    )
  }
  assert.ok(
    !HERO_CRAFT_RECIPES.some(r => r.id.includes('copper') || r.outputResource === 'copperIngot' || r.cost.copperIngot)
  )
  assert.deepEqual(
    HERO_CRAFT_RECIPES.filter(r => r.cost.copper).map(r => r.id),
    ['bronzeIngot']
  )
})

test('spears hit beyond sword reach while retaining a slash arc and no projectile range', () => {
  const { isContactTouching } = load('app/lib/contact/contactGeometry.ts')
  const { resolveContactActionProfile } = load('app/lib/contact/contactProfiles.ts')
  const config = require('../public/assets/data/gameplay/equipment.json')
  const actor = { family: 'unit', type: 'Hero', x: 0, y: 0, degree: 180 }
  const target = { family: 'unit', type: 'Villager', x: 62, y: 0 }
  assert.equal(isContactTouching(actor, target, 'sword_iron'), false)
  for (const key of keys) {
    assert.equal(isContactTouching(actor, target, key), true)
    assert.equal(resolveContactActionProfile(actor, key).halfAngle, 45)
    assert.equal(config[key].weapon.range, undefined)
  }
})

test('every spear walking, slash, dying and corpse runtime alias exists in its shared atlas', () => {
  const { dynamicEquipmentAliases, dynamicEquipmentAsset } = load('app/lib/lpc/equipment.ts')
  const atlas = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../public/assets/graphics/equipments/weapon/spear/texture.json'))
  )
  for (const key of keys) {
    assert.ok(dynamicEquipmentAsset(key).src.includes('/weapon/spear/'))
    const aliases = dynamicEquipmentAliases().filter(a => a.alias.startsWith(`equipments/${key}/`))
    assert.equal(aliases.length, 8)
    for (const alias of aliases) {
      const frames = Object.keys(atlas.frames).filter(k => k.endsWith(alias.frameSuffix))
      assert.ok(frames.length > 0, alias.alias)
      if (alias.alias.endsWith('/action')) assert.equal(frames.length, 27, alias.alias)
      if (alias.alias.endsWith('/dying')) assert.equal(frames.length, 6, alias.alias)
      if (alias.alias.endsWith('/corpse')) assert.equal(frames.length, 1, alias.alias)
    }
  }
})

test('spear slash advances nine weapon cells while repeating only the body poses', () => {
  const { getConfiguredActionFrameSequence, getActionAnimationReleaseFrame } = load(
    'app/lib/animations/actionFrameSequences.ts'
  )
  const { dynamicEquipmentLayersForEquipment } = load('app/lib/lpc/equipment.ts')
  const body = [0, 1, 2, 2, 3, 3, 4, 4, 5]
  const weapon = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  assert.deepEqual(getConfiguredActionFrameSequence({ action: 'attack', equipment: ['spear_iron'] }), body)
  assert.deepEqual(
    getConfiguredActionFrameSequence({
      action: 'interact',
      work: 'heroSword',
      inventory: { activeWeapons: { melee: 'spear_bronze' } },
    }),
    body
  )
  assert.equal(getActionAnimationReleaseFrame({ action: 'attack', equipment: ['spear_iron'] }, 'attack', 5), 8)
  for (const layer of dynamicEquipmentLayersForEquipment(['spear_iron'])) {
    assert.deepEqual(layer.actionFrameSequence, weapon)
  }
})

test('old copper tools and ingots migrate once, preserving wear and ore quantities', () => {
  const { migrateEquipmentRecord, isCurrentEquipment } = load('app/lib/equipment/equipmentMaterials.ts')
  const save = {
    units: [
      {
        inventory: {
          resources: { copper: 2, copperIngot: 4 },
          equipment: ['axe_copper~condition:37', 'pickaxe_copper'],
          activeWeapons: { tool: 'hammer_copper~condition:0' },
        },
      },
    ],
    buildings: [{ marketStock: ['scythe_copper'] }],
  }
  migrateEquipmentRecord(save)
  assert.deepEqual(save.units[0].inventory.resources, { copper: 14 })
  assert.deepEqual(save.units[0].inventory.equipment, ['axe_bronze~condition:37', 'pickaxe_bronze'])
  assert.equal(save.units[0].inventory.activeWeapons.tool, 'hammer_bronze~condition:0')
  assert.deepEqual(save.buildings[0].marketStock, ['scythe_bronze'])
  assert.equal(isCurrentEquipment('axe_copper'), false)
  const once = structuredClone(save)
  migrateEquipmentRecord(save)
  assert.deepEqual(save, once)
})

test('infantry receives the stone club across material tiers; halberds disappear and old equipment migrates', () => {
  const { dynamicEquipmentForUnit, DYNAMIC_EQUIPMENT_KEYS } = load('app/lib/lpc/equipment.ts')
  const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')
  const { migrateEquipmentRecord } = load('app/lib/equipment/equipmentMaterials.ts')
  for (const tier of [0, 2, 3]) {
    const issued = dynamicEquipmentForUnit('Fantassin', { forgeUpgrades: { weapons: tier } }, 0)
    assert.ok(issued.includes('club_ceramic'))
    assert.ok(!issued.some(key => key.startsWith('sword_')))
  }
  assert.ok(!DYNAMIC_EQUIPMENT_KEYS.includes('halberd'))
  assert.ok(!HERO_CRAFT_RECIPES.some(r => r.id === 'halberd'))
  const saved = {
    units: [
      {
        type: 'Fantassin',
        inventory: { equipment: ['sword_bronze~condition:31', 'halberd~condition:60'] },
        equipmentDurability: { sword_bronze: 31 },
      },
      { type: 'Hero', inventory: { equipment: ['sword_bronze', 'halberd~condition:60'] } },
    ],
  }
  migrateEquipmentRecord(saved)
  assert.deepEqual(saved.units[0].inventory.equipment, ['spear_bronze~condition:31', 'spear_iron~condition:60'])
  assert.deepEqual(saved.units[0].equipmentDurability, { spear_bronze: 31 })
  assert.deepEqual(saved.units[1].inventory.equipment, ['sword_bronze', 'spear_iron~condition:60'])
  const once = structuredClone(saved)
  migrateEquipmentRecord(saved)
  assert.deepEqual(saved, once)
})
