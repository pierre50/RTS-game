const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { reconcileHouseholds, getHouseResidents, getVacantHomeCount, claimHeroHome } = loadTsModule(
  'app/lib/housing/households.ts'
)
const { isBedOccupied } = loadTsModule('app/services/rest/BedOccupancy.ts')
const { UnitLifecycle } = loadTsModule('app/classes/unit/UnitLifecycle.ts', {
  mocks: {
    '../../lib': { playAudibleSoundCue() {}, canUpdateMinimap: () => false },
    '../../lib/entities/deathFlash': {},
    '../../lib/entities/entityVisualFeedback': { clearEntityVisualFeedback() {} },
    '../../lib/entities/entityFade': {},
    '../../lib/combat/combatAttackLoop': { clearCombatAttackRecovery() {} },
    '../../lib/equipment/equipmentLoot': { initializeUnitCorpseLootEquipment() {} },
    '../../lib/equipment/unitCorpseLoot': { addUnitCorpseLootResources() {} },
    '../../lib/entities/entityHealthDisplay': {},
    '../../lib/units/visuals/unitVisualTransition': {},
    '../../services/rest/UnitSleepVisuals': { clearSleepingVisualState() {} },
    '../../lib/hero/heroDefense': { cancelHeroDefense() {} },
    '../../lib/hero/heroPowerCharge': { cancelHeroPowerCharge() {} },
  },
})

function fixture() {
  const house = { type: 'House', label: 'home', isBuilt: true, i: 0, j: 0 }
  const owner = { type: 'AI', label: 'village', population: 0, buildings: [house], units: [] }
  const context = { players: [owner], map: { removeFromInstanceBucket() {} } }
  function add(label, type = 'Villager') {
    const unit = { type, label, name: label, owner, context }
    owner.units.push(unit)
    owner.population++
    return unit
  }
  return { house, owner, context, add }
}
function die(unit) {
  const lifecycle = new UnitLifecycle(unit)
  lifecycle.death = () => {} // The corpse animation does not participate in housing.
  lifecycle.die()
}

test('death of a sole resident immediately frees the house and bed before corpse removal', () => {
  const { house, owner, add } = fixture()
  const resident = add('Alice')
  reconcileHouseholds(owner)
  const bed = { label: resident.homeBedLabel }
  const observer = { owner, context: resident.context }
  assert.equal(isBedOccupied(observer, bed), true)
  die(resident)
  assert.equal(resident.isDead, true)
  assert.equal(owner.units.includes(resident), false)
  assert.deepEqual(getHouseResidents(owner, house), [])
  assert.equal(getVacantHomeCount(owner), 1)
  assert.equal(isBedOccupied(observer, bed), false)
  const saved = JSON.parse(JSON.stringify({ ...owner, units: [] }))
  reconcileHouseholds(saved)
  assert.equal(getVacantHomeCount(saved), 1)
  const newcomer = add('Bob')
  reconcileHouseholds(owner)
  assert.equal(newcomer.homeHouseLabel, house.label)
  assert.equal(newcomer.homeBedLabel, bed.label)
  assert.deepEqual(getHouseResidents(owner, house), [newcomer])
})

test('a surviving partner retains the home; death of the last partner makes it assignable again', () => {
  const { house, owner, add } = fixture()
  const first = add('Alice'),
    second = add('Bob')
  first.partnerLabel = second.label
  second.partnerLabel = first.label
  reconcileHouseholds(owner)
  const secondBed = second.homeBedLabel
  die(first)
  assert.deepEqual(getHouseResidents(owner, house), [second])
  assert.equal(getVacantHomeCount(owner), 0)
  assert.equal(second.homeBedLabel, secondBed)
  assert.equal(second.partnerLabel, undefined)
  die(second)
  assert.deepEqual(getHouseResidents(owner, house), [])
  assert.equal(getVacantHomeCount(owner), 1)
  const newcomer = add('Charlie')
  reconcileHouseholds(owner)
  assert.equal(newcomer.homeHouseLabel, house.label)
})

test('death of the resident hero clears the persistent home reservation', () => {
  const { house, owner, add } = fixture()
  const hero = add('Hero', 'Hero')
  reconcileHouseholds(owner)
  assert.equal(claimHeroHome(owner, hero, house), true)
  die(hero)
  assert.equal(house.heroHomeResident, undefined)
  assert.deepEqual(getHouseResidents(owner, house), [])
  assert.equal(getVacantHomeCount(owner), 1)
})
