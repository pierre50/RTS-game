const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  const defaultMocks = {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawInstanceBlinkingSelection: () => {},
      getSelectionMarkerOffset: () => 0,
    },
    './audio/sound': {
      playAudibleSoundCue: () => {},
      playSelectionSound: () => {},
      playSoundCue: () => {},
    },
    './combat/combat': {
      isValidCondition: () => true,
    },
    './lang': {
      t: key => key,
    },
    './buildings/buildingFeedback': {
      showUnitCannotEnterBuildingMessage: (unit, building) => {
        unit.context?.menu?.showMessage(`unitCannotEnterBuilding:${unit.type}:${building.type}`, 'warning')
      },
    },
    './units/unitUpgrades': {
      getUnitUpgradeTargetForBuilding: () => null,
    },
    './units/unitCrouchPose': {
      applyUnitCrouchPose: () => {},
      resetUnitCrouchPose: () => {},
    },
  }
  return loadTsModule(relativePath, { mocks: { ...defaultMocks, ...mocks } })
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    build: 'build',
    chopwood: 'chopwood',
    farm: 'farm',
    forageberry: 'forageberry',
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
  RESOURCE_TYPES: {
    berrybush: 'Berrybush',
    tree: 'Tree',
    wheat: 'Wheat',
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
  PLAYER_TYPES: {
    ai: 'AI',
  },
  UNIT_TYPES: {
    priest: 'Priest',
    villager: 'Villager',
  },
  WORK_TYPES: {
    farmer: 'farmer',
    forager: 'forager',
    hunter: 'hunter',
    woodcutter: 'woodcutter',
  },
}

function angleDelta(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function loadNpcInteraction(target, overrides = {}) {
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: (building, unit) => {
        if (building.type === constants.BUILDING_TYPES.temple && unit.type === constants.UNIT_TYPES.villager) {
          return constants.UNIT_TYPES.priest
        }
        if (unit.type === constants.UNIT_TYPES.villager) return building.units?.[0] || null
        return null
      },
    },
    './units/unitUpgrades': {
      getUnitUpgradeTargetForBuilding: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: () => (target ? [target] : []),
    },
    './maths': {
      angleDelta,
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
        Fantassin: { category: 'Fantassin' },
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
    units: ['Fantassin'],
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

  assert.deepEqual(calls, [['train', 'Fantassin', undefined, npc]])
})

test('"aller vers" sends a communicated villager to harvest wheat', () => {
  const owner = { label: 'player' }
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDead: false,
    isDestroyed: false,
    isUsedBy: null,
    j: 5,
    quantity: 10,
    type: constants.RESOURCE_TYPES.wheat,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.farm,
    i: 1,
    j: 1,
    owner,
    sendToFarm: orderTarget => calls.push(['farm', orderTarget]),
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['farm', target]])
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
    units: ['Fantassin'],
    x: 100,
    y: 100,
    requestUnitTraining() {
      throw new Error('villager must not enter incompatible stable training')
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './buildings/buildingTraining': {
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
    sendTo(cell) {
      calls.push(['move', cell.i, cell.j])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['message', 'unitCannotEnterBuilding:Villager:Stable', 'warning']])
})

test('"aller vers" moves specialized infantry when no barracks upgrade is available', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
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
    units: ['Fantassin'],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, unit) {
      throw new Error('infantry must not enter barracks training as an upgrade')
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
    type: 'Fantassin',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', 5, 5]])
})

test('"aller vers" shows a warning when a soldier targets an empty stable', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
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
    type: 'Stable',
    units: ['Fantassin'],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, unit) {
      calls.push(['requestUnitTraining', type, unit.type])
      unit.context.menu.showMessage('stableNeedsHorse', 'warning')
      return false
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: (building, unit) =>
        building.type === 'Stable' && unit.type === 'Fantassin' ? 'Fantassin' : null,
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
    type: 'Fantassin',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [
    ['requestUnitTraining', 'Fantassin', 'Fantassin'],
    ['message', 'stableNeedsHorse', 'warning'],
  ])
})

