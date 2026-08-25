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
        unit: { swordAttack: ['sword-attack', 'sword-attack-2'] },
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
    './equipmentStats': {
      UNARMED_UNIT_WEAPON_POWER: 0.5,
      getEquipmentCombatStats: equipment => {
        const stats = { weaponPower: 0, meleeArmor: 0, pierceArmor: 0 }
        for (const item of equipment) {
          if (item === 'sword_ceramic') stats.weaponPower += 4
          if (item === 'sword_copper') stats.weaponPower += 6
          if (item === 'axe_ceramic') stats.weaponPower += 5
          if (item === 'bow') stats.weaponPower += 4
        }
        return stats
      },
      getUnitWorkEquipment: work =>
        ({
          heroSword: ['sword_ceramic'],
          woodcutter: ['axe_ceramic'],
          hunter: ['bow'],
        })[work] ?? [],
      getUnitCombatRange: unit => unit.range ?? 4,
      refreshUnitEquipmentStats: () => {},
    },
    './equipmentLoot': {
      consumeHeroEquippedItem: (hero, slot) => {
        if (!hero.inventory?.equipped?.[slot]) return false
        const currentCount = Math.max(1, Math.floor(hero.inventory.equippedCounts?.[slot] ?? 1))
        const nextCount = currentCount - 1
        if (nextCount > 0) {
          hero.inventory.equippedCounts[slot] = nextCount
        } else {
          delete hero.inventory.equipped[slot]
          delete hero.inventory.equippedCounts[slot]
        }
        return true
      },
    },
    './grid/cells': { getBuildingContactDistance: () => 1 },
    './grid/visibility': { findInstancesInSight: () => [] },
    './grid/queries': { getClosestInstanceWithPath: () => null },
    './graphics': {
      BOW_SHOOT_RELEASE_FRAME: 8,
      LASSO_SHOOT_RELEASE_FRAME: 5,
      SLASH_IMPACT_FRAME: 5,
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
    './lpc/baked': { applyBakedLpcUnitAssets: () => true },
    './slashRecoveryAnimation': { logHeroSlashFrame: () => {}, playReverseSlashRecovery: () => false },
    './unitEnergy': {
      hasEnergyForAction: (unit, action) => {
        const costs = {
          attack: 2,
          chopwood: 1,
          minestone: 1,
          takemeat: 1,
          heroPowerCharge: 2,
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
          heroPowerCharge: 2,
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
      getActionEnergyCost: (_unit, action) => ({ heroPowerCharge: 2, heroDefense: 2, heroWhiff: 1 })[action] ?? 0,
    },
    './combatFeedback': { showDamageFeedback: () => {}, showParryFeedback: () => {} },
    './debug': { debugLog: () => {} },
    './heroToolEquipment': {
      HERO_EQUIPPED_ITEM_ORDER: ['interact', 'sword', 'bow', 'lasso'],
      HERO_TOOL_ORDER: ['interact', 'sword', 'bow', 'lasso'],
      EQUIPPED_ITEM_WEAPON: { sword: 'sword_ceramic', bow: 'bow' },
      getEquippedItemWeapon: (tool, _age = 0, hero) => {
        if (tool === 'sword') return hero?.inventory?.activeWeapons?.melee
        if (tool === 'bow') return hero?.inventory?.activeWeapons?.ranged
        if (tool === 'lasso') return hero?.inventory?.activeWeapons?.lasso
        return { sword: 'sword_ceramic', bow: 'bow' }[tool]
      },
      isHeroToolAvailable: (hero, tool) => {
        if (!tool || tool === 'interact') return true
        return Boolean(mocks['./heroToolEquipment'].getEquippedItemWeapon(tool, hero?.owner?.age ?? 0, hero))
      },
      getHeroToolEquipment: (hero, tool) => {
        const activeWeapons = hero.inventory?.activeWeapons ?? {}
        if (tool === 'sword') return [activeWeapons.melee, hero.inventory?.equipped?.offhand, activeWeapons.offhand].filter(Boolean)
        if (tool === 'bow') return [activeWeapons.ranged, activeWeapons.quiver, hero.inventory?.equipped?.arrow].filter(Boolean)
        if (tool === 'lasso') return [activeWeapons.lasso].filter(Boolean)
        return mocks['./equipmentStats'].getUnitWorkEquipment('attacker')
      },
      applyEquippedItemAppearance: (hero, tool) => {
        const work = { interact: 'attacker', sword: 'heroSword', bow: 'hunter', lasso: 'attacker' }[tool]
        hero.work = work
      },
      applyToolAppearance: (hero, tool) => mocks['./heroToolEquipment'].applyEquippedItemAppearance(hero, tool),
    },
    './heroTargeting': {
      CLICK_TARGET_SEARCH_RANGE: 15,
      MOUNTED_ATTACK_HALF_ANGLE: 45,
      getHeroAimDegree: (hero, destination) => {
        const dx = destination.x - hero.x
        const dy = (destination.y - hero.y) * (32 / 64)
        return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 180)
      },
      getHeroAimDelta: (hero, target) =>
        mocks['./maths'].angleDelta(mocks['./heroTargeting'].getHeroAimDegree(hero, target), hero.degree ?? 0),
      isMountedAttackAimBlocked: (hero, point) =>
        Boolean(hero.mountedOnHorse) &&
        mocks['./maths'].angleDelta(mocks['./heroTargeting'].getHeroAimDegree(hero, point), hero.degree ?? 0) > 45,
      getDirectionalTarget: (hero, candidates, halfAngle = 25) =>
        mocks['./heroTargeting'].getDirectionalTargets(hero, candidates, halfAngle)[0] ?? null,
      getDirectionalTargets: (hero, candidates, halfAngle = 25) =>
        candidates
          .map(target => {
            const aimPoint = mocks['./heroActionRange'].getHeroInteractionTargetPoint(hero, target)
            const targetHalfAngle = ['building', 'resource'].includes(target.family ?? '') ? 45 : halfAngle
            const angle = mocks['./heroTargeting'].getHeroAimDelta(hero, aimPoint)
            const dist = Math.hypot(aimPoint.x - hero.x, aimPoint.y - hero.y)
            return { target, angle, dist, halfAngle: targetHalfAngle }
          })
          .filter(candidate => candidate.angle <= candidate.halfAngle)
          .map(candidate => ({
            ...candidate,
            score: candidate.dist + (candidate.angle / Math.max(candidate.halfAngle, 1)) * 64,
          }))
          .sort((a, b) => a.score - b.score || a.dist - b.dist || a.angle - b.angle)
          .map(candidate => candidate.target),
      findFacingEntity: (hero, matches, range = 15) => {
        const candidates = mocks['./grid/visibility'].findInstancesInSight(hero, matches, range)
        const seen = new Set(candidates)
        const grid = hero.context?.map?.grid
        if (grid) {
          const centerI = hero.i ?? 0
          const centerJ = hero.j ?? 0
          const scanRadius = Math.ceil(range)
          const rangeSq = range * range
          for (let i = centerI - scanRadius; i <= centerI + scanRadius; i++) {
            const row = grid[i]
            if (!row) continue
            for (let j = centerJ - scanRadius; j <= centerJ + scanRadius; j++) {
              const cell = row[j]
              if (!cell) continue
              const di = i - centerI
              const dj = j - centerJ
              if (di * di + dj * dj > rangeSq) continue
              for (const corpse of cell.corpses ?? []) {
                if (!seen.has(corpse) && matches(corpse)) {
                  candidates.push(corpse)
                  seen.add(corpse)
                }
              }
            }
          }
        }
        return mocks['./heroTargeting'].getDirectionalTarget(hero, candidates)
      },
    },
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
  function loadTsFile(tsFilename) {
    const tsSource = fs.readFileSync(tsFilename, 'utf8')
    const { code: tsCode } = babel.transformSync(tsSource, {
      filename: tsFilename,
      presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', tsCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }

  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === './HeroContextActions') {
      return loadTsFile(path.join(__dirname, '../app/lib/HeroContextActions.ts'))
    }
    if (request === './HeroProjectileTools') {
      return loadTsFile(path.join(__dirname, '../app/lib/HeroProjectileTools.ts'))
    }
    if (request === './HeroMeleeTools') {
      return loadTsFile(path.join(__dirname, '../app/lib/HeroMeleeTools.ts'))
    }
    if (request === './heroToolAnimation') {
      return loadTsFile(path.join(__dirname, '../app/lib/heroToolAnimation.ts'))
    }
    if (request === './heroEnergy') {
      return loadTsFile(path.join(__dirname, '../app/lib/heroEnergy.ts'))
    }
    if (request === './heroDefense') {
      return loadTsFile(path.join(__dirname, '../app/lib/heroDefense.ts'))
    }
    if (request === './unitWorkAppearance') {
      return {
        applyUnitWorkAssets: (unit, work) => {
          const assets = unit.allAssets?.[work]
          if (!assets) return
          unit.actionSheet = assets.actionSheet
          unit.standingSheet = assets.standingSheet
          unit.walkingSheet = assets.walkingSheet
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
    inventory: {
      activeWeapons: {
        melee: 'sword_ceramic',
        ranged: 'bow',
        lasso: 'lasso',
      },
      equipped: { arrow: 'arrow_ceramic' },
      equippedCounts: { arrow: 1 },
      equipment: [],
    },
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

function playImpactFrame(hero, frame = 5) {
  hero.sprite.currentFrame = frame
  hero.sprite.onFrameChange?.(frame)
}

function releaseChargedSword(tools, hero, now = performance.now(), impactFrame = 5) {
  assert.equal(tools.releaseHeroPowerCharge(hero, now), true)
  playImpactFrame(hero, impactFrame)
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

test('directional targeting includes unit corpses stored on cells', () => {
  const corpse = { family: 'unit', i: 1, isDead: true, isDestroyed: false, j: 0, label: 'fallen-1', x: 32, y: 0 }
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      corpses: new Set(),
    }))
  )
  grid[1][0].corpses.add(corpse)
  const { findFacingEntity } = loadHeroTools({
    './grid/visibility': {
      findInstancesInSight: () => [],
    },
    './heroActionRange': {
      getHeroInteractionTargetPoint: (_hero, target) => target,
      isHeroActionInRange: () => false,
      isHeroInteractionTargetReachable: () => true,
    },
  })

  const target = findFacingEntity({ context: { map: { grid } }, i: 0, j: 0, x: 0, y: 0, degree: 180 }, () => true)

  assert.equal(target, corpse)
})

test('hero aim degree gives horizontal screen aim more room on isometric terrain', () => {
  const { getHeroAimDegree } = loadHeroTools()
  const hero = { x: 0, y: 0 }

  assert.equal(getHeroAimDegree(hero, { x: 10, y: 0 }), 180)
  assert.equal(getHeroAimDegree(hero, { x: 0, y: 10 }), 270)
  assert.equal(getHeroAimDegree(hero, { x: 10, y: 10 }), 207)
})

test('weapon tools require assigned inventory items instead of bag-only debug items', () => {
  const { getEquippedItemWeapon, isHeroToolAvailable, triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  hero.inventory = {
    equipment: ['sword_ceramic'],
    equipped: {},
    activeWeapons: {},
  }

  assert.equal(getEquippedItemWeapon('sword', 0, hero), undefined)
  assert.equal(isHeroToolAvailable(hero, 'sword'), false)
  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), false)

  hero.inventory.activeWeapons.melee = 'sword_ceramic'
  assert.equal(getEquippedItemWeapon('sword', 0, hero), 'sword_ceramic')
  assert.equal(isHeroToolAvailable(hero, 'sword'), true)
})

test('bow charge plays the action animation once while power keeps charging', () => {
  const { aimHeroPowerChargeAt, triggerToolAttackAt, updateHeroPowerCharge } = loadHeroTools()
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
    updateHeroPowerCharge(hero)

    assert.ok(hero.energy < 10)
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 8)
    assert.equal(hero.heroPowerChargeVisualLocked, true)
    assert.ok(hero.drawRatios.at(-1) < 1)

    aimHeroPowerChargeAt(hero, { x: 220, y: 20 })
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 8)
  } finally {
    global.performance = originalPerformance
  }
})

