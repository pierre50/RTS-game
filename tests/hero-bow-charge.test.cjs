const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHeroTools(overrides = {}) {
  const filename = path.join(__dirname, '../app/lib/heroTools.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  class Projectile {
    constructor(options) {
      Object.assign(this, options)
    }
  }
  const mocks = {
    'pixi.js': { Assets: { cache: { get: id => ({ id, textures: [], data: {} }) } } },
    '../constants': {
      ACTION_TYPES: {
        attack: 'attack',
        build: 'build',
        chopwood: 'chopwood',
        delivery: 'delivery',
        fishing: 'fishing',
        forageberry: 'forageberry',
        hunt: 'hunt',
        minegold: 'minegold',
        minestone: 'minestone',
        takemeat: 'takemeat',
      },
      BUILDING_TYPES: { dock: 'Dock', townCenter: 'TownCenter' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', building: 'building', unit: 'unit' },
      LOADING_TYPES: {
        berry: 'berry',
        fish: 'fish',
        gold: 'gold',
        meat: 'meat',
        stone: 'stone',
        wood: 'wood',
      },
      SHEET_TYPES: { action: 'actionSheet', standing: 'standingSheet', walking: 'walkingSheet' },
      SOUND_CUES: { hero: { meleeWhiff: 'meleeWhiff' } },
      WORK_FOOD_TYPES: ['fisher', 'hunter', 'farmer', 'forager'],
      WORK_TYPES: {
        attacker: 'attacker',
        builder: 'builder',
        fisher: 'fisher',
        hunter: 'hunter',
        goldminer: 'goldminer',
        stoneminer: 'stoneminer',
        woodcutter: 'woodcutter',
      },
    },
    './heroActionRange': {
      isHeroActionInRange: (_hero, action, target) => {
        if (action !== 'fishing' && action !== 'takemeat') return false
        return Math.hypot(target.i, target.j) <= 2.5
      },
    },
    './combat': { getActionCondition: () => false, getHitPointsWithDamage: () => 0 },
    './extra': {
      getWorkWithLoadingType: loadingType =>
        ({
          berry: 'forager',
          fish: 'fisher',
          gold: 'goldminer',
          meat: 'hunter',
          stone: 'stoneminer',
          wood: 'woodcutter',
        })[loadingType] ?? 'default',
    },
    './grid/cells': { getBuildingContactDistance: () => 1 },
    './grid/visibility': { findInstancesInSight: () => [] },
    './grid/queries': { getClosestInstanceWithPath: () => null },
    './graphics': {
      SHOOT_RELEASE_FRAME: 5,
      SLASH_IMPACT_FRAME: 1,
      onSpriteLoopAtFrame: (sprite, frame, cb) => {
        sprite.onFrameChange = currentFrame => {
          if (currentFrame >= frame) cb()
        }
      },
    },
    './maths': {
      degreeToDirection: degree => (degree < 180 ? 'north' : 'south'),
      getInstanceDegree: (_hero, x) => x,
      getReliefOffset: () => 0,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
    },
    './lang': { t: key => key },
    './sound': { playAudibleSoundCue: () => {}, playSoundCue: () => {} },
    './unitEnergy': {
      hasEnergyForAction: (unit, action) => {
        const costs = {
          attack: 2,
          chopwood: 1,
          minestone: 1,
          fishing: 1,
          takemeat: 1,
          heroBowCharge: 2,
          heroWhiff: 1,
        }
        const cost = costs[action] ?? 0
        if (unit.energy == null) unit.energy = unit.totalEnergy ?? 10
        if (unit.totalEnergy == null) unit.totalEnergy = 10
        return unit.energy >= cost
      },
      spendEnergyForAction: (unit, action) => {
        const costs = {
          attack: 2,
          chopwood: 1,
          minestone: 1,
          fishing: 1,
          takemeat: 1,
          heroBowCharge: 2,
          heroWhiff: 1,
        }
        const cost = costs[action] ?? 0
        if (unit.energy == null) unit.energy = unit.totalEnergy ?? 10
        if (unit.totalEnergy == null) unit.totalEnergy = 10
        if (unit.energy < cost) return false
        unit.energy -= cost
        return true
      },
      drainEnergyAmount: (unit, amount) => {
        if (unit.energy == null) unit.energy = unit.totalEnergy ?? 10
        if (unit.totalEnergy == null) unit.totalEnergy = 10
        const current = unit.energy
        unit.energy = Math.max(0, unit.energy - amount)
        return current >= amount
      },
      ensureUnitEnergy: unit => {
        if (unit.totalEnergy == null) unit.totalEnergy = 10
        if (unit.energy == null) unit.energy = unit.totalEnergy
      },
      getActionEnergyCost: (_unit, action) => ({ heroBowCharge: 2, heroWhiff: 1 })[action] ?? 0,
    },
    './combatFeedback': { showDamageFeedback: () => {} },
    './unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: () => {},
      XP_CATEGORIES: { melee: 'melee' },
      XP_KILL_BONUS: 0,
    },
    '../classes/Projectile': { Projectile },
    '../classes/unit/UnitCommands': {
      applyWorkForAction: (hero, work, action) => Object.assign(hero, { work, action }),
    },
  }
  Object.assign(mocks, overrides)
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeSprite() {
  return {
    currentFrame: 0,
    textures: Array.from({ length: 13 }, (_, index) => ({ index })),
    loop: false,
    playing: false,
    onComplete: null,
    onFrameChange: null,
    playCalls: 0,
    stopCalls: 0,
    play() {
      this.playing = true
      this.playCalls++
    },
    stop() {
      this.playing = false
      this.stopCalls++
    },
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.play()
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.stop()
    },
  }
}

