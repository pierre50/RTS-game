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
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const defaultMocks = {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawInstanceBlinkingSelection: () => {},
    },
    './sound': {
      playSelectionSound: () => {},
      playSoundCue: () => {},
    },
    './combat': {
      isValidCondition: () => true,
    },
    './lang': {
      t: key => key,
    },
    './buildingFeedback': {
      showUnitCannotEnterBuildingMessage: (unit, building) => {
        unit.context?.menu?.showMessage(`unitCannotEnterBuilding:${unit.type}:${building.type}`, 'warning')
      },
    },
    './unitUpgrades': {
      getUnitUpgradeTargetForBuilding: () => null,
    },
  }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (Object.hasOwn(defaultMocks, request)) return defaultMocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    build: 'build',
    hunt: 'hunt',
    takemeat: 'takemeat',
    train: 'train',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  BUILDING_TYPES: {
    temple: 'Temple',
  },
  COLOR_WHITE: 0xffffff,
  CELL_WIDTH: 64,
  LABEL_TYPES: {
    commSelection: 'commSelection',
    shadow: 'shadow',
  },
  SHEET_TYPES: {
    standing: 'standing',
  },
  SOUND_CUES: {
    unit: { militaryCommand: 'militaryCommand' },
    villager: { command: 'villagerCommand' },
  },
  UNIT_TYPES: {
    priest: 'Priest',
    villager: 'Villager',
  },
}

function loadNpcInteraction(target, overrides = {}) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './buildingTraining': {
      getTrainingTargetForUnit: (building, unit) => {
        if (building.type === 'Barracks' && unit.type === 'Axeman') return 'ShortSwordsman'
        if (building.type === constants.BUILDING_TYPES.temple && unit.type === constants.UNIT_TYPES.villager) {
          return constants.UNIT_TYPES.priest
        }
        if (unit.type === constants.UNIT_TYPES.villager) return building.units?.[0] || null
        return null
      },
    },
    './unitUpgrades': {
      getUnitUpgradeTargetForBuilding: (buildingType, unitType) =>
        buildingType === 'Barracks' && unitType === 'Axeman' ? 'ShortSwordsman' : null,
    },
    './grid/visibility': {
      findInstancesInSight: () => (target ? [target] : []),
    },
    './maths': {
      getInstanceDegree: () => 0,
    },
    ...overrides,
  })
}

test('"aller vers" sends villagers to attack an enemy under the cursor', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: orderTarget => orderTarget === target,
    i: 1,
    j: 1,
    owner: { isEnemy: owner => owner === enemyOwner },
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['attack', target]])
})

test('"aller vers" blinks the target once when any communicated NPC has a targeted action', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const blinkCalls = []
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawInstanceBlinkingSelection: instance => blinkCalls.push(instance),
    },
  })
  const calls = []
  const owner = { isEnemy: owner => owner === enemyOwner }
  const attacker = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.attack,
    i: 1,
    j: 1,
    owner,
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
  }
  const mover = {
    context: { map: { grid: [] } },
    getActionCondition: () => false,
    i: 2,
    j: 2,
    owner,
    sendTo: orderCell => calls.push(['move', orderCell]),
  }

  sendNpcGroupToTarget([attacker, mover], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [
    ['attack', target],
    ['move', { i: 5, j: 5, has: target }],
  ])
  assert.deepEqual(blinkCalls, [target])
})

test('"aller vers" sends villagers to hunt a live animal under the cursor', () => {
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    quantity: 100,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.hunt,
    i: 1,
    j: 1,
    owner: { isEnemy: () => false },
    sendToHunt: orderTarget => calls.push(['hunt', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['hunt', target]])
})