test('sword charge freezes the action animation on frame 0 while power charges', () => {
  const { triggerToolAttackAt, updateHeroPowerCharge } = loadHeroTools()
  const { hero } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 20 }), true)

    assert.equal(hero.actionLocked, true)
    assert.equal(hero.currentSheet, 'actionSheet')
    assert.equal(hero.heroPowerChargeTool, 'sword')
    assert.equal(hero.heroPowerChargeVisualLocked, true)
    assert.equal(hero.sprite.currentFrame, 0)
    assert.equal(hero.sprite.playing, false)
    assert.deepEqual(hero.drawRatios, [0])

    now += 350
    updateHeroPowerCharge(hero, now)

    assert.equal(hero.sprite.currentFrame, 0)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.drawRatios.at(-1), 0.5)
  } finally {
    global.performance = originalPerformance
  }
})

test('hero sword whiff rewinds the slash recovery through the shared helper', () => {
  const reverseCalls = []
  const soundCalls = []
  const tools = loadHeroTools({
    './slashRecoveryAnimation': {
      logHeroSlashFrame: () => {},
      playReverseSlashRecovery: (hero, options) => {
        reverseCalls.push([hero, options.releaseFrame])
        options.onComplete()
        return true
      },
    },
    './sound': {
      playAudibleSoundCue: () => {},
      playSoundCue: cue => soundCalls.push(cue),
    },
  })
  const { releaseHeroPowerCharge, triggerToolAttackAt } = tools
  const { hero } = makeHero()

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  assert.equal(hero.actionLocked, true)
  assert.equal(releaseHeroPowerCharge(hero), true)
  assert.equal(typeof hero.sprite.onFrameChange, 'function')

  hero.sprite.onFrameChange(5)

  assert.deepEqual(reverseCalls, [[hero, 5]])
  assert.deepEqual(soundCalls, ['meleeWhiff'])
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.equal(hero.sprite.onComplete, undefined)
  assert.equal(hero.sprite.onFrameChange, undefined)
})

