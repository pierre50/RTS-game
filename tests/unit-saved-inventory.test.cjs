const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitInitialization() {
  return loadTsModule('app/classes/unit/UnitInitialization.ts', {
    mocks: {
      'pixi.js': {},
      '../../lib': { getEntityMapSpace: () => null, cartesianToIsometric: () => [0, 0], getInstanceZIndex: () => 0 },
      '../../lib/chief': {},
      '../../lib/equipment/equipmentStats': {},
      '../../lib/horses/horseColors': {},
      '../../lib/lang': {},
      '../../lib/lpc': { applyBakedLpcUnitAssets() {} },
      '../../lib/audio/settings': {},
      '../../lib/units/unitEnergy': { ensureUnitEnergy() {} },
      '../../lib/units/unitWorkAppearance': {},
      '../../ui/entity/UnitInterface': {},
      './UnitActions': {},
      './UnitCombat': {},
      './UnitCommands': {},
      './UnitLifecycle': {},
      './movement/UnitMovement': {},
    },
  })
}

test('loading a hero preserves the entire saved inventory without sharing config or save objects', () => {
  const { applyUnitSpawnConfiguration } = loadUnitInitialization()
  const defaults = { equipment: [], equipped: {}, activeWeapons: { melee: 'sword_ceramic' } }
  const saved = JSON.parse(
    JSON.stringify({
      resources: { gold: 17 },
      equipment: ['bow', 'armor_leather'],
      equipped: { body: 'armor_leather' },
      equippedCounts: { arrow: 12 },
      activeWeapons: { melee: 'axe_ceramic', ranged: 'bow', quiver: 'quiver' },
    })
  )
  const owner = { config: { units: { Hero: { inventory: defaults } } } }
  const create = inventory => {
    const unit = {
      context: { map: { grid: [[{ z: 0 }]] } },
      assignProperties: function (values) {
        Object.assign(this, values)
      },
    }
    applyUnitSpawnConfiguration(unit, { owner, i: 0, j: 0, type: 'Hero', ...(inventory ? { inventory } : {}) })
    return unit
  }
  const restored = create(saved)
  assert.deepEqual(restored.inventory, saved)
  restored.inventory.equipment.pop()
  restored.inventory.activeWeapons.melee = 'changed'
  assert.equal(saved.equipment.length, 2)
  assert.equal(saved.activeWeapons.melee, 'axe_ceramic')
  const fresh = create()
  fresh.inventory.equipment.push('bow')
  assert.deepEqual(defaults.equipment, [])
  assert.deepEqual(create().inventory, defaults)
})

test('loading preserves saved chief promotions and explicit non-chief roles over type defaults', () => {
  const { applyUnitSpawnConfiguration } = loadUnitInitialization()
  const { heroCanCommand } = loadTsModule('app/lib/chief.ts')
  for (const [defaultRole, savedRole, expected] of [
    [false, true, true],
    [true, false, false],
    [false, false, false],
    [true, undefined, true],
    [false, undefined, false],
  ]) {
    const unit = {
      context: { map: { grid: [[{ z: 0 }]] } },
      assignProperties(values) { Object.assign(this, values) },
    }
    const saved = JSON.parse(JSON.stringify({ type: 'Hero', i: 0, j: 0, isChief: savedRole }))
    applyUnitSpawnConfiguration(unit, {
      ...saved,
      owner: { config: { units: { Hero: { isChief: defaultRole } } } },
    })
    assert.equal(unit.isChief, expected)
    assert.equal(heroCanCommand(unit), expected)
  }
})

test('villager construction initializes legacy schedules and restores saved times independently', () => {
  const { applyUnitSpawnConfiguration } = loadUnitInitialization()
  const create = dailySchedule => {
    const unit = {
      context: { map: { grid: [[{ z: 0 }]] } },
      assignProperties(values) { Object.assign(this, values) },
    }
    applyUnitSpawnConfiguration(unit, {
      owner: { config: { units: { Villager: {} } } },
      type: 'Villager', label: 'legacy-villager', i: 0, j: 0, dailySchedule,
    })
    return unit
  }
  const legacy = create()
  assert.ok(legacy.dailySchedule)
  assert.deepEqual(create().dailySchedule, legacy.dailySchedule)
  const saved = { wakeMinute: 365, workStartMinute: 425, workEndMinute: 1085, bedMinute: 1325 }
  const restored = create(saved)
  assert.deepEqual(restored.dailySchedule, saved)
  assert.notEqual(restored.dailySchedule, saved)
})
