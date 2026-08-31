const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadUnitActions(calls, captureHorse) {
  class HeroLassoThrow {
    constructor(unit, _destination, _context, options) {
      this.state = 'attached'
      this.target = captureHorse
      this.clearLasso = ({ releaseHorse } = {}) => {
        calls.push(['externalStableRouteActive', false])
        calls.push(['clearLasso', releaseHorse])
      }
      this.releaseHorse = ({ allowStable, allowFlee } = {}) => {
        calls.push(['releaseHorse', allowStable, allowFlee])
        captureHorse.isLassoed = false
        captureHorse.lassoOwner = null
      }
      this.setExternalStableRouteActive = active => calls.push(['externalStableRouteActive', active])
      unit.heroLasso = this
      captureHorse.isLassoed = true
      captureHorse.lassoOwner = unit
      calls.push(['lasso', options.autoRouteStableWhileAttached])
    }
  }

  function loadTsFile(filename) {
    const source = fs.readFileSync(filename, 'utf8')
    const { code } = babel.transformSync(source, {
      filename,
      presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
    })
    const module = { exports: {} }
    new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
    return module.exports
  }

  const localRequire = request => {
    if (request === '../../constants') {
      return {
        ACTION_TYPES: { captureHorse: 'captureHorse' },
        FAMILY_TYPES: { animal: 'animal', building: 'building' },
        LOADING_FOOD_TYPES: [],
        LOADING_TYPES: {},
        MENU_INFO_IDS: {},
        MINING_RESOURCE_CONFIG: {},
        RESOURCE_TYPES: {},
        RESOURCE_STOCKPILE_TYPES: {},
        SHEET_TYPES: { action: 'action', standing: 'standing' },
        SOUND_CUES: {},
        STEP_TIME: 20,
        TYPE_ACTION: {},
      }
    }
    if (request === '../../lib') {
      return {
        BOW_SHOOT_RELEASE_FRAME: 8,
        HUNTING_PROJECTILE: 'Arrow',
        SLASH_IMPACT_FRAME: 5,
        canUpdateMinimap: () => false,
        degreeToDirection: () => 'south',
        getInstanceDegree: () => 0,
        isWildHorse: horse => horse?.type === 'Horse' && horse?.tamingStatus !== 'tamed',
        instancesDistance: (a, b) => Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0)),
        onSpriteLoopAtFrame: () => {},
        playSoundCue: () => {},
        playerCanSeeInstance: () => true,
        resumeVillagerAutonomy: () => false,
        showConversionFeedback: () => {},
        showDamageFeedback: () => {},
        showHealingFeedback: () => {},
        showResourceGainFeedback: () => {},
        updateInstanceVisibility: () => {},
      }
    }
    if (request === '../../lib/horses/horseCapture') {
      return {
        getNearestAvailableStableForUnit: unit => unit.owner.buildings[0] ?? null,
        routeCapturedHorseToStableWithOwnerContact: ({ horse, owner, onHorseRouteStart }) => {
          calls.push(['route', owner.label, horse.label])
          onHorseRouteStart?.(owner.owner.buildings[0])
          return () => calls.push(['routeStop'])
        },
      }
    }
    if (request === '../HeroLassoThrow') return { HeroLassoThrow }
    if (request === '../Projectile') return { Projectile: class {} }
    if (request === '../../lib/mapSpaces') {
      return {
        getEntityCell: (entity, map) => entity?.currentCell ?? map?.grid?.[entity?.i]?.[entity?.j] ?? null,
        getEntitySpaceMapLike: entity => entity?.context?.map ?? null,
        sameCellMapSpace: () => true,
        sameMapSpace: () => true,
      }
    }
    if (request === '../../lib/projectiles') return { attachProjectileToMapSpace: () => {} }
    if (request === '../../lib/units/unitExperience') {
      return {
        LOADING_XP_CATEGORY: {},
        XP_BUILD_TICK: 1,
        XP_CATEGORIES: {},
        XP_CONVERT_SUCCESS: 1,
        XP_FELL_TREE_TICK: 1,
        getBuildRateXpMultiplier: () => 1,
        getGatherXpBonus: () => 0,
        getHealingXpBonus: () => 0,
        grantUnitXp: () => {},
      }
    }
    if (request === '../../lib/lpc') return { refreshBakedLpcUnitAssets: () => {} }
    if (request === '../../lib/lang') return { t: key => key }
    if (request === '../../lib/units/unitControl') {
      return { isHeroControlled: () => false, isManualHeroActionReleased: () => false }
    }
    if (request === '../../lib/units/unitEnergy') return { spendOrWaitForEnergy: () => true }
    if (request === '../../lib/units/unitWorkAppearance') return { applyUnitWorkAssets: () => {} }
    if (request === '../../lib/resources/resourceDelivery') {
      return {
        carriedResourcesAmount: () => 0,
        findBestResourceDeliveryTarget: () => null,
        unitHasDeliverableResources: () => false,
      }
    }
    if (request === '../../lib/entities/entityHealthDisplay') return { syncEntityHealthDisplay: () => {} }
    if (request === '../../lib/buildings/buildingOccupancy') return { getBuildingShelterCapacity: () => 0 }
    if (request === '../../lib/entities/slashRecoveryAnimation') return { playReverseSlashRecovery: () => false }
    if (request === './UnitCaptureHorseAction') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitCaptureHorseAction.ts'))
    }
    if (request === './UnitManualHeroWork') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitManualHeroWork.ts'))
    }
    if (request === './UnitResourceActions') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitResourceActions.ts'))
    }
    if (request === './UnitGatherVisualDebug') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitGatherVisualDebug.ts'))
    }
    if (request === './UnitBuildVisuals') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitBuildVisuals.ts'))
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
    if (request === './UnitPreviousWork') {
      return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitPreviousWork.ts'))
    }
    return require(request)
  }

  return loadTsFile(path.join(__dirname, '../app/classes/unit/UnitActions.ts')).UnitActions
}

