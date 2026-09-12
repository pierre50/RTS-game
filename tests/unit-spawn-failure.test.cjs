const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('a missing spritesheet during construction leaves no registered unit or blocked cell', () => {
  const cell = {
    has: null,
    solid: false,
    corpses: new Set(),
    place(unit) {
      this.has = unit
    },
  }
  const bucket = new Set()
  const owner = { units: [], corpses: [], civ: 'Hellas' }
  const context = {
    map: {
      addToInstanceBucket: unit => bucket.add(unit),
      removeFromInstanceBucket: unit => bucket.delete(unit),
    },
  }
  const initialization = loadTsModule('app/classes/unit/UnitInitialization.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { has: () => false, get: () => undefined } } },
      '../../lib': { getEntityCell: () => cell },
      '../../lib/chief': {},
      '../../lib/equipment/equipmentStats': {},
      '../../lib/horses/horseColors': {},
      '../../lib/lang': {},
      '../../lib/lpc': {},
      '../../lib/audio/settings': {},
      '../../lib/units/unitEnergy': {},
      '../../lib/units/unitHealth': {},
      '../../lib/units/unitWorkAppearance': {
        applyUnitActionFrameSequence() {},
        getUnitWorkActionSheet: () => 'actionSheet',
      },
      '../../ui/entity/UnitInterface': {},
      './UnitActions': {},
      './UnitCombat': {},
      './UnitCommands': {},
      './UnitLifecycle': {},
      './movement/UnitMovement': {},
    },
  })
  let failedUnit
  class Instance {
    constructor(context) {
      this.context = context
    }
    stopInterval() {}
    stopTimeout() {}
    destroy() {
      this.destroyed = true
    }
  }
  const { Unit } = loadTsModule('app/classes/unit/Unit.ts', {
    mocks: {
      '../Instance': { Instance },
      '../../lib': {},
      './UnitRuntimeShape': {},
      '../../lib/units/unitEnergy': {},
      '../../lib/units/unitHealth': {},
      './UnitBanditDebug': {},
      './UnitAppearanceLayers': {},
      './UnitStateHandlers': {},
      './UnitVisualState': {},
      './UnitOrders': {},
      './UnitMountedVisuals': { removeMountedHorseSprite() {} },
      './UnitInitialization': {
        ...initialization,
        initializeUnitServices() {},
        initializeUnitRuntimeState() {},
        initializeUnitWorkRole() {},
        setupUnitInterface() {},
        applyUnitSpawnConfiguration(unit) {
          failedUnit = unit
          Object.assign(unit, { owner, type: 'Villager', assets: { standingSheet: 'missing-villager' } })
          return cell
        },
      },
    },
  })
  assert.throws(() => new Unit({}, context), /Missing standing spritesheet for Villager \(Hellas\): missing-villager/)
  assert.equal(cell.has, null)
  assert.equal(cell.solid, false)
  assert.equal(cell.corpses.size, 0)
  assert.equal(bucket.size, 0)
  assert.deepEqual(owner.units, [])
  assert.deepEqual(owner.corpses, [])
  assert.equal(failedUnit.destroyed, true)
})
