const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

const WALK_SPEED_FACTOR = 0.5

function loadHeroController({
  npcInteraction,
  heroTools,
  heroActionRange,
  heroProximityInteractions,
  getInstanceDegree = () => 0,
  playSoundCue = () => {},
}) {
  const filename = path.join(__dirname, '../app/controllers/HeroController.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const loadControllerTsModule = modulePath => {
    const moduleFilename = path.join(__dirname, `../app/controllers/${modulePath}.ts`)
    const moduleSource = fs.readFileSync(moduleFilename, 'utf8')
    const { code: moduleCode } = babel.transformSync(moduleSource, {
      filename: moduleFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', moduleCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }
  const mocks = {
    'pixi.js': {
      Graphics: class {
        constructor() {
          this.circles = []
          this.ellipses = []
          this.paths = []
          this.polys = []
          this.position = { y: 0 }
        }
        clear() {}
        destroy() {}
        circle(x, y, radius) {
          this.circles.push({ x, y, radius })
        }
        ellipse(x, y, halfWidth, halfHeight) {
          this.ellipses.push({ x, y, halfWidth, halfHeight })
        }
        poly(points) {
          this.polys.push(points)
        }
        fill(options) {
          this.fillOptions = options
        }
        moveTo(x, y) {
          this.paths.push({ type: 'moveTo', x, y })
        }
        lineTo(x, y) {
          this.paths.push({ type: 'lineTo', x, y })
        }
        closePath() {
          this.paths.push({ type: 'closePath' })
        }
        stroke() {}
      },
    },
    '../constants': {
      COLOR_GOLD: 0xf8d878,
      HERO_ACTION_MOVE_SPEED_FACTOR: 0,
      HERO_MELEE_CHARGE_MOVE_SPEED_FACTOR: 0.55,
      HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR: 0.8,
      LABEL_TYPES: { commRadius: 'commRadius' },
      BUILDING_TYPES: { stable: 'Stable' },
      MOUNTED_HORSE_SPEED_BONUS: 0.45,
      SHEET_TYPES: { action: 'action', standing: 'standing', walking: 'walking' },
      SOUND_CUES: { unit: { horseMoving: 'horse-moving' } },
      STEP_TIME: 100,
    },
    '../lib': {
      cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
      drawRoundedIsoShape: (layer, points) => {
        points.forEach((point, index) => {
          if (index === 0) layer.moveTo(point.x, point.y)
          else layer.lineTo(point.x, point.y)
        })
        layer.closePath()
      },
      getInstanceDegree,
      getReliefOffset: instance => instance?.reliefLift ?? 0,
      getRoundedIsoShapePoints: ({ x = 0, y = 0, factor = 1 } = {}) => [
        { x: x - 32 * factor * 0.22, y: y - 16 * factor * (1 - 0.22) },
        { x: x + 32 * factor * 0.22, y: y - 16 * factor * (1 - 0.22) },
      ],
      playAudibleSoundCue: (_instance, cue) => playSoundCue(cue),
      playSoundCue,
      updateInstanceRenderVisibility: () => {},
    },
    '../lib/hero/heroTools': heroTools,
    '../lib/hero/heroProximityInteractions': heroProximityInteractions,
    '../lib/hero/heroCursor': {
      updateHeroCursor: () => {},
    },
    '../lib/hero/heroActionRange': heroActionRange,
    '../lib/grid/visibility': {
      instanceIsInPlayerSight: instance => instance.visible !== false && instance.inPlayerSight !== false,
    },
    '../lib/chief': {
      heroCanCommand: hero => Boolean(hero?.isChief),
    },
    '../lib/lang': {
      t: key => key,
    },
    '../lib/lpc': {
      applyBakedLpcUnitAssets: () => {},
    },
    '../lib/npc/npcInteraction': npcInteraction,
    '../lib/units/unitEnergy': {
      getEnergyMoveSpeedMultiplier: () => 1,
      updateUnitEnergy: () => {},
    },
    '../lib/units/unitLocomotion': {
      UNIT_WALK_SPEED_FACTOR: WALK_SPEED_FACTOR,
      composeMoveSpeedFactor: (...factors) =>
        factors.reduce((value, factor) => Math.min(value, Math.max(0, factor)), 1),
      getUnitWalkSpeedFactor: isWalking => (isWalking ? WALK_SPEED_FACTOR : 1),
      isUnitWalkSpeedFactor: factor => factor < 1,
    },
    '../lib/units/unitWalkingAnimation': {
      applyUnitWalkingAnimationSpeed: () => {},
    },
    '../lib/units/unitHealth': {
      updateUnitHealthRegen: () => {},
    },
    '../lib/units/unitControl': {
      setUnitControlMode: () => {},
    },
    '../services/HeroCriticalHealthEffects': {
      HeroCriticalHealthEffects: class {
        update() {}
        destroy() {}
      },
    },
    '../services/HeroOcclusionFade': {
      HeroOcclusionFade: class {
        update() {}
      },
    },
  }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === './HeroControllerSupport') {
      return loadControllerTsModule('HeroControllerSupport')
    }
    if (request === './HeroControllerUpdate') {
      return loadControllerTsModule('HeroControllerUpdate')
    }
    if (request === './HeroCompanionHorseController') {
      return loadControllerTsModule('HeroCompanionHorseController')
    }
    if (request === './HeroActionInputController') {
      return loadControllerTsModule('HeroActionInputController')
    }
    if (request === './HeroEquipmentController') {
      return loadControllerTsModule('HeroEquipmentController')
    }
    if (request === './HeroCommunicationController') return loadControllerTsModule('HeroCommunicationController')
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroController
}

function createController({
  nearbyGroup = [],
  getInstanceDegree = () => 0,
  heroToolsOverride = {},
  commIndicatorDelayMs,
  additionalPlayers = [],
  ownerBuildings = [],
  resolveCommGroup,
  resolveHeroProximityInteraction = () => null,
  withScheduler = false,
} = {}) {
  const calls = []
  const grid = Array.from({ length: 15 }, (_, i) =>
    Array.from({ length: 15 }, (_, j) => ({
      i,
      j,
      x: (i - j) * 32,
      y: (i + j) * 16,
      z: 0,
      solid: false,
      has: null,
      category: 'Land',
      waterBorder: false,
      border: false,
      place(entity) {
        this.has = entity
      },
    }))
  )
  const createdAnimals = []
  const map = {
    grid,
    updateInstanceBucket: (unit, oldI, oldJ) => calls.push(['updateInstanceBucket', unit.label, oldI, oldJ]),
    gaia: {
      createAnimal(options) {
        const animal = {
          ...options,
          label: `animal-${createdAnimals.length + 1}`,
          family: 'animal',
          x: grid[options.i][options.j].x,
          y: grid[options.i][options.j].y,
          z: grid[options.i][options.j].z,
          horseColor: options.horseColor ?? 'chestnut',
          isDead: false,
          isDestroyed: false,
          visible: true,
          animalBehavior: { stop: () => calls.push(['animalBehavior.stop', options.type]) },
          stop: () => calls.push(['horse.stop', animal.label]),
          sendTo: (target, action, callOptions) => calls.push(['horse.sendTo', target, action, callOptions]),
          clear() {
            animal.isDestroyed = true
            animal.x = null
            animal.y = null
            animal.z = null
            calls.push(['horse.clear', animal.label])
          },
        }
        createdAnimals.push(animal)
        return animal
      },
    },
  }
  const hero = {
    isChief: true,
    context: {
      map,
    },
    label: 'hero',
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    z: 0,
    currentCell: grid[0][0],
    addChildAt: child => {
      child.parent = { removeChild: () => calls.push('removeIndicator') }
    },
    isDead: false,
    isDestroyed: false,
    loading: 0,
    currentSheet: 'standing',
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sendToEvt: (target, action, options) => calls.push(['hero.sendToEvt', target.label, action, options]),
    syncMountedHorseSprite: () => {
      hero.syncMountedHorseSpriteCalls = (hero.syncMountedHorseSpriteCalls ?? 0) + 1
    },
    syncMountedRiderPosition: () => {
      hero.syncMountedRiderPositionCalls = (hero.syncMountedRiderPositionCalls ?? 0) + 1
    },
    stop: () => calls.push('stop'),
  }
  const owner = {
    label: 'player',
    buildings: ownerBuildings,
  }
  hero.owner = owner
  const npcInteraction = {
    COMM_BASE_RANGE: 2.5,
    COMM_INDICATOR_DELAY_MS: commIndicatorDelayMs,
    findCommGroup: () => nearbyGroup,
    getCommCellsInRadius: () => [
      { i: 0, j: 0 },
      { i: 1, j: 0 },
    ],
    getCommRadiusForHold: () => 2.5,
    isAnyNpcNear: () => true,
    releaseIfStillLooking: () => {},
    resolveCommGroup: resolveCommGroup || (() => nearbyGroup),
    resolveHoverTarget: () => null,
    sendNpcGroupToTarget: () => {},
    updateNpcFollow: () => {},
  }
  const heroTools = {
    aimHeroPowerChargeAt: () => false,
    aimHeroDefenseAt: () => false,
    applyToolAppearance: () => {},
    beginHeroDefense: () => false,
    cancelHeroActiveToolAction: () => false,
    cancelHeroPowerCharge: () => {},
    cancelHeroLasso: hero => hero.heroLasso?.clearLasso({ releaseHorse: true }),
    cancelHeroDefense: () => {},
    findFacingEntity: (_hero, matches) => createdAnimals.find(animal => matches(animal)) ?? null,
    getHeroAimDegree: (hero, destination) => getInstanceDegree(hero, destination.x, destination.y),
    HERO_TOOL_ORDER: ['interact', 'sword', 'bow', 'lasso'],
    isHeroPowerChargeActiveForTool: (hero, tool) =>
      hero.heroPowerChargeStart != null && hero.heroPowerChargeTool === tool && !hero.heroPowerReleaseQueued,
    isHeroToolAvailable: () => true,
    isMountedAttackAimBlocked: () => false,
    releaseHeroDefense: () => false,
    releaseHeroPowerCharge: () => false,
    triggerToolAttackAt: (_hero, _tool, destination) => {
      calls.push(['attack', destination])
      return true
    },
    updateHeroPowerCharge: () => {},
    updateHeroDefense: () => {},
    ...heroToolsOverride,
  }
  const heroActionRange = {
    isHeroInteractionTargetReachable: (hero, _action, target) => Math.hypot(hero.i - target.i, hero.j - target.j) <= 1,
  }
  const HeroController = loadHeroController({
    npcInteraction,
    heroTools,
    heroActionRange,
    heroProximityInteractions: {
      resolveHeroProximityInteraction,
    },
    getInstanceDegree,
    playSoundCue: cue => calls.push(['playSoundCue', cue]),
  })
  let cursorPoint = { x: 10, y: 20 }
  const scheduler = withScheduler
    ? {
        elapsedMs: 0,
        tasks: new Map(),
        nextId: 1,
        add(callback, interval, name) {
          const id = this.nextId++
          this.tasks.set(id, { callback, interval, name })
          return id
        },
        remove(id) {
          this.tasks.delete(id)
        },
        update(id, interval) {
          const task = this.tasks.get(id)
          if (task) task.interval = interval
        },
        tick(ms) {
          this.elapsedMs += ms
          for (const task of [...this.tasks.values()]) task.callback()
        },
      }
    : undefined
  const controller = new HeroController({
    context: {
      scheduler,
      player: owner,
      players: [owner, ...additionalPlayers],
      menu: {
        openNpcOrders: (npcs, options) => calls.push(['openNpcOrders', npcs, options]),
        setHeroInteractionPrompt: actionKey => calls.push(['setHeroInteractionPrompt', actionKey]),
        showMessage: (message, tone) => calls.push(['showMessage', message, tone]),
      },
    },
    getCellUnderCursor: () => null,
    getFacingEntityTarget: () => null,
    getWorldPointUnderCursor: () => cursorPoint,
    getGamepadMoveVector: () => ({ dx: 0, dy: 0 }),
    getViewportMetrics: () => ({ visibleLeft: -80, visibleTop: -80, visibleWidth: 160, visibleHeight: 160 }),
    setCamera: (x, y, direct) => calls.push(['setCamera', x, y, direct]),
    closeAnyHeroPanel: () => false,
    openHeroEntityInteraction: () => {
      calls.push('openHeroEntityInteraction')
      return true
    },
    shiftKeyActive: false,
  })
  controller.heroUnit = hero
  return {
    calls,
    controller,
    grid,
    hero,
    createdAnimals,
    nearbyGroup,
    scheduler,
    setCursorPoint: point => {
      cursorPoint = point
    },
  }
}

test('primary hero click still attacks when communicable villagers are nearby', () => {
  const { calls, controller } = createController({ nearbyGroup: [{ label: 'villager' }] })

  controller.handlePrimaryPointerDown()

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, [['setTextures', 'standing'], 'stop', ['attack', { x: 10, y: 20 }]])
})

test('keyboard movement during bow charge restores aim without resetting action textures', () => {
  const { calls, controller, hero } = createController({
    heroToolsOverride: {
      aimHeroPowerChargeAt: unit => {
        unit.degree = 40
        return true
      },
    },
  })
  hero.actionLocked = true
  hero.heroPowerChargeStart = 1000
  hero.heroPowerChargeTool = 'bow'
  hero.currentSheet = 'action'
  hero.speed = 1
  hero.degree = 40
  hero.mountedOnHorse = true
  controller.equippedItem = 'bow'
  hero.moveDirect = (_dx, _dy, _distance, options) => {
    hero.x += 1
    hero.degree = 270
    hero.moveOptions = options
    return true
  }

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)

  assert.equal(hero.degree, 40)
  assert.ok(Math.abs(hero.moveOptions.facingDirX + 0.766044443118978) < 1e-12)
  assert.ok(Math.abs(hero.moveOptions.facingDirY + 0.6427876096865393) < 1e-12)
  assert.equal(hero.isDirectMoving, true)
  assert.equal(hero.syncMountedHorseSpriteCalls, 1)
  assert.equal(hero.syncMountedRiderPositionCalls, 1)
  assert.deepEqual(calls, [])

  controller.handleKeyUp('heroRight')
  controller.update(1)

  assert.equal(hero.isDirectMoving, false)
  assert.equal(hero.syncMountedHorseSpriteCalls, 2)
})

