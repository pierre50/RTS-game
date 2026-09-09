const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { usesMeleeAttack, getUnitMeleeWeapon } = loadTsModule('app/lib/combat/unitMelee.ts', {
  mocks: {
    '../constants': { UNIT_TYPES: { villager: 'Villager' } },
    '../equipment/equipmentStats': {
      getUnitCombatRange: unit => unit.range,
      hasHeroInventoryEquipment: unit => unit.heroInventory === true,
      getEntityMeleeWeapon: unit => unit.configuredWeapon,
    },
  },
})

test('projectile units use ranged attacks only when their range allows it', () => {
  assert.equal(usesMeleeAttack({ type: 'Archer', projectile: 'arrow', range: 5 }), false)
  assert.equal(usesMeleeAttack({ type: 'Archer', projectile: 'arrow', range: 0 }), true)
  assert.equal(usesMeleeAttack({ type: 'Infantry', range: 1 }), true)
  assert.equal(usesMeleeAttack({ type: 'Villager', projectile: 'arrow', range: 5 }), true)
})

test('hero hand attacks do not inherit equipped combat weapons', () => {
  assert.equal(
    getUnitMeleeWeapon({ heroInventory: true, work: 'attacker', inventory: { activeWeapons: { melee: 'sword' } } }),
    undefined
  )
  assert.equal(
    getUnitMeleeWeapon({ heroInventory: true, work: 'hunter', inventory: { activeWeapons: { melee: 'axe' } } }),
    'axe'
  )
  assert.equal(getUnitMeleeWeapon({ heroInventory: true }), undefined)
  assert.equal(getUnitMeleeWeapon({ heroInventory: true, inventory: {} }), undefined)
  assert.equal(getUnitMeleeWeapon({ heroInventory: true, inventory: { activeWeapons: {} } }), undefined)
})

test('ordinary units retain their configured melee weapon', () => {
  assert.equal(getUnitMeleeWeapon({ configuredWeapon: 'spear' }), 'spear')
  assert.equal(getUnitMeleeWeapon({}), undefined)
})