test('villager horse capture resumes after the lasso and routes the owner to the stable', () => {
  const calls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    label: 'horse-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    isDead: false,
    isDestroyed: false,
  }
  const stable = {
    family: 'building',
    type: 'Stable',
    label: 'stable-1',
    i: 5,
    j: 5,
    x: 160,
    y: 160,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
  }
  const scheduler = {
    elapsedMs: 1000,
    tasks: [],
    add(callback) {
      this.tasks.push(callback)
      return this.tasks.length
    },
    remove: id => calls.push(['removeTask', id]),
  }
  const unit = {
    family: 'unit',
    type: 'Villager',
    label: 'villager-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    action: 'captureHorse',
    dest: horse,
    owner: { buildings: [stable] },
    context: { scheduler, map: { addChild: () => calls.push(['addChild']) } },
    sprite: {},
    path: [],
    getActionCondition: target => target === horse && !horse.isLassoed,
    isUnitAtDest: (_action, target) => target === horse,
    destHasMoved: () => false,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sendToEvt: (target, action, options) => {
      calls.push(['sendToEvt', target.label, action, options])
      unit.dest = target
    },
    affectNewDest: () => calls.push(['affectNewDest']),
  }

  const UnitActions = loadUnitActions(calls, horse)
  const actions = new UnitActions(unit)
  unit.getAction = name => actions.getAction(name)
  actions.getAction('captureHorse')

  assert.equal(horse.isLassoed, true)
  assert.deepEqual(
    calls.filter(call => call[0] === 'lasso'),
    [['lasso', false]]
  )

  scheduler.tasks[0]()

  assert.deepEqual(
    calls.filter(call => call[0] === 'route'),
    [['route', 'villager-1', 'horse-1']]
  )
  assert.deepEqual(calls.filter(call => call[0] === 'externalStableRouteActive').slice(-2), [
    ['externalStableRouteActive', false],
    ['externalStableRouteActive', true],
  ])
  assert.deepEqual(calls.filter(call => call[0] === 'sendToEvt').at(-1), [
    'sendToEvt',
    'stable-1',
    'captureHorse',
    { forceRepath: true },
  ])
})

