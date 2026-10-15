const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const load = file => loadTsModule(file, options)
const equipment = require('../public/assets/data/gameplay/equipment.json')
const { Assets } = require('pixi.js')
Assets.cache.set('config', { equipment })
const ammo = { ...load('app/lib/units/combat/rangedAmmunition.ts'), ...load('app/lib/units/combat/rangedShot.ts') }
const stats = load('app/lib/equipment/equipmentStats.ts')
const npc = load('app/lib/units/combat/npcWeapons.ts')
const { wearEquippedWeapon } = load('app/lib/equipment/equipmentWear.ts')

function hero(stone = 1) {
  return {
    type: 'Hero',
    family: 'unit',
    work: 'hunter',
    inventory: {
      activeWeapons: { ranged: 'slingshot' },
      resources: { stone },
      equipped: { arrow: 'arrow_iron' },
      equippedCounts: { arrow: 3 },
    },
    owner: { config: { equipment, units: {} } },
  }
}
function resident(stone = 1) {
  return {
    type: 'Villager',
    family: 'unit',
    action: 'attack',
    x: 0,
    y: 0,
    dest: { family: 'unit', x: 160, y: 0 },
    inventory: { npcWeaponsInitialized: true, equipment: ['bow', 'slingshot', 'dagger_bronze'], resources: { stone } },
    owner: { config: { equipment, units: {} } },
  }
}

test('one raw stone produces one pebble, without consuming arrows or allowing a free second shot', () => {
  const unit = hero()
  assert.equal(ammo.hasRangedAmmunition(unit), true)
  assert.equal(ammo.consumeRangedAmmunition(unit), 'Pebble')
  assert.equal(unit.inventory.resources.stone, 0)
  assert.equal(unit.inventory.equippedCounts.arrow, 3)
  assert.equal(ammo.hasRangedAmmunition(unit), false)
  assert.equal(ammo.consumeRangedAmmunition(unit), null)
  for (const amount of [0, 0.5, -1]) assert.equal(ammo.hasRangedAmmunition(hero(amount)), false)
  unit.inventory.resources.stone = 2
  unit.inventory.activeWeapons.ranged = 'slingshot~condition:0'
  assert.equal(ammo.consumeRangedAmmunition(unit), null)
  assert.equal(unit.inventory.resources.stone, 2)
})

test('slingshot damage and appearance ignore even iron arrows; ordinary bows retain them', () => {
  const unit = hero()
  const { getHeroToolEquipment } = load('app/lib/hero/heroToolEquipment.ts')
  assert.equal(stats.getHeroInventoryWeaponCombatStats(unit).rangedWeaponPower, 2)
  assert.equal(stats.getEntityWeaponPower(unit), 2)
  assert.equal(stats.getUnitCombatRange(unit), 3)
  assert.deepEqual(getHeroToolEquipment(unit, 'bow'), ['slingshot'])
  unit.inventory.activeWeapons.ranged = 'bow'
  assert.equal(stats.getHeroInventoryWeaponCombatStats(unit).rangedWeaponPower, 9)
  assert.equal(ammo.consumeRangedAmmunition(unit), 'ArrowIron')
  assert.equal(unit.inventory.equippedCounts.arrow, 2)
  assert.equal(unit.inventory.resources.stone, 1)
})

test('resident uses available stones even with an empty bow, then switches to melee after the last shot', () => {
  const unit = resident()
  const fired = npc.getNpcWeaponChoice(unit)
  assert.equal(fired.weapon, 'slingshot')
  assert.equal(stats.getEntityWeaponPower(unit), 2)
  assert.deepEqual(npc.getNpcActiveCombatEquipment(unit), ['slingshot'])
  assert.equal(ammo.consumeRangedAmmunition(unit), 'Pebble')
  wearEquippedWeapon(unit, 'ranged', fired.index)
  assert.equal(unit.inventory.equipment[1], 'slingshot~uses:299')
  assert.equal(npc.getNpcWeaponChoice(unit).weapon, 'dagger_bronze')
  assert.equal(ammo.consumeRangedAmmunition(unit), null)
})

