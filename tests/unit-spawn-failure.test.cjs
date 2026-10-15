const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('unit construction cleans failed spawns and keeps the runtime separate from its display', () => {
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
      '../../lib/units/visuals/unitWorkAppearance': {
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
      '../../lib': { uuidv4: () => 'unit-test' },
      '../../lib/mapSpaces': { getEntitySpaceMapLike: () => null },
      '../../rendering/UnitView': { unitVisualState: () => ({}) },
      '../../rendering/pixi/PixiUnitView': {
        PixiUnitView: class {
          constructor() {
            this.container = {
              destroyed: false,
              x: 0,
              y: 0,
              destroy() {
                this.destroyed = true
              },
            }
          }
          mount() {}
          unmount() {}
        },
      },
      './UnitRuntimeShape': {},
      '../../lib/units/unitEnergy': {},
      './UnitBanditDebug': {},
      './appearance/UnitAppearanceLayers': {},
      './UnitStateHandlers': {},
      './appearance/UnitVisualState': {},
      './UnitOrders': {},
      './appearance/UnitMountedVisuals': { removeMountedHorseSprite() {} },
      './UnitInitialization': {
        ...initialization,
        initializeUnitServices() {},
        initializeUnitRuntimeState() {},
        initializeUnitWorkRole() {},
        setupUnitInterface() {},
        registerInitialUnitMapPresence(unit) {
          unit.currentCell = cell
          cell.place(unit)
          owner.units.push(unit)
          bucket.add(unit)
        },
        loadConfiguredUnitSpritesheets() {},
        setupUnitCommandDispatch() {},
        scheduleInitialUnitVisibilityUpdate() {},
        applyUnitSpawnConfiguration(unit, options) {
          failedUnit = unit
          Object.assign(unit, { owner, type: 'Villager', assets: { standingSheet: 'missing-villager' } })
          if (options.valid) unit.standingSheet = { textures: {} }
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

  const workingUnit = new Unit({ valid: true }, context)
  assert.equal(workingUnit instanceof Instance, false)
  assert.notEqual(workingUnit.displayObject, workingUnit)
  workingUnit.x = 24
  workingUnit.y = 48
  assert.deepEqual([workingUnit.displayObject.x, workingUnit.displayObject.y], [24, 48])
})
