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
  class Graphics {
    constructor() {
      this.alpha = 1
      this.destroyed = false
      this.parent = null
      this.position = { set: (x, y) => Object.assign(this.position, { x, y }) }
    }
    moveTo() {
      return this
    }
    lineTo() {
      return this
    }
    circle() {
      return this
    }
    stroke() {
      return this
    }
    fill() {
      return this
    }
    clear() {
      return this
    }
    destroy() {
      this.destroyed = true
    }
  }
  const combatMock = { getActionCondition: () => false, getHitPointsWithDamage: () => 0 }
  const mocks = {
    'pixi.js': { Assets: { cache: { get: id => ({ id, textures: [], data: {} }) } }, Graphics },
    '../constants': {
      ACTION_TYPES: {
        attack: 'attack',
        build: 'build',
        chopwood: 'chopwood',
        delivery: 'delivery',
        farm: 'farm',
        forageberry: 'forageberry',
        hunt: 'hunt',
        minegold: 'minegold',
        minestone: 'minestone',
        takemeat: 'takemeat',
      },
      BUILDING_TYPES: { townCenter: 'TownCenter' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', building: 'building', resource: 'resource', unit: 'unit' },
      LOADING_TYPES: {
        berry: 'berry',
        gold: 'gold',
        meat: 'meat',
        stone: 'stone',
        wheat: 'wheat',
        wood: 'wood',
      },
      RESOURCE_TYPES: { berrybush: 'Berrybush', wheat: 'Wheat' },
      SHEET_TYPES: {
        action: 'actionSheet',
        harvest: 'harvestSheet',
        standing: 'standingSheet',
        walking: 'walkingSheet',
      },
      SOUND_CUES: {
        hero: { meleeWhiff: 'meleeWhiff' },
        projectile: { arrowLaunch: ['archer-attack', 'archer-attack-2'] },
      },
      WORK_FOOD_TYPES: ['hunter', 'farmer', 'forager'],
      WORK_TYPES: {
        attacker: 'attacker',
        builder: 'builder',
        farmer: 'farmer',
        hunter: 'hunter',
        goldminer: 'goldminer',
        stoneminer: 'stoneminer',
        woodcutter: 'woodcutter',
      },
    },
    './heroActionRange': {
      getHeroInteractionTargetPoint: (_hero, target) => ({
        x: target.i ?? target.x ?? 0,
        y: target.j ?? target.y ?? 0,
      }),
      isHeroActionInRange: (_hero, action, target) => {
        if (action !== 'takemeat') return false
        return Math.hypot(target.i, target.j) <= 2.5
      },
      isHeroInteractionTargetReachable: (hero, _action, target) =>
        Math.hypot((target.i ?? 0) - (hero.i ?? 0), (target.j ?? 0) - (hero.j ?? 0)) <= 2.5,
    },
    './combat': combatMock,
    './diplomaticAggression': {
      applyDiplomaticAggression: () => ({ changed: false, hostileNow: false, relation: 'unchanged' }),
      canTriggerDiplomaticAggression: () => false,
    },
    './extra': {
      getWorkWithLoadingType: loadingType =>
        ({
          berry: 'forager',
          gold: 'goldminer',
          meat: 'hunter',
          stone: 'stoneminer',
          wheat: 'farmer',
          wood: 'woodcutter',
        })[loadingType] ?? 'default',
    },
    './equipmentStats': {
      UNARMED_UNIT_WEAPON_POWER: 0.5,
      getEquipmentCombatStats: equipment => {
        const stats = { weaponPower: 0, meleeArmor: 0, pierceArmor: 0 }
        for (const item of equipment) {
          if (item === 'sword_ceramic') stats.weaponPower += 4
          if (item === 'sword_copper') stats.weaponPower += 6
          if (item === 'bow') stats.weaponPower += 4
        }
        return stats
      },
      getUnitWorkEquipment: work =>
        ({
          heroSword: ['sword_ceramic'],
          hunter: ['bow'],
        })[work] ?? [],
      refreshUnitEquipmentStats: () => {},
    },
    './grid/cells': { getBuildingContactDistance: () => 1 },
    './grid/visibility': { findInstancesInSight: () => [] },
    './grid/queries': { getClosestInstanceWithPath: () => null },
    './graphics': {
      BOW_SHOOT_RELEASE_FRAME: 8,
      LASSO_SHOOT_RELEASE_FRAME: 5,
      SLASH_IMPACT_FRAME: 1,
      onSpriteLoopAtFrame: (sprite, frame, cb) => {
        sprite.onFrameChange = currentFrame => {
          if (currentFrame >= frame) cb()
        }
      },
    },
    './maths': {
      angleDelta: (a, b) => {
        const diff = Math.abs(a - b) % 360
        return diff > 180 ? 360 - diff : diff
      },
      degreeToDirection: degree => (degree < 180 ? 'north' : 'south'),
      getInstanceDegree: (_hero, x) => x,
      getReliefOffset: () => 0,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
    },
    './lang': { t: key => (key === 'heroDefenseMissed' ? 'Loupé !' : key) },
    './sound': { playAudibleSoundCue: () => {}, playSoundCue: () => {} },
    './unitEnergy': {
      hasEnergyForAction: (unit, action) => {
        const costs = {
          attack: 2,
          chopwood: 1,
          minestone: 1,
          takemeat: 1,
          heroBowCharge: 2,
          heroDefense: 2,
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
          takemeat: 1,
          heroBowCharge: 2,
          heroDefense: 2,
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
      getActionEnergyCost: (_unit, action) => ({ heroBowCharge: 2, heroDefense: 2, heroWhiff: 1 })[action] ?? 0,
    },
    './combatFeedback': { showDamageFeedback: () => {}, showParryFeedback: () => {} },
    './unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: () => {},
      XP_CATEGORIES: { melee: 'melee' },
      XP_KILL_BONUS: 0,
    },
    '../classes/Projectile': { Projectile },
    '../classes/HeroLassoThrow': {
      HeroLassoThrow: class HeroLassoThrow {
        constructor(hero, destination) {
          Object.assign(this, { hero, destination, type: 'HeroLassoThrow' })
        }
      },
    },
    '../classes/unit/UnitCommands': {
      applyWorkForAction: (hero, work, action) => Object.assign(hero, { work, action }),
    },
  }
  Object.assign(mocks, overrides)
  if (overrides['./combat']) mocks['./combat'] = { ...combatMock, ...overrides['./combat'] }
  if (!mocks['./combatHit']) {
    mocks['./combatHit'] = {
      applyCombatHit: (source, target, options = {}) => {
        const beforeHitPoints = target.hitPoints ?? 0
        target.hitPoints = mocks['./combat'].getHitPointsWithDamage(
          source,
          target,
          options.defaultDamage,
          options.bonusDamage
        )
        const damageDealt = beforeHitPoints - (target.hitPoints ?? 0)
        const killed = (target.hitPoints ?? 0) <= 0
        mocks['./combatFeedback'].showDamageFeedback?.(target, damageDealt)
        if (options.xpUnit && options.xpCategory) {
          mocks['./unitExperience'].grantUnitXp?.(options.xpUnit, options.xpCategory, damageDealt)
        }
        const notifyTarget = options.notifyTarget ?? 'always'
        if (notifyTarget === 'always' || (notifyTarget === 'survived' && !killed)) {
          target.isAttacked?.(options.attacker ?? source)
        }
        if (killed) {
          if (options.grantKillXp !== false && options.xpUnit && options.xpCategory) {
            mocks['./unitExperience'].grantUnitXp?.(
              options.xpUnit,
              options.xpCategory,
              mocks['./unitExperience'].XP_KILL_BONUS
            )
          }
          target.die?.()
        }
        return { damageDealt, killed }
      },
    }
  }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === './unitWorkAppearance') {
      return {
        applyUnitWorkAssets: (unit, work) => {
          const assets = unit.allAssets?.[work]
          if (!assets) return
          unit.actionSheet = assets.actionSheet
          unit.standingSheet = assets.standingSheet
          unit.walkingSheet = unit.loading && assets.loadedSheet ? assets.loadedSheet : assets.walkingSheet
        },
      }
    }
    return require(request)
  }
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
    syncMountedHorseSprite() {
      this.syncMountedHorseSpriteCalls = (this.syncMountedHorseSpriteCalls ?? 0) + 1
    },
    syncShadow() {},
  }
  return { hero, projectiles }
}

