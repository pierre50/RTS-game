const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

const runtimeTypesMock = new Proxy(
  {},
  {
    get: (_target, prop) => (prop === 'unsetRuntimeCoordinate' ? () => null : value => value),
  }
)

const unitExperienceMock = {
  LOADING_XP_CATEGORY: {},
  WORK_XP_CATEGORY: {},
  XP_BUILD_TICK: 2,
  XP_CATEGORIES: {},
  XP_CONVERT_SUCCESS: 30,
  XP_FELL_TREE_TICK: 1,
  XP_KILL_BONUS: 15,
  getBuildRateXpMultiplier: () => 1,
  getCombatXpBonus: () => 0,
  getGatherXpBonus: () => 0,
  getHealingXpBonus: () => 0,
  grantUnitXp: () => {},
}

const entityHealthDisplayMock = {
  syncEntityHealthDisplay: (entity, options = {}) => {
    entity.drawHealthBar?.()
    if (options.menu && (options.forceInfo || entity.selected)) {
      const value =
        options.emptyWhenDepleted && (entity.hitPoints ?? 0) <= 0 ? '' : `${entity.hitPoints}/${entity.totalHitPoints}`
      options.menu.updateInfo?.('hitPoints', value)
    }
  },
}

const unitWorkAppearanceMock = {
  getUnitWorkActionSheet: (unit, work, action) => {
    if (!work) return undefined
    const key = action === 'takemeat' ? 'harvestSheet' : 'actionSheet'
    return unit.allAssets?.[work]?.[key]
  },
  applyUnitWorkAssets: (unit, work, options = {}) => {
    if (!work) return
    const assets = unit.allAssets?.[work]
    if (!assets) return
    unit.actionSheet = unitWorkAppearanceMock.getUnitWorkActionSheet(unit, work, options.action)
    unit.standingSheet = assets.standingSheet
    unit.walkingSheet = assets.walkingSheet
    unit.dyingSheet = assets.dyingSheet
    unit.corpseSheet = assets.corpseSheet
  },
}

function mockRoundedIsoShapePoints({ x, y }) {
  return [
    { x, y: y - 10 },
    { x: x + 64, y },
    { x, y: y + 10 },
    { x: x - 64, y },
  ]
}

function mockPointIsInsidePolygon(points, point) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function mockDistanceToSegment(point, a, b) {
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSq <= 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * segmentX + (point.y - a.y) * segmentY) / segmentLengthSq))
  return Math.hypot(point.x - (a.x + segmentX * t), point.y - (a.y + segmentY * t))
}

function mockDistanceToPolygon(points, point) {
  if (mockPointIsInsidePolygon(points, point)) return 0
  let closest = Infinity
  for (let index = 0; index < points.length; index++) {
    closest = Math.min(closest, mockDistanceToSegment(point, points[index], points[(index + 1) % points.length]))
  }
  return closest
}

function mockDegreeToDirection(degree) {
  const normalized = ((degree % 360) + 360) % 360
  if (normalized >= 337.5 || normalized < 22.5) return 'east'
  if (normalized < 67.5) return 'south-east'
  if (normalized < 112.5) return 'south'
  if (normalized < 157.5) return 'south-west'
  if (normalized < 202.5) return 'west'
  if (normalized < 247.5) return 'north-west'
  if (normalized < 292.5) return 'north'
  return 'north-east'
}

function mockGetInstanceDegree(instance, x, y) {
  return (Math.atan2(y - instance.y, x - instance.x) * 180) / Math.PI
}

function mockGetMiningActions() {
  const configured = Object.values(constants.MINING_RESOURCE_CONFIG ?? {})
    .map(config => config.action)
    .filter(Boolean)
  return configured.length
    ? configured
    : [constants.ACTION_TYPES.minestone, constants.ACTION_TYPES.minegold].filter(Boolean)
}

function mockSyncMovedActionTarget(unit, dest) {
  if (!unit.destHasMoved?.() || !dest || !unit.realDest) return
  unit.realDest.i = dest.i
  unit.realDest.j = dest.j
  unit.realDest.x = dest.x
  unit.realDest.y = dest.y
  const oldDeg = unit.degree
  unit.degree = mockGetInstanceDegree(unit, dest.x, dest.y)
  if (mockDegreeToDirection(oldDeg ?? 0) !== mockDegreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(constants.SHEET_TYPES.action)
  }
}

function mockBuildingFootprintCells(startX, startY, grid, size = 1) {
  const result = []
  const footprintSize = Math.max(1, Math.floor(size))
  const before = Math.floor((footprintSize - 1) / 2)
  const after = footprintSize - before - 1
  for (let i = startX - before; i <= startX + after; i++) {
    for (let j = startY - before; j <= startY + after; j++) {
      if (grid[i]?.[j]) result.push(grid[i][j])
    }
  }
  return result
}

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  function loadTsFile(tsFilename) {
    const source = fs.readFileSync(tsFilename, 'utf8')
    const { code } = babel.transformSync(source, {
      filename: tsFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const module = { exports: {} }
    new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
    return module.exports
  }
  const localRequire = request => {
    request = request.replace(/^\.\.\/\.\.\/\.\.\//, '../../')
    if (request === '../../types/runtime') return runtimeTypesMock
    if (request === '../../lib') {
      const libMock = mocks[request] ?? {}
      return {
        getRoundedIsoShapePoints: libMock.getRoundedIsoShapePoints ?? mockRoundedIsoShapePoints,
        getRoundedIsoFootprintPoints:
          libMock.getRoundedIsoFootprintPoints ?? libMock.getRoundedIsoShapePoints ?? mockRoundedIsoShapePoints,
        pointIsInsidePolygon: libMock.pointIsInsidePolygon ?? mockPointIsInsidePolygon,
        distanceToPolygon: libMock.distanceToPolygon ?? mockDistanceToPolygon,
        getMiningActions: libMock.getMiningActions ?? mockGetMiningActions,
        syncMovedActionTarget: libMock.syncMovedActionTarget ?? mockSyncMovedActionTarget,
        isBanditOwner: owner =>
          Boolean(owner?.devConsoleBanditOwner || (owner?.isPlayed !== true && owner?.name === 'Bandits')),
        isBanditUnit: unit =>
          Boolean(unit?.category === 'Bandit' || unit?.type?.includes?.('Bandit') || unit?.owner?.name === 'Bandits'),
        playAudibleSoundCue: (_instance, cue) => libMock.playSoundCue?.(cue),
        playMovementSurfaceAudio: () => {},
        ...libMock,
      }
    }
    if (request === '../../lib/mapSpaces') {
      const getSpace = (map, spaceId) => map?.spaces?.get?.(spaceId || 'outside') ?? null
      const getSpaceGrid = (entity, map) => getSpace(map, entity?.spaceId)?.grid ?? map?.grid ?? null
      return {
        getEntityCell: (entity, map) =>
          entity?.currentCell ??
          getSpaceGrid(entity, map)?.[entity?.i]?.[entity?.j] ??
          map?.grid?.[entity?.i]?.[entity?.j] ??
          null,
        getEntitySpaceGrid: unit => getSpaceGrid(unit, unit?.context?.map ?? mocks['../../lib']?.map ?? null),
        getEntitySpaceMapLike: unit => unit?.context?.map ?? mocks['../../lib']?.map ?? null,
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
        sameCellMapSpace: () => true,
        sameMapSpace: () => true,
      }
    }
    if (request === '../../lib/buildings/passageCells') {
      const passageCells = mocks[request] ?? {}
      const canUnitWaitOnCell =
        passageCells.canUnitWaitOnCell ??
        ((_unit, cell) =>
          Boolean(cell && !cell.solid && cell.category !== 'Water' && !cell.border && !cell.waterBorder))
      return {
        canUnitUseCellAsIdleDestination:
          passageCells.canUnitUseCellAsIdleDestination ??
          ((unit, cell, options = {}) => {
            if (!canUnitWaitOnCell(unit, cell, options)) return false
            if (cell.waterBorder) return false
            const occupant = cell.has
            return Boolean(!occupant || occupant === unit || occupant.label === unit.label || occupant.isDestroyed)
          }),
        canUnitWaitOnCell,
        createReservedPassageCellLookup:
          passageCells.createReservedPassageCellLookup ??
          (() => ({
            has: () => false,
            size: 0,
          })),
        findNearestPassageWaitingCell: passageCells.findNearestPassageWaitingCell ?? (() => null),
        routeUnitAwayFromPassageCell: passageCells.routeUnitAwayFromPassageCell ?? (() => false),
        shouldUnitAvoidPassageStop: passageCells.shouldUnitAvoidPassageStop ?? (() => false),
        unitHasActivePassageStopIntent: passageCells.unitHasActivePassageStopIntent ?? (() => false),
      }
    }
    if (request === '../../lib/buildings/interiors') {
      const interiors = mocks[request] ?? {}
      return {
        getBuildingInteriorEntryCell:
          interiors.getBuildingInteriorEntryCell ??
          (building => building.context?.map?.grid?.[building.i + 1]?.[building.j + 2] ?? null),
        isBuildingInteriorSupported: interiors.isBuildingInteriorSupported ?? (() => false),
      }
    }
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === '../lpc/generatedPalettes') {
      return {
        LPC_RUNTIME_PALETTES: {},
        LPC_RUNTIME_SOURCE_PALETTES: {},
      }
    }
    if (request === '../../lib/units/unitWorkAppearance') return unitWorkAppearanceMock
    if (request === '../../lib/units/unitExperience') return unitExperienceMock
    if (request === '../../lib/entities/entityHealthDisplay') return entityHealthDisplayMock
    if (request === '../../lib/lang') return { t: value => value }
    if (request === '../../lib/entities/slashRecoveryAnimation') return { playReverseSlashRecovery: () => false }
    if (request === '../../lib/combat/diplomaticAggression') {
      return {
        applyDiplomaticAggression: () => ({ changed: false, hostileNow: false, relation: 'unchanged' }),
      }
    }
    if (request === '../../lib/horses/horseCapture') {
      return {
        getNearestAvailableStableForUnit: () => null,
        routeCapturedHorseToStableWithOwnerContact: () => null,
      }
    }
    if (request === '../../lib/units/unitEnergy') {
      return {
        cancelEnergyWait: unit => {
          unit.waitingForEnergyAction = null
          unit.waitingForEnergyTarget = null
          unit.energyWaitTaskId = null
          unit.combatMode = null
        },
        getEnergyMoveSpeedMultiplier: unit => {
          if (unit.mountedOnHorse) return 1
          if (!unit.totalEnergy || unit.energy == null) return 1
          const ratio = Math.max(0, Math.min(1, unit.energy / unit.totalEnergy))
          return ratio >= 0.5 ? 1 : 0.55 + 0.45 * (ratio / 0.5)
        },
        spendOrWaitForEnergy: () => true,
      }
    }
    if (request === '../../lib/units/unitLocomotion') {
      return loadTsFile(path.join(__dirname, '../app/lib/units/unitLocomotion.ts'))
    }
    if (request === '../../lib/units/unitCrouchPose') {
      return {
        applyUnitCrouchPose: () => {},
        resetUnitCrouchPose: () => {},
      }
    }
    if (request === '../../lib/units/unitWalkingAnimation') {
      return {
        applyUnitWalkingAnimationSpeed: (unit, factor) => {
          unit.appliedWalkingAnimationFactor = factor
        },
      }
    }
    if (request === '../../lib/equipment/equipmentStats') {
      return {
        getUnitCombatRange: unit => unit.range ?? 4,
      }
    }
    if (request === '../../lib/hero/heroActionRange') {
      return {
        isHeroActionInRange: () => false,
      }
    }
    if (request === '../../lib/combat/combatBehavior') {
      return {
        markCombatFlee: unit => {
          unit.combatMode = 'flee'
        },
      }
    }
    if (request === '../../lib/units/unitControl') {
      return {
        canAutoAcquireTarget: () => true,
        canAutoReactToAttack: () => true,
        isHeroControlled: () => false,
        isManualHeroActionReleased: () => false,
        setUnitControlMode: (unit, controlMode) => {
          unit.controlMode = controlMode
        },
      }
    }
    if (request === '../UnitCommands' && Object.hasOwn(mocks, './UnitCommands')) return mocks['./UnitCommands']
    if (request === './UnitCommands' || request === '../UnitCommands') {
      return {
        applyWorkForAction: (unit, work, action) => {
          unit.work = work
          unit.action = action
        },
      }
    }
    if (request === './UnitResourceDeliveryCommands') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitResourceDeliveryCommands.ts'))
    }
    if (
      request === '../UnitResourceDeliveryCommands' ||
      request === '../../classes/unit/UnitResourceDeliveryCommands'
    ) {
      return {
        applyWorkForAction: (unit, work, action) => {
          unit.work = work
          unit.action = action
        },
      }
    }
    if (request === './UnitCaptureHorseAction') return { handleCaptureHorseAction: () => {} }
    if (request === './UnitManualHeroWork') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitManualHeroWork.ts'))
    }
    if (request === './UnitResourceActions') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitResourceActions.ts'))
    }
    if (request === './UnitResourceGathering') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitResourceGathering.ts'))
    }
    if (request === './UnitConversionAction') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitConversionAction.ts'))
    }
    if (request === './UnitDirectedActions') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitDirectedActions.ts'))
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
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitHeroDirectMovementCollision.ts'))
    }
    if (request === './movement/UnitMovementDebug' || request === './UnitMovementDebug') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitMovementDebug.ts'))
    }
    if (request === './movement/UnitMovementHelpers' || request === './UnitMovementHelpers') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitMovementHelpers.ts'))
    }
    if (request === './movement/UnitAffectNewDest' || request === './UnitAffectNewDest') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/movement/UnitAffectNewDest.ts'))
    }
    if (request === './UnitPreviousWork') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitPreviousWork.ts'))
    }
    if (request === '../HeroLassoThrow') return { HeroLassoThrow: class {} }
    return requireFromTsFile(request, filename, mocks)
  }
  return loadTsFile(filename)
}

