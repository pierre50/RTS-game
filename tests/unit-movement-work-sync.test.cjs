const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadUnitMovement(calls) {
  const filename = path.join(__dirname, '../app/classes/unit/movement/UnitMovement.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const constants = {
    ACTION_TYPES: {
      captureHorse: 'captureHorse',
      hunt: 'hunt',
      takemeat: 'takemeat',
    },
    BUILDING_TYPES: {},
    FAMILY_TYPES: { animal: 'animal', building: 'building' },
    MINING_RESOURCE_CONFIG: {},
    RELIEF_CLIMB_SPEED_MULTIPLIER: 1,
    RELIEF_LIFT_SMOOTHING: 0.2,
    SHEET_TYPES: { walking: 'walking' },
    UNIT_TYPES: { villager: 'Villager' },
    WORK_TYPES: { horseCapture: 'horseCapture', hunter: 'hunter' },
  }
  function loadTsFile(tsFilename) {
    const tsSource = fs.readFileSync(tsFilename, 'utf8')
    const { code: tsCode } = babel.transformSync(tsSource, {
      filename: tsFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', tsCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }
  const mocks = {}
  const localRequire = request => {
    request = request.replace(/^\.\.\/\.\.\/\.\.\//, '../../')
    if (request === '../../constants') return constants
    if (request === '../../lib') {
      return {
        canUpdateMinimap: () => false,
        cartesianToIsometric: point => point,
        clearVillagerAutonomy: () => {},
        degreeToDirection: () => 'south',
        findInstancesInSight: () => [],
        findReachableFleeCell: () => null,
        getCellsAroundPoint: () => [],
        getClosestInstanceWithPath: () => null,
        getMiningActions: () => ['minestone', 'minegold'],
        getGroundReliefLevel: () => 0,
        getInstanceClosestFreeCellPath: () => [],
        getInstanceDegree: () => 0,
        getInstancePath: () => [],
        getInstanceZIndex: () => 0,
        getRoundedIsoFootprintPoints: () => [],
        instanceContactInstance: () => true,
        instancesDistance: () => 0,
        isometricToCartesian: point => point,
        moveTowardPoint: () => false,
        playMovementSurfaceAudio: () => {},
        resumeVillagerAutonomy: () => false,
        showBlockedFeedback: () => {},
        showConfusionFeedback: () => {},
        updateInstanceRenderVisibility: () => {},
        updateInstanceVisibility: () => {},
      }
    }
    if (request === '../../lib/mapSpaces') {
      return {
        getEntitySpaceMapLike: unit => unit?.context?.map ?? null,
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
        sameCellMapSpace: () => true,
        sameMapSpace: () => true,
      }
    }
    if (request === '../../lib/buildings/passageCells') {
      return {
        canUnitWaitOnCell: (_unit, cell) =>
          Boolean(cell && !cell.solid && cell.category !== 'Water' && !cell.border && !cell.waterBorder),
        createReservedPassageCellLookup: () => ({
          has: () => false,
          size: 0,
        }),
        findNearestPassageWaitingCell: () => null,
        routeUnitAwayFromPassageCell: () => false,
        shouldUnitAvoidPassageStop: () => false,
        unitHasActivePassageStopIntent: () => false,
      }
    }
    if (request === '../../lib/units/unitControl') return { isHeroControlled: () => false }
    if (request === '../../lib/hero/heroActionRange') return { isHeroActionInRange: () => false }
    if (request === '../../lib/combat/combatBehavior') return { markCombatFlee: () => {} }
    if (request === '../../lib/units/unitEnergy')
      return { cancelEnergyWait: () => {}, getEnergyMoveSpeedMultiplier: () => 1 }
    if (request === '../../lib/units/unitLocomotion')
      return loadTsFile(path.join(__dirname, '../app/lib/units/unitLocomotion.ts'))
    if (request === '../../lib/units/unitCrouchPose') {
      return {
        applyUnitCrouchPose: () => {},
        resetUnitCrouchPose: () => {},
      }
    }
    if (request === '../../lib/units/unitWalkingAnimation') return { applyUnitWalkingAnimationSpeed: () => {} }
    if (request === '../../services/rest/UnitSleepVisuals') return { keepSleepingOutsideVisual: () => {} }
    if (request === '../../lib/equipment/equipmentStats') return { getUnitCombatRange: () => 4 }
    if (request === './UnitCommands' || request === '../UnitCommands') {
      return {
        applyWorkForAction: (unit, work, action) => {
          calls.push(['applyWorkForAction', work, action])
          unit.work = work
          unit.action = action
        },
      }
    }
    if (request === './movement/UnitDirectMovement' || request === './UnitDirectMovement') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitDirectMovement.ts'))
    }
    if (request === './movement/UnitMovementRouting' || request === './UnitMovementRouting') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitMovementRouting.ts'))
    }
    if (request === './movement/UnitPathMovement' || request === './UnitPathMovement') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitPathMovement.ts'))
    }
    if (request === './movement/UnitHeroDirectMovementCollision' || request === './UnitHeroDirectMovementCollision') {
      return {
        blocksHeroDirectMoveWithRoundedFootprint: () => false,
        blocksHeroDirectMoveWithSoftBody: () => false,
        createHeroTerrainCollisionBlocker: () => null,
        getHeroCollisionFootprintPoints: () => [],
        getHeroDirectMoveBlockerAtPoint: () => null,
        getHeroTerrainCollisionBlockerNearPoint: () => null,
        isHeroTerrainCollisionCell: () => false,
      }
    }
    if (request === './movement/UnitMovementDebug' || request === './UnitMovementDebug') {
      return {
        debugBlockedDirectMove: () => {},
        debugCombatMove: () => {},
        debugDirectMoveProbe: () => {},
        debugHuntRangeCheck: () => {},
      }
    }
    if (request === './movement/UnitMovementHelpers' || request === './UnitMovementHelpers') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitMovementHelpers.ts'))
    }
    if (request === './movement/UnitAffectNewDest' || request === './UnitAffectNewDest') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitAffectNewDest.ts'))
    }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { UnitMovement: module.exports.UnitMovement, constants }
}

function makeUnit(constants, calls) {
  const unit = {
    type: constants.UNIT_TYPES.villager,
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    action: null,
    context: { map: { grid: [[{ solid: false }]] } },
    path: [],
    sprite: { playing: false, play: () => {} },
    handleChangeDest: () => calls.push(['handleChangeDest']),
    stopInterval: () => calls.push(['stopInterval']),
    isUnitAtDest: () => true,
    setDest: target => {
      unit.dest = target
    },
    getAction: action => calls.push(['getAction', action]),
  }
  return unit
}

test('villager movement syncs hunting actions to hunter work and capture to horseCapture work', () => {
  const calls = []
  const { UnitMovement, constants } = loadUnitMovement(calls)
  const target = { family: constants.FAMILY_TYPES.animal, label: 'target-1', i: 0, j: 0, x: 0, y: 0 }

  for (const [action, expectedWork] of [
    [constants.ACTION_TYPES.hunt, constants.WORK_TYPES.hunter],
    [constants.ACTION_TYPES.takemeat, constants.WORK_TYPES.hunter],
    [constants.ACTION_TYPES.captureHorse, constants.WORK_TYPES.horseCapture],
  ]) {
    const unit = makeUnit(constants, calls)
    new UnitMovement(unit).sendToEvt(target, action, { forceRepath: true })
    assert.deepEqual(calls.filter(call => call[0] === 'applyWorkForAction').at(-1), [
      'applyWorkForAction',
      expectedWork,
      action,
    ])
  }
})
