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
      createIsoSelectionMarker: options => ({ ...options, label: options.label }),
    },
    './sound': {
      playSelectionSound: () => {},
      playSoundCue: () => {},
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
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  COLOR_WHITE: 0xffffff,
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
    villager: 'Villager',
  },
}

function loadNpcInteraction(target) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: () => (target ? [target] : []),
    },
    './maths': {
      getInstanceDegree: () => 0,
    },
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

function loadNpcFollowModule(instances) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './maths': {
      getInstanceDegree: () => 0,
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
