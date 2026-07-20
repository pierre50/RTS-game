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
      SHEET_TYPES: { action: 'action', standing: 'standing', walking: 'walking' },
      STEP_TIME: 100,
    },
    '../lib': {
      drawRoundedIsoShape: (layer, points) => {
        points.forEach((point, index) => {
          if (index === 0) layer.moveTo(point.x, point.y)
          else layer.lineTo(point.x, point.y)
        })
        layer.closePath()
      },
      getInstanceDegree,
      getRoundedIsoShapePoints: ({ factor = 1 } = {}) => [
        { x: -32 * factor * 0.22, y: -16 * factor * (1 - 0.22) },
        { x: 32 * factor * 0.22, y: -16 * factor * (1 - 0.22) },
      ],
      updateInstanceRenderVisibility: () => {},
    },
    '../lib/heroTools': heroTools,
    '../lib/heroCursor': {
      updateHeroCursor: () => {},
    },
    '../lib/npcInteraction': npcInteraction,
    '../lib/unitControl': {
      setUnitControlMode: () => {},
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroController
}

function createController({ nearbyGroup = [], getInstanceDegree, heroToolsOverride = {} } = {}) {
  const calls = []
  const hero = {
    addChildAt: child => {
      child.parent = { removeChild: () => calls.push('removeIndicator') }
    },
    isDead: false,
    isDestroyed: false,
    loading: 0,
    currentSheet: 'standing',
    setTextures: sheet => calls.push(['setTextures', sheet]),
    stop: () => calls.push('stop'),
  }
  const npcInteraction = {
    COMM_BASE_RANGE: 2.5,
    findCommGroup: () => nearbyGroup,
    getCommRadiusForHold: () => 2.5,
    isAnyNpcNear: () => true,
    releaseIfStillLooking: () => {},
    resolveCommGroup: () => nearbyGroup,
    resolveHoverTarget: () => null,
    sendNpcGroupToTarget: () => {},
    updateNpcFollow: () => {},
  }
  const heroTools = {
    aimHeroBowChargeAt: () => false,
    applyToolAppearance: () => {},
    cancelHeroBowCharge: () => {},
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

test('primary ARPG click still attacks when communicable villagers are nearby', () => {
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
    hero.degree = 270
    return true
  }

  assert.equal(controller.handleKeyDown('heroRight'), true)
  controller.update(1)

  assert.equal(hero.degree, 40)
  assert.deepEqual(calls, [])
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

test('E shows communication radius even when no villagers are nearby', () => {
  const { calls, controller } = createController({ nearbyGroup: [] })

  assert.equal(controller.handleKeyDown('heroInteract'), true)
  assert.equal(controller.commCharging, true)

  controller.updateCommIndicator()
  assert.deepEqual(controller.commIndicator.paths, [
    { type: 'moveTo', x: -17.6, y: -31.200000000000003 },
    { type: 'lineTo', x: 17.6, y: -31.200000000000003 },
    { type: 'closePath' },
  ])
  assert.deepEqual(controller.commIndicator.ellipses, [])

  controller.handleKeyUp('heroInteract')

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['removeIndicator'])
})

test('communication charge indicator is drawn as a rounded isometric footprint', () => {
  const group = [{ label: 'villager' }]
  const { controller } = createController({ nearbyGroup: group })

  controller.handleKeyDown('heroInteract')
  controller.updateCommIndicator()

  assert.deepEqual(controller.commIndicator.paths[0], { type: 'moveTo', x: -17.6, y: -31.200000000000003 })
  assert.equal(controller.commIndicator.paths.at(-1).type, 'closePath')
  assert.deepEqual(controller.commIndicator.ellipses, [])
  assert.deepEqual(controller.commIndicator.circles, [])
  assert.deepEqual(controller.commIndicator.polys, [])
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
