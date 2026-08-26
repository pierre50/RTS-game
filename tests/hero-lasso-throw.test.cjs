const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadHeroLassoThrow({ treeCollision = () => null } = {}) {
  const filename = path.join(__dirname, '../app/classes/HeroLassoThrow.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  class Graphics {
    constructor() {
      this.parent = null
      this.destroyed = false
      this.circles = []
    }
    clear() {
      this.circles = []
      return this
    }
    moveTo() {
      return this
    }
    lineTo() {
      return this
    }
    circle(x, y, radius) {
      this.circles.push({ x, y, radius })
      return this
    }
    stroke() {
      return this
    }
    destroy() {
      this.destroyed = true
    }
  }
  const mocks = {
    'pixi.js': { Graphics },
    '../constants': {
      BUILDING_TYPES: { stable: 'Stable' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', resource: 'resource' },
      STEP_TIME: 20,
    },
    '../lib': {
      getReliefOffset: () => 0,
      instanceContactInstance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j) <= 1,
    },
    '../lib/maths': {
      degreeToDirection: degree => {
        if (degree > 67.5 && degree < 112.5) return 'north'
        if (degree > 247.5 && degree < 292.5) return 'south'
        if (degree > 337.5 || degree < 22.5) return 'west'
        if (degree > 157.5 && degree < 202.5) return 'east'
        return 'south'
      },
      pointIsBetweenTwoPoint: () => true,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    },
    '../lib/lang': { t: key => key },
    '../lib/horses/horseCapture': {
      HORSE_CAPTURE_STABLE_MAX_DISTANCE: 7,
      HORSE_CAPTURE_STABLE_TIMEOUT_MS: 12000,
      routeCapturedHorseToStableWithOwnerContact: options => {
        const {
          gameContext,
          owner,
          horse,
          forceRepath = false,
          isRouteValid,
          onStored,
          onFailure,
          onStableUnavailable,
          onHorseRouteStart,
        } = options
        const tick = () => {
          if (isRouteValid && !isRouteValid()) {
            onFailure?.()
            return
          }
          const stable = owner.owner?.buildings?.find(
            building =>
              building.type === 'Stable' &&
              !building.isDead &&
              !building.isDestroyed &&
              (building.stableHorses?.length ?? 0) < 5
          )
          if (!stable) {
            onStableUnavailable?.()
            return
          }
          if (Math.hypot(owner.i - stable.i, owner.j - stable.j) > 1) return
          onHorseRouteStart?.(stable)
          if (Math.hypot(horse.i - stable.i, horse.j - stable.j) <= 1) {
            stable.stableHorses = stable.stableHorses ?? []
            stable.stableHorses.push({ horseColor: horse.horseColor })
            stable.horseAmount = stable.stableHorses.length
            horse.clear?.()
            onStored?.()
            return
          }
          horse.sendTo?.(stable, undefined, { forceRepath })
        }
        const taskId = gameContext.scheduler.add(tick)
        tick()
        return () => gameContext.scheduler.remove(taskId)
      },
    },
    '../lib/treeCollision': { findTreeSegmentCollision: treeCollision },
    '../lib/horses/wildHorseBehavior': {
      spookWildHorse: (horse, threat) => {
        horse.strategy = 'runaway'
        horse.ambientMovement = true
        horse.animalBehavior?.start?.()
        if (threat) horse.isAttacked?.(threat)
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroLassoThrow
}

function makeContext(calls = []) {
  return {
    scheduler: {
      elapsedMs: 1000,
      tasks: [],
      add(callback) {
        this.tasks.push(callback)
        return this.tasks.length
      },
      remove: id => calls.push(['removeTask', id]),
    },
    map: { gaia: { animals: [] }, grid: [] },
    menu: { showMessage: (message, tone) => calls.push(['showMessage', message, tone]) },
    players: [],
  }
}

function makeHero() {
  return {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    degree: 270,
    sprite: { currentFrame: 0 },
    zIndex: 0,
  }
}

function makeHorse(calls = []) {
  return {
    family: 'animal',
    type: 'Horse',
    isDead: false,
    isDestroyed: false,
    i: 6,
    j: 0,
    x: 180,
    y: 0,
    degree: 0,
    sprite: { currentFrame: 0 },
    zIndex: 20,
    horseColor: 'dark',
    stop: () => calls.push(['horse.stop']),
    sendTo: (target, action, options) => calls.push(['horse.sendTo', target, action, options]),
    animalBehavior: {
      start: () => calls.push(['animalBehavior.start']),
      stop: () => calls.push(['animalBehavior.stop']),
    },
    isAttacked: attacker => calls.push(['horse.isAttacked', attacker]),
    clear: () => calls.push(['horse.clear']),
  }
}

test('attached lasso makes the horse follow and releases it when cleared', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  horse.x = 240
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  assert.equal(horse.isLassoed, true)
  assert.equal(horse.lassoOwner, hero)

  lasso.step()
  assert.deepEqual(calls.filter(call => call[0] === 'horse.sendTo'), [
    ['horse.sendTo', hero, null, { forceRepath: true }],
  ])

  lasso.clearLasso()
  assert.equal(horse.isLassoed, false)
  assert.equal(horse.lassoOwner, null)
  assert.equal(hero.heroLasso, null)
  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(calls.some(call => call[0] === 'animalBehavior.start'), true)
  assert.equal(calls.some(call => call[0] === 'horse.isAttacked'), true)
})

test('external stable routing suspends lasso follow and stop commands', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  horse.i = 0
  horse.j = 0
  horse.x = 12
  horse.y = 0
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context, {
    autoRouteStableWhileAttached: false,
  })

  lasso.attachToHorse(horse)
  lasso.setExternalStableRouteActive(true)
  lasso.step()

  assert.deepEqual(calls.filter(call => call[0] === 'horse.stop'), [['horse.stop']])
  assert.deepEqual(calls.filter(call => call[0] === 'horse.sendTo'), [])
})