test('keyboard movement during sword charge moves at reduced speed while aiming', () => {
  const { calls, controller, hero } = createController({
    heroToolsOverride: {
      aimHeroPowerChargeAt: unit => {
        unit.degree = 180
        return true
      },
    },
  })
  const moveCalls = []
  hero.actionLocked = true
  hero.heroPowerChargeStart = 1000
  hero.heroPowerChargeTool = 'sword'
  hero.currentSheet = 'action'
  hero.speed = 100 / 6
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.equippedItem = 'sword'

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)

  assert.equal(moveCalls.length, 1)
  assert.ok(Math.abs(moveCalls[0][0] - 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][1]) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][2] - (100 / 6) * (1000 / 60 / 100) * 0.55) < 1e-9)
  assert.equal(
    calls.some(call => Array.isArray(call) && call[0] === 'setTextures' && call[1] === 'walking'),
    true
  )
})

test('sword charge returns to standing animation when movement stops', () => {
  const { calls, controller, hero } = createController({
    heroToolsOverride: {
      aimHeroPowerChargeAt: unit => {
        unit.degree = 180
        return true
      },
    },
  })
  hero.actionLocked = true
  hero.heroPowerChargeStart = 1000
  hero.heroPowerChargeTool = 'sword'
  hero.currentSheet = 'standing'
  hero.speed = 100 / 6
  hero.sprite = { playing: false, play: () => (hero.sprite.playing = true), stop: () => (hero.sprite.playing = false) }
  hero.moveDirect = (...args) => {
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.equippedItem = 'sword'

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)
  controller.handleKeyUp('heroRight')
  controller.update(1)

  assert.deepEqual(
    calls.filter(call => Array.isArray(call) && call[0] === 'setTextures'),
    [
      ['setTextures', 'walking'],
      ['setTextures', 'standing'],
    ]
  )
})

