const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { UNIT_TYPES: U, FAMILY_TYPES: F, BUILDING_TYPES: B } = loadTsModule('app/lib/constants.ts')
const { getActionCondition } = loadTsModule('app/lib/combat/combatActionConditions.ts', {
  mocks: {
    '../equipment/equipmentStats': { getEntityWeaponPower: unit => unit?.weaponPower ?? 0 },
    '../resources/resourceDelivery': { unitHasDeliverableResourcesForBuilding: unit => unit.hasCargo === true },
    '../buildings/interiorAccess': {
      shouldAttackBuildingForInteriorAccess: (_unit, building) => building.accessBlocked === true,
    },
    './bandits': { isBanditOwner: owner => owner.bandits === true, isBanditUnitType: type => type === 'Bandit' },
    './combatRelations': { isFriendlyTarget: (source, target) => source.owner?.label === target.owner?.label },
  },
})
const owner = { label: 'ally', isEnemy: other => other?.label === 'enemy' }
const source = (patch = {}) => ({ family: F.unit, type: U.villager, hitPoints: 10, owner, ...patch })
const building = (patch = {}) => ({
  family: F.building,
  owner,
  hitPoints: 50,
  totalHitPoints: 100,
  isBuilt: true,
  ...patch,
})

test('construction and delivery distinguish repairable buildings from valid storage destinations', () => {
  const worker = source({ hasCargo: true })
  assert.equal(getActionCondition(worker, building(), 'build'), true)
  assert.equal(getActionCondition(worker, building({ hitPoints: 100 }), 'build'), false)
  assert.equal(getActionCondition(worker, building({ hitPoints: 100, isBuilt: false }), 'build'), true)
  assert.equal(getActionCondition(source({ type: U.hero }), building(), 'build'), true)
  assert.equal(getActionCondition(worker, building(), 'delivery'), true)
  assert.equal(getActionCondition(source(), building(), 'delivery'), false)
  assert.equal(getActionCondition(source({ type: U.hero, hasCargo: true }), building(), 'delivery'), false)
  for (const action of ['build', 'delivery']) {
    for (const patch of [{ owner: { label: 'enemy' } }, { family: F.unit }, { hitPoints: 0 }, { isDead: true }]) {
      assert.equal(getActionCondition(worker, building(patch), action), false)
    }
  }
  assert.equal(getActionCondition(worker, building({ isBuilt: false }), 'delivery'), false)
})

test('training requires a supported unit and prevents mounting a rider twice', () => {
  const target = building({ type: B.stable, units: [U.infantry] })
  assert.equal(getActionCondition(source(), target, 'train', { trainingType: U.infantry }), true)
  assert.equal(getActionCondition(source({ type: U.infantry }), target, 'train', { trainingType: U.infantry }), true)
  assert.equal(
    getActionCondition(source({ type: U.infantry, mountedOnHorse: true }), target, 'train', {
      trainingType: U.infantry,
    }),
    false
  )
  assert.equal(getActionCondition(source(), target, 'train'), false)
  assert.equal(getActionCondition(source(), target, 'train', {}), false)
  assert.equal(getActionCondition(source(), target, 'train', { trainingType: U.priest }), false)
  for (const patch of [
    { units: undefined },
    { isBuilt: false },
    { isDead: true },
    { hitPoints: undefined },
    { owner: null },
  ]) {
    assert.equal(getActionCondition(source(), { ...target, ...patch }, 'train', { trainingType: U.infantry }), false)
  }
})

test('healing requires a living injured allied unit', () => {
  const target = source({ hitPoints: 5, totalHitPoints: 10 })
  assert.equal(getActionCondition(source(), target, 'heal'), true)
  for (const patch of [
    { hitPoints: 0 },
    { hitPoints: 10 },
    { totalHitPoints: undefined },
    { isDead: true },
    { family: F.building },
    { owner: null },
  ]) {
    assert.equal(getActionCondition(source(), { ...target, ...patch }, 'heal'), false)
  }
})

test('conversion respects enemy relations, bandit immunity and the building technology requirement', () => {
  const priest = source({ type: U.priest })
  const enemy = source({ type: U.infantry, owner: { label: 'enemy' } })
  assert.equal(getActionCondition(priest, enemy, 'convert'), true)
  assert.equal(getActionCondition(source(), enemy, 'convert'), false)
  assert.equal(getActionCondition({ ...priest, owner: null }, enemy, 'convert'), false)
  assert.equal(getActionCondition({ ...priest, owner: { ...owner, bandits: true } }, enemy, 'convert'), false)
  assert.equal(getActionCondition(priest, { ...enemy, owner }, 'convert'), false)
  for (const patch of [{ type: U.priest }, { type: 'Bandit' }, { hitPoints: undefined }, { isDead: true }]) {
    assert.equal(getActionCondition(priest, { ...enemy, ...patch }, 'convert'), false)
  }
  const enemyBuilding = building({ owner: enemy.owner })
  assert.equal(getActionCondition(priest, enemyBuilding, 'convert'), false)
  const advancedPriest = { ...priest, owner: { ...owner, technologies: ['Monotheism'] } }
  assert.equal(getActionCondition(advancedPriest, enemyBuilding, 'convert'), true)
  assert.equal(getActionCondition(advancedPriest, { ...enemy, family: F.animal }, 'convert'), false)
})

test('attack eligibility and the shared guard reject unusable targets and orders', () => {
  const fighter = source({ weaponPower: 1 })
  const enemy = source({ owner: { label: 'enemy' } })
  assert.equal(getActionCondition(fighter, enemy, 'attack'), true)
  assert.equal(getActionCondition(source(), enemy, 'attack'), false)
  assert.equal(getActionCondition(fighter, source(), 'attack'), false)
  assert.equal(getActionCondition(fighter, building({ owner: enemy.owner }), 'attack'), false)
  assert.equal(getActionCondition(fighter, building({ owner: enemy.owner, accessBlocked: true }), 'attack'), true)
  assert.equal(
    getActionCondition(
      source({ family: F.animal, weaponPower: 1 }),
      building({ owner: enemy.owner, accessBlocked: true }),
      'attack'
    ),
    false
  )
  assert.equal(getActionCondition(fighter, { ...enemy, owner: null, family: F.animal }, 'attack'), true)
  for (const action of [undefined, 'unknown']) assert.equal(getActionCondition(fighter, enemy, action), false)
  assert.equal(getActionCondition(fighter, fighter, 'attack'), false)
  assert.equal(getActionCondition(fighter, null, 'attack'), false)
  assert.equal(getActionCondition({ ...fighter, hitPoints: 0 }, enemy, 'attack'), false)
  assert.equal(getActionCondition({ ...fighter, isDead: true }, enemy, 'attack'), false)
})