test('stone hunting can be selected while idle, and shows the slingshot without a bow or quiver', () => {
  const unit = resident(2)
  unit.dest = undefined
  unit.action = null
  assert.equal(ammo.hasRangedAmmunition(unit), true)
  unit.action = 'hunt'
  unit.dest = { family: 'animal', x: 160, y: 0 }
  unit.appearance = { layers: [{ equipmentKey: 'bow' }, { equipmentKey: 'quiver' }, { equipmentKey: 'arrow_iron' }] }
  const { syncNpcWeaponAppearance } = load('app/lib/units/visuals/npcWeaponAppearance.ts')
  syncNpcWeaponAppearance(unit)
  assert.ok(unit.appearance.layers.some(layer => layer.equipmentKey === 'slingshot'))
  assert.ok(unit.appearance.layers.every(layer => !['bow', 'quiver', 'arrow_iron'].includes(layer.equipmentKey)))
})

test('forge, market, repair and ranged slot all expose the same slingshot', () => {
  const { FORGE_EQUIPMENT_RECIPES } = load('app/lib/hero/heroForgeRecipes.ts')
  const recipe = FORGE_EQUIPMENT_RECIPES.find(item => item.id === 'slingshot')
  assert.deepEqual(recipe.cost, { wood: 2, leather: 1, sinew: 1 })
  assert.equal(recipe.forgeGroup, 'weapons')
  const { resetMarketEquipmentStock, getMarketEquipmentOffers } = load('app/lib/equipment/equipmentMarket.ts')
  const market = { owner: { civ: 'Alba' } }
  resetMarketEquipmentStock(market)
  assert.ok(getMarketEquipmentOffers({}, market.marketStock).some(offer => offer.equipment === 'slingshot'))
  assert.equal(load('app/lib/equipment/equipmentSlots.ts').getWeaponSlot('slingshot~condition:50'), 'ranged')
  assert.deepEqual(load('app/lib/equipment/equipmentRepair.ts').getEquipmentRepairCost('slingshot~condition:50'), {
    wood: 1,
    leather: 1,
    sinew: 1,
  })
})

test('all walking, firing and death sprite aliases resolve, and pebble is a small separate projectile', () => {
  const { dynamicEquipmentAliases, dynamicEquipmentAsset } = load('app/lib/lpc/equipment.ts')
  const atlas = JSON.parse(fs.readFileSync('public/assets/graphics/equipments/weapon/slingshot/texture.json'))
  assert.ok(dynamicEquipmentAsset('slingshot').src.includes('/weapon/slingshot/'))
  const aliases = dynamicEquipmentAliases().filter(item => item.alias.startsWith('equipments/slingshot/'))
  assert.equal(aliases.length, 8)
  for (const alias of aliases)
    assert.ok(
      Object.keys(atlas.frames).some(key => key.endsWith(alias.frameSuffix)),
      alias.alias
    )
  const pebble = require('../public/assets/graphics/projectiles/pebble/texture.json')
  assert.deepEqual(pebble.meta.size, { w: 5, h: 4 })
  assert.equal(require('../public/assets/data/gameplay/projectiles.json').Pebble.assets, 'projectiles/pebble')
})

test('hunting release snapshots the last stone damage and range before switching weapons', () => {
  let release
  const projectiles = []
  const { handleUnitHuntAction } = loadTsModule('app/classes/unit/work/UnitHuntAction.ts', {
    mocks: {
      '../../../lib': {
        BOW_SHOOT_RELEASE_FRAME: 8,
        getHuntingAimPoint: (_unit, _dest, type) => {
          assert.equal(type, 'Pebble')
          return { x: 160, y: 0 }
        },
        onSpriteLoopAtFrame: (_sprite, _frame, callback) => {
          release = callback
        },
      },
      '../../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
      '../../../lib/projectiles': { attachProjectileToMapSpace() {} },
      '../../Projectile': {
        Projectile: class {
          constructor(options) {
            projectiles.push(options)
          }
        },
      },
    },
  })
  const unit = resident()
  Object.assign(unit, {
    action: 'hunt',
    sprite: {},
    visualAnimation: {
      onLoop() {},
      onFrameEachLoop(_frame, callback) { release = callback },
    },
    context: { map: {} },
    realDest: { x: 160, y: 0 },
    getActionCondition: () => true,
    stop() {
      this.stopped = true
    },
  })
  unit.dest.family = 'animal'
  handleUnitHuntAction(unit)
  assert.equal(unit.inventory.resources.stone, 1)
  release()
  assert.equal(projectiles.length, 1)
  assert.equal(projectiles[0].type, 'Pebble')
  assert.equal(projectiles[0].weaponPower, 2)
  assert.ok(projectiles[0].maxDistance > 0)
  assert.equal(unit.inventory.resources.stone, 0)
  assert.equal(unit.inventory.equipment[1], 'slingshot~uses:299')
  release()
  assert.equal(projectiles.length, 1)
  assert.equal(unit.stopped, true)
})