test('keyboard movement during sword release keeps the attack planted', () => {
  const { controller, hero } = createController()
  const moveCalls = []
  hero.actionLocked = true
  hero.heroPowerChargeStart = 1000
  hero.heroPowerChargeTool = 'sword'
  hero.heroPowerReleaseQueued = true
  hero.currentSheet = 'action'
  hero.speed = 100 / 6
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.equippedItem = 'sword'

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)

  assert.equal(moveCalls.length, 0)
})

test('switching tools during bow charge cancels the charge before pointer release', () => {
  const { controller, hero } = createController({
    heroToolsOverride: {
      applyToolAppearance: (unit, tool) => {
        unit.appliedTool = tool
      },
      cancelHeroPowerCharge: unit => {
        unit.heroPowerChargeStart = null
        unit.heroPowerChargeTool = undefined
        unit.actionLocked = false
        unit.cancelledPowerCharge = true
      },
      releaseHeroPowerCharge: () => {
        throw new Error('stale bow charge should not release after switching tools')
      },
    },
  })
  hero.heroPowerChargeStart = 1000
  hero.heroPowerChargeTool = 'bow'
  hero.actionLocked = true
  controller.equippedItem = 'bow'
  controller.mouseHeld = true
  controller.primaryClickPoint = { x: 20, y: 30 }

  assert.equal(controller.handleKeyDown('heroTool2'), true)
  controller.handlePointerUp(0)

  assert.equal(hero.cancelledPowerCharge, true)
  assert.equal(hero.appliedTool, 'sword')
  assert.equal(controller.equippedItem, 'sword')
  assert.equal(controller.mouseHeld, false)
  assert.equal(controller.primaryClickPoint, null)
})