test('"aller vers" sends a bowman to the stable even before a horse is available', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Bowman: { category: 'Bowman' },
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
    type: 'Stable',
    units: ['Bowman'],
    x: 100,
    y: 100,
    requestUnitTraining(type, extra, unit) {
      calls.push(['requestUnitTraining', type, unit.type])
      return true
    },
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: (building, unit) =>
        building.type === 'Stable' && unit.type === 'Bowman' ? 'Bowman' : null,
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
    type: 'Bowman',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['requestUnitTraining', 'Bowman', 'Bowman']])
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
    trainingTargetType: 'Fantassin',
    getChildByLabel: () => null,
    sendTo(dest, action) {
      calls.push(['sendTo', dest, action])
    },
  }
  const { releaseIfStillLooking } = loadNpcInteraction(null)

  releaseIfStillLooking([npc])

  assert.equal(npc.lookingAtHero, false)
  assert.equal(npc.previousDest, null)
  assert.equal(npc.trainingTargetType, 'Fantassin')
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
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
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
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
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
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
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
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
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
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './maths': {
      angleDelta,
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

test('hero can talk to a non-hostile AI unit without owning it', () => {
  const player = { label: 'player', isEnemy: owner => owner.relation === 'hostile' }
  const hero = { owner: player }
  const neutralOwner = { label: 'neutral-ai', type: constants.PLAYER_TYPES.ai, relation: 'neutral' }
  const villager = makeCommAlly({ owner: neutralOwner })
  const { isTalkableNpc } = loadNpcInteraction(null)

  assert.equal(isTalkableNpc(hero, villager), true)
})

test('hero cannot talk to a hostile AI unit', () => {
  const player = { label: 'player', isEnemy: owner => owner.relation === 'hostile' }
  const hero = { owner: player }
  const hostileOwner = { label: 'hostile-ai', type: constants.PLAYER_TYPES.ai, relation: 'hostile' }
  const soldier = makeCommAlly({ owner: hostileOwner })
  const { isTalkableNpc } = loadNpcInteraction(null)

  assert.equal(isTalkableNpc(hero, soldier), false)
})

test('communication radius still ignores non-owned neutral AI units', () => {
  const owner = { label: 'player' }
  const neutralOwner = { label: 'neutral-ai', type: constants.PLAYER_TYPES.ai }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const neutralVillager = makeCommAlly({ owner: neutralOwner, i: 1, j: 0, x: 10, y: 0 })
  const { resolveCommGroup } = loadCommModule([neutralVillager], () => 0)

  assert.deepEqual(resolveCommGroup(hero, 0), [])
})

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
  const { getCommRadiusForHold } = loadNpcInteraction(null)
  const commChargeMs = 2200
  const commMaxRange = 7

  assert.equal(getCommRadiusForHold(-100), 0)
  assert.equal(getCommRadiusForHold(0), 0)
  assert.ok(getCommRadiusForHold(250) < 1)
  assert.ok(getCommRadiusForHold(commChargeMs / 2) < commMaxRange / 2)
  assert.equal(getCommRadiusForHold(commChargeMs), commMaxRange)
  assert.equal(getCommRadiusForHold(commChargeMs * 2), commMaxRange)
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
  const { getCommCellsInRadius, resolveCommGroup } = loadCommModule([inside, diagonalOutside], () => 0)

  const group = resolveCommGroup(hero, 2)
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
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './grid/movement': {
      getInstanceClosestFreeCellPath: (_unit, target) => target.path ?? [{ i: target.i, j: target.j }],
    },
    './combat': {
      isWheatMature: target => target?.mature !== false,
    },
    './maths': {
      angleDelta,
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

test('followers match the hero walking pace while following', () => {
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    requestedMoveSpeedFactor: undefined,
    getActionCondition: () => true,
  })

  updateNpcFollow(hero, { matchHeroWalk: true })

  assert.deepEqual(calls, [['move', heroCell]])
  assert.equal(follower.requestedMoveSpeedFactor, 0.5)

  updateNpcFollow(hero, { matchHeroWalk: false })

  assert.equal(follower.requestedMoveSpeedFactor, undefined)
})

