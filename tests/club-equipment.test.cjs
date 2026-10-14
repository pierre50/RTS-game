const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const load = file => loadTsModule(file, { moduleCache: new Map() })
const key = 'club_ceramic'

test('stone club can be crafted, equipped, worn and repaired as a melee weapon', () => {
  const { HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCraftRecipes.ts')
  const { getWeaponSlot } = load('app/lib/equipment/equipmentSlots.ts')
  const { getEquipmentMaxUses, isBrokenCombatWeapon } = load('app/lib/equipment/equipmentCondition.ts')
  const { getEquipmentRepairCost } = load('app/lib/equipment/equipmentRepair.ts')
  const recipe = HERO_CRAFT_RECIPES.find(value => value.id === key)
  assert.equal(recipe.station, 'inventory')
  assert.equal(recipe.forgeGroup, 'weapons')
  assert.deepEqual(recipe.cost, { stone: 4, wood: 3, fiber: 2 })
  assert.equal(getWeaponSlot(key), 'melee')
  assert.equal(getEquipmentMaxUses(key), 300)
  assert.equal(isBrokenCombatWeapon(`${key}~condition:0`), true)
  assert.ok(getEquipmentRepairCost(`${key}~condition:40`).stone > 0)
})

test('stone club damage and contact match its early-game tier', () => {
  const config = require('../public/assets/data/gameplay/equipment.json')
  const { resolveContactActionProfile } = load('app/lib/contact/contactProfiles.ts')
  const { getEquipmentGoldValue } = load('app/lib/equipment/equipmentMarket.ts')
  const actor = { family: 'unit', type: 'Hero' }
  assert.equal(config[key].weapon.power, 6)
  assert.ok(config[key].weapon.power > config.spear_ceramic.weapon.power)
  assert.ok(config[key].weapon.power < config.mace_bronze.weapon.power)
  assert.equal(resolveContactActionProfile(actor, key).reach, 32)
  assert.equal(getEquipmentGoldValue(key), 135)
})

test('stone club slash reverses body and weapon together', () => {
  const { getConfiguredActionFrameSequence } = load('app/lib/animations/actionFrameSequences.ts')
  const { dynamicEquipmentLayersForEquipment } = load('app/lib/lpc/equipment.ts')
  const sequence = [5, 4, 3, 2, 1, 0]
  assert.deepEqual(getConfiguredActionFrameSequence({ action: 'attack', equipment: [key] }), sequence)
  assert.deepEqual(
    getConfiguredActionFrameSequence({
      action: 'interact',
      work: 'heroSword',
      inventory: { activeWeapons: { melee: `${key}~uses:240` } },
    }),
    sequence
  )
  const layers = dynamicEquipmentLayersForEquipment([key])
  assert.equal(layers.length, 2)
  for (const layer of layers) {
    assert.equal(layer.actionFrameSequence, undefined)
  }
})

test('stone club runtime atlas has walk, slash, hurt and corpse layers', () => {
  const { dynamicEquipmentAliases, dynamicEquipmentAsset } = load('app/lib/lpc/equipment.ts')
  const asset = dynamicEquipmentAsset(key)
  assert.ok(asset.src.includes('/weapon/club/'))
  const atlasPath = path.join(__dirname, '../public/assets/graphics/equipments/weapon/club/texture.json')
  assert.ok(fs.existsSync(atlasPath))
  const atlas = JSON.parse(fs.readFileSync(atlasPath))
  const aliases = dynamicEquipmentAliases().filter(alias => alias.alias.startsWith(`equipments/${key}/`))
  assert.equal(aliases.length, 8)
  for (const alias of aliases) {
    const frames = Object.keys(atlas.frames).filter(name => name.endsWith(alias.frameSuffix))
    assert.equal(
      frames.length,
      alias.alias.endsWith('/action') ? 18 : alias.alias.endsWith('/walking') ? 27 : alias.alias.endsWith('/dying') ? 6 : 1,
      alias.alias
    )
  }
})