test('shift keyboard movement on foot keeps absolute movement and locks current facing', () => {
  const { calls, controller, hero, setCursorPoint } = createController({
    getInstanceDegree: (unit, x) => (x > unit.x ? 180 : 0),
  })
  const moveCalls = []
  hero.degree = 180
  hero.speed = 100 / 6
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.controls.shiftKeyActive = true
  setCursorPoint({ x: -10, y: 0 })

  assert.equal(controller.handleKeyDown('heroUp'), true)
  controller.update(1)

  assert.equal(moveCalls.length, 1)
  assert.ok(Math.abs(moveCalls[0][0]) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][1] + 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][2] - (100 / 6) * (1000 / 60 / 100) * WALK_SPEED_FACTOR) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][3].facingDirX - 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][3].facingDirY) < 1e-9)

  controller.handlePrimaryPointerDown()

  const attackCall = calls.find(call => Array.isArray(call) && call[0] === 'attack')
  assert.ok(attackCall)
  assert.ok(attackCall[1].x > hero.x)
})

test('shift keyboard movement keeps backpedaling on the shared walking pace', () => {
  const { controller, hero } = createController()
  const moveCalls = []
  hero.degree = 180
  hero.speed = 100 / 6
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.controls.shiftKeyActive = true

  assert.equal(controller.handleKeyDown('heroLeft'), true)
  controller.update(1)

  assert.equal(moveCalls.length, 1)
  assert.ok(Math.abs(moveCalls[0][0] + 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][1]) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][2] - (100 / 6) * (1000 / 60 / 100) * WALK_SPEED_FACTOR) < 1e-9)
})

test('gamepad direction lock keeps current facing while moving with the stick', () => {
  const { controller, hero } = createController()
  const moveCalls = []
  hero.degree = 180
  hero.speed = 100 / 6
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.controls.getGamepadMoveVector = () => ({ dx: 0, dy: -1 })
  controller.controls.isHeroDirectionLockActive = () => true

  controller.update(1)

  assert.equal(moveCalls.length, 1)
  assert.ok(Math.abs(moveCalls[0][0]) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][1] + 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][3].facingDirX - 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][3].facingDirY) < 1e-9)
})

test('shift keyboard movement does not lock facing while mounted', () => {
  const { controller, hero, setCursorPoint } = createController()
  const moveCalls = []
  hero.speed = 100 / 6
  hero.mountedOnHorse = true
  hero.moveDirect = (...args) => {
    moveCalls.push(args)
    hero.x += args[0] * args[2]
    hero.y += args[1] * args[2]
    return true
  }
  controller.controls.shiftKeyActive = true
  setCursorPoint({ x: 10, y: 0 })

  assert.equal(controller.handleKeyDown('heroDown'), true)
  controller.update(1)

  assert.equal(moveCalls.length, 1)
  assert.ok(Math.abs(moveCalls[0][0]) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][1] - 1) < 1e-9)
  assert.ok(Math.abs(moveCalls[0][2] - (100 / 6) * (1000 / 60 / 100)) < 1e-9)
  assert.equal(moveCalls[0][3], undefined)
})

test('H calls a companion horse, then E mounts when it is close', () => {
  let horseInteraction = null
  const { calls, controller, createdAnimals, grid, hero } = createController({
    resolveHeroProximityInteraction: () => horseInteraction,
  })
  hero.speed = 1
  hero.companionHorseColor = 'dark'

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(hero.mountedOnHorse, undefined)
  assert.equal(hero.speed, 1)
  assert.equal(createdAnimals.length, 1)
  assert.equal(createdAnimals[0].type, 'Horse')
  assert.equal(createdAnimals[0].horseColor, 'dark')
  assert.ok(Math.hypot(createdAnimals[0].i - hero.i, createdAnimals[0].j - hero.j) >= 10)
  assert.deepEqual(calls, [
    ['animalBehavior.stop', 'Horse'],
    ['horse.sendTo', { i: 0, j: 0, x: 0, y: 0, z: 0 }, null, { forceRepath: true }],
    ['playSoundCue', 'horse-moving'],
    ['showMessage', 'companionHorseComing', 'success'],
  ])

  createdAnimals[0].i = 0
  createdAnimals[0].j = 1
  createdAnimals[0].x = grid[0][1].x
  createdAnimals[0].y = grid[0][1].y
  createdAnimals[0].horseColor = 'black'
  createdAnimals[0].degree = 270
  horseInteraction = { action: 'mount', labelKey: 'heroInteractionMount', target: createdAnimals[0] }
  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(hero.speed, 1.45)
  assert.equal(hero.i, 0)
  assert.equal(hero.j, 1)
  assert.equal(hero.x, grid[0][1].x)
  assert.equal(hero.y, grid[0][1].y)
  assert.equal(hero.horseColor, 'black')
  assert.equal(hero.degree, 270)
  assert.deepEqual(calls.slice(4), [
    ['setHeroInteractionPrompt', 'heroInteractionMount'],
    ['updateInstanceBucket', 'hero', 0, 0],
    ['setTextures', 'standing'],
    ['horse.clear', 'animal-1'],
    ['setCamera', grid[0][1].x, grid[0][1].y, undefined],
  ])
})

