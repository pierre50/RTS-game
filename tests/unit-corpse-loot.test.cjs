const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { UNIT_CORPSE_LOOT } = loadTsModule('app/config/unitCorpseLoot.ts')
const { RESOURCE_STORAGE_NAMES } = loadTsModule('app/constants/entities.ts')
const { addUnitCorpseLootResources } = loadTsModule('app/lib/equipment/unitCorpseLoot.ts')

function corpse(type = 'BanditSword', random = () => 0) {
  return {
    type,
    isDead: true,
    owner: { isEnemy: () => true, units: [], population: 1 },
    context: { player: { isEnemy: () => true }, map: { random, removeFromInstanceBucket() {} } },
  }
}

test('loot tables contain valid independent chances and inclusive integer quantities', () => {
  assert.equal(Object.keys(UNIT_CORPSE_LOOT).length, 9)
  for (const table of Object.values(UNIT_CORPSE_LOOT)) {
    assert.equal(new Set(table.map(entry => entry.item)).size, table.length)
    for (const entry of table) {
      assert.ok(RESOURCE_STORAGE_NAMES.includes(entry.item))
      assert.ok(entry.chancePercent >= 0 && entry.chancePercent <= 100)
      assert.ok(Number.isInteger(entry.min) && entry.min > 0)
      assert.ok(Number.isInteger(entry.max) && entry.max >= entry.min)
    }
  }
})

test('each unit profile can yield minimum and maximum quantities, or nothing', () => {
  for (const [type, table] of Object.entries(UNIT_CORPSE_LOOT)) {
    for (const quantityRoll of [0, 0.999999]) {
      let rolls = 0
      const unit = corpse(type, () => (++rolls % 2 === 1 ? 0 : quantityRoll))
      addUnitCorpseLootResources(unit)
      assert.deepEqual(
        unit.inventory.resources,
        Object.fromEntries(table.map(entry => [entry.item, quantityRoll === 0 ? entry.min : entry.max]))
      )
    }
    const empty = corpse(type, () => 0.999999)
    addUnitCorpseLootResources(empty)
    assert.equal(empty.inventory, undefined)
  }
})

test('chance boundaries are exclusive and drops accumulate with carried resources', () => {
  const rolls = [0.599999, 0.999999, 0.45, 0.35, 0.3, 0.25]
  const unit = corpse('BanditSword', () => {
    assert.ok(rolls.length > 0)
    return rolls.shift()
  })
  unit.inventory = { resources: { leather: 7, wood: 4 }, equipment: ['bow'] }
  addUnitCorpseLootResources(unit)
  assert.deepEqual(unit.inventory, { resources: { leather: 10, wood: 4 }, equipment: ['bow'] })
  assert.equal(rolls.length, 0)
})

test('living, destroyed, friendly and unknown units do not gain loot', () => {
  const units = [
    { ...corpse(), isDead: false },
    { ...corpse(), isDestroyed: true },
    { ...corpse(), owner: { isPlayed: true } },
    { ...corpse(), owner: undefined },
    { ...corpse(), context: undefined },
    corpse('Unknown'),
    corpse('Hero'),
  ]
  const friendly = corpse()
  friendly.owner.isEnemy = friendly.context.player.isEnemy = () => false
  units.push(friendly)
  for (const unit of units) {
    addUnitCorpseLootResources(unit)
    assert.equal(unit.inventory, undefined)
  }
})

test('death rolls once, and corpse inspection and pickup never refill the loot', () => {
  let rolls = 0
  const unit = corpse('BanditSword', () => {
    rolls++
    return 0
  })
  unit.isDead = false
  const { UnitLifecycle } = loadTsModule('app/classes/unit/UnitLifecycle.ts', {
    mocks: {
      '../../lib': { playAudibleSoundCue() {}, canUpdateMinimap: () => false },
      '../../lib/entities/deathFlash': {},
      '../../lib/entities/entityVisualFeedback': { clearEntityVisualFeedback() {} },
      '../../lib/entities/entityFade': {},
      '../../lib/combat/combatAttackLoop': { clearCombatAttackRecovery() {} },
      '../../lib/equipment/equipmentLoot': { initializeUnitCorpseLootEquipment() {} },
      '../../lib/entities/entityHealthDisplay': {},
      '../../lib/units/unitVisualTransition': {},
      '../../services/rest/UnitSleepVisuals': { clearSleepingVisualState() {} },
    },
  })
  const lifecycle = new UnitLifecycle(unit)
  lifecycle.death = () => {}
  lifecycle.die()
  const firstRolls = rolls
  assert.ok(firstRolls > 0)
  lifecycle.die()
  assert.equal(rolls, firstRolls)

  const { getUnitCorpseLootResources, pickupCorpseResource } = loadTsModule('app/lib/equipment/equipmentLoot.ts', {
    mocks: {
      '../objectives/ageRules': {},
      '../lpc': {},
      '../units/unitExperience': {},
      './equipmentStats': {},
    },
  })
  const hero = {}
  const resources = { ...getUnitCorpseLootResources(unit) }
  for (const [resource, amount] of Object.entries(resources)) {
    assert.equal(pickupCorpseResource(unit, hero, resource), amount)
    assert.equal(pickupCorpseResource(unit, hero, resource), 0)
  }
  assert.deepEqual(hero.inventory.resources, resources)
  assert.deepEqual(getUnitCorpseLootResources(unit), {})
  assert.equal(rolls, firstRolls)
})
