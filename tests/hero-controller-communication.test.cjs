const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHeroController({ npcInteraction, heroTools, getInstanceDegree = () => 0 }) {
  const filename = path.join(__dirname, '../app/controllers/HeroController.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
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
      HERO_ACTION_MOVE_SPEED_FACTOR: 0.5,
      LABEL_TYPES: { commRadius: 'commRadius' },
      MOUNTED_HORSE_SPEED_BONUS: 0.4,
      SHEET_TYPES: { action: 'action', standing: 'standing', walking: 'walking' },
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
      updateInstanceRenderVisibility: () => {},
    },
    '../lib/heroTools': heroTools,
    '../lib/heroCursor': {
      updateHeroCursor: () => {},
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
    '../lib/npcInteraction': npcInteraction,
    '../lib/unitEnergy': {
      updateUnitEnergy: () => {},
    },
    '../lib/unitHealth': {
      updateUnitHealthRegen: () => {},
    },
    '../lib/unitControl': {
      setUnitControlMode: () => {},
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroController
}

function createController({
  nearbyGroup = [],
  getInstanceDegree,
  heroToolsOverride = {},
  commIndicatorDelayMs,
  resolveCommGroup,
} = {}) {
  const calls = []
  const hero = {
    isChief: true,
    context: {
      map: {
        grid: [
          [
            { i: 0, j: 0 },
            { i: 0, j: 1 },
          ],
          [
            { i: 1, j: 0 },
            { i: 1, j: 1 },
          ],
        ],
      },
    },
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    addChildAt: child => {
      child.parent = { removeChild: () => calls.push('removeIndicator') }
    },
    isDead: false,
    isDestroyed: false,
    loading: 0,
    currentSheet: 'standing',
    setTextures: sheet => calls.push(['setTextures', sheet]),
    syncMountedHorseSprite: () => {
      hero.syncMountedHorseSpriteCalls = (hero.syncMountedHorseSpriteCalls ?? 0) + 1
    },
    stop: () => calls.push('stop'),
  }
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
    aimHeroBowChargeAt: () => false,
    applyToolAppearance: () => {},
    cancelHeroBowCharge: () => {},
    HERO_TOOL_ORDER: ['interact', 'sword', 'halberd', 'bow'],
    releaseHeroBowCharge: () => false,
    triggerToolAttackAt: (_hero, _tool, destination) => {
      calls.push(['attack', destination])
      return true
    },
    updateHeroBowCharge: () => {},
    ...heroToolsOverride,
  }
  const HeroController = loadHeroController({ npcInteraction, heroTools, getInstanceDegree })
  let cursorPoint = { x: 10, y: 20 }
  const controller = new HeroController({
    context: {
      menu: {
        openNpcOrders: npcs => calls.push(['openNpcOrders', npcs]),
        showMessage: (message, tone) => calls.push(['showMessage', message, tone]),
      },
    },
    getCellUnderCursor: () => null,
    getWorldPointUnderCursor: () => cursorPoint,
    getGamepadMoveVector: () => ({ dx: 0, dy: 0 }),
  })
  controller.heroUnit = hero
  return {
    calls,
    controller,
    hero,
    nearbyGroup,
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
      aimHeroBowChargeAt: unit => {
        unit.degree = 40
        return true
      },
    },
  })
  hero.actionLocked = true
  hero.currentSheet = 'action'
  hero.speed = 1
  hero.degree = 40
  hero.moveDirect = () => {
    hero.x += 1
    hero.degree = 270
    return true
  }

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)

  assert.equal(hero.degree, 40)
  assert.equal(hero.isDirectMoving, true)
  assert.equal(hero.syncMountedHorseSpriteCalls, 1)
  assert.deepEqual(calls, [])

  controller.handleKeyUp('heroRight')
  controller.update(1)

  assert.equal(hero.isDirectMoving, false)
  assert.equal(hero.syncMountedHorseSpriteCalls, 2)
})

test('H mounts the hero once for debug without stacking speed', () => {
  const { calls, controller, hero } = createController()
  hero.speed = 1
  hero.removeMountedHorseSprite = () => calls.push('removeHorse')
  hero.syncMountedRiderPosition = () => calls.push('syncRider')

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(hero.mountedOnHorse, true)
  assert.equal(hero.speed, 1.4)
  assert.deepEqual(calls, [['setTextures', 'standing']])

  assert.equal(controller.handleKeyDown('heroMountHorse'), true)
  assert.equal(hero.mountedOnHorse, false)
  assert.equal(hero.speed, 1)
  assert.deepEqual(calls, [['setTextures', 'standing'], 'removeHorse', 'syncRider', ['setTextures', 'standing']])
})

test('E owns villager communication and opens orders on key release', () => {
  const group = [{ label: 'villager-1' }, { label: 'villager-2' }]
  const { calls, controller } = createController({ nearbyGroup: group })

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, true)

  controller.handleKeyUp('heroInteract')

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group]])
})

test('E is blocked when the hero is not a chief', () => {
  const { calls, controller, hero } = createController({ nearbyGroup: [{ label: 'villager' }] })
  hero.isChief = false

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, [['showMessage', 'requiresChief', 'warning']])
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
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group]])
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
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group]])
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