const constants = {
  CELL_HEIGHT: 32,
  CELL_WIDTH: 64,
  ACTION_TYPES: {
    attack: 'attack',
    build: 'build',
    chopwood: 'chopwood',
    heal: 'heal',
    farm: 'farm',
    forageberry: 'forageberry',
    hunt: 'hunt',
    captureHorse: 'captureHorse',
    convert: 'convert',
    delivery: 'delivery',
    minegold: 'minegold',
    minestone: 'minestone',
    takemeat: 'takemeat',
    train: 'train',
  },
  BUILDING_TYPES: {
    farm: 'Farm',
    granary: 'Granary',
    storagePit: 'StoragePit',
    townCenter: 'TownCenter',
    watchTower: 'WatchTower',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  MENU_INFO_IDS: {
    type: 'type',
  },
  SHEET_TYPES: {
    corpse: 'corpseSheet',
    standing: 'standingSheet',
    walking: 'walking',
  },
  RELIEF_CLIMB_SPEED_MULTIPLIER: 0.7,
  RELIEF_LIFT_SMOOTHING: 1,
  RESOURCE_TYPES: {
    wheat: 'Wheat',
  },
  RESOURCE_STOCKPILE_TYPES: {
    copper: 'copper',
    gold: 'gold',
    iron: 'iron',
    stone: 'stone',
    wood: 'wood',
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
    forager: 'forager',
    goldminer: 'goldminer',
    healer: 'healer',
    horseCapture: 'horseCapture',
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

test('resource gather cadence values are centralized by carried resource type', () => {
  const { RESOURCE_GATHER_SWINGS, LOADING_TYPES } = loadModule('app/constants/entities.ts', {})

  assert.deepEqual(RESOURCE_GATHER_SWINGS, {
    [LOADING_TYPES.berry]: 2,
    [LOADING_TYPES.wheat]: 2,
    [LOADING_TYPES.wood]: 2,
    [LOADING_TYPES.meat]: 3,
    [LOADING_TYPES.stone]: 3,
    [LOADING_TYPES.gold]: 4,
    [LOADING_TYPES.copper]: 3,
    [LOADING_TYPES.iron]: 4,
  })
})

test('train action without a target type stops cleanly without confusion fallback', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const building = {
    family: constants.FAMILY_TYPES.building,
    isBuilt: true,
    label: 'barracks',
    owner: { label: 'p1' },
    type: 'Barracks',
    units: ['Fantassin'],
  }
  const unit = {
    action: constants.ACTION_TYPES.train,
    context: { menu: { showMessage: (...args) => calls.push(['message', ...args]) } },
    dest: building,
    owner: { isPlayed: true, label: 'p1' },
    sprite: {},
    trainingTargetType: null,
    getActionCondition: () => {
      calls.push(['condition'])
      return false
    },
    affectNewDest: () => calls.push(['affectNewDest']),
    stop: () => calls.push(['stop']),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.train)

  assert.equal(unit.trainingTargetType, null)
  assert.deepEqual(calls, [['stop']])
})

test('failed train entry after building cleanup stops without confusion fallback', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const unit = {
    action: constants.ACTION_TYPES.train,
    context: { menu: { showMessage: (...args) => calls.push(['message', ...args]) } },
    owner: { isPlayed: true, label: 'p1' },
    sprite: {},
    trainingTargetType: 'Fantassin',
    getActionCondition: () => true,
    affectNewDest: () => calls.push(['affectNewDest']),
    stop: () => calls.push(['stop']),
  }
  const building = {
    family: constants.FAMILY_TYPES.building,
    isBuilt: true,
    label: 'barracks',
    loading: null,
    owner: unit.owner,
    queue: [],
    technology: null,
    trainingUnit: null,
    type: 'Barracks',
    units: ['Fantassin'],
    startTrainingWithUnit: trainee => {
      trainee.trainingTargetType = null
      return false
    },
  }
  unit.dest = building

  new UnitActions(unit).getAction(constants.ACTION_TYPES.train)

  assert.equal(unit.trainingTargetType, null)
  assert.deepEqual(calls, [['stop']])
})

test('direct texture recoloring bakes and caches animation frames', () => {
  const previousDocument = global.document
  const imageData = { data: new Uint8ClampedArray([0x28, 0x5c, 0xc4, 255, 0x4a, 0x54, 0x62, 255]) }
  let bakedData = null
  let fromCalls = 0
  global.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => imageData,
        putImageData: data => {
          bakedData = new Uint8ClampedArray(data.data)
        },
      }),
    }),
  }

  try {
    const { changeSpriteTexturesColorDirectly } = loadModule('app/lib/graphics/colors.ts', {
      'pixi.js': { Texture: { from: () => ({ recolored: ++fromCalls }) } },
      'pixi-filters': { MultiColorReplaceFilter: class {} },
    })
    const sourceTexture = {
      frame: { x: 0, y: 0, width: 1, height: 1 },
      source: { resource: {}, uid: 'unit-sheet' },
    }

    const first = changeSpriteTexturesColorDirectly([sourceTexture], 'red')
    const second = changeSpriteTexturesColorDirectly([sourceTexture], 'red')

    assert.equal(fromCalls, 1)
    assert.notEqual(first[0], sourceTexture)
    assert.equal(second[0], first[0])
    assert.deepEqual(Array.from(bakedData.slice(4, 7)), [0x4a, 0x54, 0x62])
  } finally {
    global.document = previousDocument
  }
})

test('arbitrary texture recoloring preserves anchors and caches frames', () => {
  const previousDocument = global.document
  const imageData = { data: new Uint8ClampedArray([0xad, 0x6e, 0x51, 255, 0x12, 0x34, 0x56, 255]) }
  let bakedData = null
  let fromCalls = 0
  global.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => imageData,
        putImageData: data => {
          bakedData = new Uint8ClampedArray(data.data)
        },
      }),
    }),
  }

  try {
    const { recolorTextureByMap } = loadModule('app/lib/graphics/colors.ts', {
      'pixi.js': { Texture: { from: () => ({ recolored: ++fromCalls }) } },
      'pixi-filters': { MultiColorReplaceFilter: class {} },
    })
    const sourceTexture = {
      defaultAnchor: { x: 0.5, y: 0.86 },
      frame: { x: 0, y: 0, width: 2, height: 1 },
      source: { resource: {}, uid: 'horse-sheet' },
    }

    const first = recolorTextureByMap(sourceTexture, [[0xad6e51, 0x848795]], 'horse-dark')
    const second = recolorTextureByMap(sourceTexture, [[0xad6e51, 0x848795]], 'horse-dark')

    assert.equal(fromCalls, 1)
    assert.equal(second, first)
    assert.deepEqual(first.defaultAnchor, sourceTexture.defaultAnchor)
    assert.deepEqual(Array.from(bakedData.slice(0, 3)), [0x84, 0x87, 0x95])
    assert.deepEqual(Array.from(bakedData.slice(4, 7)), [0x12, 0x34, 0x56])
  } finally {
    global.document = previousDocument
  }
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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

test('hero-controlled unit action range can satisfy destination checks before strict contact', () => {
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      instanceContactInstance: () => false,
      instancesDistance: () => 2.4,
    },
    '../../lib/hero/heroActionRange': {
      isHeroActionInRange: (_unit, action, dest) =>
        action === constants.ACTION_TYPES.takemeat && dest.family === constants.FAMILY_TYPES.animal,
    },
  })
  const unit = {
    action: constants.ACTION_TYPES.takemeat,
    controlMode: 'hero',
    type: constants.UNIT_TYPES.villager,
  }
  const carcass = {
    family: constants.FAMILY_TYPES.animal,
    i: 2,
    isDestroyed: false,
    j: 0,
  }

  assert.equal(new UnitMovement(unit).isUnitAtDest(constants.ACTION_TYPES.takemeat, carcass), true)
})

test('ranged units must contact buildings before entering them', () => {
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      instanceContactInstance: () => false,
      instancesDistance: () => 4,
    },
  })
  const unit = {
    type: 'Bowman',
    range: 5,
  }
  const stable = {
    family: constants.FAMILY_TYPES.building,
    type: 'Stable',
    i: 2,
    j: 0,
    isDestroyed: false,
  }

  assert.equal(new UnitMovement(unit).isUnitAtDest(constants.ACTION_TYPES.build, stable), false)
  assert.equal(new UnitMovement(unit).isUnitAtDest(constants.ACTION_TYPES.attack, stable), true)
})

for (const [mountedOnHorse, expectedSpeed] of [
  [false, 2],
  [true, 2],
]) {
  test(`${mountedOnHorse ? 'mounted' : 'foot'} units use the expected path movement speed`, () => {
    const speeds = []
    const lib = {
      canUpdateMinimap: () => false,
      cartesianToIsometric: (i, j) => [i * 10, j * 10],
      degreeToDirection: () => 'south',
      getGroundReliefLevel: () => 0,
      getInstanceDegree: () => 0,
      getInstanceZIndex: () => 0,
      instancesDistance: () => 10,
      moveTowardPoint: (_unit, _x, _y, speed) => speeds.push(speed),
      updateInstanceVisibility: () => {},
    }
    const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
      '../../constants': constants,
      '../../lib': lib,
    })
    const unit = {
      action: null,
      context: {
        map: {
          grid: [[{ has: null, i: 0, j: 0, solid: false, z: 0 }], [{ has: null, i: 1, j: 0, solid: false, z: 0 }]],
          updateInstanceBucket: () => {},
        },
      },
      currentCell: { has: null, i: 0, j: 0, solid: false, z: 0 },
      currentSheet: constants.SHEET_TYPES.walking,
      dest: { i: 1, isDestroyed: false, j: 0, x: 10, y: 0 },
      i: 0,
      j: 0,
      mountedOnHorse,
      path: [{ i: 1, j: 0 }],
      speed: 2,
      sprite: { playing: true, play: () => {} },
    }

    new UnitMovement(unit)._moveToPath()

    assert.equal(speeds.length, 1)
    assert.ok(Math.abs(speeds[0] - expectedSpeed) < 1e-9)
  })
}

for (const [mountedOnHorse, expectedSpeed] of [
  [false, 1.46],
  [true, 2],
]) {
  test(`${mountedOnHorse ? 'mounted' : 'foot'} low-energy units use the expected path movement speed`, () => {
    const speeds = []
    const lib = {
      canUpdateMinimap: () => false,
      cartesianToIsometric: (i, j) => [i * 10, j * 10],
      degreeToDirection: () => 'south',
      getGroundReliefLevel: () => 0,
      getInstanceDegree: () => 0,
      getInstanceZIndex: () => 0,
      instancesDistance: () => 10,
      moveTowardPoint: (_unit, _x, _y, speed) => speeds.push(speed),
      updateInstanceVisibility: () => {},
    }
    const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
      '../../constants': constants,
      '../../lib': lib,
    })
    const unit = {
      action: null,
      context: {
        map: {
          grid: [[{ has: null, i: 0, j: 0, solid: false, z: 0 }], [{ has: null, i: 1, j: 0, solid: false, z: 0 }]],
          updateInstanceBucket: () => {},
        },
      },
      currentCell: { has: null, i: 0, j: 0, solid: false, z: 0 },
      currentSheet: constants.SHEET_TYPES.walking,
      dest: { i: 1, isDestroyed: false, j: 0, x: 10, y: 0 },
      energy: 2,
      i: 0,
      j: 0,
      loading: 0,
      mountedOnHorse,
      path: [{ i: 1, j: 0 }],
      speed: 2,
      sprite: { playing: true, play: () => {} },
      totalEnergy: 10,
    }

    new UnitMovement(unit)._moveToPath()

    assert.equal(speeds.length, 1)
    assert.ok(Math.abs(speeds[0] - expectedSpeed) < 1e-9)
  })
}