test('"aller vers" sends a communicated villager into a training building', () => {
  const owner = {
    config: {
      units: {
        Clubman: { category: 'Infantry' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Barracks',
    units: ['Clubman'],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, villager) {
      calls.push(['train', type, extra, villager])
      return true
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    i: 1,
    j: 1,
    owner,
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['train', 'Clubman', undefined, npc]])
})

test('"aller vers" sends a communicated villager into a temple to train a priest', () => {
  const owner = {
    config: {
      units: {
        Priest: { category: 'Civilian' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: constants.BUILDING_TYPES.temple,
    units: [constants.UNIT_TYPES.priest],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, villager) {
      calls.push(['train', type, extra, villager])
      return true
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    i: 1,
    j: 1,
    owner,
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['train', constants.UNIT_TYPES.priest, undefined, npc]])
})

test('"aller vers" warns instead of moving a villager to an incompatible own building', () => {
  const calls = []
  const owner = {
    config: {
      units: {},
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Stable',
    units: ['Clubman'],
    x: 100,
    y: 100,
    requestUnitTraining() {
      throw new Error('villager must not enter incompatible stable training')
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './lang': {
      t: (key, vars) => (vars ? `${key}:${vars.unit}:${vars.building}` : key),
    },
  })
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendTo() {
      calls.push(['move'])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['message', 'unitCannotEnterBuilding:Villager:Stable', 'warning']])
})

test('"aller vers" sends upgradeable specialized units into a training building', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        ShortSwordsman: { category: 'Infantry' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Barracks',
    units: ['ShortSwordsman'],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, unit) {
      calls.push(['train', type, extra, unit])
      return true
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendTo() {
      calls.push(['move'])
    },
    type: 'Axeman',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['train', 'ShortSwordsman', undefined, npc]])
})

test('"aller vers" moves specialized units when no building upgrade is available', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Clubman: { category: 'Infantry' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Barracks',
    units: ['Clubman'],
    x: 100,
    y: 100,
    requestUnitTraining() {
      throw new Error('non-upgradeable specialized units must not enter training')
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendTo(cell) {
      calls.push(['move', cell.i, cell.j])
    },
    type: 'Clubman',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', 5, 5]])
})

test('closing communication resumes a pending training order', () => {
  const calls = []
  const barracks = {
    family: constants.FAMILY_TYPES.building,
    isDestroyed: false,
    type: 'Barracks',
  }
  const npc = {
    lookingAtHero: true,
    previousDest: barracks,
    trainingTargetType: 'Axeman',
    getChildByLabel: () => null,
    sendTo(dest, action) {
      calls.push(['sendTo', dest, action])
    },
  }
  const { releaseIfStillLooking } = loadNpcInteraction(null)

  releaseIfStillLooking([npc])

  assert.equal(npc.lookingAtHero, false)
  assert.equal(npc.previousDest, null)
  assert.equal(npc.trainingTargetType, 'Axeman')
  assert.deepEqual(calls, [['sendTo', barracks, constants.ACTION_TYPES.train]])
})

test('"aller vers" cursor shows combat feedback over combat targets', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.unit }, true)

    assert.equal(classes.has('hero-cursor-combat'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the resource hand over buildings', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.building }, true)

    assert.equal(classes.has('hero-cursor-resource'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the pointer only while choosing an empty go-to target', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, null, false)
    assert.equal(classes.has('hero-cursor-pointer'), false)

    updateHeroCursor(null, null, true)
    assert.equal(classes.has('hero-cursor-pointer'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('combat hover does not change the cursor outside "aller vers" picking', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.unit }, false)

    assert.equal(classes.has('hero-cursor-combat'), false)
    assert.equal(classes.has('hero-cursor-pointer'), false)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

function loadCommModule(instances, getInstanceDegree) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './maths': {
      getInstanceDegree,
    },
  })
}

function makeCommAlly(props) {
  return {
    family: constants.FAMILY_TYPES.unit,
    isDead: false,
    isDestroyed: false,
    action: null,
    addChildAt: () => {},
    getChildByLabel: () => null,
    setTextures: () => {},
    ...props,
  }
}

test('a quick tap (radius 0) resolves to the ally the hero is facing, ignoring one to the side', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [facingAlly])
})

test('a quick tap does not resolve to a faced ally beyond one adjacent cell', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const farFacingAlly = makeCommAlly({ owner, i: 2, j: 0, x: 20, y: 0 })
  const { resolveCommGroup } = loadCommModule([farFacingAlly], () => 0)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('a quick tap does not resolve to a visually distant faced ally even when grid cells are adjacent', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const distantFacingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 96, y: 0 })
  const { resolveCommGroup } = loadCommModule([distantFacingAlly], () => 0)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('a quick tap finds nothing when no ally is within the facing cone', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = () => 150
  const { resolveCommGroup } = loadCommModule([sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('communication radius grows exponentially while staying capped at max range', () => {
  const { COMM_CHARGE_MS, COMM_MAX_RANGE, getCommRadiusForHold } = loadNpcInteraction(null)

  assert.equal(getCommRadiusForHold(-100), 0)
  assert.equal(getCommRadiusForHold(0), 0)
  assert.ok(getCommRadiusForHold(250) < 1)
  assert.ok(getCommRadiusForHold(COMM_CHARGE_MS / 2) < COMM_MAX_RANGE / 2)
  assert.equal(getCommRadiusForHold(COMM_CHARGE_MS), COMM_MAX_RANGE)
  assert.equal(getCommRadiusForHold(COMM_CHARGE_MS * 2), COMM_MAX_RANGE)
})

test('holding past the precision zone nets every eligible ally in the charged radius', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7)

  assert.deepEqual(group, [facingAlly, sideAlly])
})

test('communication indicator cells use the same grid radius as group selection', () => {
  const owner = { label: 'player' }
  const grid = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => ({ i, j })))
  const hero = { owner, degree: 0, x: 0, y: 0, i: 2, j: 2, context: { map: { grid } } }
  const inside = makeCommAlly({ owner, i: 4, j: 2, x: 64, y: 32 })
  const diagonalOutside = makeCommAlly({ owner, i: 4, j: 4, x: 0, y: 64 })
  const { findCommGroup, getCommCellsInRadius } = loadCommModule([inside, diagonalOutside], () => 0)

  const group = findCommGroup(hero, 2)
  const cells = getCommCellsInRadius(hero, 2).map(cell => `${cell.i}:${cell.j}`)

  assert.deepEqual(group, [inside])
  assert.ok(cells.includes('4:2'))
  assert.equal(cells.includes('4:4'), false)
})

test('hidden communication release only takes the ally in front of the hero even with a charged radius', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7, { precisionOnly: true })

  assert.deepEqual(group, [facingAlly])
})

