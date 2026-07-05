const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const runtimeTypesMock = new Proxy(
  {},
  {
    get: (_target, prop) => (prop === 'unsetRuntimeCoordinate' ? () => null : value => value),
  }
)

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../types/runtime') return runtimeTypesMock
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
    convert: 'convert',
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
    watchTower: 'WatchTower',
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
    priest: 'Priest',
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

test('switching a recolored sprite back to blue clears its color filter', () => {
  const { changeSpriteColor } = loadModule('app/lib/graphics/colors.ts', {
    'pixi.js': { Texture: { from: () => ({}) } },
    'pixi-filters': { MultiColorReplaceFilter: class {} },
  })
  const sprite = { filters: ['red-filter'] }

  changeSpriteColor(sprite, 'blue')

  assert.equal(sprite.filters, null)
})

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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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

test('converted units stop old orders, switch owner, and refresh idle color', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: {},
      SOUND_CUES: { villager: {} },
      TYPE_ACTION: {},
    },
    '../../lib': {
      boardTransport: () => {},
      canUpdateMinimap: () => false,
      changeSpriteColor: (_sprite, color) => calls.push(['changeSpriteColor', color]),
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: target => calls.push(['updateInstanceVisibility', target.owner.color]),
    },
    '../projectile': { Projectile: class {} },
    '../../lib/buildings/towers': {
      getTowerType: () => constants.BUILDING_TYPES.watchTower,
      isTower: target => target?.type === constants.BUILDING_TYPES.watchTower,
    },
  })
  const oldOwner = { color: 'red', label: 'enemy', population: 1, units: [] }
  const newOwner = { color: 'blue', isPlayed: true, label: 'player', population: 0, units: [], technologies: [] }
  const target = {
    action: constants.ACTION_TYPES.attack,
    actionLocked: true,
    blockedGatherApproach: { target: 'tree' },
    dest: { label: 'old-target' },
    family: constants.FAMILY_TYPES.unit,
    inactif: false,
    owner: oldOwner,
    path: [{ i: 1, j: 1 }],
    pendingOrder: { dest: { label: 'queued' } },
    previousDest: { label: 'previous' },
    previousWork: constants.WORK_TYPES.attacker,
    realDest: { i: 1, j: 1 },
    selected: false,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: {
      onComplete: () => {},
      onFrameChange: () => {},
      onLoop: () => {},
    },
    stopInterval: () => calls.push(['stopInterval']),
  }
  oldOwner.units.push(target)
  const priest = {
    context: {
      menu: {
        updatePlayerMiniMapEvt: () => {},
        updateTopbar: () => calls.push(['updateTopbar']),
      },
      player: {},
    },
    owner: newOwner,
    stop: () => calls.push(['priestStop']),
  }

  const converted = new UnitActions(priest).convertTarget(target)

  assert.equal(converted, true)
  assert.equal(target.owner, newOwner)
  assert.equal(oldOwner.units.includes(target), false)
  assert.equal(newOwner.units.includes(target), true)
  assert.equal(target.action, null)
  assert.equal(target.dest, null)
  assert.equal(target.realDest, null)
  assert.equal(target.actionLocked, false)
  assert.equal(target.pendingOrder, null)
  assert.equal(target.blockedGatherApproach, null)
  assert.equal(target.inactif, true)
  assert.deepEqual(target.path, [])
  assert.deepEqual(
    calls.filter(([name]) => name === 'setTextures' || name === 'changeSpriteColor'),
    [
      ['setTextures', constants.SHEET_TYPES.standing],
      ['changeSpriteColor', 'blue'],
    ]
  )
})

test('converted buildings keep their source civilization and age assets', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: {},
      SOUND_CUES: { villager: {} },
      TYPE_ACTION: {},
    },
    '../../lib': {
      boardTransport: () => {},
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: target => calls.push(['updateInstanceVisibility', target.assetCiv, target.assetAge]),
    },
    '../projectile': { Projectile: class {} },
    '../../lib/buildings/towers': {
      getTowerType: () => constants.BUILDING_TYPES.watchTower,
      isTower: target => target?.type === constants.BUILDING_TYPES.watchTower,
    },
  })
  const oldOwner = {
    age: 1,
    buildings: [],
    civ: 'Egyptian',
    color: 'red',
    hasBuilt: [],
    label: 'egypt',
    populationMax: 0,
  }
  const newOwner = {
    age: 3,
    buildings: [],
    civ: 'Greek',
    color: 'blue',
    hasBuilt: [],
    isPlayed: true,
    label: 'greek',
    populationMax: 0,
  }
  const target = {
    clearRallyPoint: () => calls.push(['clearRallyPoint']),
    family: constants.FAMILY_TYPES.building,
    finalTexture: () => calls.push(['finalTexture', target.assetCiv, target.assetAge, target.assetType]),
    isBuilt: true,
    owner: oldOwner,
    queue: ['old-unit'],
    selected: false,
    sprite: {},
    stopInterval: () => calls.push(['stopInterval']),
    technologies: [],
    type: 'TownCenter',
    units: [],
  }
  oldOwner.buildings.push(target)
  const priest = {
    context: {
      menu: {
        getRallyPointButton: () => ({}),
        updatePlayerMiniMapEvt: () => {},
        updateTopbar: () => calls.push(['updateTopbar']),
      },
      player: {},
    },
    owner: newOwner,
    stop: () => calls.push(['priestStop']),
  }

  const converted = new UnitActions(priest).convertTarget(target)

  assert.equal(converted, true)
  assert.equal(target.owner, newOwner)
  assert.equal(target.assetCiv, 'Egyptian')
  assert.equal(target.assetAge, 1)
  assert.equal(target.assetType, 'TownCenter')
  assert.deepEqual(
    calls.filter(([name]) => name === 'finalTexture'),
    [['finalTexture', 'Egyptian', 1, 'TownCenter']]
  )
  assert.equal(oldOwner.buildings.includes(target), false)
  assert.equal(newOwner.buildings.includes(target), true)
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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