test('villager horse capture repath throttle survives synchronous action reentry', () => {
  const calls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    label: 'horse-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    isDead: false,
    isDestroyed: false,
  }
  const scheduler = {
    elapsedMs: 500,
    tasks: [],
    add(callback) {
      this.tasks.push(callback)
      return this.tasks.length
    },
    remove: id => calls.push(['removeTask', id]),
  }
  const unit = {
    family: 'unit',
    type: 'Villager',
    label: 'villager-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    action: 'captureHorse',
    dest: horse,
    owner: { buildings: [] },
    context: { scheduler, map: { addChild: () => calls.push(['addChild']) } },
    sprite: {},
    path: [{ i: 3, j: 3 }],
    getActionCondition: target => target === horse,
    isUnitAtDest: (_action, target) => target === horse,
    destHasMoved: () => false,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sendToEvt: (target, action, options) => {
      calls.push(['sendToEvt', target.label, action, options])
      unit.dest = target
      unit.getAction?.(action)
    },
    affectNewDest: () => calls.push(['affectNewDest']),
  }

  const UnitActions = loadUnitActions(calls, horse)
  const actions = new UnitActions(unit)
  unit.getAction = name => actions.getAction(name)
  actions.getAction('captureHorse')

  assert.equal(calls.filter(call => call[0] === 'sendToEvt').length, 1)
  assert.equal(
    calls.some(call => call[0] === 'lasso'),
    false
  )
})

test('villager horse capture refuses a tamed horse', () => {
  const calls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    tamingStatus: 'tamed',
    label: 'horse-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    isDead: false,
    isDestroyed: false,
  }
  const scheduler = {
    elapsedMs: 500,
    tasks: [],
    add(callback) {
      this.tasks.push(callback)
      return this.tasks.length
    },
    remove: id => calls.push(['removeTask', id]),
  }
  const unit = {
    family: 'unit',
    type: 'Villager',
    label: 'villager-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    action: 'captureHorse',
    dest: horse,
    owner: { buildings: [] },
    context: { scheduler, map: { addChild: () => calls.push(['addChild']) } },
    sprite: {},
    path: [],
    getActionCondition: () => true,
    affectNewDest: () => calls.push(['affectNewDest']),
  }

  const UnitActions = loadUnitActions(calls, horse)
  const actions = new UnitActions(unit)
  actions.getAction('captureHorse')

  assert.deepEqual(calls, [['affectNewDest']])
  assert.equal(scheduler.tasks.length, 0)
})

test('villager horse capture cleanup releases the attached horse when the order changes', () => {
  const calls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    label: 'horse-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    isDead: false,
    isDestroyed: false,
  }
  const stable = {
    family: 'building',
    type: 'Stable',
    label: 'stable-1',
    i: 5,
    j: 5,
    x: 160,
    y: 160,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
  }
  const scheduler = {
    elapsedMs: 1000,
    tasks: [],
    add(callback) {
      this.tasks.push(callback)
      return this.tasks.length
    },
    remove: id => calls.push(['removeTask', id]),
  }
  const unit = {
    family: 'unit',
    type: 'Villager',
    label: 'villager-1',
    i: 3,
    j: 3,
    x: 96,
    y: 96,
    action: 'captureHorse',
    dest: horse,
    owner: { buildings: [stable] },
    context: { scheduler, map: { addChild: () => calls.push(['addChild']) } },
    sprite: {},
    path: [],
    getActionCondition: target => target === horse && !horse.isLassoed,
    isUnitAtDest: (_action, target) => target === horse,
    destHasMoved: () => false,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sendToEvt: (target, action, options) => {
      calls.push(['sendToEvt', target.label, action, options])
      unit.dest = target
    },
    affectNewDest: () => calls.push(['affectNewDest']),
  }

  const UnitActions = loadUnitActions(calls, horse)
  const actions = new UnitActions(unit)
  unit.getAction = name => actions.getAction(name)
  actions.getAction('captureHorse')

  assert.equal(horse.isLassoed, true)

  unit.action = null
  scheduler.tasks[0]()

  assert.equal(horse.isLassoed, false)
  assert.equal(horse.lassoOwner, null)
  assert.deepEqual(
    calls.filter(call => call[0] === 'externalStableRouteActive'),
    [['externalStableRouteActive', false]]
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'releaseHorse'),
    [['releaseHorse', false, true]]
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'clearLasso'),
    [['clearLasso', false]]
  )
})