function makeHero() {
  const projectiles = []
  const hero = {
    actionLocked: false,
    context: { map: { addChild: projectile => projectiles.push(projectile) } },
    currentSheet: 'standingSheet',
    degree: 0,
    height: 0,
    hitPoints: 10,
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    owner: { isPlayed: true },
    sprite: makeSprite(),
    width: 0,
    x: 0,
    y: 0,
    drawRatios: [],
    drawHeroPowerBar(ratio) {
      this.drawRatios.push(ratio)
    },
    removeHeroPowerBar() {
      this.powerBarRemoved = true
    },
    setTextures(sheet) {
      this.currentSheet = sheet
      this.sprite.play()
    },
    syncAppearanceLayers() {},
    syncShadow() {},
  }
  return { hero, projectiles }
}

test('bow charge plays the action animation once while power keeps charging', () => {
  const { aimHeroBowChargeAt, triggerToolAttackAt, updateHeroBowCharge } = loadHeroTools()
  const { hero } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    assert.equal(hero.energy, 10)
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.onComplete, undefined)

    hero.sprite.playing = false
    hero.sprite.currentFrame = 4
    hero.sprite.onFrameChange(4)
    now += 100
    updateHeroBowCharge(hero)

    assert.ok(hero.energy < 10)
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 4)
    assert.equal(hero.heroBowChargeVisualLocked, true)
    assert.ok(hero.drawRatios.at(-1) < 1)

    aimHeroBowChargeAt(hero, { x: 220, y: 20 })
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 4)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow charge keeps the manually aimed destination instead of snapping to a nearby target', () => {
  const enemy = {
    family: 'unit',
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    x: 10,
    y: 0,
  }
  const { aimHeroBowChargeAt, releaseHeroBowCharge, triggerToolAttackAt } = loadHeroTools({
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
  })
  const { hero, projectiles } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 120, y: 0 }), true)
    aimHeroBowChargeAt(hero, { x: 240, y: 0 })
    now += 350
    assert.equal(releaseHeroBowCharge(hero, now), true)
    hero.sprite.currentFrame = 5
    hero.sprite.onFrameChange?.(5)

    assert.equal(projectiles.length, 1)
    assert.deepEqual(projectiles[0].destination, { x: 240, y: 0 })
    assert.equal(projectiles[0].target, undefined)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow charge drains energy while held and releases when energy is empty', () => {
  const { triggerToolAttackAt, updateHeroBowCharge } = loadHeroTools()
  const { hero } = makeHero()
  let now = 3000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    hero.energy = 0.1
    hero.totalEnergy = 10

    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    now += 100
    updateHeroBowCharge(hero)

    assert.equal(hero.energy, 0)
    assert.equal(hero.heroBowReleaseQueued, true)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release freezes power at mouse-up while waiting for release frame', () => {
  const { releaseHeroBowCharge, triggerToolAttackAt, updateHeroBowCharge } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  let now = 2000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 })
    hero.sprite.currentFrame = 1
    now += 70
    assert.equal(releaseHeroBowCharge(hero), true)
    const releasePower = hero.heroBowReleasePower
    assert.ok(releasePower > 0 && releasePower < 0.2)

    now += 600
    updateHeroBowCharge(hero)
    assert.equal(hero.heroBowReleasePower, releasePower)
    assert.equal(hero.drawRatios.at(-1), releasePower)
    assert.equal(projectiles.length, 0)

    hero.sprite.currentFrame = 5
    hero.sprite.onFrameChange?.(5)

    assert.equal(projectiles.length, 1)
    assert.equal(projectiles[0].maxDistance, Math.hypot(64, 32) * 4 * 0.2)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release drains energy up to the mouse-up instant', () => {
  const { releaseHeroBowCharge, triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  let now = 4000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    hero.energy = 10
    hero.totalEnergy = 10

    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    now += 350
    assert.equal(releaseHeroBowCharge(hero), true)

    assert.equal(hero.energy, 9)
    assert.equal(hero.heroBowReleasePower, 0.5)
  } finally {
    global.performance = originalPerformance
  }
})