test('attached lasso starts from the walking hand position and mirrors east-facing frames', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  hero.degree = 0
  hero.sprite.currentFrame = 6
  lasso.step()
  assert.deepEqual(lasso.spawnOrigin, { x: -11, y: -8 })

  hero.degree = 180
  lasso.step()
  assert.deepEqual(lasso.spawnOrigin, { x: 11, y: -8 })
})

test('attached lasso ends on the horse neck and does not draw the throw loop', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  horse.degree = 0
  horse.sprite.currentFrame = 2
  lasso.step()
  assert.deepEqual(lasso.tip, { x: 156, y: -33 })
  assert.deepEqual(lasso.circles, [])

  horse.degree = 180
  lasso.step()
  assert.deepEqual(lasso.tip, { x: 204, y: -33 })
})

test('attached lasso renders under the horse and retracts above the hero again', () => {
  const HeroLassoThrow = loadHeroLassoThrow({ treeCollision: () => ({ type: 'Tree' }) })
  const calls = []
  const hero = makeHero()
  hero.zIndex = 4
  const horse = makeHorse(calls)
  horse.zIndex = 30
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  assert.equal(lasso.zIndex, 29)

  lasso.step()
  assert.equal(lasso.state, 'retracting')
  assert.equal(lasso.zIndex, 6)
})

test('outbound lasso ignores a horse already held by another owner', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const otherOwner = { label: 'villager-2' }
  const horse = makeHorse(calls)
  horse.isLassoed = true
  horse.lassoOwner = otherOwner
  const context = makeContext(calls)
  context.map.gaia.animals = [horse]
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.step()

  assert.equal(lasso.target, null)
  assert.equal(horse.isLassoed, true)
  assert.equal(horse.lassoOwner, otherOwner)
})

test('released lasso stores a nearby horse when the owner is at the stable', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const stable = {
    family: 'building',
    type: 'Stable',
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    i: 6,
    j: 1,
    x: 180,
    y: 32,
    stableHorses: [],
  }
  const context = makeContext(calls)
  context.players = [{ buildings: [stable] }]
  hero.owner = context.players[0]
  hero.i = stable.i
  hero.j = stable.j
  hero.x = stable.x
  hero.y = stable.y
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  lasso.clearLasso()

  assert.equal(horse.isLassoed, false)
  assert.deepEqual(calls.filter(call => call[0] === 'horse.sendTo'), [])
  assert.deepEqual(stable.stableHorses, [{ horseColor: 'dark' }])
  assert.equal(stable.horseAmount, 1)
  assert.equal(calls.some(call => call[0] === 'horse.clear'), true)
  assert.equal(calls.some(call => call[0] === 'horse.isAttacked'), false)
})

test('horse returns to wild behavior if its target stable disappears', () => {
  const HeroLassoThrow = loadHeroLassoThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const stable = {
    family: 'building',
    type: 'Stable',
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    i: 6,
    j: 1,
    x: 180,
    y: 32,
    stableHorses: [],
  }
  const context = makeContext(calls)
  context.players = [{ buildings: [stable] }]
  hero.owner = context.players[0]
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  lasso.clearLasso()
  stable.isDestroyed = true
  context.scheduler.tasks[1]()

  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(calls.some(call => call[0] === 'animalBehavior.start'), true)
  assert.equal(calls.some(call => call[0] === 'horse.isAttacked'), true)
})

test('attached lasso cuts when the rope crosses a tree trunk', () => {
  const HeroLassoThrow = loadHeroLassoThrow({ treeCollision: () => ({ type: 'Tree' }) })
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const lasso = new HeroLassoThrow(hero, { x: 220, y: 0 }, context)

  lasso.attachToHorse(horse)
  lasso.step()

  assert.equal(horse.isLassoed, false)
  assert.equal(horse.lassoOwner, null)
  assert.equal(lasso.state, 'retracting')
  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(calls.some(call => call[0] === 'animalBehavior.start'), true)
  assert.equal(calls.some(call => call[0] === 'horse.isAttacked'), true)
})