test('directional targeting prefers a much closer nearby resource over a perfectly aligned far one', () => {
  const nearWheat = { family: 'resource', label: 'near-wheat', x: 32, y: 32 }
  const farTree = { family: 'resource', label: 'far-tree', x: 120, y: 0 }
  const { findFacingEntity } = loadHeroTools({
    './grid/visibility': {
      findInstancesInSight: (_hero, matches) => [farTree, nearWheat].filter(matches),
    },
    './heroActionRange': {
      getHeroInteractionTargetPoint: (_hero, target) => target,
      isHeroActionInRange: () => false,
      isHeroInteractionTargetReachable: () => true,
    },
  })

  const target = findFacingEntity({ x: 0, y: 0, degree: 180 }, () => true)

  assert.equal(target, nearWheat)
})

test('hero aim degree gives horizontal screen aim more room on isometric terrain', () => {
  const { getHeroAimDegree } = loadHeroTools()
  const hero = { x: 0, y: 0 }

  assert.equal(getHeroAimDegree(hero, { x: 10, y: 0 }), 180)
  assert.equal(getHeroAimDegree(hero, { x: 0, y: 10 }), 270)
  assert.equal(getHeroAimDegree(hero, { x: 10, y: 10 }), 207)
})

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
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange(8)
    now += 100
    updateHeroBowCharge(hero)

    assert.ok(hero.energy < 10)
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 8)
    assert.equal(hero.heroBowChargeVisualLocked, true)
    assert.ok(hero.drawRatios.at(-1) < 1)

    aimHeroBowChargeAt(hero, { x: 220, y: 20 })
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 8)
  } finally {
    global.performance = originalPerformance
  }
})

