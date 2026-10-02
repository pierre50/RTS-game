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
  assert.equal(rules.resolveForgeEquipment('sword_ceramic', owner), 'sword_copper')
  assert.equal(rules.resolveForgeEquipment('round_shield_ceramic_slash', owner), 'round_shield_iron_slash')
  assert.equal(rules.resolveForgeEquipment('arrow_ceramic', owner), 'arrow_ceramic')
  assert.equal(rules.resolveForgeEquipment('centurion_crest', owner), 'centurion_crest')
})

test('soldier experience unlocks pieces while forge upgrades independently choose their metal', () => {
  const { dynamicEquipmentForUnit } = loadTsModule('app/lib/lpc/equipment.ts')
  const owner = { forgeUpgrades: { weapons: 3, armor: 1, arrows: 2 } }
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', owner, 0), ['sword_iron'])
  const veteran = dynamicEquipmentForUnit('Fantassin', owner, 18, 'Latium')
  assert.ok(veteran.includes('armor_legion_copper'))
  assert.ok(veteran.includes('helmet_legion_copper'))
  assert.ok(veteran.includes('centurion_plumage'))
  assert.ok(veteran.includes('sword_iron'))
  const archer = dynamicEquipmentForUnit('Bowman', owner, 10)
  assert.ok(archer.includes('arrow_bronze'))
  assert.ok(archer.includes('bow_recurve'))
  assert.ok(archer.includes('armor_mail_copper'))
})

test('upgraded tools unlock village iron mining without changing the hero inventory', () => {
  const { getMiningPickaxe, hasIronMiningPickaxe } = loadTsModule('app/lib/resources/miningEquipment.ts')
  const owner = { age: 2, forgeUpgrades: { pickaxes: 1 } }
  const worker = { type: 'Villager', owner }
  const hero = { type: 'Hero', owner, inventory: { equipment: ['pickaxe_copper'] } }
  assert.equal(hasIronMiningPickaxe(worker), false)
  owner.forgeUpgrades.pickaxes = 2
  assert.equal(getMiningPickaxe(worker), 'pickaxe_bronze')
  assert.equal(hasIronMiningPickaxe(worker), true)
  assert.equal(hasIronMiningPickaxe(hero), false)
  hero.inventory.equipment.push('pickaxe_iron')
  assert.equal(getMiningPickaxe(hero), 'pickaxe_iron')
  assert.equal(rules.getForgeGatherBonus(owner, 'goldminer', 'Villager'), 2)
  assert.equal(rules.getForgeGatherBonus(owner, 'goldminer', 'Hero'), 0)
  assert.equal(rules.getForgeGatherBonus(owner, 'woodcutter', 'Villager'), 0)
  assert.equal(rules.getForgeBuildMultiplier({ forgeUpgrades: { hammers: 2 } }, 'Villager'), 1.5)
})

test('forge purchase revalidates ownership, chief, proximity, cost and expected tier', () => {
  const refreshed = []
  let reachable = true
  const { researchForgeUpgrade } = loadTsModule('app/lib/equipment/forgeResearch.ts', {
    mocks: {
      '../hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      './equipmentStats': { refreshUnitEquipmentStats: unit => refreshed.push(unit.type) },
      '../resources/playerResourceTotals': {
        getMissingPlayerResources: (player, cost, options) => {
          assert.equal(options.includeHero, false)
          return Object.fromEntries(Object.entries(cost).filter(([key, amount]) => (player.stock[key] ?? 0) < amount))
        },
        withdrawChestResources: (player, cost, options) => {
          assert.equal(options.includeHero, false)
          for (const [key, amount] of Object.entries(cost)) player.stock[key] -= amount
          return true
        },
      },
    },
  })
  const player = { forgeUpgrades: {}, stock: { wood: 100, copper: 100, iron: 100 }, units: [] }
  const hero = { owner: player, type: 'Hero', isChief: true }
  const soldier = { type: 'Fantassin', experience: { melee: 1000 }, syncAppearanceLayers() {} }
  player.units.push(hero, soldier, { type: 'Villager' }, { type: 'Fantassin', isDead: true })
  const forge = { type: 'Forge', isBuilt: true, owner: player }
  const before = structuredClone(player.stock)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 2, hero), false)
  assert.equal(researchForgeUpgrade(player, { ...forge, owner: {} }, 'weapons', 1, hero), false)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 1, { ...hero, isChief: false }), false)
  reachable = false
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 1, hero), false)
  reachable = true
  for (const invalid of [{ isBuilt: false }, { isDead: true }, { isDestroyed: true }])
    assert.equal(researchForgeUpgrade(player, { ...forge, ...invalid }, 'weapons', 1, hero), false)
  assert.deepEqual(player.stock, before)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 1, hero), true)
  assert.equal(player.forgeUpgrades.weapons, 1)
  assert.deepEqual(refreshed, ['Fantassin', 'Villager'])
  assert.deepEqual(soldier.experience, { melee: 1000 })
  assert.equal(player.stock.copper, before.copper - 20)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 1, hero), false)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 2, hero), true)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 3, hero), true)
  assert.equal(researchForgeUpgrade(player, forge, 'weapons', 4, hero), false)
  player.stock.copper = 0
  assert.equal(researchForgeUpgrade(player, forge, 'pickaxes', 1, hero), false)
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
  const cache = new Map([['equipments/sword_copper/front/walking', sheet]])
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
  unit.lootEquipment = ['sword_copper']
  unit.owner.forgeUpgrades.weapons = 3
  assert.equal(getLayerRenderState(unit, layer, 'walkingSheet')?.spritesheet, sheet)
  unit.lootEquipment = []
  assert.equal(getLayerRenderState(unit, layer, 'walkingSheet'), null)
})