for (const action of [constants.ACTION_TYPES.hunt, constants.ACTION_TYPES.captureHorse]) {
  test(`villager ${action} walks cautiously when close to an animal target`, () => {
    const speeds = []
    const lib = {
      canUpdateMinimap: () => false,
      cartesianToIsometric: (i, j) => [i * 10, j * 10],
      degreeToDirection: () => 'south',
      getGroundReliefLevel: () => 0,
      getInstanceDegree: () => 0,
      getInstanceZIndex: () => 0,
      instancesDistance: (_a, _b, useWorld = true) => (useWorld === false ? 10 : 6),
      moveTowardPoint: (_unit, _x, _y, speed) => speeds.push(speed),
      updateInstanceVisibility: () => {},
    }
    const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
      '../../constants': constants,
      '../../lib': lib,
    })
    const unit = {
      action,
      context: {
        map: {
          grid: [[{ has: null, i: 0, j: 0, solid: false, z: 0 }], [{ has: null, i: 1, j: 0, solid: false, z: 0 }]],
          updateInstanceBucket: () => {},
        },
      },
      currentCell: { has: null, i: 0, j: 0, solid: false, z: 0 },
      currentSheet: constants.SHEET_TYPES.walking,
      dest: { family: constants.FAMILY_TYPES.animal, i: 1, isDestroyed: false, j: 0, x: 10, y: 0 },
      i: 0,
      j: 0,
      path: [{ i: 1, j: 0 }],
      speed: 2,
      sprite: { playing: true, play: () => {} },
      type: constants.UNIT_TYPES.villager,
    }

    new UnitMovement(unit)._moveToPath()

    assert.equal(speeds.length, 1)
    assert.equal(speeds[0], 1)
    assert.equal(unit.requestedMoveSpeedFactor, 0.5)
    assert.equal(unit.appliedWalkingAnimationFactor, 0.5)
  })
}

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
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showConversionFeedback: (target, color) => calls.push(['showConversionFeedback', target.label, color]),
      updateInstanceVisibility: target => calls.push(['updateInstanceVisibility', target.owner.color]),
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const oldOwner = { color: 'red', label: 'enemy', population: 1, units: [] }
  const newOwner = {
    color: 'blue',
    colorHex: '#ffffff',
    isPlayed: true,
    label: 'player',
    population: 0,
    units: [],
    technologies: [],
  }
  const target = {
    action: constants.ACTION_TYPES.attack,
    actionLocked: true,
    blockedGatherApproach: { target: 'tree' },
    combatMode: 'recover',
    dest: { label: 'old-target' },
    energyWaitTaskId: 42,
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 7,
    inactif: false,
    label: 'convert-target',
    owner: oldOwner,
    path: [{ i: 1, j: 1 }],
    pendingOrder: { dest: { label: 'queued' } },
    previousDest: { label: 'previous' },
    previousWork: constants.WORK_TYPES.attacker,
    realDest: { i: 1, j: 1 },
    selected: false,
    shouldKeepHealthBarVisible: () => target.owner?.isPlayed,
    drawHealthBar: () => calls.push(['drawHealthBar']),
    context: { scheduler: { remove: taskId => calls.push(['removeTask', taskId]) } },
    lastCombatRecoveryMoveAt: 123,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: {
      onComplete: () => {},
      onFrameChange: () => {},
      onLoop: () => {},
    },
    stopInterval: () => calls.push(['stopInterval']),
    waitingForEnergyAction: constants.ACTION_TYPES.attack,
    waitingForEnergyTarget: { label: 'old-enemy' },
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
  assert.equal(target.combatMode, null)
  assert.equal(target.waitingForEnergyAction, null)
  assert.equal(target.waitingForEnergyTarget, null)
  assert.equal(target.energyWaitTaskId, null)
  assert.equal(target.lastCombatRecoveryMoveAt, null)
  assert.equal(target.inactif, true)
  assert.deepEqual(target.path, [])
  assert.deepEqual(
    calls.filter(([name]) => name === 'removeTask'),
    [['removeTask', 42]]
  )
  assert.deepEqual(
    calls.filter(([name]) => name === 'setTextures'),
    [['setTextures', constants.SHEET_TYPES.standing]]
  )
  assert.deepEqual(
    calls.filter(([name]) => name === 'showConversionFeedback'),
    [['showConversionFeedback', 'convert-target', 'blue']]
  )
  assert.deepEqual(
    calls.filter(([name]) => name === 'drawHealthBar'),
    [['drawHealthBar']]
  )
})

test('converted player units remove their stale health bar when captured by another owner', () => {
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
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showConversionFeedback: () => {},
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const oldOwner = { color: 'blue', isPlayed: true, label: 'player', population: 1, units: [] }
  const newOwner = { color: 'red', label: 'enemy', population: 0, units: [], technologies: [] }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    owner: oldOwner,
    path: [],
    selected: false,
    shouldKeepHealthBarVisible: () => target.owner?.isPlayed,
    removeHealthBar: () => calls.push(['removeHealthBar']),
    setTextures: () => {},
  }
  oldOwner.units.push(target)
  const captor = {
    context: {
      menu: {
        updatePlayerMiniMapEvt: () => {},
      },
    },
    owner: newOwner,
    stop: () => {},
  }

  const converted = new UnitActions(captor).convertTarget(target)

  assert.equal(converted, true)
  assert.equal(target.owner, newOwner)
  assert.deepEqual(calls, [['removeHealthBar']])
})

test('bandit-owned units cannot convert surrendered enemies into the bandit team', () => {
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
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showConversionFeedback: () => calls.push(['showConversionFeedback']),
      updateInstanceVisibility: () => calls.push(['updateInstanceVisibility']),
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const oldOwner = { color: 'blue', label: 'player', units: [] }
  const banditOwner = { devConsoleBanditOwner: true, label: 'bandit-owner', units: [] }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    label: 'surrender-target',
    owner: oldOwner,
    path: [{ i: 1, j: 0 }],
    selected: false,
    setTextures: () => calls.push(['setTextures']),
  }
  oldOwner.units.push(target)
  const bandit = {
    context: {
      menu: {
        updatePlayerMiniMapEvt: () => calls.push(['updatePlayerMiniMapEvt']),
      },
    },
    owner: banditOwner,
    stop: () => calls.push(['banditStop']),
  }

  const converted = new UnitActions(bandit).convertTarget(target, { grantXp: false, stopConverter: false })

  assert.equal(converted, false)
  assert.equal(target.owner, oldOwner)
  assert.equal(oldOwner.units.includes(target), true)
  assert.equal(banditOwner.units.includes(target), false)
  assert.deepEqual(target.path, [{ i: 1, j: 0 }])
  assert.deepEqual(calls, [])
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
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showConversionFeedback: (target, color) => calls.push(['showConversionFeedback', target.type, color]),
      updateInstanceVisibility: target => calls.push(['updateInstanceVisibility', target.assetCiv, target.assetAge]),
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
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
        getActionRallyPointButton: () => ({}),
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
  assert.deepEqual(
    calls.filter(([name]) => name === 'showConversionFeedback'),
    [['showConversionFeedback', 'TownCenter', 'blue']]
  )
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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

test('combat recovery idles when its reposition path finishes without an action', () => {
  const calls = []
  const cell0 = {
    has: null,
    i: 0,
    j: 0,
    solid: true,
    z: 0,
  }
  const cell1 = {
    has: null,
    i: 1,
    j: 0,
    solid: false,
    z: 0,
    place(entity) {
      this.has = entity
      this.solid = true
    },
  }
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i * 10, j * 10],
    degreeToDirection: () => 'south',
    getGroundReliefLevel: () => 0,
    getInstanceDegree: () => 0,
    getInstanceZIndex: () => 0,
    instancesDistance: (a, b, useCartesian = true) =>
      useCartesian ? Math.hypot(a.i - b.i, a.j - b.j) : Math.hypot(a.x - b.x, a.y - b.y),
    moveTowardPoint: () => {},
    playMovementSurfaceAudio: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    combatMode: 'recover',
    context: {
      map: {
        grid: [[cell0], [cell1]],
        updateInstanceBucket: () => calls.push(['updateInstanceBucket']),
      },
    },
    currentCell: cell0,
    dest: cell1,
    destHasMoved: () => false,
    i: 0,
    isUnitAtDest: () => false,
    j: 0,
    path: [{ i: 1, j: 0 }],
    setTextures: sheet => calls.push(['setTextures', sheet]),
    speed: 20,
    sprite: {
      playing: true,
      play: () => calls.push(['sprite.play']),
      stop: () => calls.push(['sprite.stop']),
    },
    stop: () => calls.push(['stop']),
    stopInterval: () => calls.push(['stopInterval']),
    waitingForEnergyAction: constants.ACTION_TYPES.attack,
    x: 0,
    y: 0,
  }
  cell0.has = unit

  new UnitMovement(unit)._moveToPath()

  assert.equal(unit.i, 1)
  assert.equal(unit.j, 0)
  assert.deepEqual(unit.path, [])
  assert.deepEqual(
    calls.filter(([name]) => ['setTextures', 'sprite.stop', 'stop'].includes(name)),
    [['setTextures', constants.SHEET_TYPES.standing], ['sprite.stop']]
  )
})

test('path movement treats a same-label solid cell as its own stale occupancy', () => {
  const calls = []
  const cell0 = {
    has: null,
    i: 0,
    j: 0,
    solid: true,
    z: 0,
  }
  const staleOccupant = { family: constants.FAMILY_TYPES.unit, label: 'bandit-1', type: 'Bandit2' }
  const cell1 = {
    has: staleOccupant,
    i: 1,
    j: 0,
    solid: true,
    z: 0,
    place(entity) {
      this.has = entity
    },
  }
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i * 10, j * 10],
    degreeToDirection: () => 'south',
    getGroundReliefLevel: () => 0,
    getInstanceDegree: () => 0,
    getInstanceZIndex: () => 0,
    instancesDistance: (a, b, useCartesian = true) =>
      useCartesian ? Math.hypot(a.i - b.i, a.j - b.j) : Math.hypot((a.x ?? 0) - b.x, (a.y ?? 0) - b.y),
    moveTowardPoint: () => {},
    playMovementSurfaceAudio: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    context: {
      map: {
        grid: [[cell0], [cell1]],
        updateInstanceBucket: () => calls.push(['updateInstanceBucket']),
      },
    },
    currentCell: cell0,
    dest: cell1,
    destHasMoved: () => false,
    i: 0,
    isUnitAtDest: () => false,
    j: 0,
    label: 'bandit-1',
    path: [{ i: 1, j: 0 }],
    sendToEvt: () => calls.push(['sendToEvt']),
    speed: 20,
    sprite: {
      playing: true,
      play: () => calls.push(['sprite.play']),
    },
    x: 0,
    y: 0,
  }
  cell0.has = unit

  new UnitMovement(unit)._moveToPath()

  assert.equal(unit.i, 1)
  assert.equal(unit.j, 0)
  assert.equal(cell0.has, null)
  assert.equal(cell0.solid, false)
  assert.equal(cell1.has, unit)
  assert.equal(cell1.solid, true)
  assert.equal(
    calls.some(([name]) => name === 'sendToEvt'),
    false
  )
})

test('path movement starts the action when the target occupies the next blocked cell in range', () => {
  const calls = []
  const cell0 = {
    has: null,
    i: 0,
    j: 0,
    solid: true,
    z: 0,
  }
  const hero = {
    family: constants.FAMILY_TYPES.unit,
    i: 1,
    j: 0,
    label: 'hero-1',
    type: 'Hero',
    x: 10,
    y: 0,
  }
  const cell1 = {
    has: hero,
    i: 1,
    j: 0,
    solid: true,
    z: 0,
  }
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i * 10, j * 10],
    degreeToDirection: () => 'east',
    getGroundReliefLevel: () => 0,
    getInstanceDegree: () => 90,
    getInstanceZIndex: () => 0,
    instancesDistance: (a, b, useCartesian = true) =>
      useCartesian ? Math.hypot(a.i - b.i, a.j - b.j) : Math.hypot((a.x ?? 0) - b.x, (a.y ?? 0) - b.y),
    moveTowardPoint: () => {},
    playMovementSurfaceAudio: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: constants.ACTION_TYPES.attack,
    context: {
      map: {
        grid: [[cell0], [cell1]],
        updateInstanceBucket: () => calls.push(['updateInstanceBucket']),
      },
    },
    currentCell: cell0,
    dest: hero,
    i: 0,
    isUnitAtDest: (action, dest) => action === constants.ACTION_TYPES.attack && dest === hero,
    j: 0,
    label: 'bandit-1',
    path: [{ i: 1, j: 0 }],
    sendToEvt: () => calls.push(['sendToEvt']),
    stopInterval: () => calls.push(['stopInterval']),
    getAction: action => calls.push(['getAction', action]),
    x: 0,
    y: 0,
  }
  cell0.has = unit
  const warn = console.warn
  console.warn = () => {}
  try {
    new UnitMovement(unit)._moveToPath()
  } finally {
    console.warn = warn
  }

  assert.deepEqual(unit.path, [])
  assert.equal(unit.degree, 90)
  assert.deepEqual(calls, [['stopInterval'], ['getAction', constants.ACTION_TYPES.attack]])
})

test('combat recovery with no active action pauses instead of using the generic stop flow', () => {
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      resumeVillagerAutonomy: () => {
        calls.push(['resumeVillagerAutonomy'])
        return false
      },
    },
  })
  const unit = {
    action: null,
    combatMode: 'recover',
    path: [{ i: 1, j: 1 }],
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: { stop: () => calls.push(['sprite.stop']) },
    stop: () => calls.push(['stop']),
    stopInterval: () => calls.push(['stopInterval']),
    waitingForEnergyAction: constants.ACTION_TYPES.attack,
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(unit.path, [])
  assert.equal(
    calls.some(([name]) => name === 'stop'),
    false
  )
  assert.equal(
    calls.some(([name]) => name === 'resumeVillagerAutonomy'),
    false
  )
  assert.ok(calls.some(([name, sheet]) => name === 'setTextures' && sheet === constants.SHEET_TYPES.standing))
  assert.ok(calls.some(([name]) => name === 'sprite.stop'))
})

test('direct movement advances even when subpixel steps would be ignored by path helper', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      i,
      j,
      x: i,
      y: j,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
    }))
  )
  const currentCell = grid[0][0]
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: () => [0, 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell,
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: -0.5060000000002401,
    y: 704,
  }

  const moved = new UnitMovement(unit).moveDirect(-1, 0, 0.45649999999975993)

  assert.equal(moved, true)
  assert.equal(unit.x, -0.9625000000000001)
  assert.equal(unit.y, 704)
})