test('hero resource tools get a small hero contact forgiveness band', () => {
  const fish = {
    category: 'Fish',
    family: 'resource',
    i: 2.4,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const calls = []
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: () => true, getHitPointsWithDamage: () => 0 },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [fish].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    i: 0,
    j: 0,
    isUnitAtDest: () => false,
    getAction: action => calls.push(['getAction', action]),
    setDest: target => calls.push(['setDest', target]),
  })

  assert.equal(triggerToolAction(hero, 'interact'), true)
  assert.deepEqual(calls, [
    ['setDest', fish],
    ['getAction', 'fishing'],
  ])
})

test('full hero inventory blocks fishing without playing a whiff animation', () => {
  const fish = {
    category: 'Fish',
    family: 'resource',
    i: 1,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const messages = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': { getActionCondition: () => true, getHitPointsWithDamage: () => 0 },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [fish].filter(predicate) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    context: {
      map: { addChild: () => {} },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    i: 0,
    j: 0,
    loading: 10,
    loadingMax: { fish: 10 },
    loadingType: 'fish',
    isUnitAtDest: () => true,
    getAction: action => {
      hero.startedAction = action
    },
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), false)
  assert.equal(hero.startedAction, undefined)
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.deepEqual(messages, [['heroInventoryFull', 'warning']])
})

test('free-hand interact does not whiff when aiming at a delivery building out of reach', () => {
  const townCenter = {
    family: 'building',
    i: 4,
    isDestroyed: false,
    j: 0,
    type: 'TownCenter',
    x: 10,
    y: 0,
  }
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (_hero, target, action) => target === townCenter && action === 'delivery',
      getHitPointsWithDamage: () => 0,
    },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [townCenter].filter(predicate) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    i: 0,
    j: 0,
    loading: 10,
    loadingType: 'fish',
    isUnitAtDest: () => false,
    getAction: action => {
      hero.startedAction = action
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), false)
  assert.equal(hero.startedAction, undefined)
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
})

test('civil tools are no longer equipped combat weapons', () => {
  const enemy = {
    family: 'unit',
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    x: 10,
    y: 0,
  }
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (_hero, target, action) => target === enemy && action === 'attack',
      getHitPointsWithDamage: () => 0,
    },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
  })
  const { hero } = makeHero()

  assert.equal(triggerToolAttackAt(hero, 'pickaxe', { x: 10, y: 0 }), false)
  assert.equal(triggerToolAttackAt(hero, 'hammer', { x: 10, y: 0 }), false)
  assert.equal(triggerToolAttackAt(hero, 'fishingRod', { x: 10, y: 0 }), false)
  assert.equal(enemy.hitPoints, 10)
  assert.equal(hero.actionLocked, false)
})

test('context actions check energy from the action, not an equipped tool', () => {
  const tree = {
    category: 'Tree',
    family: 'resource',
    i: 1,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const calls = []
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: (_hero, target, action) => target === tree && action === 'chopwood' },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [tree].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 2,
    i: 0,
    j: 0,
    isUnitAtDest: () => true,
    getAction: action => calls.push(['getAction', action]),
    setDest: target => calls.push(['setDest', target]),
  })

  assert.equal(triggerToolAction(hero, 'interact'), true)
  assert.equal(hero.energy, 2)
  assert.equal(hero.contextAction, 'chop')
  assert.deepEqual(calls, [
    ['setDest', tree],
    ['getAction', 'chopwood'],
  ])
})

test('context actions are blocked when hero energy is too low', () => {
  const rock = {
    category: 'Stone',
    family: 'resource',
    i: 1,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const messages = []
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: (_hero, target, action) => target === rock && action === 'minestone' },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [rock].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    context: {
      map: { addChild: () => {} },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    energy: 0,
    i: 0,
    j: 0,
    isUnitAtDest: () => true,
    getAction: action => {
      hero.startedAction = action
    },
  })

  assert.equal(triggerToolAction(hero, 'interact'), false)
  assert.equal(hero.startedAction, undefined)
  assert.equal(hero.contextAction, undefined)
  assert.deepEqual(messages, [['heroNotEnoughEnergy', 'warning']])
})