test('stationary followers copy the hero crouch pose without needing to move', () => {
  const { updateNpcFollow } = loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './buildings/buildingTraining': {
      getTrainingTargetForUnit: () => null,
    },
    './grid/visibility': {
      findInstancesInSight: () => [],
    },
    './maths': {
      angleDelta,
      getInstanceDegree: () => 0,
      isometricToCartesian: () => [0, 0],
    },
    './units/unitCrouchPose': {
      applyUnitCrouchPose: (unit, active) => {
        unit.isCrouching = active
      },
      resetUnitCrouchPose: () => {},
    },
  })
  const { hero, follower, calls } = makeEscortWorld({
    i: 0,
    j: 0,
    getActionCondition: () => true,
  })
  hero.isCrouching = true

  updateNpcFollow(hero)

  assert.deepEqual(calls, [])
  assert.equal(follower.isCrouching, true)

  hero.isCrouching = false
  updateNpcFollow(hero)

  assert.equal(follower.isCrouching, false)
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

test('villager followers mirror the hero chopping nearby trees without keeping a permanent wood job', () => {
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-1',
    path: [{ i: 1, j: 1 }],
    quantity: 40,
    type: constants.RESOURCE_TYPES.tree,
  }
  const { updateNpcFollow } = loadNpcFollowModule([tree])
  const { hero, follower, calls } = makeEscortWorld({
    i: 2,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    autonomousJob: null,
    getActionCondition: (target, action) => target === tree && action === constants.ACTION_TYPES.chopwood,
    sendToTree(target) {
      calls.push(['chopwood', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.chopwood
      this.work = constants.WORK_TYPES.woodcutter
      this.autonomousJob = 'wood'
    },
  })
  hero.action = constants.ACTION_TYPES.chopwood
  hero.dest = tree

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['chopwood', tree]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.chopwood, targetLabel: 'tree-1' })
  assert.equal(follower.autonomousJob, null)
})

test('villager followers mirror hero farming while skipping occupied wheat', () => {
  const occupiedWheat = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'wheat-1',
    path: [{ i: 1, j: 1 }],
    quantity: 20,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const freeWheat = {
    ...occupiedWheat,
    i: 2,
    label: 'wheat-2',
    path: [{ i: 2, j: 1 }],
  }
  const { updateNpcFollow } = loadNpcFollowModule([occupiedWheat, freeWheat])
  const { hero, follower, calls } = makeEscortWorld({
    i: 3,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    getActionCondition: (_target, action) => action === constants.ACTION_TYPES.farm,
    sendToFarm(target) {
      calls.push(['farm', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.farm
      this.work = constants.WORK_TYPES.farmer
    },
  })
  const busyFarmer = {
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.farmer,
    action: constants.ACTION_TYPES.farm,
    dest: occupiedWheat,
    owner: hero.owner,
  }
  hero.owner.units.push(busyFarmer)
  hero.action = constants.ACTION_TYPES.farm
  hero.dest = occupiedWheat

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['farm', freeWheat]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.farm, targetLabel: 'wheat-2' })
})

test('followers mirror the hero attacking a live target', () => {
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 12,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'boar-1',
  }
  const { updateNpcFollow } = loadNpcFollowModule([target])
  const { hero, follower, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.attack,
    sendToAttack(orderTarget) {
      calls.push(['attack', orderTarget])
      this.dest = orderTarget
      this.action = constants.ACTION_TYPES.attack
    },
  })
  hero.action = constants.ACTION_TYPES.attack
  hero.dest = target

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', target]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.attack, targetLabel: 'boar-1' })
})