test('a direct move blocked head-on slides along the obstacle contour', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  grid[1][0].solid = true
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [x >= 0.5 ? 1 : 0, y >= 0.4 ? 1 : 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }
  const movement = new UnitMovement(unit)

  // Head-on (1, 0) lands in solid (1, 0); the ±22.5° probes still resolve to that
  // cell, so the slide settles on the +45° deflection into the free (1, 1) cell.
  const moved = movement.moveDirect(1, 0, 1)

  assert.equal(moved, true)
  assert.equal(unit.i, 1)
  assert.equal(unit.j, 1)
  assert.ok(Math.abs(unit.x - 0.5) < 1e-9)
  assert.ok(Math.abs(unit.y - 0.5) < 1e-9)
  assert.equal(movement.slideBias, 1)
  assert.equal(grid[1][1].has, unit)

  // An undeflected follow-up move clears the slide bias.
  const movedFree = movement.moveDirect(0, 1, 0.1)

  assert.equal(movedFree, true)
  assert.equal(movement.slideBias, 0)
})

test('direct move can keep facing separate from movement direction', () => {
  const grid = [[{ i: 0, j: 0, x: 0, y: 0, z: 0, solid: false, border: false, category: 'Ground', has: null }]]
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: degree => (degree === 90 ? 'east' : 'south'),
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: (_unit, x, y) => (x > y ? 90 : 180),
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: () => [0, 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 0,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }

  const moved = new UnitMovement(unit).moveDirect(0, 1, 1, { facingDirX: 1, facingDirY: 0 })

  assert.equal(moved, true)
  assert.equal(unit.x, 0)
  assert.equal(unit.y, 1)
  assert.equal(unit.degree, 90)
})

test('hero direct movement rounds building footprint corners', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  const building = {
    family: 'building',
    isDestroyed: false,
    label: 'house-1',
    size: 1,
    x: 0,
    y: 0,
  }
  grid[1][1].solid = true
  grid[1][1].has = building
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [x >= 0.5 ? 1 : 0, y >= 0.5 ? 1 : 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const createUnit = () => ({
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  })

  const blockedUnit = createUnit()
  const blocked = new UnitMovement(blockedUnit).attemptMoveDirect(12, 6, 1)

  assert.equal(blocked, false)
  assert.equal(blockedUnit.i, 0)
  assert.equal(blockedUnit.j, 0)

  const slimSideUnit = createUnit()
  const movedThroughSlimIsoSide = new UnitMovement(slimSideUnit).attemptMoveDirect(24, 8, 1)

  assert.equal(movedThroughSlimIsoSide, true)
  assert.equal(slimSideUnit.i, 1)
  assert.equal(slimSideUnit.j, 1)

  const roundedCornerUnit = createUnit()
  const movedThroughRoundedCorner = new UnitMovement(roundedCornerUnit).attemptMoveDirect(31, 16, 1)

  assert.equal(movedThroughRoundedCorner, true)
  assert.equal(roundedCornerUnit.i, 1)
  assert.equal(roundedCornerUnit.j, 1)
  assert.equal(roundedCornerUnit.visible, true)

  const movedDeeperIntoBuilding = new UnitMovement(roundedCornerUnit).attemptMoveDirect(-19, -10, 1)

  assert.equal(movedDeeperIntoBuilding, false)
  assert.equal(roundedCornerUnit.x, 31)
  assert.equal(roundedCornerUnit.y, 16)
})

test('hero direct movement stops at the map edge without leaking world position', () => {
  const grid = [
    [
      {
        i: 0,
        j: 0,
        x: 0,
        y: 0,
        z: 0,
        solid: false,
        border: false,
        category: 'Ground',
        has: null,
      },
    ],
  ]
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [Math.floor(x), Math.floor(y)],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 0,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }

  const moved = new UnitMovement(unit).attemptMoveDirect(-1, 0, 1)

  assert.equal(moved, false)
  assert.equal(unit.i, 0)
  assert.equal(unit.j, 0)
  assert.equal(unit.x, 0)
  assert.equal(unit.y, 0)
})

test('hero direct movement slides along rounded building collision instead of iso cell edges', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  const building = {
    family: 'building',
    isDestroyed: false,
    label: 'house-1',
    size: 1,
    x: 0,
    y: 0,
  }
  grid[1][0].solid = true
  grid[1][0].has = building
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [x >= 0.5 ? 1 : 0, y >= 0.5 ? 1 : 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 2,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 16,
    y: 8,
  }
  const movement = new UnitMovement(unit)

  const moved = movement.moveDirect(-1, -0.5, 1)

  assert.equal(moved, true)
  assert.notEqual(unit.x, 16)
  assert.notEqual(unit.y, 8)
  assert.equal(movement.directMoveBlocker, building)
})

test('hero rounded-footprint collision keeps global padding beyond the raw edge', () => {
  const { getHeroDirectMoveBlockerAtPoint } = loadModule(
    'app/classes/unit/movement/UnitHeroDirectMovementCollision.ts',
    {
      '../../constants': constants,
      '../../lib': {
        getRoundedIsoFootprintPoints: mockRoundedIsoShapePoints,
        pointIsInsidePolygon: mockPointIsInsidePolygon,
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => true,
      },
    }
  )

  for (const family of [constants.FAMILY_TYPES.building, constants.FAMILY_TYPES.resource]) {
    const grid = [
      [
        {
          i: 0,
          j: 0,
          x: 0,
          y: 0,
          z: 0,
          solid: true,
          border: false,
          category: 'Ground',
          has: null,
        },
      ],
    ]
    const blocker = {
      family,
      i: 0,
      isDestroyed: false,
      j: 0,
      label: `${family}-1`,
      size: 1,
      type: family,
      x: 0,
      y: 0,
    }
    grid[0][0].has = blocker
    const unit = {
      context: {
        map: {
          grid,
        },
      },
      x: 0,
      y: -30,
    }

    assert.equal(getHeroDirectMoveBlockerAtPoint(unit, grid[0][0], 0, -15), blocker)
  }
})

test('hero soft-body collision keeps global padding around units and animals', () => {
  const { getHeroDirectMoveBlockerAtPoint } = loadModule(
    'app/classes/unit/movement/UnitHeroDirectMovementCollision.ts',
    {
      '../../constants': constants,
      '../../lib/units/unitControl': {
        isHeroControlled: () => true,
      },
    }
  )

  for (const family of [constants.FAMILY_TYPES.unit, constants.FAMILY_TYPES.animal]) {
    const blocker = {
      family,
      currentSheet: 'standing',
      isDead: false,
      isDestroyed: false,
      label: `${family}-1`,
      size: 1,
      type: family,
      x: 20,
      y: 0,
    }
    const grid = [
      [
        {
          i: 0,
          j: 0,
          has: blocker,
          corpses: [],
        },
      ],
    ]
    const unit = {
      context: {
        map: {
          grid,
        },
      },
      x: 0,
      y: 0,
    }

    assert.equal(getHeroDirectMoveBlockerAtPoint(unit, grid[0][0], 3, 0), blocker)
  }
})

test('hero direct movement aligns size 2 collision to the even footprint center', () => {
  const grid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      i,
      j,
      x: (i - j) * 32,
      y: (i + j - 2) * 16,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  const building = {
    family: 'building',
    i: 1,
    isDestroyed: false,
    j: 1,
    label: 'tower-1',
    size: 2,
    x: grid[1][1].x,
    y: grid[1][1].y,
  }
  for (const cell of [grid[1][1], grid[2][1], grid[1][2], grid[2][2]]) {
    cell.solid = true
    cell.has = building
  }
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getBuildingFootprintCells: mockBuildingFootprintCells,
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    cartesianToIsometric: () => [0, 0],
    isometricToCartesian: () => [0, 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 3,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: -12,
  }

  const moved = new UnitMovement(unit).attemptMoveDirect(0, 1, 3)

  assert.equal(moved, false)
  assert.equal(unit.y, -12)
})

test('hero direct movement can enter a passable water-border cell', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      i,
      j,
      x: i,
      y: j,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      waterBorder: false,
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  grid[1][0].waterBorder = true
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i, j],
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => {
      if (x >= 0.5 && y < -0.05) return [1, 1]
      if (x >= 0.5) return [1, 0]
      return [0, 0]
    },
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }
  const movement = new UnitMovement(unit)

  const moved = movement.moveDirect(1, 0, 1)

  assert.equal(moved, true)
  assert.equal(unit.i, 1)
  assert.equal(unit.j, 0)
  assert.equal(movement.directMoveBlocker, null)
})

test('hero terrain blocker pads the water cell after the water border', () => {
  const getIsoDiamondPoints = ({ x, y }) => [
    { x, y: y - 16 },
    { x: x + 32, y },
    { x, y: y + 16 },
    { x: x - 32, y },
  ]
  const cell = {
    i: 1,
    j: 0,
    x: 32,
    y: 16,
    z: 0,
    solid: false,
    border: true,
    category: 'Water',
    waterBorder: false,
    has: null,
  }
  const { createHeroTerrainCollisionBlocker, getHeroCollisionFootprintPoints } = loadModule(
    'app/classes/unit/movement/UnitHeroDirectMovementCollision.ts',
    {
      '../../constants': constants,
      '../../lib': {
        cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
        distanceToPolygon: mockDistanceToPolygon,
        getRoundedIsoFootprintPoints: mockRoundedIsoShapePoints,
        getRoundedIsoShapePoints: getIsoDiamondPoints,
        pointIsInsidePolygon: mockPointIsInsidePolygon,
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => true,
      },
    }
  )
  const blocker = createHeroTerrainCollisionBlocker(cell)

  assert.deepEqual(blocker.collisionPoints, [
    { x: 32, y: 0 },
    { x: 64, y: 16 },
    { x: 32, y: 32 },
    { x: 0, y: 16 },
  ])
  assert.deepEqual(getHeroCollisionFootprintPoints(blocker), [
    { x: 32, y: -24 },
    { x: 112, y: 16 },
    { x: 32, y: 56 },
    { x: -48, y: 16 },
  ])
})

test('hero terrain blocker uses iso-aligned standard padding for interior solid terrain', () => {
  const getIsoDiamondPoints = ({ x, y }) => [
    { x, y: y - 16 },
    { x: x + 32, y },
    { x, y: y + 16 },
    { x: x - 32, y },
  ]
  const cell = {
    i: 1,
    j: 0,
    x: 32,
    y: 16,
    z: 0,
    solid: true,
    border: false,
    category: 'Dirt',
    terrainHidden: true,
    waterBorder: false,
    has: null,
  }
  const { createHeroTerrainCollisionBlocker, getHeroCollisionFootprintPoints } = loadModule(
    'app/classes/unit/movement/UnitHeroDirectMovementCollision.ts',
    {
      '../../constants': constants,
      '../../lib': {
        cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
        distanceToPolygon: mockDistanceToPolygon,
        getRoundedIsoFootprintPoints: mockRoundedIsoShapePoints,
        getRoundedIsoShapePoints: getIsoDiamondPoints,
        pointIsInsidePolygon: mockPointIsInsidePolygon,
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => true,
      },
    }
  )
  const blocker = createHeroTerrainCollisionBlocker(cell, { mapType: 'interior' })

  assert.equal(blocker.terrainCollisionKind, 'wall')
  assert.deepEqual(getHeroCollisionFootprintPoints(blocker), [
    { x: 32, y: -14 },
    { x: 92, y: 16 },
    { x: 32, y: 46 },
    { x: -28, y: 16 },
  ])

  const interiorWaterBlocker = createHeroTerrainCollisionBlocker(
    { ...cell, category: 'Water' },
    { mapType: 'interior' }
  )
  assert.equal(interiorWaterBlocker.terrainCollisionKind, 'wall')
  assert.deepEqual(getHeroCollisionFootprintPoints(interiorWaterBlocker), [
    { x: 32, y: -14 },
    { x: 92, y: 16 },
    { x: 32, y: 46 },
    { x: -28, y: 16 },
  ])
})

test('hero terrain blocking targets water and interior solid terrain, not the water-border cell itself', () => {
  const { isHeroTerrainCollisionCell } = loadModule('app/classes/unit/movement/UnitHeroDirectMovementCollision.ts', {
    '../../constants': constants,
    '../../lib': {
      cartesianToIsometric: (i, j) => [i, j],
      distanceToPolygon: mockDistanceToPolygon,
      getRoundedIsoFootprintPoints: mockRoundedIsoShapePoints,
      pointIsInsidePolygon: mockPointIsInsidePolygon,
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const hero = {}
  const interiorGrid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      category: 'Dirt',
      has: null,
      solid: true,
      terrainHidden: true,
      waterBorder: false,
    }))
  )
  interiorGrid[1][1].solid = false
  interiorGrid[1][1].terrainHidden = false
  interiorGrid[0][1].category = 'Water'
  const interiorHero = { context: { map: { grid: interiorGrid, mapType: 'interior' } } }

  assert.equal(isHeroTerrainCollisionCell(hero, { category: 'Ground', waterBorder: true, solid: true }), false)
  assert.equal(isHeroTerrainCollisionCell(hero, { category: 'Ground', waterBorder: true, solid: false }), false)
  assert.equal(isHeroTerrainCollisionCell(hero, { category: 'Water', waterBorder: false, solid: false }), true)
  assert.equal(isHeroTerrainCollisionCell(interiorHero, interiorGrid[1][1]), false)
  assert.equal(isHeroTerrainCollisionCell(interiorHero, interiorGrid[0][1]), true)
  assert.equal(isHeroTerrainCollisionCell(interiorHero, { ...interiorGrid[0][0], i: 10, j: 10 }), false)
  assert.equal(isHeroTerrainCollisionCell(interiorHero, { ...interiorGrid[0][1], has: interiorHero }), false)
})