test('hero defense holds melee tools on the third action frame', () => {
  const { beginHeroDefense, updateHeroDefense } = loadHeroTools()
  const { hero } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(beginHeroDefense(hero, 'sword'), true)
    assert.equal(hero.actionLocked, true)
    assert.equal(hero.heroDefenseActive, true)
    assert.equal(hero.currentSheet, 'actionSheet')
    assert.equal(hero.sprite.currentFrame, 0)
    assert.equal(hero.sprite.playing, true)

    hero.sprite.currentFrame = 2
    hero.sprite.onFrameChange(2)
    assert.equal(hero.heroDefenseVisualLocked, true)
    assert.equal(hero.sprite.currentFrame, 2)
    assert.equal(hero.sprite.playing, false)

    now += 350
    updateHeroDefense(hero)
    assert.equal(hero.sprite.currentFrame, 2)
    assert.equal(hero.energy, 9)
  } finally {
    global.performance = originalPerformance
  }
})

test('hero defense releases by reversing back to standing', () => {
  const { beginHeroDefense, releaseHeroDefense } = loadHeroTools()
  const { hero } = makeHero()
  const scheduled = new Map()
  let nextTaskId = 1
  hero.context.scheduler = {
    add(callback) {
      const id = nextTaskId++
      scheduled.set(id, callback)
      return id
    },
    addOneShot(callback) {
      const id = nextTaskId++
      scheduled.set(id, callback)
      return id
    },
    remove(id) {
      scheduled.delete(id)
    },
  }

  assert.equal(beginHeroDefense(hero, 'sword'), true)
  hero.sprite.currentFrame = 2
  assert.equal(releaseHeroDefense(hero), true)
  assert.equal(hero.heroDefenseActive, false)
  assert.equal(hero.actionLocked, true)
  assert.equal(scheduled.size, 2)

  const reverseStep = [...scheduled.values()][1]
  reverseStep()
  assert.equal(hero.sprite.currentFrame, 1)
  assert.equal(hero.actionLocked, true)
  reverseStep()
  assert.equal(hero.sprite.currentFrame, 0)
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.equal(scheduled.size, 0)
})