test('H brings an unspawned linked horse out from a visible owned stable', () => {
  const { calls, controller, createdAnimals, grid, hero } = createController()
  hero.speed = 1
  hero.sight = 8
  hero.companionHorseColor = 'dark'
  const stable = {
    family: 'building',
    type: 'Stable',
    label: 'stable-1',
    owner: hero.owner,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    visible: true,
    i: 2,
    j: 2,
    x: grid[2][2].x,
    y: grid[2][2].y,
    z: grid[2][2].z,
    size: 3,
  }
  hero.owner.buildings = [stable]

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)

  assert.equal(createdAnimals.length, 1)
  assert.equal(createdAnimals[0].type, 'Horse')
  assert.equal(createdAnimals[0].horseColor, 'dark')
  assert.ok(Math.hypot(createdAnimals[0].i - stable.i, createdAnimals[0].j - stable.j) <= 6)
  assert.ok(Math.hypot(createdAnimals[0].i - hero.i, createdAnimals[0].j - hero.j) < 10)
  assert.deepEqual(calls, [
    ['animalBehavior.stop', 'Horse'],
    ['horse.sendTo', { i: 0, j: 0, x: 0, y: 0, z: 0 }, null, { forceRepath: true }],
    ['playSoundCue', 'horse-moving'],
    ['showMessage', 'companionHorseComing', 'success'],
  ])
})

test('H teleports a hidden active companion horse to a visible owned stable before calling it', () => {
  const { calls, controller, createdAnimals, grid, hero } = createController()
  hero.speed = 1
  hero.sight = 8
  hero.companionHorseColor = 'dark'
  const stable = {
    family: 'building',
    type: 'Stable',
    label: 'stable-1',
    owner: hero.owner,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    visible: true,
    i: 2,
    j: 2,
    x: grid[2][2].x,
    y: grid[2][2].y,
    z: grid[2][2].z,
    size: 3,
  }
  hero.owner.buildings = [stable]

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  const horse = createdAnimals[0]
  const hiddenCell = grid[14][14]
  horse.i = hiddenCell.i
  horse.j = hiddenCell.j
  horse.x = hiddenCell.x
  horse.y = hiddenCell.y
  horse.z = hiddenCell.z
  horse.currentCell = hiddenCell
  horse.visible = false
  hiddenCell.has = horse
  hiddenCell.solid = true
  calls.length = 0

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)

  assert.equal(createdAnimals.length, 1)
  assert.notEqual(horse.currentCell, hiddenCell)
  assert.equal(hiddenCell.has, null)
  assert.equal(hiddenCell.solid, false)
  assert.ok(Math.hypot(horse.i - stable.i, horse.j - stable.j) <= 6)
  assert.deepEqual(calls, [
    ['updateInstanceBucket', 'animal-1', 14, 14],
    ['horse.sendTo', { i: 0, j: 0, x: 0, y: 0, z: 0 }, null, { forceRepath: true }],
    ['playSoundCue', 'horse-moving'],
    ['showMessage', 'companionHorseComing', 'success'],
  ])
})

test('E fades the hero through the companion horse mount transition when scheduled', () => {
  let horseInteraction = null
  const { calls, controller, createdAnimals, grid, hero, scheduler } = createController({
    resolveHeroProximityInteraction: () => horseInteraction,
    withScheduler: true,
  })
  hero.speed = 1
  hero.companionHorseColor = 'dark'
  hero.alpha = 1

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  createdAnimals[0].i = 0
  createdAnimals[0].j = 1
  createdAnimals[0].x = grid[0][1].x
  createdAnimals[0].y = grid[0][1].y
  createdAnimals[0].horseColor = 'black'
  createdAnimals[0].degree = 270
  calls.length = 0

  horseInteraction = { action: 'mount', labelKey: 'heroInteractionMount', target: createdAnimals[0] }
  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(hero.mountedOnHorse, undefined)
  assert.equal(controller.mountTransitionTaskId, 1)

  scheduler.tick(60)
  assert.ok(hero.alpha < 1)
  assert.equal(hero.mountedOnHorse, undefined)
  assert.equal(createdAnimals[0].isDestroyed, false)
  assert.ok(
    calls.some(
      call =>
        Array.isArray(call) &&
        call[0] === 'setCamera' &&
        call[1] > Math.min(grid[0][0].x, grid[0][1].x) &&
        call[1] < Math.max(grid[0][0].x, grid[0][1].x)
    )
  )

  scheduler.tick(80)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(hero.i, 0)
  assert.equal(hero.j, 1)
  assert.equal(hero.horseColor, 'black')
  assert.equal(createdAnimals[0].isDestroyed, true)
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'updateInstanceBucket'))
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'horse.clear'))
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'setCamera' && call[1] === grid[0][1].x))

  scheduler.tick(140)
  assert.equal(hero.alpha, 1)
  assert.equal(controller.mountTransitionTaskId, null)
})

test('H sends a close companion horse instead of mounting it', () => {
  const { calls, controller, createdAnimals, grid, hero } = createController({
    heroToolsOverride: {
      findFacingEntity: () => null,
    },
  })
  hero.speed = 1
  hero.companionHorseColor = 'dark'

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  createdAnimals[0].i = 0
  createdAnimals[0].j = 1
  createdAnimals[0].x = grid[0][1].x
  createdAnimals[0].y = grid[0][1].y
  calls.length = 0

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(hero.mountedOnHorse, undefined)
  assert.equal(hero.speed, 1)
  assert.deepEqual(calls, [
    ['horse.sendTo', { i: 0, j: 0, x: 0, y: 0, z: 0 }, null, { forceRepath: true }],
    ['playSoundCue', 'horse-moving'],
    ['showMessage', 'companionHorseComing', 'success'],
  ])
})