test('a blocked gather target sends the villager near it before retrying', () => {
  const target = { label: 'berries-1', i: 3, j: 3, isDestroyed: false }
  const approachCell = { i: 1, j: 3, solid: false, border: false, category: 'Grass' }
  const approachPath = [{ i: 1, j: 3 }]
  const grid = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => ({
      i,
      j,
      solid: false,
      border: false,
      category: 'Grass',
      has: null,
    }))
  )
  grid[target.i][target.j].solid = true
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getCellsAroundPoint: (_i, _j, _grid, distance, condition) =>
      distance === 2 && condition(approachCell) ? [approachCell] : [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: (_unit, i, j) => (i === approachCell.i && j === approachCell.j ? approachPath : []),
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    actionLocked: false,
    category: 'Unit',
    context: {
      map: { grid },
      performance: { record: () => {} },
    },
    dest: null,
    getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.forageberry,
    handleChangeDest: () => {},
    i: 0,
    isDead: false,
    isUnitAtDest: () => false,
    j: 0,
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: nextTarget => {
      unit.dest = nextTarget
    },
    setPath: path => {
      unit.path = path
    },
    stopInterval: () => {},
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.forager,
  }

  new UnitMovement(unit).sendToEvt(target, constants.ACTION_TYPES.forageberry)

  assert.equal(unit.dest, target)
  assert.equal(unit.action, constants.ACTION_TYPES.forageberry)
  assert.equal(unit.blockedGatherApproach.target, target)
  assert.deepEqual(unit.path, approachPath)
})

test('a villager fishing a water resource keeps the fish target and paths to reachable shore', () => {
  const fish = { label: 'fish-1', i: 2, j: 2, x: 20, y: 20, category: 'Fish', isDestroyed: false }
  const shoreCell = { i: 1, j: 2, solid: false, border: false, category: 'Grass' }
  const shorePath = [{ i: 1, j: 2 }]
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      solid: false,
      border: false,
      category: i === fish.i && j === fish.j ? 'Water' : 'Grass',
      has: null,
    }))
  )
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'south',
    findInstancesInSight: () => [],
    getCellsAroundPoint: (_i, _j, _grid, distance, condition) =>
      distance === 1 && condition(shoreCell) ? [shoreCell] : [],
    getClosestInstanceWithPath: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: (_unit, i, j) => (i === shoreCell.i && j === shoreCell.j ? shorePath : []),
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    actionLocked: false,
    category: 'Unit',
    context: {
      map: { grid },
      performance: { record: () => {} },
    },
    dest: null,
    getActionCondition: (candidate, action) => candidate === fish && action === constants.ACTION_TYPES.fishing,
    handleChangeDest: () => {},
    i: 0,
    isDead: false,
    isUnitAtDest: () => false,
    j: 0,
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: nextTarget => {
      unit.dest = nextTarget
    },
    setPath: path => {
      unit.path = path
    },
    stopInterval: () => {},
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.fisher,
  }

  new UnitMovement(unit).sendToEvt(fish, constants.ACTION_TYPES.fishing)

  assert.equal(unit.dest, fish)
  assert.equal(unit.action, constants.ACTION_TYPES.fishing)
  assert.deepEqual(unit.path, shorePath)
})

test('a villager retries the original gather order after approaching a blocked target', () => {
  const target = { label: 'berries-1', isDestroyed: false }
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
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
    },
  })
  const unit = {
    blockedGatherApproach: { target, action: constants.ACTION_TYPES.forageberry },
    getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.forageberry,
    sendToEvt: (candidate, action, options) => calls.push([candidate.label, action, options]),
  }

  const handled = new UnitMovement(unit).retryBlockedGatherApproach()

  assert.equal(handled, true)
  assert.equal(unit.blockedGatherApproach, null)
  assert.deepEqual(calls, [
    ['berries-1', constants.ACTION_TYPES.forageberry, { forceRepath: true, allowBlockedGatherApproach: false }],
  ])
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/UnitMovement.ts', {
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

test('a farmer returns to the same farm after delivering food', () => {
  const farm = {
    label: 'farm-1',
    family: constants.FAMILY_TYPES.building,
    type: constants.BUILDING_TYPES.farm,
  }
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: {},
      SOUND_CUES: { villager: {} },
      TYPE_ACTION: {},
    },
    '../../lib': {
      boardTransport: () => {},
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: () => {},
    },
    '../projectile': { Projectile: class {} },
    '../../lib/buildings/towers': {
      getTowerType: () => constants.BUILDING_TYPES.watchTower,
      isTower: target => target?.type === constants.BUILDING_TYPES.watchTower,
    },
  })
  const unit = {
    context: { map: { grid: [] } },
    previousDest: farm,
    previousWork: constants.WORK_TYPES.farmer,
    work: constants.WORK_TYPES.farmer,
    getActionCondition: (target, action) => target === farm && action === constants.ACTION_TYPES.farm,
    sendToFarm: (target, immediate) => calls.push(['sendToFarm', target.label, immediate]),
    stop: () => calls.push(['stop']),
  }

  new UnitActions(unit).goBackToPrevious()

  assert.deepEqual(calls, [['sendToFarm', 'farm-1', true]])
  assert.equal(unit.previousDest, null)
})

test('delivery orders bypass the human command throttle', () => {
  const resource = { label: 'farm-1' }
  const granary = {
    label: 'granary-1',
    type: constants.BUILDING_TYPES.granary,
  }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
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
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
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
