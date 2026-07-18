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
        stroke() {}
      },
    },
    '../constants': {
      ARPG_DIRECTIONS: {},
      ARPG_KEYS: new Set(),
      COLOR_GOLD: 0xf8d878,
      HERO_ACTION_MOVE_SPEED_FACTOR: 0.5,
      LABEL_TYPES: { commRadius: 'commRadius' },
      SHEET_TYPES: { action: 'action', standing: 'standing', walking: 'walking' },
      STEP_TIME: 100,
    },
    '../lib': {
      getInstanceDegree,
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

function createController({ nearbyGroup = [], getInstanceDegree } = {}) {
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
    applyToolAppearance: () => {},
    triggerToolAttackAt: (_hero, _tool, destination) => {
      calls.push(['attack', destination])
      return true
    },
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

test('E owns villager communication and opens orders on key release', () => {
  const group = [{ label: 'villager-1' }, { label: 'villager-2' }]
  const { calls, controller } = createController({ nearbyGroup: group })

  assert.equal(controller.handleKeyDown('e'), true)
  assert.equal(controller.commCharging, true)

  controller.handleKeyUp('e')

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['removeIndicator', ['openNpcOrders', group]])
})

test('E shows communication radius even when no villagers are nearby', () => {
  const { calls, controller } = createController({ nearbyGroup: [] })

  assert.equal(controller.handleKeyDown('e'), true)
  assert.equal(controller.commCharging, true)

  controller.updateCommIndicator()
  assert.deepEqual(controller.commIndicator.ellipses, [{ x: 0, y: 0, halfWidth: 80, halfHeight: 40 }])

  controller.handleKeyUp('e')

  assert.equal(controller.commCharging, false)
  assert.deepEqual(calls, ['removeIndicator'])
})

test('communication charge indicator is drawn as a ground-projected ellipse', () => {
  const group = [{ label: 'villager' }]
  const { controller } = createController({ nearbyGroup: group })

  controller.handleKeyDown('e')
  controller.updateCommIndicator()

  assert.deepEqual(controller.commIndicator.ellipses, [{ x: 0, y: 0, halfWidth: 80, halfHeight: 40 }])
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