test('H sends the companion horse to the hero position captured on key press', () => {
  const { calls, controller, createdAnimals, grid, hero } = createController()
  hero.speed = 1
  hero.companionHorseColor = 'dark'

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  hero.i = 2
  hero.j = 2
  hero.x = grid[2][2].x
  hero.y = grid[2][2].y
  hero.z = grid[2][2].z
  hero.currentCell = grid[2][2]

  assert.equal(createdAnimals.length, 1)
  assert.deepEqual(
    calls.find(call => call[0] === 'horse.sendTo'),
    ['horse.sendTo', { i: 0, j: 0, x: 0, y: 0, z: 0 }, null, { forceRepath: true }]
  )
})

test('H warns instead of spawning a horse when no horse is linked', () => {
  const { calls, controller, createdAnimals, hero } = createController()
  hero.speed = 1

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(createdAnimals.length, 0)
  assert.equal(hero.mountedOnHorse, undefined)
  assert.deepEqual(calls, [['showMessage', 'heroNeedsLinkedHorse', 'warning']])
})

test('H does not dismount while the hero is mounted', () => {
  const { calls, controller, createdAnimals, hero } = createController()
  hero.speed = 1.45
  hero.mountedOnHorse = true
  hero.horseColor = 'white'
  hero.companionHorseColor = 'white'

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(hero.speed, 1.45)
  assert.equal(createdAnimals.length, 0)
  assert.deepEqual(calls, [])
})

test('Shift dismounts and leaves the horse in place while the hero steps aside', () => {
  const { calls, controller, createdAnimals, grid, hero } = createController()
  hero.speed = 1.45
  hero.mountedOnHorse = true
  hero.horseColor = 'white'
  hero.companionHorseColor = 'white'
  hero.removeMountedHorseSprite = () => calls.push('removeHorse')
  hero.syncMountedRiderPosition = () => calls.push('syncRider')
  const mountedI = hero.i
  const mountedJ = hero.j

  assert.equal(controller.handleKeyDown('heroDismountHorse'), true)
  assert.equal(hero.mountedOnHorse, false)
  assert.equal(hero.speed, 1)
  assert.equal(createdAnimals.length, 1)
  assert.equal(createdAnimals[0].type, 'Horse')
  assert.equal(createdAnimals[0].horseColor, 'white')
  assert.equal(createdAnimals[0].i, mountedI)
  assert.equal(createdAnimals[0].j, mountedJ)
  assert.ok(Math.hypot(hero.i - mountedI, hero.j - mountedJ) <= 1)
  assert.notDeepEqual([hero.i, hero.j], [mountedI, mountedJ])
  assert.equal(hero.x, grid[hero.i][hero.j].x)
  assert.equal(hero.y, grid[hero.i][hero.j].y)
  assert.deepEqual(calls, [
    'removeHorse',
    'syncRider',
    ['setTextures', 'standing'],
    ['updateInstanceBucket', 'hero', mountedI, mountedJ],
    ['animalBehavior.stop', 'Horse'],
    ['setCamera', hero.x, hero.y, undefined],
  ])
})

test('Shift fades the hero through the companion horse dismount transition when scheduled', () => {
  const { calls, controller, createdAnimals, grid, hero, scheduler } = createController({ withScheduler: true })
  hero.speed = 1.45
  hero.mountedOnHorse = true
  hero.horseColor = 'white'
  hero.companionHorseColor = 'white'
  hero.alpha = 1
  hero.removeMountedHorseSprite = () => calls.push('removeHorse')
  hero.syncMountedRiderPosition = () => calls.push('syncRider')
  const mountedI = hero.i
  const mountedJ = hero.j

  assert.equal(controller.handleKeyDown('heroDismountHorse'), true)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(createdAnimals.length, 0)
  assert.equal(controller.mountTransitionTaskId, 1)

  scheduler.tick(60)
  assert.ok(hero.alpha < 1)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(createdAnimals.length, 0)

  scheduler.tick(80)
  assert.equal(hero.mountedOnHorse, false)
  assert.equal(hero.speed, 1)
  assert.equal(createdAnimals.length, 1)
  assert.equal(createdAnimals[0].type, 'Horse')
  assert.equal(createdAnimals[0].horseColor, 'white')
  assert.equal(createdAnimals[0].i, mountedI)
  assert.equal(createdAnimals[0].j, mountedJ)
  assert.ok(Math.hypot(hero.i - mountedI, hero.j - mountedJ) <= 1)
  assert.notDeepEqual([hero.i, hero.j], [mountedI, mountedJ])
  assert.equal(hero.x, grid[hero.i][hero.j].x)
  assert.equal(hero.y, grid[hero.i][hero.j].y)
  assert.ok(calls.some(call => call === 'removeHorse'))
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'updateInstanceBucket'))
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'animalBehavior.stop'))
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'setCamera' && call[1] === hero.x))

  scheduler.tick(140)
  assert.equal(hero.alpha, 1)
  assert.equal(controller.mountTransitionTaskId, null)
})

test('changing away from lasso clears the active lasso', () => {
  const { calls, controller, hero } = createController()
  hero.heroLasso = {
    clearLasso: options => calls.push(['clearLasso', options]),
  }

  controller.setEquippedTool('lasso')
  assert.deepEqual(calls, [])

  controller.setEquippedTool('sword')
  assert.deepEqual(calls, [['clearLasso', { releaseHorse: true }]])
})