test('hero direct movement allows water-border cell entry outside the rounded terrain footprint', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 1 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      waterBorder: false,
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  grid[1][0].waterBorder = true
  grid[1][0].border = true
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i, j],
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: () => [1, 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 20,
  }
  grid[0][0].has = unit
  grid[0][0].solid = true

  const moved = new UnitMovement(unit).attemptMoveDirect(1, 0, 1)

  assert.equal(moved, true)
  assert.equal(unit.i, 1)
  assert.equal(unit.j, 0)
})

test('npc direct movement blocks water terrain behind the shoreline', () => {
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 1 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      waterBorder: false,
      has: null,
      place(entity) {
        this.has = entity
      },
    }))
  )
  grid[1][0].category = 'Water'
  grid[1][0].waterBorder = false
  grid[1][0].solid = false
  const lib = {
    canUpdateMinimap: () => false,
    cartesianToIsometric: (i, j) => [i, j],
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: () => [1, 0],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => false,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Villager',
    context: {
      map: {
        grid,
        size: 1,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }

  const moved = new UnitMovement(unit).attemptMoveDirect(1, 0, 1)

  assert.equal(moved, false)
  assert.equal(unit.i, 0)
  assert.equal(unit.j, 0)
})

test('hero direct movement collides softly with units and animals', () => {
  const createGrid = blocker => {
    const grid = Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => ({
        i,
        j,
        x: 0,
        y: 0,
        z: 0,
        solid: false,
        border: false,
        category: 'Ground',
        has: null,
      }))
    )
    grid[1][0].solid = true
    grid[1][0].has = blocker
    return grid
  }
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [
      Math.max(0, Math.min(2, Math.floor(x / 8))),
      Math.max(0, Math.min(2, Math.floor(Math.abs(y) / 8))),
    ],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const createUnit = (grid, x = 0) => ({
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 2,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x,
    y: 0,
  })

  for (const family of [constants.FAMILY_TYPES.unit, constants.FAMILY_TYPES.animal]) {
    const blocker = {
      family,
      isDead: false,
      isDestroyed: false,
      label: `${family}-1`,
      size: 1,
      type: family,
      x: 10,
      y: 0,
    }
    const blockedGrid = createGrid(blocker)
    const blockedUnit = createUnit(blockedGrid)

    const blocked = new UnitMovement(blockedUnit).attemptMoveDirect(9, 0, 1)

    assert.equal(blocked, false)
    assert.equal(blockedUnit.x, 0)

    const squeezeGrid = createGrid(blocker)
    const squeezeUnit = createUnit(squeezeGrid, 4)

    const squeezedAway = new UnitMovement(squeezeUnit).attemptMoveDirect(-1, 0, 1)

    assert.equal(squeezedAway, true)
    assert.equal(squeezeUnit.x, 3)

    const slideGrid = createGrid(blocker)
    const slideUnit = createUnit(slideGrid)
    const movement = new UnitMovement(slideUnit)

    const slid = movement.moveDirect(1, 0, 9)

    assert.equal(slid, true)
    assert.notEqual(slideUnit.y, 0)
    assert.equal(movement.directMoveBlocker, blocker)
  }
})

test('hero direct movement collides softly with unit corpses until they clear', () => {
  const corpse = {
    currentSheet: 'corpseSheet',
    family: constants.FAMILY_TYPES.unit,
    isDead: true,
    isDestroyed: false,
    label: 'fallen-1',
    size: 1,
    type: 'Fantassin',
    x: 10,
    y: 0,
  }
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      x: 0,
      y: 0,
      z: 0,
      solid: false,
      border: false,
      category: 'Ground',
      has: null,
      corpses: new Set(),
      place(entity) {
        this.has = entity
      },
    }))
  )
  grid[1][0].corpses.add(corpse)
  const lib = {
    canUpdateMinimap: () => false,
    degreeToDirection: () => 'west',
    findInstancesInSight: () => [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getGroundReliefLevel: () => 0,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 270,
    getInstancePath: () => [],
    getInstanceZIndex: () => 0,
    getRoundedIsoShapePoints: mockRoundedIsoShapePoints,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    isometricToCartesian: (x, y) => [
      Math.max(0, Math.min(2, Math.floor(x / 8))),
      Math.max(0, Math.min(2, Math.floor(Math.abs(y) / 8))),
    ],
    moveTowardPoint: () => {},
    updateInstanceRenderVisibility: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
    },
  })
  const unit = {
    actionLocked: false,
    category: 'Fantassin',
    context: {
      map: {
        grid,
        size: 2,
        updateInstanceBucket: () => {},
      },
    },
    currentCell: grid[0][0],
    degree: 0,
    i: 0,
    j: 0,
    sprite: {
      playing: true,
      play: () => {},
    },
    setTextures: () => {},
    x: 0,
    y: 0,
  }

  const blocked = new UnitMovement(unit).attemptMoveDirect(9, 0, 1)

  assert.equal(blocked, false)
  assert.equal(unit.x, 0)
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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

test('blocked gather approach skips water cells before picking an approach', () => {
  const target = { label: 'tree-1', i: 3, j: 3, isDestroyed: false }
  const coastCell = { i: 1, j: 3, solid: false, border: false, waterBorder: false, category: 'Water' }
  const landCell = { i: 2, j: 3, solid: false, border: false, waterBorder: false, category: 'Grass' }
  const landPath = [{ i: 2, j: 3 }]
  const grid = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => ({
      i,
      j,
      solid: false,
      border: false,
      waterBorder: false,
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
      distance === 2 ? [coastCell, landCell].filter(condition) : [],
    getClosestInstanceWithPath: () => null,
    getFreeCellAroundPoint: () => null,
    getInstanceClosestFreeCellPath: () => [],
    getInstanceDegree: () => 0,
    getInstancePath: (_unit, i, j) => (i === landCell.i && j === landCell.j ? landPath : []),
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => Infinity,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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
    getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.chopwood,
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
    work: constants.WORK_TYPES.woodcutter,
  }

  new UnitMovement(unit).sendToEvt(target, constants.ACTION_TYPES.chopwood)

  assert.equal(unit.dest, target)
  assert.equal(unit.blockedGatherApproach.target, target)
  assert.deepEqual(unit.path, landPath)
})

test('a villager retries the original gather order after approaching a blocked target', () => {
  const target = { label: 'berries-1', isDestroyed: false }
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib/buildings/passageCells': {
      findNearestPassageWaitingCell: () => ({ cell: expectedWaitCell, path: [expectedWaitCell] }),
      shouldUnitAvoidPassageStop: (_unit, cell, options = {}) => cell === entryCell && !options.allowPassageStop,
      unitHasActivePassageStopIntent: () => false,
    },
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

test('manual move orders cancel autonomy resume before routing', () => {
  const calls = []
  const targetCell = { corpses: [], has: null, i: 1, j: 0, solid: false, x: 48, y: 0 }
  const grid = [[{ corpses: [], has: null, i: 0, j: 0, solid: false, x: 0, y: 0 }], [targetCell]]
  const oldWorkTarget = {
    family: constants.FAMILY_TYPES.resource,
    i: 3,
    isDestroyed: false,
    j: 3,
    label: 'tree-1',
    x: 144,
    y: 144,
  }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      clearVillagerAutonomy: unit => calls.push(['clearVillagerAutonomy', unit.label]),
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getInstanceClosestFreeCellPath: () => [],
      getInstanceDegree: () => 0,
      getInstancePath: (_unit, i, j) => (i === targetCell.i && j === targetCell.j ? [targetCell] : []),
      getInstanceZIndex: () => 0,
      instanceContactInstance: () => false,
      instancesDistance: () => Infinity,
      moveTowardPoint: () => {},
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': {
      cancelEnergyWait: unit => {
        calls.push(['cancelEnergyWait', unit.waitingForEnergyAction, unit.waitingForEnergyTarget?.label])
        unit.waitingForEnergyAction = null
        unit.waitingForEnergyTarget = null
        unit.energyWaitTaskId = null
      },
      getEnergyMoveSpeedMultiplier: () => 1,
    },
  })
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    actionLocked: false,
    blockedGatherApproach: null,
    context: { map: { grid }, performance: { record: () => {} } },
    dest: oldWorkTarget,
    energyWaitTaskId: 7,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    i: 0,
    isDead: false,
    isUnitAtDest: () => false,
    j: 0,
    label: 'villager-1',
    path: [],
    previousDest: oldWorkTarget,
    previousWork: constants.WORK_TYPES.woodcutter,
    queueOrder: () => false,
    setDest: dest => {
      calls.push(['setDest', dest.i, dest.j])
      unit.dest = dest
    },
    setPath: path => {
      calls.push(['setPath', path])
      unit.path = path
    },
    stopInterval: () => calls.push(['stopInterval']),
    type: constants.UNIT_TYPES.villager,
    waitingForEnergyAction: constants.ACTION_TYPES.chopwood,
    waitingForEnergyTarget: oldWorkTarget,
    work: constants.WORK_TYPES.woodcutter,
  }

  new UnitMovement(unit).sendToEvt(targetCell, null)

  assert.equal(unit.waitingForEnergyAction, null)
  assert.equal(unit.waitingForEnergyTarget, null)
  assert.equal(unit.energyWaitTaskId, null)
  assert.equal(unit.dest, targetCell)
  assert.equal(unit.action, null)
  assert.equal(unit.previousDest, null)
  assert.equal(unit.previousWork, null)
  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['stopInterval'],
    ['cancelEnergyWait', constants.ACTION_TYPES.chopwood, 'tree-1'],
    ['clearVillagerAutonomy', 'villager-1'],
    ['setDest', 1, 0],
    ['setPath', [targetCell]],
  ])
})

function makePassageMovementCell(i, j) {
  return {
    category: 'Land',
    corpses: new Set(),
    fogSprites: [],
    has: null,
    i,
    j,
    solid: false,
    terrainHidden: false,
    type: 'grass',
    visible: true,
    viewBy: new Set(),
    waterBorder: false,
    x: i,
    y: j,
    z: 0,
    place(entity) {
      this.has = entity
    },
    removeFog() {},
    setFog() {},
    updateVisible() {},
  }
}

function makePassageMovementGrid(size = 5) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => makePassageMovementCell(i, j)))
}

function makePassageMovementUnit(context, grid) {
  const unit = {
    action: null,
    actionLocked: false,
    blockedGatherApproach: null,
    context,
    currentCell: grid[0][0],
    dest: null,
    handleChangeDest: () => {},
    i: 0,
    isDead: false,
    isUnitAtDest: () => false,
    j: 0,
    label: 'villager-1',
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: dest => {
      unit.dest = dest
    },
    setPath: path => {
      unit.path = path
    },
    stopInterval: () => {},
    type: constants.UNIT_TYPES.villager,
  }
  return unit
}

test('manual move orders avoid building passage cells as final stops', () => {
  const grid = makePassageMovementGrid()
  const owner = { buildings: [], units: [] }
  const building = {
    i: 1,
    isBuilt: true,
    j: 0,
    label: 'town-center-1',
    owner,
    type: constants.BUILDING_TYPES.townCenter,
  }
  owner.buildings.push(building)
  const entryCell = grid[2][2]
  const expectedWaitCell = grid[1][2]
  const context = { map: { grid, size: 4 }, performance: { record: () => {} }, players: [owner] }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib/buildings/passageCells': {
      findNearestPassageWaitingCell: () => ({ cell: expectedWaitCell, path: [expectedWaitCell] }),
      shouldUnitAvoidPassageStop: (_unit, cell, options = {}) => cell === entryCell && !options.allowPassageStop,
      unitHasActivePassageStopIntent: () => false,
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      clearVillagerAutonomy: () => {},
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getInstanceClosestFreeCellPath: () => [],
      getInstanceDegree: () => 0,
      getInstancePath: (_unit, i, j) =>
        i === expectedWaitCell.i && j === expectedWaitCell.j ? [expectedWaitCell] : [],
      getInstanceZIndex: () => 0,
      instanceContactInstance: () => false,
      instancesDistance: () => Infinity,
      moveTowardPoint: () => {},
      updateInstanceVisibility: () => {},
    },
  })
  const unit = makePassageMovementUnit(context, grid)

  new UnitMovement(unit).sendToEvt(entryCell, null)

  assert.equal(unit.dest, expectedWaitCell)
  assert.deepEqual(unit.path, [expectedWaitCell])
})

test('solid target approach cells avoid building passage cells as final stops', () => {
  const grid = makePassageMovementGrid()
  const entryCell = grid[1][2]
  const approachCell = grid[2][1]
  const target = {
    family: 'building',
    i: 2,
    isDestroyed: false,
    j: 2,
    label: 'barracks-1',
    type: 'Barracks',
    x: 2,
    y: 2,
  }
  grid[target.i][target.j].solid = true
  const context = { map: { grid, size: 4 }, performance: { record: () => {} }, players: [] }
  let rejectedPassageCell = false
  let acceptedApproachCell = false
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib/buildings/passageCells': {
      canUnitWaitOnCell: (_unit, cell, options = {}) => options.passageLookup?.has(cell) !== true,
      createReservedPassageCellLookup: () => ({
        has: cell => cell === entryCell,
        size: 1,
      }),
      findNearestPassageWaitingCell: () => null,
      shouldUnitAvoidPassageStop: () => false,
      unitHasActivePassageStopIntent: () => false,
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      clearVillagerAutonomy: () => {},
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getInstanceClosestFreeCellPath: (_unit, _target, _map, options = {}) => {
        rejectedPassageCell = options.isCellAllowed?.(entryCell) === false
        acceptedApproachCell = options.isCellAllowed?.(approachCell) === true
        return [approachCell]
      },
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      getInstanceZIndex: () => 0,
      instanceContactInstance: () => false,
      instancesDistance: () => Infinity,
      moveTowardPoint: () => {},
      updateInstanceVisibility: () => {},
    },
  })
  const unit = makePassageMovementUnit(context, grid)

  new UnitMovement(unit).sendToEvt(target, constants.ACTION_TYPES.attack)

  assert.equal(rejectedPassageCell, true)
  assert.equal(acceptedApproachCell, true)
  assert.equal(unit.dest, target)
  assert.deepEqual(unit.path, [approachCell])
})

