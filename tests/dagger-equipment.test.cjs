const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const equipment = loadTsModule('app/lib/lpc/equipment.ts', options)
const stats = loadTsModule('app/lib/equipment/equipmentStats.ts', options)
const arrows = loadTsModule('app/lib/units/combat/unitArrows.ts', options)
const { canAttack } = loadTsModule('app/lib/combat/combatCapabilities.ts', options)

function archer(type) {
  const unit = {
    type,
    family: 'unit',
    projectile: 'Arrow',
    owner: { civ: 'Alba', config: { units: { [type]: {} } } },
    inventory: {},
  }
  arrows.initializeNpcArrows(unit)
  return unit
}

test('daggers are craftable material variants, purchasable, equippable and issued to both archer types', () => {
  const { FORGE_EQUIPMENT_RECIPES, groupForgeRecipeVariants } = loadTsModule(
    'app/lib/hero/heroForgeRecipes.ts',
    options
  )
  const { getMarketEquipmentOffers } = loadTsModule('app/lib/equipment/equipmentMarket.ts', options)
  const { getWeaponSlot } = loadTsModule('app/lib/equipment/equipmentSlots.ts', options)
  const recipes = FORGE_EQUIPMENT_RECIPES.filter(recipe => recipe.id.startsWith('dagger_'))
  assert.deepEqual(
    recipes.map(recipe => recipe.id),
    ['dagger_bronze', 'dagger_iron']
  )
  assert.equal(groupForgeRecipeVariants(recipes).length, 1)
  for (const id of ['dagger_bronze', 'dagger_iron']) {
    assert.equal(getWeaponSlot(id), 'melee')
    assert.ok(
      getMarketEquipmentOffers({ buildingLevel: 2 }).some(offer => offer.equipment === id && offer.goldValue > 0)
    )
  }
  for (const type of ['Bowman', 'BanditArcher']) {
    assert.ok(equipment.dynamicEquipmentForUnit(type).includes('dagger_bronze'))
    assert.ok(equipment.dynamicEquipmentForUnit(type, { forgeUpgrades: { weapons: 3 } }).includes('dagger_iron'))
  }
})

test('empty quivers switch combat power, reach and displayed weapons to the dagger, including after reload', () => {
  for (const type of ['Bowman', 'BanditArcher']) {
    const unit = archer(type)
    assert.equal(stats.getEntityWeaponPower(unit), 6, 'bow plus arrow, without dagger bonus')
    assert.equal(stats.getUnitCombatRange(unit), 4)
    assert.equal(arrows.isInactiveArcherWeapon(unit, 'dagger_bronze'), true)
    while (arrows.consumeNpcArrow(unit)) {
      /* empty the quiver */
    }
    const restored = JSON.parse(JSON.stringify(unit))
    assert.equal(canAttack(restored), true)
    assert.equal(stats.getUnitCombatRange(restored), undefined)
    assert.equal(stats.getEntityMeleeWeapon(restored), 'dagger_bronze')
    assert.equal(stats.getEntityWeaponPower(restored), 6, 'dagger only, without bow or arrow bonus')
    assert.equal(arrows.isInactiveArcherWeapon(restored, 'bow'), true)
    assert.equal(arrows.isInactiveArcherWeapon(restored, 'dagger_bronze'), false)
    restored.equipmentDurability = { dagger_bronze: 0 }
    assert.equal(canAttack(restored), false, 'a broken dagger cannot rescue an empty quiver')
    restored.inventory.equipment.push('arrow_ceramic')
    assert.equal(canAttack(restored), true)
    assert.equal(stats.getUnitCombatRange(restored), 4)
    assert.equal(arrows.isInactiveArcherWeapon(restored, 'dagger_bronze'), true)
  }
})

test('dagger and bandit melee atlases contain their required animation frames', () => {
  const atlas = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../public/assets/graphics/equipments/weapon/dagger/texture.json'), 'utf8')
  )
  for (const material of ['bronze', 'iron']) {
    for (const side of ['back', 'front']) {
      const frames = Object.keys(atlas.frames).filter(key => key.endsWith(`_dagger_${material}_${side}_action.png`))
      assert.equal(frames.length, 18)
    }
  }
  const bandit = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../public/assets/graphics/units/bandit_archer/male/texture.json'), 'utf8')
  )
  assert.equal(Object.keys(bandit.frames).filter(key => key.endsWith('_action_slash.png')).length, 18)
})

test('the final arrow retains its ranged damage and immediately resumes the order at melee range', () => {
  let release
  const projectiles = []
  const orders = []
  const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
    mocks: {
      '../../lib': { BOW_SHOOT_RELEASE_FRAME: 9, SLASH_IMPACT_FRAME: 5, playAudibleSoundCue() {} },
      '../../lib/combat/combatBehavior': { markCombatAttack() {} },
      '../../lib/equipment/equipmentStats': stats,
      '../../lib/combat/combatAttackLoop': {},
      '../../lib/contact/contactDebug': {},
      '../../lib/contact/contactGeometry': {},
      '../../lib/entities/slashRecoveryAnimation': {},
      '../../lib/buildings/interiorAccess': {},
      '../../services/BuildingInteriorSpaceSystem': {},
      '../../lib/units/visuals/unitWorkAppearance': {},
      '../../lib/units/visuals/unitVisualTransition': {},
      '../../lib/combat/combatFeedback': {},
      '../../lib/units/unitControl': {},

      '../../lib/projectiles': { attachProjectileToMapSpace() {} },
      '../../lib/equipment/equipmentWear': { wearEquippedWeapon() {} },
      '../Projectile': {
        Projectile: class {
          constructor(value) {
            projectiles.push(value)
          }
        },
      },
    },
  })
  const unit = archer('BanditArcher')
  unit.owner.forgeUpgrades = { weapons: 3 }
  unit.inventory.equipment = ['arrow_ceramic']
  const target = { family: 'unit', hitPoints: 10 }
  Object.assign(unit, {
    context: { map: {} },
    dest: target,
    realDest: target,
    getActionCondition: () => true,
    sendToEvt: (...args) => orders.push(args),
  })
  const combat = new UnitCombat(unit)
  combat.runAttackLoop = (frame, callback) => {
    release = callback
    unit.releaseFrame = frame
  }
  combat.handleAttackAction()
  assert.equal(unit.releaseFrame, 9)
  release(target)
  assert.equal(projectiles.length, 1)
  assert.equal(projectiles[0].weaponPower, 6, 'last arrow keeps bow damage despite switching to iron dagger')
  assert.equal(arrows.hasUnitArrow(unit), false)
  assert.equal(orders.length, 1)
  assert.equal(orders[0][0], target)
  assert.equal(orders[0][1], 'attack')
  assert.equal(orders[0][2].forceRepath, true)
  combat.handleAttackAction()
  assert.equal(unit.releaseFrame, 5)
  assert.equal(stats.getEntityWeaponPower(unit), 8)
})