test('left click with an active lasso clears it instead of throwing again', () => {
  const { calls, controller, hero } = createController()
  hero.heroLasso = {
    clearLasso: options => calls.push(['clearLasso', options]),
  }

  controller.setEquippedTool('lasso')
  controller.handlePrimaryPointerDown()

  assert.deepEqual(calls, [['clearLasso', { releaseHorse: true }]])
  assert.equal(controller.mouseHeld, false)
  assert.equal(controller.primaryClickPoint, null)
})

test('E uses a facing npc proximity interaction before starting communication charge', () => {
  const npc = { label: 'villager' }
  const { calls, controller } = createController({
    nearbyGroup: [npc],
    resolveHeroProximityInteraction: () => ({
      action: 'communicate',
      labelKey: 'heroInteractionCommunicate',
      target: npc,
    }),
  })

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, false)
  assert.equal(controller.isHeroActionHeld(), true)
  assert.deepEqual(calls, [
    ['setHeroInteractionPrompt', 'heroInteractionCommunicate'],
    ['openNpcOrders', [npc], undefined],
  ])
})

test('hero proximity interaction can use buildings owned by other players', () => {
  const ownBuilding = { label: 'own-house' }
  const otherBuilding = { label: 'other-house' }
  let receivedBuildings = null
  const { controller } = createController({
    additionalPlayers: [{ label: 'other-player', buildings: [otherBuilding] }],
    ownerBuildings: [ownBuilding],
    resolveHeroProximityInteraction: options => {
      receivedBuildings = options.buildings
      return null
    },
  })

  controller.getProximityInteraction()

  assert.deepEqual(
    receivedBuildings.map(building => building.label),
    ['own-house', 'other-house']
  )
})

test('E owns villager communication and opens orders on key release', () => {
  const group = [{ label: 'villager-1' }, { label: 'villager-2' }]
  const { calls, controller } = createController({ nearbyGroup: group })

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, true)
  assert.equal(controller.isHeroActionHeld(), true)

  controller.handleKeyUp('heroInteract')

  assert.equal(controller.commCharging, false)
  assert.equal(controller.isHeroActionHeld(), false)
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group, undefined]])
})

test('E opens direct interaction when the hero is not a chief', () => {
  const { calls, controller, hero } = createController({ nearbyGroup: [{ label: 'villager' }] })
  hero.isChief = false

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['openHeroEntityInteraction'])
})

test('E shows communication radius even when no villagers are nearby', () => {
  const { calls, controller } = createController({ nearbyGroup: [] })

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, true)

  controller.updateCommIndicator()
  assert.deepEqual(controller.commIndicator.paths, [
    { type: 'moveTo', x: -7.04, y: -12.48 },
    { type: 'lineTo', x: 7.04, y: -12.48 },
    { type: 'closePath' },
    { type: 'moveTo', x: 24.96, y: 3.5199999999999996 },
    { type: 'lineTo', x: 39.04, y: 3.5199999999999996 },
    { type: 'closePath' },
  ])
  assert.deepEqual(controller.commIndicator.ellipses, [])

  controller.handleKeyUp('heroInteract')

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['removeIndicator'])
})

test('communication radius stays hidden until the configured delay has elapsed', () => {
  const { controller } = createController({ commIndicatorDelayMs: 250 })

  controller.handleKeyDown('heroInteract')
  controller.updateCommIndicator()

  assert.deepEqual(controller.commIndicator.paths, [])

  controller.commChargeStart = performance.now() - 300
  controller.updateCommIndicator()

  assert.deepEqual(controller.commIndicator.paths[0], { type: 'moveTo', x: -7.04, y: -12.48 })
})

test('releasing communication before the radius is visible requests precision-only resolution', () => {
  const group = [{ label: 'front-villager' }]
  const resolutions = []
  const optionsSeen = []
  const { calls, controller } = createController({
    nearbyGroup: group,
    commIndicatorDelayMs: 250,
    resolveCommGroup: (_hero, radius, options) => {
      resolutions.push(radius)
      optionsSeen.push(options)
      return group
    },
  })

  controller.handleKeyDown('heroInteract')
  controller.handleKeyUp('heroInteract')

  assert.deepEqual(resolutions, [0])
  assert.deepEqual(optionsSeen, [{ precisionOnly: true }])
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group, undefined]])
})

test('releasing communication after the radius is visible resolves the charged radius', () => {
  const group = [{ label: 'front-villager' }]
  const resolutions = []
  const optionsSeen = []
  const { calls, controller } = createController({
    nearbyGroup: group,
    commIndicatorDelayMs: 250,
    resolveCommGroup: (_hero, radius, options) => {
      resolutions.push(radius)
      optionsSeen.push(options)
      return group
    },
  })

  controller.handleKeyDown('heroInteract')
  controller.commChargeStart = performance.now() - 500
  controller.handleKeyUp('heroInteract')

  assert.deepEqual(resolutions, [2.5])
  assert.deepEqual(optionsSeen, [{ precisionOnly: false }])
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group, undefined]])
})

test('communication charge indicator is drawn as synchronized ground cells', () => {
  const group = [{ label: 'villager' }]
  const { controller } = createController({ nearbyGroup: group })

  controller.handleKeyDown('heroInteract')
  controller.updateCommIndicator()

  assert.deepEqual(controller.commIndicator.paths[0], { type: 'moveTo', x: -7.04, y: -12.48 })
  assert.equal(controller.commIndicator.paths.at(-1).type, 'closePath')
  assert.deepEqual(controller.commIndicator.ellipses, [])
  assert.deepEqual(controller.commIndicator.circles, [])
  assert.deepEqual(controller.commIndicator.polys, [])
})

test('communication charge indicator follows hero relief lift', () => {
  const { controller, hero } = createController()
  hero.reliefLift = -24

  controller.handleKeyDown('heroInteract')
  controller.updateCommIndicator()

  assert.equal(controller.commIndicator.position.y, -24)
})