test('passage move orders can explicitly stop on the passage cell', () => {
  const grid = makePassageMovementGrid()
  const owner = { buildings: [], units: [] }
  const building = {
    i: 1,
    isBuilt: true,
    j: 0,
    label: 'town-center-1',
    owner,
    type: constants.BUILDING_TYPES.townCenter,
  }
  owner.buildings.push(building)
  const entryCell = grid[2][2]
  const context = { map: { grid, size: 4 }, performance: { record: () => {} }, players: [owner] }
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib/buildings/passageCells': {
      findNearestPassageWaitingCell: () => null,
      shouldUnitAvoidPassageStop: (_unit, cell, options = {}) => cell === entryCell && !options.allowPassageStop,
      unitHasActivePassageStopIntent: () => false,
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      clearVillagerAutonomy: () => {},
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getInstanceClosestFreeCellPath: () => [],
      getInstanceDegree: () => 0,
      getInstancePath: (_unit, i, j) => (i === entryCell.i && j === entryCell.j ? [entryCell] : []),
      getInstanceZIndex: () => 0,
      instanceContactInstance: () => false,
      instancesDistance: () => Infinity,
      moveTowardPoint: () => {},
      updateInstanceVisibility: () => {},
    },
  })
  const unit = makePassageMovementUnit(context, grid)

  new UnitMovement(unit).sendToEvt(entryCell, null, { allowPassageStop: true })

  assert.equal(unit.dest, entryCell)
  assert.deepEqual(unit.path, [entryCell])
})

test('force repath restarts a build action when the villager is already in range', () => {
  const building = {
    family: constants.FAMILY_TYPES.building,
    i: 2,
    isDestroyed: false,
    j: 0,
    label: 'house-1',
    size: 2,
    x: 20,
    y: 0,
  }
  const grid = [
    [{ has: null, i: 0, j: 0, solid: false }],
    [{ has: null, i: 1, j: 0, solid: false }],
    [{ has: building, i: 2, j: 0, solid: true }],
  ]
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getInstanceClosestFreeCellPath: () => [],
      getInstanceDegree: () => 90,
      getInstancePath: () => [],
      getInstanceZIndex: () => 0,
      instanceContactInstance: () => true,
      instancesDistance: () => 1,
      moveTowardPoint: () => {},
      updateInstanceVisibility: () => {},
    },
    './UnitCommands': {
      applyWorkForAction: (unit, work, action) => {
        unit.work = work
        unit.action = action
      },
    },
  })
  const unit = {
    action: constants.ACTION_TYPES.build,
    actionLocked: false,
    blockedGatherApproach: null,
    context: { map: { grid }, performance: { record: () => {} } },
    dest: building,
    getAction: action => calls.push(['getAction', action]),
    handleChangeDest: () => calls.push(['handleChangeDest']),
    i: 1,
    isDead: false,
    isUnitAtDest: (_action, target) => target === building,
    j: 0,
    label: 'villager-1',
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: target => {
      calls.push(['setDest', target.label])
      unit.dest = target
    },
    stopInterval: () => calls.push(['stopInterval']),
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
  }

  new UnitMovement(unit).sendToEvt(building, constants.ACTION_TYPES.build, { forceRepath: true })

  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['stopInterval'],
    ['setDest', 'house-1'],
    ['getAction', constants.ACTION_TYPES.build],
  ])
})

test('an autonomous villager retries its job instead of stopping when pathing fails', () => {
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 2,
    isDestroyed: false,
    j: 2,
    label: 'berries-1',
    type: 'Berrybush',
  }
  const grid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      i,
      j,
      solid: false,
      border: false,
      category: 'Grass',
      has: null,
    }))
  )
  grid[target.i][target.j].solid = true
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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
      resumeVillagerAutonomy: unit => {
        calls.push(['resumeVillagerAutonomy', unit.autonomousJob, unit.dest])
        return true
      },
      showBlockedFeedback: () => calls.push(['showBlockedFeedback']),
      updateInstanceVisibility: () => {},
    },
    './UnitCommands': {
      applyWorkForAction: (unit, work, action) => {
        unit.work = work
        unit.action = action
      },
    },
  })
  const unit = {
    action: null,
    actionLocked: false,
    autonomousJob: 'food',
    blockedGatherApproach: null,
    context: { map: { grid }, performance: { record: () => {} } },
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
    stop: () => calls.push(['stop']),
    stopInterval: () => {},
    type: constants.UNIT_TYPES.villager,
    work: null,
  }

  new UnitMovement(unit).sendToEvt(target, constants.ACTION_TYPES.forageberry)

  assert.deepEqual(calls, [['resumeVillagerAutonomy', 'food', null]])
})

test('low-level gather orders realign villager work before starting the action', () => {
  const tree = { family: constants.FAMILY_TYPES.resource, i: 0, isDestroyed: false, j: 0, label: 'tree-1', x: 10, y: 0 }
  const calls = []
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      canUpdateMinimap: () => false,
      clearVillagerAutonomy: () => {},
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getCellsAroundPoint: () => [],
      getClosestInstanceWithPath: () => null,
      getFreeCellAroundPoint: () => null,
      getGroundReliefLevel: () => 0,
      getInstanceClosestFreeCellPath: () => [],
      getInstanceDegree: () => 180,
      getInstancePath: () => [],
      getInstanceZIndex: () => 0,
      getRoundedIsoShapePoints: () => [],
      instanceContactInstance: () => true,
      instancesDistance: () => 0,
      isometricToCartesian: () => ({ x: 0, y: 0 }),
      moveTowardPoint: () => {},
      resumeVillagerAutonomy: () => false,
      showBlockedFeedback: () => {},
      showConfusionFeedback: () => {},
      updateInstanceRenderVisibility: () => {},
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': { isHeroControlled: () => false },
    '../../lib/hero/heroActionRange': { isHeroActionInRange: () => false },
    '../../lib/units/unitEnergy': { cancelEnergyWait: () => {}, getEnergyMoveSpeedMultiplier: () => 1 },
    '../UnitResourceDeliveryCommands': {
      applyWorkForAction: (unit, work, action) => {
        calls.push(['applyWorkForAction', work, action])
        unit.work = work
        unit.action = action
      },
    },
  })
  const grid = [[{ has: null, i: 0, j: 0, solid: false }]]
  const unit = {
    action: null,
    actionLocked: false,
    blockedGatherApproach: null,
    context: { map: { grid }, performance: { record: () => {} } },
    dest: null,
    getAction: action => calls.push(['getAction', action, unit.work]),
    handleChangeDest: () => {},
    i: 0,
    isDead: false,
    isUnitAtDest: () => true,
    j: 0,
    path: [],
    previousDest: null,
    previousWork: null,
    queueOrder: () => false,
    setDest: target => {
      unit.dest = target
    },
    stopInterval: () => {},
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.hunter,
  }

  new UnitMovement(unit).sendToEvt(tree, constants.ACTION_TYPES.chopwood)

  assert.equal(unit.work, constants.WORK_TYPES.woodcutter)
  assert.equal(unit.action, constants.ACTION_TYPES.chopwood)
  assert.deepEqual(calls, [
    ['applyWorkForAction', constants.WORK_TYPES.woodcutter, constants.ACTION_TYPES.chopwood],
    ['getAction', constants.ACTION_TYPES.chopwood, constants.WORK_TYPES.woodcutter],
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
  })
  const unit = {
    action: null,
    dest: { label: 'empty-cell', family: 'cell' },
    previousDest: { label: 'berry-bush', family: 'resource' },
    previousWork: 'forager',
    type: constants.UNIT_TYPES.villager,
    work: 'forager',
    stopInterval: () => calls.push(['stopInterval']),
    goBackToPrevious: () => calls.push(['goBackToPrevious']),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).affectNewDest()

  assert.deepEqual(calls, [['stopInterval'], ['stop']])
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
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

test('chopping wood shows damage before wood is gathered', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, hitPoints: 'hitPoints' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: (target, amount) => calls.push(['damage', target.label, amount]),
      showResourceGainFeedback: (target, amount) => calls.push(['gain', target.label, amount]),
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 3,
    label: 'tree-1',
    selected: true,
    totalHitPoints: 5,
    drawHealthBar: () => calls.push(['drawHealthBar']),
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: { menu: { updateInfo: (id, value) => calls.push(['updateInfo', id, value]) } },
    dest: tree,
    owner: { isPlayed: true },
    sprite: {},
    getActionCondition: target => target === tree,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(tree.hitPoints, 2)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['damage', 'tree-1', 1],
    ['drawHealthBar'],
    ['updateInfo', 'hitPoints', '2/5'],
  ])
})

test('chopping a depleted berrybush destroys it instead of gathering wood', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, hitPoints: 'hitPoints' },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, berrybush: 'Berrybush' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: (target, amount) => calls.push(['damage', target.label, amount]),
      showResourceGainFeedback: (target, amount) => calls.push(['gain', target.label, amount]),
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 1,
    label: 'berrybush-1',
    quantity: 0,
    selected: false,
    totalHitPoints: 5,
    type: 'Berrybush',
    die: () => calls.push(['die']),
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: { menu: { updateInfo: (id, value) => calls.push(['updateInfo', id, value]) } },
    dest: berrybush,
    owner: { isPlayed: true, wood: 0 },
    sprite: {},
    affectNewDest: () => calls.push(['affectNewDest']),
    getActionCondition: target => target === berrybush && (berrybush.hitPoints ?? 0) > 0,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(berrybush.hitPoints, 0)
  assert.equal(unit.owner.wood, 0)
  assert.deepEqual(calls, [['setTextures', 'action'], ['damage', 'berrybush-1', 1], ['die'], ['affectNewDest']])
})

test('chopping a legacy depleted berrybush clamps its health before damage', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, hitPoints: 'hitPoints' },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, berrybush: 'Berrybush' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: (target, amount) => calls.push(['damage', target.label, amount]),
      showResourceGainFeedback: () => {},
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 40,
    label: 'legacy-berrybush',
    quantity: 0,
    selected: false,
    totalHitPoints: 40,
    type: 'Berrybush',
    updateTexture: () => calls.push(['updateTexture']),
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: { menu: {} },
    dest: berrybush,
    owner: { isPlayed: true, wood: 0 },
    sprite: {},
    getActionCondition: target => target === berrybush && (berrybush.hitPoints ?? 0) > 0,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(berrybush.totalHitPoints, 4)
  assert.equal(berrybush.hitPoints, 3)
  assert.deepEqual(calls, [['setTextures', 'action'], ['updateTexture'], ['damage', 'legacy-berrybush', 1]])
})

test('chopping a felled tree adds wood to the unit inventory', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 0,
    label: 'tree-1',
    quantity: 5,
    selected: true,
    totalHitPoints: 5,
    type: 'Tree',
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: {
      menu: {
        updateInfo: (id, value) => calls.push(['updateInfo', id, value]),
        updateTopbar: () => calls.push(['updateTopbar']),
      },
    },
    dest: tree,
    gatherAmount: { woodcutter: 2 },
    label: 'villager-1',
    owner: { isPlayed: true, wood: 3 },
    sprite: {},
    work: constants.WORK_TYPES.woodcutter,
    getActionCondition: target => target === tree && tree.quantity > 0,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(unit.owner.wood, 3)
  assert.deepEqual(unit.inventory.resources, { wood: 2 })
  assert.equal(tree.quantity, 3)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['feedback', 'villager-1', 2],
    ['updateInfo', 'quantityText', 3],
  ])
})

test('felled tree wood gathering uses the shared cadence after the tree is cut', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      RESOURCE_GATHER_SWINGS: { wood: 2 },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 0,
    label: 'tree-1',
    quantity: 5,
    selected: true,
    totalHitPoints: 5,
    type: 'Tree',
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: {
      menu: {
        updateInfo: (id, value) => calls.push(['updateInfo', id, value]),
        updateTopbar: () => calls.push(['updateTopbar']),
      },
    },
    dest: tree,
    gatherAmount: { woodcutter: 2 },
    label: 'villager-1',
    owner: { isPlayed: true, wood: 3 },
    sprite: {},
    work: constants.WORK_TYPES.woodcutter,
    getActionCondition: target => target === tree && tree.quantity > 0,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }
  const actions = new UnitActions(unit)

  actions.getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(unit.owner.wood, 3)
  assert.equal(tree.quantity, 5)

  actions.getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(unit.owner.wood, 3)
  assert.deepEqual(unit.inventory.resources, { wood: 2 })
  assert.equal(tree.quantity, 3)
  assert.deepEqual(
    calls.filter(([type]) => type === 'feedback' || type === 'updateInfo'),
    [
      ['feedback', 'villager-1', 2],
      ['updateInfo', 'quantityText', 3],
    ]
  )
})