test('villager followers treat a hero bow intent at a deer as a hunt order for that deer', () => {
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'deer-1',
    path: [{ i: 2, j: 1 }],
    quantity: 80,
    type: 'Deer',
  }
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    getActionCondition: (target, action) => target === deer && action === constants.ACTION_TYPES.hunt,
    isUnitAtDest: (action, target) => action === constants.ACTION_TYPES.hunt && target === deer,
    sendToHunt(target) {
      calls.push(['hunt', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.hunt
      this.work = constants.WORK_TYPES.hunter
    },
  })
  hero.action = null
  hero.dest = null
  hero.followAssistIntent = { action: constants.ACTION_TYPES.hunt, target: deer, targetLabel: 'deer-1' }

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['hunt', deer]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' })
})

test('villager followers do not walk toward a deer for a hero bow-shot intent', () => {
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'deer-1',
    path: [{ i: 2, j: 1 }],
    quantity: 80,
    type: 'Deer',
  }
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    action: constants.ACTION_TYPES.hunt,
    dest: deer,
    followAssist: { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' },
    getActionCondition: (target, action) => target === deer && action === constants.ACTION_TYPES.hunt,
    isUnitAtDest: () => false,
    sendToHunt(target) {
      calls.push(['hunt', target])
    },
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  })
  hero.action = null
  hero.dest = null
  hero.followAssistIntent = { action: constants.ACTION_TYPES.hunt, target: deer, targetLabel: 'deer-1' }

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['stop'], ['move', heroCell]])
  assert.equal(follower.followAssist, null)
})

test('followers stop temporary follow-assist work when the hero stops that work', () => {
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    action: constants.ACTION_TYPES.chopwood,
    dest: { label: 'tree-1' },
    followAssist: { action: constants.ACTION_TYPES.chopwood, targetLabel: 'tree-1' },
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  })
  hero.action = null
  hero.dest = null

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['stop'], ['move', heroCell]])
  assert.equal(follower.followAssist, null)
})

test('assisted hunters stop when their hunted animal dies instead of switching to meat gathering', () => {
  const calls = []
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 0,
    isDead: true,
    isDestroyed: false,
    quantity: 80,
  }
  const { UnitDirectedActions } = loadTsModule('app/classes/unit/UnitDirectedActions.ts', {
    mocks: {
      '../../constants': {
        ...constants,
        LOADING_TYPES: { meat: 'meat' },
        SHEET_TYPES: { action: 'action' },
        SOUND_CUES: { villager: { takeMeat: 'takeMeat' } },
      },
      '../../lib': {
        BOW_SHOOT_RELEASE_FRAME: 7,
        HUNTING_PROJECTILE: 'Arrow',
        onSpriteLoopAtFrame: () => {},
        playerCanSeeInstance: () => true,
        showHealingFeedback: () => {},
        syncMovedActionTarget: () => {},
      },
      '../../lib/entities/entityHealthDisplay': {
        syncEntityHealthDisplay: () => {},
      },
      '../../lib/lang': {
        t: key => key,
      },
      '../../lib/lpc': {
        refreshBakedLpcUnitAssets: () => {},
      },
      '../../lib/units/unitExperience': {
        getHealingXpBonus: () => 0,
        grantUnitXp: () => {},
        XP_CATEGORIES: { healing: 'healing' },
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => false,
      },
      '../../lib/units/unitEnergy': {
        spendOrWaitForEnergy: () => true,
      },
      '../Projectile': {
        Projectile: class {},
      },
      './UnitManualHeroWork': {
        stopManualHeroAction: () => {},
      },
    },
  })
  const unit = {
    action: constants.ACTION_TYPES.hunt,
    dest: deer,
    followAssist: { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' },
    getActionCondition: () => true,
    sendToTakeMeat: target => calls.push(['takemeat', target]),
    sprite: {},
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  }

  new UnitDirectedActions(unit, () => {}).handleHuntAction()

  assert.deepEqual(calls, [['stop']])
  assert.equal(unit.followAssist, null)
})