test('held primary attack re-aims at the current cursor on the next swing', () => {
  const degreeCalls = []
  const { calls, controller, hero, setCursorPoint } = createController({
    getInstanceDegree: (_hero, x, y) => {
      degreeCalls.push({ x, y })
      return x
    },
  })

  hero.degree = 90
  controller.update(1)

  assert.equal(hero.degree, 90)
  assert.deepEqual(degreeCalls, [])

  controller.handlePrimaryPointerDown()

  assert.equal(hero.degree, 10)
  assert.deepEqual(degreeCalls, [{ x: 10, y: 20 }])

  setCursorPoint({ x: 40, y: 50 })
  hero.actionLocked = false
  hero.currentSheet = 'standing'
  controller.update(1)

  assert.equal(hero.degree, 40)
  assert.deepEqual(degreeCalls, [
    { x: 10, y: 20 },
    { x: 40, y: 50 },
  ])
  assert.deepEqual(calls.slice(-2), ['stop', ['attack', { x: 40, y: 50 }]])
})

test('held sword primary does not repeat while held', () => {
  const degreeCalls = []
  const { calls, controller, hero, setCursorPoint } = createController({
    getInstanceDegree: (_hero, x, y) => {
      degreeCalls.push({ x, y })
      return x
    },
  })

  controller.equippedItem = 'sword'
  hero.degree = 90

  controller.handlePrimaryPointerDown()

  assert.equal(controller.mouseHeld, true)
  assert.deepEqual(controller.primaryClickPoint, { x: 10, y: 20 })
  assert.equal(hero.degree, 10)

  setCursorPoint({ x: 40, y: 50 })
  hero.actionLocked = false
  hero.currentSheet = 'standing'
  controller.update(1)

  assert.equal(hero.degree, 10)
  assert.deepEqual(degreeCalls, [{ x: 10, y: 20 }])
  assert.deepEqual(
    calls.filter(call => Array.isArray(call) && call[0] === 'attack'),
    [['attack', { x: 10, y: 20 }]]
  )
})

test('releasing held sword primary uses the shared charge release', () => {
  const releases = []
  const { calls, controller, hero } = createController({
    heroToolsOverride: {
      releaseHeroPowerCharge: unit => {
        releases.push(unit.heroPowerChargeTool)
        unit.heroPowerChargeStart = null
        unit.heroPowerChargeTool = undefined
        return true
      },
      triggerToolAttackAt: (unit, tool, destination) => {
        calls.push(['attack', tool, destination])
        unit.heroPowerChargeStart = 1000
        unit.heroPowerChargeTool = tool
        return true
      },
    },
  })

  controller.equippedItem = 'sword'
  controller.handlePrimaryPointerDown()

  assert.equal(controller.mouseHeld, true)

  controller.handlePointerUp(0)

  assert.deepEqual(releases, ['sword'])
  assert.equal(controller.mouseHeld, false)
  assert.equal(controller.primaryClickPoint, null)
  assert.equal(hero.heroPowerChargeStart, null)
})

test('left click during held defense performs one attack then resumes defense', () => {
  const events = []
  const { calls, controller, hero } = createController({
    heroToolsOverride: {
      beginHeroDefense: unit => {
        events.push('beginDefense')
        if (unit.actionLocked) return false
        unit.heroDefenseActive = true
        unit.actionLocked = true
        return true
      },
      cancelHeroActiveToolAction: unit => {
        events.push('cancelAction')
        unit.heroDefenseActive = false
        unit.actionLocked = false
        return true
      },
      releaseHeroPowerCharge: unit => {
        events.push('releaseAttack')
        unit.heroPowerChargeStart = null
        unit.heroPowerChargeTool = undefined
        unit.actionLocked = true
        return true
      },
      triggerToolAttackAt: (unit, tool, destination) => {
        calls.push(['attack', tool, destination])
        unit.heroPowerChargeStart = 1000
        unit.heroPowerChargeTool = tool
        unit.actionLocked = true
        return true
      },
    },
  })

  controller.equippedItem = 'sword'
  controller.handleDefenseKeyDown()
  controller.handlePrimaryPointerDown()
  controller.handlePointerUp(0)

  assert.equal(controller.defenseHeld, true)
  assert.deepEqual(events, ['beginDefense', 'cancelAction', 'releaseAttack'])
  assert.deepEqual(
    calls.filter(call => Array.isArray(call) && call[0] === 'attack'),
    [['attack', 'sword', { x: 10, y: 20 }]]
  )

  controller.update(1)
  assert.deepEqual(events, ['beginDefense', 'cancelAction', 'releaseAttack'])

  hero.actionLocked = false
  controller.update(1)

  assert.deepEqual(events, ['beginDefense', 'cancelAction', 'releaseAttack', 'beginDefense'])
  assert.equal(hero.heroDefenseActive, true)
})

test('defense key interrupts an active hero attack and blocks immediately', () => {
  const events = []
  const { controller, hero } = createController({
    heroToolsOverride: {
      beginHeroDefense: unit => {
        events.push('beginDefense')
        if (unit.actionLocked) return false
        unit.heroDefenseActive = true
        unit.actionLocked = true
        return true
      },
      cancelHeroActiveToolAction: unit => {
        events.push('cancelAction')
        unit.actionLocked = false
        return true
      },
    },
  })

  controller.equippedItem = 'sword'
  hero.actionLocked = true

  controller.handleDefenseKeyDown()

  assert.equal(controller.defenseHeld, true)
  assert.deepEqual(events, ['cancelAction', 'beginDefense'])
  assert.equal(hero.heroDefenseActive, true)
  assert.equal(hero.actionLocked, true)
})