test('free-hand whiff rewinds the slash recovery through the shared helper', () => {
  const reverseCalls = []
  const soundCalls = []
  const { triggerToolAttackAt } = loadHeroTools({
    './slashRecoveryAnimation': {
      logHeroSlashFrame: () => {},
      playReverseSlashRecovery: (hero, options) => {
        reverseCalls.push([hero, options.releaseFrame])
        options.onComplete()
        return true
      },
    },
    './sound': {
      playAudibleSoundCue: () => {},
      playSoundCue: cue => soundCalls.push(cue),
    },
  })
  const { hero } = makeHero()

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.actionLocked, true)
  assert.equal(typeof hero.sprite.onFrameChange, 'function')

  hero.sprite.onFrameChange(5)

  assert.deepEqual(reverseCalls, [[hero, 5]])
  assert.deepEqual(soundCalls, ['meleeWhiff'])
  assert.equal(hero.actionLocked, false)
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.equal(hero.sprite.onComplete, undefined)
  assert.equal(hero.sprite.onFrameChange, undefined)
})

test('mounted bow charge keeps aim inside the starting horse cone', () => {
  const { aimHeroPowerChargeAt, triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()

  hero.mountedOnHorse = true

  assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 0 }), true)
  assert.equal(hero.degree, 180)
  assert.equal(hero.heroPowerChargeFacingDegree, 180)
  assert.equal(aimHeroPowerChargeAt(hero, { x: -10, y: 0 }), true)
  assert.equal(hero.degree, 180)
  assert.deepEqual(hero.heroPowerChargeDestination, { x: 10, y: 0 })
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
  const { beginHeroDefense } = loadHeroTools({
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

  assert.equal(beginHeroDefense(hero, 'sword'), true)
  assert.equal(typeof hero.showHeroDefenseFlash, 'function')
  hero.showHeroDefenseFlash()

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
  const { beginHeroDefense } = loadHeroTools()
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

  assert.equal(beginHeroDefense(hero, 'sword'), true)
  assert.equal(typeof hero.showHeroDefenseFlash, 'function')
  hero.showHeroDefenseFlash()
  assert.equal(weaponLayer.tint, 0xfff06a)
  hero.showHeroDefenseFlash()
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
  const { aimHeroPowerChargeAt, releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools({
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
  })
  const { hero, projectiles } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 120, y: 0 }), true)
    aimHeroPowerChargeAt(hero, { x: 240, y: 0 })
    now += 350
    assert.equal(releaseHeroPowerCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 1)
    assert.deepEqual(projectiles[0].destination, { x: 240, y: 0 })
    assert.equal(projectiles[0].target, undefined)
  } finally {
    global.performance = originalPerformance
  }
})

