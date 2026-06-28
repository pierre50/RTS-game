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
    chopwood: 'chopwood',
    delivery: 'delivery',
    farm: 'farm',
    fishing: 'fishing',
    forageberry: 'forageberry',
    hunt: 'hunt',
    minegold: 'minegold',
    minestone: 'minestone',
    takemeat: 'takemeat',
  },
  BUILDING_TYPES: {
    dock: 'Dock',
    farm: 'Farm',
    granary: 'Granary',
    storagePit: 'StoragePit',
    townCenter: 'TownCenter',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  MENU_INFO_IDS: {
    type: 'type',
  },
  SHEET_TYPES: {
    walking: 'walking',
  },
  STEP_TIME: 100,
  UNIT_TYPES: {
    villager: 'villager',
  },
  WORK_FOOD_TYPES: ['farmer'],
  WORK_TYPES: {
    attacker: 'attacker',
    builder: 'builder',
    farmer: 'farmer',
    fisher: 'fisher',
    forager: 'forager',
    goldminer: 'goldminer',
    healer: 'healer',
    stoneminer: 'stoneminer',
    woodcutter: 'woodcutter',
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

test('land attackers keep the attack order when targeting an enemy boat', () => {
  const path = [{ i: 5, j: 4 }]
  const grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ solid: false, has: null })))
  grid[5][5].solid = true
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => path,
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
  const dest = { label: 'enemy-boat', i: 5, j: 5, solid: true, isDestroyed: false }
  const unit = {
    action: null,
    actionLocked: false,
    category: 'Infantry',
    context: {
      map: { grid },
      performance: { record: () => {} },
    },
    dest: null,
    affectNewDest: () => {},
    getActionCondition: () => true,
    handleChangeDest: () => {},
    i: 1,
    isDead: false,
    isUnitAtDest: () => false,
    j: 1,
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: target => {
      unit.dest = target
    },
    setPath: targetPath => {
      unit.path = targetPath
    },
    stopInterval: () => {},
  }

  new UnitMovement(unit).sendToEvt(dest, 'attack')

  assert.equal(unit.dest, dest)
  assert.equal(unit.action, 'attack')
  assert.deepEqual(unit.path, path)
})

test('boats keep the attack order when targeting an enemy land unit', () => {
  const path = [{ i: 4, j: 5 }]
  const grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ solid: false, has: null })))
  grid[5][5].solid = true
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => path,
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
  const dest = { label: 'enemy-archer', i: 5, j: 5, solid: true, isDestroyed: false }
  const unit = {
    action: null,
    actionLocked: false,
    category: 'Boat',
    context: {
      map: { grid },
      performance: { record: () => {} },
    },
    dest: null,
    affectNewDest: () => {},
    getActionCondition: () => true,
    handleChangeDest: () => {},
    i: 1,
    isDead: false,
    isUnitAtDest: () => false,
    j: 1,
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: target => {
      unit.dest = target
    },
    setPath: targetPath => {
      unit.path = targetPath
    },
    stopInterval: () => {},
  }

  new UnitMovement(unit).sendToEvt(dest, 'attack')

  assert.equal(unit.dest, dest)
  assert.equal(unit.action, 'attack')
  assert.deepEqual(unit.path, path)
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

test('a villager builds a granary then starts gathering nearby berries', () => {
  const granary = {
    label: 'granary-1',
    family: constants.FAMILY_TYPES.building,
    type: constants.BUILDING_TYPES.granary,
    isBuilt: true,
  }
  const berryBush = { label: 'berries-1' }
  const tree = { label: 'tree-1' }
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: (_unit, condition) => [tree, berryBush].filter(condition),
    getClosestInstanceWithPath: (_unit, targets) => ({ instance: targets[0], path: [{ i: 1, j: 1 }] }),
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
    dest: granary,
    previousDest: null,
    previousWork: null,
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
    stopInterval: () => {},
    getActionCondition: (target, action) => target === berryBush && action === constants.ACTION_TYPES.forageberry,
    sendToBerrybush: (target, immediate) => calls.push(['sendToBerrybush', target.label, immediate]),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [['sendToBerrybush', 'berries-1', true]])
})

test('a villager builds a town center then starts gathering any nearby compatible resource', () => {
  const townCenter = {
    label: 'town-center-1',
    family: constants.FAMILY_TYPES.building,
    type: constants.BUILDING_TYPES.townCenter,
    isBuilt: true,
  }
  const tree = { label: 'tree-1' }
  const calls = []
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: (_unit, condition) => [tree].filter(condition),
    getClosestInstanceWithPath: (_unit, targets) => ({ instance: targets[0], path: [{ i: 1, j: 1 }] }),
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
    dest: townCenter,
    previousDest: null,
    previousWork: null,
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
    stopInterval: () => {},
    getActionCondition: (target, action) => target === tree && action === constants.ACTION_TYPES.chopwood,
    sendToTree: (target, immediate) => calls.push(['sendToTree', target.label, immediate]),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [['sendToTree', 'tree-1', true]])
})

test('delivery orders bypass the human command throttle', () => {
  const resource = { label: 'farm-1' }
  const granary = {
    label: 'granary-1',
    type: constants.BUILDING_TYPES.granary,
  }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.js', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: (_unit, target, action) => action === constants.ACTION_TYPES.delivery && target === granary,
      getClosestInstance: () => granary,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      getWorkWithLoadingType: () => null,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    category: 'Unit',
    context: { map: { grid: [[{ label: 'current-cell' }]] } },
    dest: resource,
    i: 0,
    j: 0,
    loadingType: 'wheat',
    owner: {
      buildings: [granary],
      config: {
        buildings: {
          Granary: { accept: ['wheat'] },
          StoragePit: { accept: ['wood'] },
        },
      },
    },
    sendTo: () => calls.push(['sendTo']),
    sendToEvt: (target, action) => calls.push(['sendToEvt', target.label, action]),
  }

  new UnitCommands(unit).sendToDelivery()

  assert.deepEqual(calls, [['sendToEvt', 'granary-1', constants.ACTION_TYPES.delivery]])
  assert.equal(unit.previousDest, resource)
})

test('immediate farm orders bypass the human command throttle', () => {
  const farm = { label: 'farm-1', type: constants.BUILDING_TYPES.farm }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.js', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: (_unit, target, action) => target === farm && action === constants.ACTION_TYPES.farm,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      getWorkWithLoadingType: () => null,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    action: null,
    allAssets: null,
    buildQueue: [],
    context: { menu: { updateInfo: () => {} } },
    dest: null,
    isDead: false,
    loading: 0,
    owner: { isPlayed: true, selectedUnit: null },
    path: [],
    previousDest: null,
    previousWork: null,
    sendTo: () => calls.push(['sendTo']),
    sendToEvt: (target, action) => calls.push(['sendToEvt', target.label, action]),
    type: constants.UNIT_TYPES.villager,
    updateInterfaceLoading: () => calls.push(['updateInterfaceLoading']),
    work: constants.WORK_TYPES.builder,
  }

  new UnitCommands(unit).sendToFarm(farm, true)

  assert.deepEqual(
    calls.filter(call => call[0] !== 'updateInterfaceLoading'),
    [['sendToEvt', 'farm-1', constants.ACTION_TYPES.farm]]
  )
  assert.equal(unit.work, constants.WORK_TYPES.farmer)
})