test('hero chopping wood rewinds the work swing after the impact frame', () => {
  const calls = []
  const reverseCalls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wood: 'wood' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, hitPoints: 'hitPoints' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { chopWood: 'chop-wood' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, frame, callback) => {
        calls.push(['releaseFrame', frame])
        callback()
      },
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showDamageFeedback: (target, amount) => calls.push(['damage', target.label, amount]),
      showResourceGainFeedback: () => {},
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/entities/slashRecoveryAnimation': {
      playReverseSlashRecovery: (unit, options) => {
        reverseCalls.push([unit, options.releaseFrame])
        return true
      },
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
      isManualHeroActionReleased: () => false,
    },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 3,
    label: 'tree-1',
    selected: false,
    totalHitPoints: 5,
  }
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    context: { menu: {} },
    dest: tree,
    sprite: { loop: true },
    getActionCondition: target => target === tree,
    getWorkSound: () => 'chop-wood',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.chopwood)

  assert.equal(tree.hitPoints, 2)
  assert.equal(unit.actionLocked, true)
  assert.equal(unit.sprite.loop, false)
  assert.deepEqual(reverseCalls, [[unit, 5]])
})

test('hero building health bar refreshes while construction progresses', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: {},
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, hitPoints: 'hitPoints' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { buildLoop: 'build-loop' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showResourceGainFeedback: () => {},
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const building = {
    family: constants.FAMILY_TYPES.building,
    hitPoints: 1,
    totalHitPoints: 10,
    constructionTime: 10,
    selected: false,
    isBuilt: false,
    shouldKeepHealthBarVisible: () => true,
    drawHealthBar: () => calls.push(['drawHealthBar']),
    updateHitPoints: action => calls.push(['updateHitPoints', action]),
  }
  const unit = {
    action: constants.ACTION_TYPES.build,
    context: { menu: {} },
    dest: building,
    owner: { isPlayed: true },
    sprite: {},
    getActionCondition: target => target === building,
    getWorkSound: () => 'build-loop',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.build)

  assert.equal(building.hitPoints, 2)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['drawHealthBar'],
    ['updateHitPoints', constants.ACTION_TYPES.build],
  ])
})

test('a farmer can return to the same farm after an interrupted food job', () => {
  const farm = {
    label: 'farm-1',
    family: constants.FAMILY_TYPES.resource,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: {},
      SOUND_CUES: { villager: {} },
      TYPE_ACTION: { [constants.RESOURCE_TYPES.wheat]: constants.ACTION_TYPES.farm },
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
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

test('resuming previous animal work does not remember the interrupted target again', () => {
  const interruptedTarget = { label: 'blocked-tree', isUsedBy: null }
  const animal = {
    label: 'deer-1',
    family: constants.FAMILY_TYPES.animal,
    category: 'Animal',
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
      canUpdateMinimap: () => false,
      changeSpriteColor: () => {},
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const unit = {
    dest: interruptedTarget,
    path: [{ label: 'old-path-cell' }],
    previousDest: animal,
    previousWork: constants.WORK_TYPES.hunter,
    work: constants.WORK_TYPES.hunter,
    getActionCondition: (target, action) => target === animal && action === constants.ACTION_TYPES.takemeat,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    sendToTakeMeat: target => {
      calls.push(['sendToTakeMeat', target.label, unit.dest])
      if (unit.dest && !unit.previousDest) unit.previousDest = unit.dest
    },
    stop: () => calls.push(['stop']),
  }

  new UnitActions(unit).goBackToPrevious()

  assert.deepEqual(calls, [['handleChangeDest'], ['sendToTakeMeat', 'deer-1', null]])
  assert.equal(unit.previousDest, null)
  assert.deepEqual(unit.path, [])
})

test('resuming previous work routes to the previous destination runtime map space cell', () => {
  const stoneType = 'Stone'
  const outsideCell = { i: 2, j: 2, label: 'outside-cell' }
  const interiorCell = { i: 2, j: 2, label: 'interior-cell', spaceId: 'interior:test' }
  const interior = {
    grid: [
      [null, null, null],
      [null, null, null],
      [null, null, interiorCell],
    ],
    id: 'interior:test',
  }
  const map = {
    grid: [
      [null, null, null],
      [null, null, null],
      [null, null, outsideCell],
    ],
    spaces: new Map([[interior.id, interior]]),
  }
  const target = {
    category: stoneType,
    family: constants.FAMILY_TYPES.resource,
    i: 2,
    j: 2,
    label: 'stone-1',
    spaceId: interior.id,
    type: stoneType,
  }
  const calls = []
  const { goBackToPrevious } = loadModule('app/classes/unit/UnitPreviousWork.ts', {
    '../../constants': {
      ...constants,
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, stone: stoneType },
      TYPE_ACTION: { [stoneType]: constants.ACTION_TYPES.minestone },
    },
    '../../lib': {
      resumeVillagerAutonomy: () => false,
    },
  })
  const unit = {
    context: { map },
    dest: { label: 'interrupted' },
    path: [{ label: 'old-path-cell' }],
    previousDest: target,
    previousWork: constants.WORK_TYPES.stoneminer,
    work: constants.WORK_TYPES.lumberjack,
    getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.minestone,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    sendToEvt: (cell, action) => calls.push(['sendToEvt', cell, action]),
  }

  goBackToPrevious(unit)

  assert.deepEqual(calls, [['handleChangeDest'], ['sendToEvt', interiorCell, constants.ACTION_TYPES.minestone]])
  assert.equal(unit.previousDest, null)
  assert.equal(unit.work, constants.WORK_TYPES.stoneminer)
})

test('exploration orders bypass the human command throttle', () => {
  const calls = []
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      solid: false,
    }))
  )
  const targetCell = grid[1][0]
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      getInstancePath: (_unit, i, j) => (i === targetCell.i && j === targetCell.j ? [targetCell] : []),
    },
  })
  const unit = {
    context: { map: { grid } },
    i: 1,
    j: 1,
    owner: {
      views: {
        isViewed: (i, j) => i !== targetCell.i || j !== targetCell.j,
      },
    },
    sendTo: () => calls.push(['sendTo']),
    sendToEvt: (target, action, options) => calls.push(['sendToEvt', target, action, options]),
    stop: () => calls.push(['stop']),
  }

  assert.equal(new UnitMovement(unit).explore(), true)
  assert.deepEqual(calls, [['sendToEvt', targetCell, null, { forceRepath: true, preserveAutonomy: true }]])
})

test('exploration skips water and coast cells', () => {
  const calls = []
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Grass',
      solid: false,
      waterBorder: false,
    }))
  )
  const waterCell = grid[1][2]
  waterCell.category = 'Water'
  const coastCell = grid[2][1]
  coastCell.waterBorder = true
  const landCell = grid[4][2]
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      getInstancePath: (_unit, i, j) => (i === landCell.i && j === landCell.j ? [landCell] : []),
    },
  })
  const unit = {
    context: { map: { grid } },
    i: 2,
    j: 2,
    owner: {
      views: {
        isViewed: (i, j) =>
          !(
            (i === waterCell.i && j === waterCell.j) ||
            (i === coastCell.i && j === coastCell.j) ||
            (i === landCell.i && j === landCell.j)
          ),
      },
    },
    sendToEvt: (target, action, options) => calls.push(['sendToEvt', target, action, options]),
    stop: () => calls.push(['stop']),
  }

  assert.equal(new UnitMovement(unit).explore(), true)
  assert.deepEqual(calls, [['sendToEvt', landCell, null, { forceRepath: true, preserveAutonomy: true }]])
})

test('runaway units use the shared reachable flee cell selection', () => {
  const calls = []
  const escapeCell = { i: 2, j: 5, solid: false, category: 'Land', border: false }
  let optionsSeen = null
  const { UnitMovement } = loadModule('app/classes/unit/movement/UnitMovement.ts', {
    '../../constants': constants,
    '../../lib': {
      findReachableFleeCell: (_unit, _threat, _map, options) => {
        optionsSeen = options
        return escapeCell
      },
    },
  })
  const unit = {
    context: { map: { grid: [] } },
    i: 5,
    j: 5,
    sight: 3,
    sendTo: cell => calls.push(['sendTo', cell]),
    stop: () => calls.push(['stop']),
  }

  new UnitMovement(unit).runaway({ i: 3, j: 5 })

  assert.deepEqual(calls, [['sendTo', escapeCell]])
  assert.equal(optionsSeen.range, 3)
  assert.equal(optionsSeen.isCellAllowed({ solid: true, category: 'Land', border: false }), false)
  assert.equal(optionsSeen.isCellAllowed({ solid: false, category: 'Water', border: false }), false)
  assert.equal(optionsSeen.isCellAllowed({ solid: false, category: 'Land', border: true }), false)
  assert.equal(optionsSeen.isCellAllowed({ solid: false, category: 'Land', border: false }), true)
})

test('hero farming does not claim or replace the farm worker slot', () => {
  const occupant = { label: 'villager-1' }
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { wheat: 'wheat' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { gatherFood: 'gather-food' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const farm = {
    family: constants.FAMILY_TYPES.resource,
    isUsedBy: occupant,
    label: 'farm-1',
    quantity: 20,
    selected: true,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const unit = {
    action: constants.ACTION_TYPES.farm,
    allAssets: { [constants.WORK_TYPES.farmer]: {} },
    context: { menu: { updateInfo: (id, value) => calls.push(['updateInfo', id, value]) } },
    dest: farm,
    label: 'hero',
    owner: { isPlayed: true },
    sprite: {},
    work: constants.WORK_TYPES.farmer,
    getActionCondition: target => target === farm,
    getWorkSound: () => 'gather-food',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.farm)

  assert.equal(farm.isUsedBy, occupant)
  assert.equal(unit.owner.food ?? 0, 0)
  assert.deepEqual(unit.inventory.resources, { food: 1 })
  assert.equal(farm.quantity, 19)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['feedback', 'hero', 1],
    ['updateInfo', 'quantityText', 19],
  ])
})

test('hero gathering adds food to local inventory without global resource bookkeeping', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: ['wheat'],
      LOADING_TYPES: { wheat: 'wheat' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { gatherFood: 'gather-food' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const wheat = {
    family: constants.FAMILY_TYPES.resource,
    label: 'wheat-1',
    quantity: 20,
    selected: false,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const unit = {
    action: constants.ACTION_TYPES.farm,
    context: { menu: { showMessage: (message, level) => calls.push(['message', message, level]) } },
    controlMode: 'hero',
    dest: wheat,
    label: 'hero',
    owner: { food: 0, isPlayed: true },
    sprite: {},
    work: constants.WORK_TYPES.farmer,
    getActionCondition: target => target === wheat,
    getWorkSound: () => 'gather-food',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.farm)

  assert.equal(unit.owner.food, 0)
  assert.deepEqual(unit.inventory.resources, { food: 1 })
  assert.equal(wheat.quantity, 19)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['feedback', 'hero', 1],
  ])
})

test('farm gather cadence is the same for hero and villagers', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: ['wheat'],
      LOADING_TYPES: { wheat: 'wheat' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      RESOURCE_GATHER_SWINGS: { wheat: 2 },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { gatherFood: 'gather-food' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': {
      isHeroControlled: unit => unit.controlMode === 'hero',
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })

  function makeFarmer(label, controlMode) {
    const wheat = {
      family: constants.FAMILY_TYPES.resource,
      isUsedBy: null,
      label: `${label}-wheat`,
      quantity: 20,
      selected: false,
      type: constants.RESOURCE_TYPES.wheat,
    }
    const unit = {
      action: constants.ACTION_TYPES.farm,
      context: { menu: {} },
      controlMode,
      dest: wheat,
      label,
      owner: { food: 0, isPlayed: controlMode === 'hero' },
      sprite: {},
      work: constants.WORK_TYPES.farmer,
      getActionCondition: target => target === wheat && (!wheat.isUsedBy || wheat.isUsedBy === unit),
      getWorkSound: () => 'gather-food',
      setTextures: sheet => calls.push(['setTextures', label, sheet]),
    }
    return { actions: new UnitActions(unit), unit, wheat }
  }

  for (const actor of [makeFarmer('hero', 'hero'), makeFarmer('villager', 'npc')]) {
    actor.actions.getAction(constants.ACTION_TYPES.farm)
    assert.equal(actor.unit.owner.food, 0)
    assert.equal(actor.wheat.quantity, 20)

    actor.actions.getAction(constants.ACTION_TYPES.farm)
    assert.equal(actor.unit.owner.food, 0)
    assert.deepEqual(actor.unit.inventory.resources, { food: 1 })
    assert.equal(actor.wheat.quantity, 19)
  }

  assert.deepEqual(
    calls.filter(([type]) => type === 'feedback'),
    [
      ['feedback', 'hero', 1],
      ['feedback', 'villager', 1],
    ]
  )
})

test('hero mining adds stone to local inventory', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      ACTION_TYPES: {
        ...constants.ACTION_TYPES,
        minestone: 'minestone',
      },
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { stone: 'stone' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      MINING_RESOURCE_CONFIG: {
        Stone: {
          action: 'minestone',
          loadingType: 'stone',
          work: constants.WORK_TYPES.stoneminer,
          sound: 'mineStone',
          gatherEvery: 1,
          dieOnEmpty: true,
        },
      },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, stone: 'Stone' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { mineOre: 'mine-ore' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: cue => calls.push(['sound', cue]),
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const rock = {
    family: constants.FAMILY_TYPES.resource,
    label: 'stone-1',
    quantity: 20,
    selected: true,
    type: 'Stone',
  }
  const unit = {
    action: constants.ACTION_TYPES.minestone,
    context: {
      controls: { instanceIsAudible: () => true },
      menu: {
        updateInfo: (id, value) => calls.push(['updateInfo', id, value]),
      },
    },
    controlMode: 'hero',
    dest: rock,
    label: 'hero',
    owner: { isPlayed: true, stone: 0 },
    sprite: {},
    work: constants.WORK_TYPES.stoneminer,
    getActionCondition: target => target === rock && rock.quantity > 0,
    getWorkSound: () => 'mine-stone',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.minestone)

  assert.equal(unit.owner.stone, 0)
  assert.deepEqual(unit.inventory.resources, { stone: 1 })
  assert.equal(rock.quantity, 19)
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['sound', 'mine-ore'],
    ['feedback', 'hero', 1],
    ['updateInfo', 'quantityText', 19],
  ])
})