test('hero defense release fallback clears a stuck reverse animation', () => {
  const { beginHeroDefense, releaseHeroDefense } = loadHeroTools()
  const { hero } = makeHero()
  const scheduled = new Map()
  let nextTaskId = 1
  hero.context.scheduler = {
    add(callback) {
      const id = nextTaskId++
      scheduled.set(id, callback)
      return id
    },
    addOneShot(callback) {
      const id = nextTaskId++
      scheduled.set(id, callback)
      return id
    },
    remove(id) {
      scheduled.delete(id)
    },
  }

  assert.equal(beginHeroDefense(hero, 'sword'), true)
  hero.sprite.currentFrame = 2
  assert.equal(releaseHeroDefense(hero), true)
  assert.equal(hero.actionLocked, true)

  const fallbackStep = [...scheduled.values()][0]
  fallbackStep()
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.equal(hero.heroDefenseReverseTaskId, null)
  assert.equal(hero.heroDefenseReleaseFallbackTaskId, null)
})

test('hero defense only starts with point weapons', () => {
  const { beginHeroDefense } = loadHeroTools()
  const { hero } = makeHero()

  assert.equal(beginHeroDefense(hero, 'bow'), false)
  assert.equal(hero.heroDefenseActive, undefined)
  assert.equal(beginHeroDefense(hero, 'interact'), false)
  assert.equal(beginHeroDefense(hero, 'sword'), true)
})

test('hero defense flash targets weapon layers without flashing the body sprite', () => {
  const parryFeedback = []
  const { showHeroDefenseFlash } = loadHeroTools({
    './combatFeedback': {
      showDamageFeedback: () => {},
      showParryFeedback: (target, text) => parryFeedback.push([target.label, text]),
    },
  })
  const { hero } = makeHero()
  const weaponLayer = { tint: 0x123456, alpha: 0.5, blendMode: 'normal', visible: true }
  const hiddenLayer = { tint: 0x654321, alpha: 0.25, visible: false }
  const scheduled = []
  hero.appearanceLayerSprites = new Map([
    [0, weaponLayer],
    [1, hiddenLayer],
  ])
  hero.context.scheduler = {
    addOneShot(callback) {
      scheduled.push(callback)
      return scheduled.length
    },
  }
  hero.sprite.tint = 0x222222
  hero.sprite.alpha = 0.75

  showHeroDefenseFlash(hero)

  assert.equal(weaponLayer.tint, 0xfff06a)
  assert.equal(weaponLayer.alpha, 1)
  assert.equal(weaponLayer.blendMode, 'add')
  assert.equal(hiddenLayer.tint, 0x654321)
  assert.equal(hiddenLayer.alpha, 0.25)
  assert.equal(hero.sprite.tint, 0x222222)
  assert.equal(hero.sprite.alpha, 0.75)
  assert.deepEqual(parryFeedback, [['hero', 'Loupé !']])

  scheduled[0]()
  assert.equal(weaponLayer.tint, 0x123456)
  assert.equal(weaponLayer.alpha, 0.5)
  assert.equal(weaponLayer.blendMode, 'normal')
})