test('mounted bow release spawns the arrow from the rider height', () => {
  const { releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    hero.x = 50
    hero.y = 100
    hero.mountedOnHorse = true
    hero.getMountedRiderY = () => -25

    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 170, y: 100 }), true)
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 1)
    assert.deepEqual(projectiles[0].spawnPoint, { x: 70, y: 57 })
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release without equipped arrows plays the shot but does not spawn a projectile', () => {
  const { releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  const messages = []
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }
  hero.inventory.equipped = {}
  hero.context.menu = { showMessage: (message, level) => messages.push([message, level]) }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 170, y: 100 }), true)
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 0)
    assert.deepEqual(messages, [['heroNoArrowsEquipped', 'warning']])
    assert.equal(hero.currentSheet, 'actionSheet')
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release consumes equipped arrows until the slot is empty', () => {
  const { releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  let inventoryRefreshes = 0
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }
  hero.inventory.equippedCounts.arrow = 2
  hero.context.menu = { refreshInventory: () => inventoryRefreshes++ }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 170, y: 100 }), true)
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 1)
    assert.equal(hero.inventory.equipped.arrow, 'arrow_ceramic')
    assert.equal(hero.inventory.equippedCounts.arrow, 1)
    assert.equal(inventoryRefreshes, 1)

    hero.actionLocked = false
    hero.sprite = makeSprite()
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 170, y: 100 }), true)
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)
    hero.sprite.currentFrame = 8
    hero.sprite.onFrameChange?.(8)

    assert.equal(projectiles.length, 2)
    assert.equal(hero.inventory.equipped.arrow, undefined)
    assert.equal(hero.inventory.equippedCounts.arrow, undefined)
    assert.equal(inventoryRefreshes, 2)
  } finally {
    global.performance = originalPerformance
  }
})

