const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const rules = loadTsModule('app/lib/equipment/forgeUpgrades.ts')

test('forge families progress independently and ignore obsolete global age', () => {
  assert.equal(rules.getForgeTier({ age: 2 }, 'axes'), 0)
  assert.equal(rules.normalizeForgeUpgrades({ age: 2, forgeUpgrades: { axes: 1 } }).weapons, 0)
  const owner = { forgeUpgrades: { axes: 2, weapons: 1, armor: 3, arrows: 0 } }
  assert.equal(rules.resolveForgeEquipment('axe_ceramic', owner), 'axe_bronze')
  assert.equal(rules.resolveForgeEquipment('pickaxe_ceramic', owner), 'pickaxe_ceramic')
  assert.equal(rules.resolveForgeEquipment('sword_ceramic', owner), 'sword_bronze')
  assert.equal(rules.resolveForgeEquipment('round_shield_ceramic_slash', owner), 'round_shield_iron_slash')
  assert.equal(rules.resolveForgeEquipment('arrow_ceramic', owner), 'arrow_ceramic')
  assert.equal(rules.resolveForgeEquipment('centurion_crest', owner), 'centurion_crest')
})

test('soldier experience unlocks pieces while forge upgrades independently choose their metal', () => {
  const { dynamicEquipmentForUnit } = loadTsModule('app/lib/lpc/equipment.ts')
  const owner = { forgeUpgrades: { weapons: 3, armor: 1, arrows: 2 } }
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', owner, 0), ['spear_iron'])
  const veteran = dynamicEquipmentForUnit('Fantassin', owner, 18, 'Latium')
  assert.ok(veteran.includes('armor_leather'))
  assert.ok(veteran.includes('helmet_pointed_leather'))
  assert.ok(veteran.includes('centurion_plumage'))
  assert.ok(veteran.includes('spear_iron'))
  const archer = dynamicEquipmentForUnit('Bowman', owner, 10)
  assert.ok(archer.includes('arrow_bronze'))
  assert.ok(archer.includes('bow_recurve'))
  assert.ok(archer.includes('armor_leather'))
})

test('iron mining requires an equipped bronze or iron pickaxe, independent of research', () => {
  const { getMiningPickaxe, hasIronMiningPickaxe } = loadTsModule('app/lib/resources/miningEquipment.ts')
  const owner = { age: 2, forgeUpgrades: { pickaxes: 1 } }
  const worker = { type: 'Villager', owner, inventory: { activeWeapons: { tool: 'picksword_bronze' } } }
  const hero = { type: 'Hero', owner, inventory: { activeWeapons: { tool: 'picksword_bronze' }, equipment: [] } }
  assert.equal(hasIronMiningPickaxe(worker), false)
  owner.forgeUpgrades.pickaxes = 2
  assert.equal(hasIronMiningPickaxe(worker), false)
  worker.inventory.activeWeapons.tool = 'pickaxe_bronze'
  assert.equal(getMiningPickaxe(worker), 'pickaxe_bronze')
  assert.equal(hasIronMiningPickaxe(worker), true)
  assert.equal(hasIronMiningPickaxe(hero), false)
  assert.equal(hero.inventory.activeWeapons.tool, 'picksword_bronze')
  hero.inventory.activeWeapons.tool = 'pickaxe_iron'
  assert.equal(getMiningPickaxe(hero), 'pickaxe_iron')
})

test('save snapshots preserve independent forge families', () => {
  const { serializeEconomyPlayer } = loadTsModule('app/serialization/VillageEconomySnapshot.ts')
  const owner = { type: 'Human', age: 2, forgeUpgrades: { axes: 2, weapons: 1 }, units: [], buildings: [] }
  const snapshot = serializeEconomyPlayer(owner)
  assert.deepEqual(snapshot.forgeUpgrades, owner.forgeUpgrades)
  snapshot.forgeUpgrades.axes = 3
  assert.equal(owner.forgeUpgrades.axes, 2)
})

test('unit appearance uses the selected family and keeps corpse equipment stable', () => {
  const sheet = { textures: { 0: {} } }
  const cache = new Map([['equipments/sword_bronze/front/walking', sheet]])
  const { getLayerRenderState } = loadTsModule('app/classes/unit/appearance/UnitAppearanceRenderState.ts', {
    mocks: {
      'pixi.js': { Assets: { cache } },
      '../../../lib': { getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }) },
    },
  })
  const unit = {
    type: 'Fantassin',
    owner: { age: 2, forgeUpgrades: { weapons: 1, armor: 3 } },
    sprite: { currentFrame: 0 },
    context: { map: { ready: false } },
  }
  const layer = { equipmentKey: 'sword_ceramic', walkingSheet: 'equipments/sword_ceramic/front/walking', zIndex: 1 }
  assert.equal(getLayerRenderState(unit, layer, 'walkingSheet')?.spritesheet, sheet)
  unit.isDead = true
  unit.lootEquipment = ['sword_bronze']
  unit.owner.forgeUpgrades.weapons = 3
  assert.equal(getLayerRenderState(unit, layer, 'walkingSheet')?.spritesheet, sheet)
  unit.lootEquipment = []
  assert.equal(getLayerRenderState(unit, layer, 'walkingSheet'), null)
})

test('hero work tools follow village research while personal combat equipment stays individual', () => {
  const owner = { forgeUpgrades: { axes: 3, hammers: 2, weapons: 3, arrows: 3, armor: 3 } }
  const hero = { type: 'Hero', owner }
  assert.equal(rules.resolveUnitForgeEquipment('axe_ceramic', hero), 'axe_iron')
  assert.equal(rules.resolveUnitForgeEquipment('hammer_ceramic', hero), 'hammer_bronze')
  assert.equal(rules.resolveUnitForgeEquipment('sword_bronze', hero), 'sword_bronze')
  assert.equal(rules.resolveUnitForgeEquipment('bow', hero), 'bow')
  assert.equal(rules.resolveUnitForgeEquipment('armor_leather', hero), 'armor_leather')
})