test('hidden communication release finds nothing when no ally is in front of the hero', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = () => 150
  const { resolveCommGroup } = loadCommModule([sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7, { precisionOnly: true })

  assert.deepEqual(group, [])
})

function loadNpcFollowModule(instances) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './maths': {
      getInstanceDegree: () => 0,
      isometricToCartesian: () => [0, 0],
    },
  })
}

function makeEscortWorld(followerProps) {
  const heroCell = { i: 0, j: 0, has: null, corpses: [] }
  const owner = { label: 'player', units: [] }
  owner.isEnemy = other => Boolean(other) && other !== owner
  const hero = { i: 0, j: 0, owner, context: { map: { grid: [[heroCell]] } } }
  const calls = []
  const follower = {
    followingHero: true,
    isDead: false,
    isDestroyed: false,
    owner,
    sendTo: dest => calls.push(['move', dest]),
    sendToAttack: target => calls.push(['attack', target]),
    ...followerProps,
  }
  owner.units = [hero, follower]
  return { hero, follower, heroCell, calls }
}

test('followers engage an enemy unit passing near the hero', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 3, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (target, action) => target === enemy && action === constants.ACTION_TYPES.attack,
  })

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', enemy]])
})

test('followers ignore idle animals and keep trailing the hero', () => {
  const gaia = { label: 'gaia' }
  const gazelle = {
    family: constants.FAMILY_TYPES.animal,
    owner: gaia,
    hitPoints: 8,
    isDead: false,
    isDestroyed: false,
    action: null,
    dest: null,
    i: 2,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([gazelle])
  const { hero, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    getActionCondition: () => true,
  })

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['move', heroCell]])
})

test('followers defend the hero from an attacking predator', () => {
  const gaia = { label: 'gaia' }
  const lion = {
    family: constants.FAMILY_TYPES.animal,
    owner: gaia,
    hitPoints: 30,
    isDead: false,
    isDestroyed: false,
    action: constants.ACTION_TYPES.attack,
    dest: null,
    i: 2,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([lion])
  const { hero, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (target, action) => target === lion && action === constants.ACTION_TYPES.attack,
  })
  lion.dest = hero

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', lion]])
})

test('followers prefer an active attacker over a closer passer-by', () => {
  const enemyOwner = { label: 'enemy' }
  const passing = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 1, j: 0 }
  const attacker = {
    family: 'unit',
    owner: enemyOwner,
    hitPoints: 20,
    isDead: false,
    isDestroyed: false,
    action: constants.ACTION_TYPES.attack,
    dest: null,
    i: 3,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([passing, attacker])
  const { hero, calls } = makeEscortWorld({
    i: 0,
    j: 1,
    getActionCondition: (target, action) => action === constants.ACTION_TYPES.attack,
  })
  attacker.dest = hero

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', attacker]])
})

test('a fighting follower is left alone inside the leash', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 6, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, follower, calls } = makeEscortWorld({
    i: 5,
    j: 0,
    action: constants.ACTION_TYPES.attack,
    getActionCondition: () => true,
  })
  follower.dest = enemy

  updateNpcFollow(hero)

  assert.deepEqual(calls, [])
})

test('a follower dragged past the leash breaks off and returns to the hero', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 21, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 20,
    j: 0,
    action: constants.ACTION_TYPES.attack,
    getActionCondition: () => true,
  })
  follower.dest = enemy

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['move', heroCell]])
})