test('lasso charge releases a drawn lasso instead of an arrow', () => {
  const soundCues = []
  const { aimHeroPowerChargeAt, releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools({
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
    aimHeroPowerChargeAt(hero, { x: 180, y: 0 })
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)
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
  const { triggerToolAttackAt, updateHeroPowerCharge } = loadHeroTools()
  const { hero } = makeHero()
  let now = 3000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    hero.energy = 0.1
    hero.totalEnergy = 10

    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    now += 100
    updateHeroPowerCharge(hero)

    assert.equal(hero.energy, 0)
    assert.equal(hero.heroPowerReleaseQueued, true)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release freezes power at mouse-up while waiting for release frame', () => {
  const { releaseHeroPowerCharge, triggerToolAttackAt, updateHeroPowerCharge } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  let now = 2000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 })
    hero.sprite.currentFrame = 5
    now += 70
    assert.equal(releaseHeroPowerCharge(hero), true)
    const releasePower = hero.heroPowerReleasePower
    assert.ok(releasePower > 0 && releasePower < 0.2)

    now += 600
    updateHeroPowerCharge(hero)
    assert.equal(hero.heroPowerReleasePower, releasePower)
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
  const { releaseHeroPowerCharge, triggerToolAttackAt } = loadHeroTools()
  const { hero } = makeHero()
  let now = 4000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    hero.energy = 10
    hero.totalEnergy = 10

    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    now += 350
    assert.equal(releaseHeroPowerCharge(hero), true)

    assert.equal(hero.energy, 9)
    assert.equal(hero.heroPowerReleasePower, 0.5)
  } finally {
    global.performance = originalPerformance
  }
})