test('overlapping hero defense flashes restore the original weapon color', () => {
  const { showHeroDefenseFlash } = loadHeroTools()
  const { hero } = makeHero()
  const weaponLayer = { tint: 0x123456, alpha: 0.5, blendMode: 'normal', visible: true }
  const scheduled = []
  hero.appearanceLayerSprites = new Map([[0, weaponLayer]])
  hero.context.scheduler = {
    addOneShot(callback) {
      scheduled.push(callback)
      return scheduled.length
    },
  }

  showHeroDefenseFlash(hero)
  assert.equal(weaponLayer.tint, 0xfff06a)
  showHeroDefenseFlash(hero)
  assert.equal(weaponLayer.tint, 0xfff06a)

  scheduled[0]()
  assert.equal(weaponLayer.tint, 0xfff06a)
  scheduled[1]()
  assert.equal(weaponLayer.tint, 0x123456)
  assert.equal(weaponLayer.alpha, 0.5)
  assert.equal(weaponLayer.blendMode, 'normal')
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
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 1)
    assert.deepEqual(projectiles[0].destination, { x: 240, y: 0 })
    assert.equal(projectiles[0].target, undefined)
  } finally {
    global.performance = originalPerformance
  }
})

test('lasso charge releases a drawn lasso instead of an arrow', () => {
  const soundCues = []
  const { aimHeroBowChargeAt, releaseHeroBowCharge, triggerToolAttackAt } = loadHeroTools({
    './sound': {
      playAudibleSoundCue: () => {},
      playSoundCue: cue => soundCues.push(cue),
    },
  })
  const { hero, projectiles } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'lasso', { x: 120, y: 0 }), true)
    aimHeroBowChargeAt(hero, { x: 180, y: 0 })
    now += 700
    assert.equal(releaseHeroBowCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 1)
    assert.equal(projectiles[0].type, 'HeroLassoThrow')
    assert.deepEqual(projectiles[0].destination, { x: 180, y: 0 })
    assert.equal(projectiles[0].maxDistance, undefined)
    assert.deepEqual(soundCues, [['archer-attack', 'archer-attack-2']])
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

    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

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
  const carcass = {
    family: 'animal',
    i: 2.4,
    isDead: true,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const calls = []
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: () => true, getHitPointsWithDamage: () => 0 },
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

test('free-hand interact starts farming aimed wheat instead of whiffing', () => {
  const wheat = {
    family: 'resource',
    i: 1,
    isDead: false,
    isDestroyed: false,
    isUsedBy: { label: 'villager-1' },
    j: 0,
    quantity: 10,
    type: 'Wheat',
    x: 10,
    y: 0,
  }
  const calls = []
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: (_hero, target, action) => target === wheat && action === 'farm' },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [wheat].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    i: 0,
    j: 0,
    loading: 0,
    loadingMax: { wheat: 10 },
    loadingType: null,
    owner: { label: 'player' },
    isUnitAtDest: () => true,
    getAction: action => calls.push(['getAction', action]),
    setDest: target => calls.push(['setDest', target]),
  })

  assert.equal(triggerToolAction(hero, 'interact'), true)
  assert.equal(hero.work, 'farmer')
  assert.equal(hero.action, 'farm')
  assert.deepEqual(calls, [
    ['setDest', wheat],
    ['getAction', 'farm'],
  ])
})