test('free-hand interact plays an empty swing when no target is aimed', () => {
  const { triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  Object.assign(hero, {
    getAction: action => {
      hero.startedAction = action
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.startedAction, undefined)
  assert.equal(hero.actionLocked, true)
  assert.equal(hero.currentSheet, 'actionSheet')
})

test('free-hand interact damages an aimed enemy unit on the slash impact frame', () => {
  const enemy = {
    family: 'unit',
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'enemy',
    totalHitPoints: 10,
    x: 10,
    y: 0,
    isAttackedCalls: [],
    isAttacked(attacker) {
      this.isAttackedCalls.push(attacker.label)
    },
  }
  const damageFeedback = []
  const xp = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (_hero, target, action) => target === enemy && action === 'attack',
      getHitPointsWithDamage: (_hero, target) => Math.max(0, target.hitPoints - 3),
    },
    './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
    './unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: (_unit, category, amount) => xp.push([category, amount]),
      XP_CATEGORIES: { melee: 'melee' },
      XP_KILL_BONUS: 0,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    isUnitAtDest: () => true,
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.energy, 8)
  assert.equal(hero.action, 'attack')
  assert.equal(hero.dest, enemy)
  assert.equal(enemy.hitPoints, 10)

  hero.sprite.currentFrame = 1
  hero.sprite.onFrameChange(1)

  assert.equal(enemy.hitPoints, 7)
  assert.deepEqual(damageFeedback, [['enemy', 3]])
  assert.deepEqual(xp, [['melee', 3]])
  assert.deepEqual(enemy.isAttackedCalls, ['hero'])
})

for (const family of ['building', 'animal']) {
  test(`free-hand interact damages an aimed enemy ${family} on the slash impact frame`, () => {
    const enemy = {
      family,
      hitPoints: 10,
      i: 1,
      isDead: false,
      isDestroyed: false,
      j: 0,
      label: `enemy-${family}`,
      totalHitPoints: 10,
      x: 10,
      y: 0,
      isAttackedCalls: [],
      isAttacked(attacker) {
        this.isAttackedCalls.push(attacker.label)
      },
    }
    const damageFeedback = []
    const { triggerToolAttackAt } = loadHeroTools({
      './combat': {
        getActionCondition: (_hero, target, action) => target === enemy && action === 'attack',
        getHitPointsWithDamage: (_hero, target) => Math.max(0, target.hitPoints - 2),
      },
      './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
      './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
    })
    const { hero } = makeHero()
    Object.assign(hero, {
      energy: 10,
      isUnitAtDest: () => true,
      setDest: target => {
        hero.dest = target
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
    hero.sprite.currentFrame = 1
    hero.sprite.onFrameChange(1)

    assert.equal(enemy.hitPoints, 8)
    assert.deepEqual(damageFeedback, [[`enemy-${family}`, 2]])
    assert.deepEqual(enemy.isAttackedCalls, ['hero'])
  })
}

test('free-hand interact does not whiff without energy', () => {
  const messages = []
  const { triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  Object.assign(hero, {
    context: {
      map: { addChild: () => {} },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    energy: 0,
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), false)
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.deepEqual(messages, [['heroNotEnoughEnergy', 'warning']])
})

test('bow charge does not start without energy', () => {
  const messages = []
  const { triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  Object.assign(hero, {
    context: {
      map: { addChild: () => {} },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    energy: 0,
  })

  assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 0 }), false)
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.heroBowChargeStart, undefined)
  assert.deepEqual(messages, [['heroNotEnoughEnergy', 'warning']])
})

test('free-hand interact still whiffs when a contextual target is aimed but out of reach', () => {
  const tree = {
    category: 'Tree',
    family: 'resource',
    i: 20,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': { getActionCondition: (_hero, target, action) => target === tree && action === 'chopwood' },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [tree].filter(predicate) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    i: 0,
    j: 0,
    isUnitAtDest: () => false,
    getAction: action => {
      hero.startedAction = action
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.startedAction, undefined)
  assert.equal(hero.actionLocked, true)
  assert.equal(hero.currentSheet, 'actionSheet')
})

test('hero free-hand context action can take meat with the hero food forgiveness band', () => {
  const carcass = {
    family: 'animal',
    hitPoints: 0,
    i: 2.4,
    isDead: true,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 5,
    y: 0,
  }
  const calls = []
  const { triggerToolAction } = loadHeroTools({
    './combat': {
      getActionCondition: (_hero, target, action) => target === carcass && action === 'takemeat',
      getHitPointsWithDamage: () => 0,
    },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [carcass].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    i: 0,
    j: 0,
    isUnitAtDest: () => false,
    getAction: action => calls.push(['getAction', action]),
    setDest: target => calls.push(['setDest', target]),
  })

  assert.equal(triggerToolAction(hero, 'interact'), true)
  assert.deepEqual(calls, [
    ['setDest', carcass],
    ['getAction', 'takemeat'],
  ])
})
