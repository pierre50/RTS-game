const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: {
    build: 'build',
    delivery: 'delivery',
    hunt: 'hunt',
    takemeat: 'takemeat',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  SHEET_TYPES: {
    walking: 'walking',
  },
  STEP_TIME: 100,
  UNIT_TYPES: {
    villager: 'villager',
  },
  WORK_TYPES: {
    attacker: 'attacker',
    builder: 'builder',
    healer: 'healer',
  },
}

test('sets an automatically selected destination before starting its action', () => {
  const oldTarget = { label: 'empty-tree', family: 'resource' }
  const newTarget = { label: 'tree-2', family: 'resource', x: 10, y: 12 }
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [newTarget],
    getClosestInstanceWithPath: () => ({ instance: newTarget, path: [] }),
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 90,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => true,
    instancesDistance: () => 0,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: 'chopwood',
    dest: oldTarget,
    previousDest: null,
    type: constants.UNIT_TYPES.villager,
    work: 'woodcutter',
    stopInterval: () => {},
    getActionCondition: () => true,
    setDest: target => {
      calls.push(['setDest', target.label])
      unit.dest = target
    },
    getAction: () => {
      calls.push(['getAction', unit.dest.label])
    },
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [
    ['setDest', 'tree-2'],
    ['getAction', 'tree-2'],
  ])
})

test('destination checks stay pure when no destination exists', () => {
  let redispatched = false
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const movement = new UnitMovement({
    affectNewDest: () => {
      redispatched = true
    },
  })

  assert.equal(movement.isUnitAtDest('chopwood', null), false)
  assert.equal(redispatched, false)
})

test('manual move orders cancel previous villager work when the unit arrives', () => {
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    dest: { label: 'empty-cell', family: 'cell' },
    loading: 4,
    previousDest: { label: 'berry-bush', family: 'resource' },
    previousWork: 'forager',
    type: constants.UNIT_TYPES.villager,
    work: 'forager',
    stopInterval: () => calls.push(['stopInterval']),
    goBackToPrevious: () => calls.push(['goBackToPrevious']),
    sendToDelivery: () => calls.push(['sendToDelivery']),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [['stopInterval'], ['stop']])
})

test('boats flee to water cells when attacked', () => {
  const grid = Array.from({ length: 10 }, (_, i) =>
    Array.from({ length: 10 }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Grass',
      solid: false,
    }))
  )
  grid[8][5].category = 'Water'
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    category: 'Boat',
    context: { map: { grid } },
    i: 5,
    j: 5,
    sendTo: cell => calls.push(cell),
    sight: 3,
    stop: () => calls.push('stop'),
  }
  const attacker = { i: 4, j: 5 }

  new UnitMovement(unit).runaway(attacker)

  assert.deepEqual(calls, [grid[8][5]])
})

test('an idle builder picks a nearby unfinished building after completing its current site', () => {
  const completedBuilding = { label: 'house-1', family: constants.FAMILY_TYPES.building, isBuilt: true }
  const nearbyBuilding = { label: 'house-2', family: constants.FAMILY_TYPES.building, isBuilt: false }
  const path = [{ i: 4, j: 5 }]
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: (unit, condition) => (condition(nearbyBuilding) ? [nearbyBuilding] : []),
    getClosestInstanceWithPath: () => ({ instance: nearbyBuilding, path }),
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: constants.ACTION_TYPES.build,
    buildQueue: [],
    dest: completedBuilding,
    previousDest: null,
    previousWork: null,
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
    stopInterval: () => {},
    getActionCondition: target => target === nearbyBuilding,
    setDest: target => {
      calls.push(['setDest', target.label])
      unit.dest = target
    },
    setPath: targetPath => calls.push(['setPath', targetPath]),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [
    ['setDest', 'house-2'],
    ['setPath', path],
  ])
  assert.equal(unit.work, constants.WORK_TYPES.builder)
})