test('full hero inventory blocks gathering without playing a whiff animation', () => {
  const carcass = {
    family: 'animal',
    i: 1,
    isDead: true,
    isDestroyed: false,
    j: 0,
    quantity: 100,
    x: 10,
    y: 0,
  }
  const messages = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': { getActionCondition: () => true, getHitPointsWithDamage: () => 0 },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [carcass].filter(predicate) },
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
    loadingMax: { meat: 10 },
    loadingType: 'meat',
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
    loadingType: 'berry',
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

test('context build refreshes the action sheet before starting the locked action', () => {
  const foundation = {
    family: 'building',
    hitPoints: 10,
    i: 1,
    isBuilt: false,
    isDestroyed: false,
    j: 0,
    totalHitPoints: 100,
    x: 10,
    y: 0,
  }
  const { triggerToolAction } = loadHeroTools({
    './combat': { getActionCondition: (_hero, target, action) => target === foundation && action === 'build' },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [foundation].filter(predicate) },
    './grid/queries': {
      getClosestInstanceWithPath: (_hero, candidates) =>
        candidates.length ? { instance: candidates[0], path: [] } : null,
    },
    '../classes/unit/UnitCommands': {
      applyWorkForAction: (hero, work, action) => Object.assign(hero, { work, action }),
    },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    action: 'build',
    allAssets: {
      builder: {
        actionSheet: 'hero-builder-action',
      },
    },
    i: 0,
    j: 0,
    work: 'builder',
    isUnitAtDest: () => true,
    getAction: action => {
      hero.startedAction = action
      hero.setTextures(hero.actionSheet ? 'actionSheet' : 'walkingSheet')
      hero.actionLocked = true
    },
    setDest: target => {
      hero.dest = target
    },
  })
  hero.actionSheet = undefined

  assert.equal(triggerToolAction(hero, 'interact'), true)
  assert.equal(hero.startedAction, 'build')
  assert.deepEqual(hero.actionSheet, { id: 'hero-builder-action', textures: [], data: {} })
  assert.equal(hero.currentSheet, 'actionSheet')
  assert.equal(hero.actionLocked, true)
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
  assert.equal(hero.syncMountedHorseSpriteCalls, 1)
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
    const soundCues = []
    const { triggerToolAttackAt } = loadHeroTools({
      './combat': {
        getActionCondition: (_hero, target, action) => target === enemy && action === 'attack',
        getHitPointsWithDamage: (_hero, target) => Math.max(0, target.hitPoints - 2),
      },
      './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
      './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
      './sound': { playAudibleSoundCue: (_instance, cue) => soundCues.push(cue), playSoundCue: () => {} },
    })
    const { hero } = makeHero()
    Object.assign(hero, {
      energy: 10,
      sounds: { hit: 'hero-hit' },
      isUnitAtDest: () => true,
      setDest: target => {
        hero.dest = target
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
    assert.deepEqual(soundCues, [])
    hero.sprite.currentFrame = 1
    hero.sprite.onFrameChange(1)

    assert.equal(enemy.hitPoints, 8)
    assert.deepEqual(soundCues, ['hero-hit'])
    assert.deepEqual(damageFeedback, [[`enemy-${family}`, 2]])
    assert.deepEqual(enemy.isAttackedCalls, ['hero'])
  })
}

test('sword uses fixed weapon damage even when the hero has no damage stat', () => {
  const animal = {
    family: 'animal',
    hitPoints: 20,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'enemy-animal',
    owner: { label: 'gaia' },
    totalHitPoints: 20,
    x: 10,
    y: 0,
  }
  const damageFeedback = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (source, target, action) =>
        action === 'attack' &&
        target === animal &&
        (source.equipment?.length ?? 0) > 0 &&
        source.owner?.isEnemy?.(target.owner) &&
        target.hitPoints > 0 &&
        !target.isDead,
      getHitPointsWithDamage: (_source, target, damage) => Math.max(0, target.hitPoints - damage),
    },
    './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [animal].filter(predicate) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    equipment: [],
    owner: { isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'gaia' },
    isUnitAtDest: () => true,
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  hero.sprite.currentFrame = 1
  hero.sprite.onFrameChange(1)

  assert.equal(animal.hitPoints, 16)
  assert.deepEqual(damageFeedback, [['enemy-animal', 4]])
})

test('sword damages berry bushes with weapon damage', () => {
  const berrybush = {
    family: 'resource',
    hitPoints: 40,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'berrybush',
    quantity: 100,
    totalHitPoints: 40,
    type: 'Berrybush',
    x: 10,
    y: 0,
  }
  const damageFeedback = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (_source, target, action) => action === 'attack' && target === berrybush,
      getHitPointsWithDamage: (_source, target, damage) => Math.max(0, target.hitPoints - damage),
    },
    './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [berrybush].filter(predicate) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    isUnitAtDest: () => true,
    owner: { age: 0, isPlayed: true },
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  hero.sprite.currentFrame = 1
  hero.sprite.onFrameChange(1)

  assert.equal(berrybush.hitPoints, 36)
  assert.equal(berrybush.quantity, 100)
  assert.deepEqual(damageFeedback, [['berrybush', 4]])
})

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