test('hero interact can gather from an aimed resource target', () => {
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
    isUnitAtDest: () => true,
    getAction: action => {
      hero.startedAction = action
    },
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.startedAction, 'takemeat')
  assert.equal(hero.dest, carcass)
  assert.equal(hero.actionLocked, false)
  assert.deepEqual(messages, [])
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

test('sword whiffs use the generic melee whiff sound', () => {
  const soundCues = []
  const tools = loadHeroTools({
    './sound': { playAudibleSoundCue: () => {}, playSoundCue: cue => soundCues.push(cue) },
  })
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  assert.deepEqual(soundCues, [])
  releaseChargedSword(tools, hero)

  assert.deepEqual(soundCues, ['meleeWhiff'])
})

test('axe whiffs use the generic melee whiff sound', () => {
  const soundCues = []
  const { triggerToolAttackAt } = loadHeroTools({
    './sound': { playAudibleSoundCue: () => {}, playSoundCue: cue => soundCues.push(cue) },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    work: 'woodcutter',
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.deepEqual(soundCues, [])
  playImpactFrame(hero)

  assert.deepEqual(soundCues, ['meleeWhiff'])
})

test('axe attacks against units use sword attack cues on the slash impact frame', () => {
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
  }
  const soundCues = []
  const { triggerToolAttackAt } = loadHeroTools({
    './combat': {
      getActionCondition: (_hero, target, action) => target === enemy && action === 'attack',
      getHitPointsWithDamage: (_hero, target) => Math.max(0, target.hitPoints - 3),
    },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
    './sound': { playAudibleSoundCue: (_instance, cue) => soundCues.push(cue), playSoundCue: () => {} },
  })
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    i: 0,
    isUnitAtDest: () => true,
    j: 0,
    sounds: { hit: 'hero-hit' },
    work: 'woodcutter',
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.deepEqual(soundCues, [])
  playImpactFrame(hero)

  assert.deepEqual(soundCues, [['sword-attack', 'sword-attack-2']])
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
    i: 0,
    isUnitAtDest: () => true,
    j: 0,
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
  assert.equal(hero.energy, 8)
  assert.equal(hero.action, 'attack')
  assert.equal(hero.dest, enemy)
  assert.equal(enemy.hitPoints, 10)

  hero.sprite.currentFrame = 5
  hero.sprite.onFrameChange(5)

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
      i: 0,
      sounds: { hit: 'hero-hit' },
      isUnitAtDest: () => true,
      j: 0,
      setDest: target => {
        hero.dest = target
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'interact', { x: 10, y: 0 }), true)
    assert.deepEqual(soundCues, [])
    hero.sprite.currentFrame = 5
    hero.sprite.onFrameChange(5)

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
  const tools = loadHeroTools({
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
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    equipment: [],
    i: 0,
    j: 0,
    owner: { isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'gaia' },
    isUnitAtDest: () => true,
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  releaseChargedSword(tools, hero)

  assert.equal(animal.hitPoints, 16)
  assert.deepEqual(damageFeedback, [['enemy-animal', 4]])
})

test('half charged sword releases on the slash impact frame with scaled damage', () => {
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
  const tools = loadHeroTools({
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
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  let now = 3000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    Object.assign(hero, {
      energy: 10,
      equipment: [],
      i: 0,
      j: 0,
      owner: { isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'gaia' },
      isUnitAtDest: () => true,
      setDest: target => {
        hero.dest = target
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
    now += 350
    releaseChargedSword(tools, hero, now)

    assert.equal(animal.hitPoints, 15)
    assert.deepEqual(damageFeedback, [['enemy-animal', 5]])
    assert.equal(hero.powerBarRemoved, true)
  } finally {
    global.performance = originalPerformance
  }
})

test('fully charged sword releases on the slash impact frame with full scaled damage', () => {
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
  const tools = loadHeroTools({
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
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  let now = 3000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    Object.assign(hero, {
      energy: 10,
      equipment: [],
      i: 0,
      j: 0,
      owner: { isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'gaia' },
      isUnitAtDest: () => true,
      setDest: target => {
        hero.dest = target
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
    now += 700
    releaseChargedSword(tools, hero, now)

    assert.equal(animal.hitPoints, 14)
    assert.deepEqual(damageFeedback, [['enemy-animal', 6]])
    assert.equal(hero.powerBarRemoved, true)
  } finally {
    global.performance = originalPerformance
  }
})

test('fully charged sword release keeps the slash sheets and flashes the sword layer', () => {
  let restoreFlash = null
  const { triggerToolAttackAt, releaseHeroPowerCharge } = loadHeroTools({
    'pixi.js': {
      Assets: {
        cache: {
          get: id => ({ id, textures: [], data: {} }),
          has: () => true,
        },
      },
      Graphics: class {},
    },
  })
  const { hero } = makeHero()
  let now = 3000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    Object.assign(hero, {
      appearance: {
        layers: [
          {
            equipmentKey: 'sword_ceramic',
            actionSheet: 'lpc-equipment/sword_ceramic/front/action',
          },
        ],
      },
      appearanceLayerSprites: new Map([[0, { tint: 0x123456, alpha: 0.5, blendMode: 'normal', visible: true }]]),
      assets: { actionSheet: 'lpc-baked/hero/greek/male/action/slash' },
      actionSheet: { id: 'hero-slash' },
      context: {
        scheduler: {
          addOneShot(callback) {
            restoreFlash = callback
          },
        },
      },
      energy: 10,
      setTextures(sheet) {
        this.currentSheet = sheet
        this.actionSheetUsedForAttack = this.actionSheet?.id
        this.swordLayerUsedForAttack = this.appearance.layers[0].actionSheet
        this.sprite.play()
      },
    })

    assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
    now += 700
    assert.equal(releaseHeroPowerCharge(hero, now), true)

    const swordLayerSprite = hero.appearanceLayerSprites.get(0)
    assert.equal(hero.actionSheetUsedForAttack, 'hero-slash')
    assert.equal(hero.swordLayerUsedForAttack, 'lpc-equipment/sword_ceramic/front/action')
    assert.equal(swordLayerSprite.tint, 0xfff06a)
    assert.equal(swordLayerSprite.alpha, 1)
    assert.equal(swordLayerSprite.blendMode, 'add')

    restoreFlash()
    assert.equal(swordLayerSprite.tint, 0x123456)
    assert.equal(swordLayerSprite.alpha, 0.5)
    assert.equal(swordLayerSprite.blendMode, 'normal')

    hero.sprite.onComplete()

    assert.equal(hero.actionSheet.id, 'hero-slash')
    assert.equal(hero.assets.actionSheet, 'lpc-baked/hero/greek/male/action/slash')
    assert.equal(hero.appearance.layers[0].actionSheet, 'lpc-equipment/sword_ceramic/front/action')
  } finally {
    global.performance = originalPerformance
  }
})

test('sword attacks use sword attack cues on the slash impact frame', () => {
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
  const soundCues = []
  const tools = loadHeroTools({
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
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [animal].filter(predicate) },
    './sound': { playAudibleSoundCue: (_instance, cue) => soundCues.push(cue), playSoundCue: () => {} },
  })
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    equipment: [],
    i: 0,
    j: 0,
    owner: { isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'gaia' },
    isUnitAtDest: () => true,
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  assert.deepEqual(soundCues, [])
  releaseChargedSword(tools, hero)

  assert.deepEqual(soundCues, [['sword-attack', 'sword-attack-2']])
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
  const tools = loadHeroTools({
    './combat': {
      getActionCondition: (_source, target, action) => action === 'attack' && target === berrybush,
      getHitPointsWithDamage: (_source, target, damage) => Math.max(0, target.hitPoints - damage),
    },
    './combatFeedback': { showDamageFeedback: (target, amount) => damageFeedback.push([target.label, amount]) },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [berrybush].filter(predicate) },
  })
  const { triggerToolAttackAt } = tools
  const { hero } = makeHero()
  Object.assign(hero, {
    energy: 10,
    i: 0,
    isUnitAtDest: () => true,
    j: 0,
    owner: { age: 0, isPlayed: true },
    setDest: target => {
      hero.dest = target
    },
  })

  assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
  releaseChargedSword(tools, hero)

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

test('charged sword release does not fall back to a whiff when attack energy is too low', () => {
  const enemy = {
    family: 'animal',
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'enemy-animal',
    totalHitPoints: 10,
    x: 10,
    y: 0,
  }
  const messages = []
  const soundCues = []
  const tools = loadHeroTools({
    './combat': {
      getActionCondition: (_source, target, action) => action === 'attack' && target === enemy,
      getHitPointsWithDamage: (_source, target, damage) => Math.max(0, target.hitPoints - damage),
    },
    './grid/visibility': { findInstancesInSight: (_hero, predicate) => [enemy].filter(predicate) },
    './sound': { playAudibleSoundCue: () => {}, playSoundCue: cue => soundCues.push(cue) },
  })
  const { releaseHeroPowerCharge, triggerToolAttackAt } = tools
  const { hero } = makeHero()
  let now = 5000
  const originalPerformance = global.performance
  global.performance = { now: () => now }
  Object.assign(hero, {
    context: {
      map: { addChild: () => {} },
      menu: { showMessage: (message, level) => messages.push([message, level]) },
    },
    energy: 1,
    i: 0,
    isUnitAtDest: () => true,
    j: 0,
  })

  try {
    assert.equal(triggerToolAttackAt(hero, 'sword', { x: 10, y: 0 }), true)
    assert.equal(releaseHeroPowerCharge(hero, now), false)
    assert.equal(hero.energy, 1)
    assert.equal(hero.actionLocked, false)
    assert.equal(hero.currentSheet, 'standingSheet')
    assert.equal(enemy.hitPoints, 10)
    assert.deepEqual(soundCues, [])
    assert.deepEqual(messages, [['heroNotEnoughEnergy', 'warning']])
  } finally {
    global.performance = originalPerformance
  }
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
  assert.equal(hero.heroPowerChargeStart, undefined)
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