test('hero mining progress survives manual action restarts for slower ores', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      ACTION_TYPES: {
        ...constants.ACTION_TYPES,
        minegold: 'minegold',
      },
      LOADING_FOOD_TYPES: [],
      LOADING_TYPES: { gold: 'gold' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      MINING_RESOURCE_CONFIG: {
        Gold: {
          action: 'minegold',
          loadingType: 'gold',
          work: constants.WORK_TYPES.goldminer,
          sound: 'mineGold',
        },
      },
      RESOURCE_GATHER_SWINGS: { gold: 4 },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, gold: 'Gold' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { mineOre: 'mine-ore' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: cue => calls.push(['sound', cue]),
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../../lib/units/unitControl': {
      isHeroControlled: () => true,
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const gold = {
    family: constants.FAMILY_TYPES.resource,
    label: 'gold-1',
    quantity: 20,
    selected: true,
    type: 'Gold',
  }
  const unit = {
    action: constants.ACTION_TYPES.minegold,
    context: {
      controls: { instanceIsAudible: () => true },
      menu: {
        updateInfo: (id, value) => calls.push(['updateInfo', id, value]),
      },
    },
    controlMode: 'hero',
    dest: gold,
    label: 'hero',
    owner: { gold: 0, isPlayed: true },
    sprite: {},
    work: constants.WORK_TYPES.goldminer,
    getActionCondition: target => target === gold && gold.quantity > 0,
    getWorkSound: () => 'mine-gold',
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }
  const actions = new UnitActions(unit)

  actions.getAction(constants.ACTION_TYPES.minegold)
  actions.getAction(constants.ACTION_TYPES.minegold)
  actions.getAction(constants.ACTION_TYPES.minegold)

  assert.equal(unit.owner.gold, 0)
  assert.equal(gold.quantity, 20)

  actions.getAction(constants.ACTION_TYPES.minegold)

  assert.equal(unit.owner.gold, 0)
  assert.deepEqual(unit.inventory.resources, { gold: 1 })
  assert.equal(gold.quantity, 19)
  assert.deepEqual(
    calls.filter(([type]) => type === 'feedback' || type === 'updateInfo'),
    [
      ['feedback', 'hero', 1],
      ['updateInfo', 'quantityText', 19],
    ]
  )
})

test('depleted berrybushes stay on the map as empty bushes', () => {
  const calls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      LOADING_FOOD_TYPES: ['berry'],
      LOADING_TYPES: { berry: 'berry' },
      MENU_INFO_IDS: { ...constants.MENU_INFO_IDS, quantityText: 'quantityText' },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, berrybush: 'Berrybush' },
      SHEET_TYPES: { ...constants.SHEET_TYPES, action: 'action' },
      SOUND_CUES: { villager: { forageBerry: 'forage-berry' } },
      TYPE_ACTION: {},
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => callback(),
      playerCanSeeInstance: () => false,
      playSoundCue: () => {},
      showResourceGainFeedback: (target, amount) => calls.push(['feedback', target.label, amount]),
      SLASH_IMPACT_FRAME: 5,
      updateInstanceVisibility: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    isDead: false,
    label: 'berrybush-1',
    quantity: 1,
    selected: true,
    type: 'Berrybush',
    die: () => calls.push(['die']),
    updateTexture: () => calls.push(['updateTexture']),
  }
  const unit = {
    action: constants.ACTION_TYPES.forageberry,
    context: {
      menu: {
        showMessage: (message, level) => calls.push(['message', message, level]),
        updateInfo: (id, value) => calls.push(['updateInfo', id, value]),
      },
    },
    dest: berrybush,
    label: 'villager-1',
    owner: { food: 0, isPlayed: true },
    sprite: {},
    getActionCondition: target => target === berrybush && berrybush.quantity > 0,
    getWorkSound: () => 'forage-berry',
    setTextures: sheet => calls.push(['setTextures', sheet]),
    affectNewDest: () => calls.push(['affectNewDest']),
  }

  new UnitActions(unit).getAction(constants.ACTION_TYPES.forageberry)

  assert.equal(berrybush.quantity, 0)
  assert.equal(berrybush.isDead, false)
  assert.equal(unit.owner.food, 0)
  assert.deepEqual(unit.inventory.resources, { food: 1 })
  assert.deepEqual(calls, [
    ['setTextures', 'action'],
    ['feedback', 'villager-1', 1],
    ['updateInfo', 'quantityText', 0],
    ['updateTexture'],
    ['message', 'berrybushDepleted', 'warning'],
    ['affectNewDest'],
  ])
})

test('immediate farm orders bypass the human command throttle', () => {
  const farm = { label: 'farm-1', family: constants.FAMILY_TYPES.resource, type: constants.RESOURCE_TYPES.wheat }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: (_unit, target, action) => target === farm && action === constants.ACTION_TYPES.farm,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
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
    owner: { isPlayed: true, selectedUnit: null },
    path: [],
    previousDest: null,
    previousWork: null,
    sendTo: () => calls.push(['sendTo']),
    sendToEvt: (target, action) => calls.push(['sendToEvt', target.label, action]),
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
  }

  new UnitCommands(unit).sendToFarm(farm, true)

  assert.deepEqual(calls, [['sendToEvt', 'farm-1', constants.ACTION_TYPES.farm]])
  assert.equal(unit.work, constants.WORK_TYPES.farmer)
})

test('villager resource job switches deliver carried resources before starting the new job', () => {
  const oldTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 2,
    isDestroyed: false,
    j: 2,
    label: 'tree-1',
    type: 'Tree',
  }
  const stone = {
    family: constants.FAMILY_TYPES.resource,
    i: 7,
    isDestroyed: false,
    j: 7,
    label: 'stone-1',
    type: 'Stone',
  }
  const storagePit = {
    family: constants.FAMILY_TYPES.building,
    i: 4,
    isDestroyed: false,
    j: 4,
    label: 'storage-pit-1',
    type: constants.BUILDING_TYPES.storagePit,
  }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      MINING_RESOURCE_CONFIG: {
        Stone: {
          action: constants.ACTION_TYPES.minestone,
          work: constants.WORK_TYPES.stoneminer,
        },
      },
    },
    '../../lib': {
      getActionCondition: (_unit, target, action) =>
        (target === stone && action === constants.ACTION_TYPES.minestone) ||
        (target === storagePit && action === constants.ACTION_TYPES.delivery),
      getAutonomyJobForWork: work => {
        if (work === constants.WORK_TYPES.woodcutter) return 'wood'
        if (work === constants.WORK_TYPES.stoneminer) return 'stone'
        return null
      },
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      setVillagerAutonomy: (unit, job) => {
        unit.autonomousJob = job
      },
    },
    '../../lib/resources/resourceDelivery': {
      findResourceDeliveryTarget: () => storagePit,
      unitHasDeliverableResources: () => true,
      unitHasDeliverableResourcesForBuilding: (_unit, building) => building === storagePit,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    allAssets: null,
    autonomousJob: 'wood',
    buildQueue: [],
    context: { menu: { updateInfo: () => {} } },
    dest: oldTree,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: { wood: 4 } },
    isDead: false,
    owner: { isPlayed: true, selectedUnit: null },
    path: [],
    previousDest: null,
    previousWork: null,
    sendTo: target => calls.push(['sendTo', target.label]),
    sendToEvt: (target, action, options) => {
      unit.dest = target
      unit.action = action
      calls.push(['sendToEvt', target.label, action, options])
    },
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.woodcutter,
  }

  const started = new UnitCommands(unit).sendToStone(stone, true)

  assert.equal(started, true)
  assert.equal(unit.action, constants.ACTION_TYPES.delivery)
  assert.equal(unit.work, constants.WORK_TYPES.woodcutter)
  assert.equal(unit.resourceDeliveryState.building, storagePit)
  assert.equal(unit.resourceDeliveryState.phase, 'toBuilding')
  assert.deepEqual(unit.resourceDeliveryState.returnTask, {
    action: constants.ACTION_TYPES.minestone,
    autonomousJob: 'stone',
    dest: stone,
    work: constants.WORK_TYPES.stoneminer,
  })
  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['sendToEvt', 'storage-pit-1', constants.ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true }],
  ])
})

test('villager resource orders in the same job do not force an early delivery', () => {
  const oldTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 2,
    isDestroyed: false,
    j: 2,
    label: 'tree-1',
    type: 'Tree',
  }
  const newTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 7,
    isDestroyed: false,
    j: 7,
    label: 'tree-2',
    type: 'Tree',
  }
  const calls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: (_unit, target, action) => target === newTree && action === constants.ACTION_TYPES.chopwood,
      getAutonomyJobForWork: work => (work === constants.WORK_TYPES.woodcutter ? 'wood' : null),
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      setVillagerAutonomy: (unit, job) => {
        unit.autonomousJob = job
      },
    },
    '../../lib/resources/resourceDelivery': {
      findResourceDeliveryTarget: () => {
        throw new Error('delivery target should not be requested')
      },
      unitHasDeliverableResources: () => true,
      unitHasDeliverableResourcesForBuilding: () => true,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    action: constants.ACTION_TYPES.chopwood,
    allAssets: null,
    autonomousJob: 'wood',
    buildQueue: [],
    context: { menu: { updateInfo: () => {} } },
    dest: oldTree,
    inventory: { resources: { wood: 4 } },
    isDead: false,
    owner: { isPlayed: false, selectedUnit: null },
    path: [],
    previousDest: null,
    previousWork: null,
    sendToEvt: (target, action) => calls.push(['sendToEvt', target.label, action]),
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.woodcutter,
  }

  new UnitCommands(unit).sendToTree(newTree, true)

  assert.equal(unit.resourceDeliveryState, undefined)
  assert.equal(unit.work, constants.WORK_TYPES.woodcutter)
  assert.equal(unit.autonomousJob, 'wood')
  assert.deepEqual(calls, [['sendToEvt', 'tree-2', constants.ACTION_TYPES.chopwood]])
})

test('farm orders warn when wheat is not mature yet', () => {
  const wheat = {
    label: 'wheat-1',
    family: constants.FAMILY_TYPES.resource,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const messages = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: () => false,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      isWheatMature: () => false,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    buildQueue: [],
    context: { menu: { showMessage: (message, level) => messages.push([message, level]) } },
    isDead: false,
    owner: { isPlayed: true },
    type: constants.UNIT_TYPES.villager,
  }

  const started = new UnitCommands(unit).sendToFarm(wheat, true)

  assert.equal(started, false)
  assert.deepEqual(messages, [['wheatNotReady', 'warning']])
})

test('farm orders stay quiet when immature wheat is outside the camera', () => {
  const wheat = {
    label: 'wheat-1',
    family: constants.FAMILY_TYPES.resource,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const messages = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': constants,
    '../../lib': {
      getActionCondition: () => false,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      isWheatMature: () => false,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    buildQueue: [],
    context: {
      controls: { instanceInCamera: () => false },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    isDead: false,
    owner: { isPlayed: true },
    type: constants.UNIT_TYPES.villager,
  }

  const started = new UnitCommands(unit).sendToFarm(wheat, true)

  assert.equal(started, false)
  assert.deepEqual(messages, [])
})

test('berry orders warn when the bush is depleted', () => {
  const berrybush = {
    label: 'berrybush-1',
    family: constants.FAMILY_TYPES.resource,
    quantity: 0,
    type: 'Berrybush',
  }
  const messages = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      ACTION_TYPES: { ...constants.ACTION_TYPES, forageberry: 'forageberry' },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, berrybush: 'Berrybush' },
      WORK_TYPES: { ...constants.WORK_TYPES, forager: 'forager' },
    },
    '../../lib': {
      getActionCondition: () => false,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      isWheatMature: () => false,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    buildQueue: [],
    context: { menu: { showMessage: (message, level) => messages.push([message, level]) } },
    isDead: false,
    owner: { isPlayed: true },
    type: constants.UNIT_TYPES.villager,
  }

  const started = new UnitCommands(unit).sendToBerrybush(berrybush, true)

  assert.equal(started, false)
  assert.deepEqual(messages, [['berrybushDepleted', 'warning']])
})

test('berry orders stay quiet when the depleted bush is outside the camera', () => {
  const berrybush = {
    label: 'berrybush-1',
    family: constants.FAMILY_TYPES.resource,
    quantity: 0,
    type: 'Berrybush',
  }
  const messages = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    'pixi.js': { Assets: { cache: { get: () => null } } },
    '../../constants': {
      ...constants,
      ACTION_TYPES: { ...constants.ACTION_TYPES, forageberry: 'forageberry' },
      RESOURCE_TYPES: { ...constants.RESOURCE_TYPES, berrybush: 'Berrybush' },
      WORK_TYPES: { ...constants.WORK_TYPES, forager: 'forager' },
    },
    '../../lib': {
      getActionCondition: () => false,
      getClosestInstance: () => null,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      isWheatMature: () => false,
    },
    '../../lib/lang': { t: value => value },
  })
  const unit = {
    buildQueue: [],
    context: {
      controls: { instanceInCamera: () => false },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    isDead: false,
    owner: { isPlayed: true },
    type: constants.UNIT_TYPES.villager,
  }

  const started = new UnitCommands(unit).sendToBerrybush(berrybush, true)

  assert.equal(started, false)
  assert.deepEqual(messages, [])
})
