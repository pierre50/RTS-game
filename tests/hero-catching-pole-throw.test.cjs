const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadHeroCatchingPoleThrow({ treeCollision = () => null, playAudibleSoundCue = () => null } = {}) {
  const filename = path.join(__dirname, '../app/classes/HeroCatchingPoleThrow.ts')
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
      SHEET_TYPES: {
        action: 'actionSheet',
        walking: 'walkingSheet',
      },
      STEP_TIME: 20,
    },
    '../lib': {
      getReliefOffset: () => 0,
      instanceContactInstance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j) <= 1,
      playAudibleSoundCue,
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
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroCatchingPoleThrow
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
    currentSheet: 'walkingSheet',
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

test('attached catchingPole makes the horse follow and releases it when cleared', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  horse.x = 240
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  assert.equal(horse.isCatchingPoleCaught, true)
  assert.equal(horse.catchingPoleOwner, hero)

  catchingPole.step()
  assert.deepEqual(
    calls.filter(call => call[0] === 'horse.sendTo'),
    [['horse.sendTo', hero, null, { forceRepath: true }]]
  )

  catchingPole.clearCatchingPoleThrow()
  assert.equal(horse.isCatchingPoleCaught, false)
  assert.equal(horse.catchingPoleOwner, null)
  assert.equal(hero.heroCatchingPoleThrow, null)
  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(
    calls.some(call => call[0] === 'animalBehavior.start'),
    true
  )
  assert.equal(
    calls.some(call => call[0] === 'horse.isAttacked'),
    true
  )
})

test('catchingPole capture plays a random horse vocal cue', () => {
  const soundCalls = []
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow({
    playAudibleSoundCue: (instance, cue, options) => {
      soundCalls.push({ instance, cue, options })
      return 'horse-2'
    },
  })
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)

  assert.deepEqual(soundCalls, [{ instance: horse, cue: ['horse-2', 'horse-3'], options: { profile: 'voice' } }])
})

test('catchingPole resolves the throw visual once when a horse is caught', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  let resolved = 0
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context, {
    onThrowResolved: () => {
      resolved += 1
    },
  })

  catchingPole.attachToHorse(horse)
  catchingPole.clearCatchingPoleThrow()

  assert.equal(resolved, 1)
})

test('external stable routing suspends catchingPole follow and stop commands', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  horse.i = 0
  horse.j = 0
  horse.x = 12
  horse.y = 0
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context, {
    autoRouteStableWhileAttached: false,
  })

  catchingPole.attachToHorse(horse)
  catchingPole.setExternalStableRouteActive(true)
  catchingPole.step()

  assert.deepEqual(
    calls.filter(call => call[0] === 'horse.stop'),
    [['horse.stop']]
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'horse.sendTo'),
    []
  )
})

test('attached catchingPole starts from the walking stick tip position', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  hero.degree = 0
  hero.sprite.currentFrame = 6
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: -13, y: -24 })

  hero.degree = 180
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 12, y: -24 })
})

test('attached catchingPole ends on the horse neck and does not draw the throw loop', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  horse.degree = 0
  horse.sprite.currentFrame = 2
  catchingPole.step()
  assert.deepEqual(catchingPole.tip, { x: 156, y: -33 })
  assert.deepEqual(catchingPole.circles, [])

  horse.degree = 180
  catchingPole.step()
  assert.deepEqual(catchingPole.tip, { x: 204, y: -33 })
})

test('outbound catchingPole draws only the rope and follows the walking stick tip frames', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  hero.zIndex = 4
  hero.degree = 270
  hero.sprite.currentFrame = 0
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  assert.deepEqual(catchingPole.circles, [])
  assert.deepEqual(catchingPole.spawnOrigin, { x: 12, y: -26 })
  assert.equal(catchingPole.zIndex, 6)

  hero.sprite.currentFrame = 6
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 12, y: -23 })
})

test('mounted catchingPole rope follows the rider-height stick tip', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  hero.mountedOnHorse = true
  hero.getMountedRiderY = () => -25
  hero.degree = 270
  hero.sprite.currentFrame = 0
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  assert.deepEqual(catchingPole.spawnOrigin, { x: 12, y: -51 })

  hero.sprite.currentFrame = 6
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 12, y: -48 })
})

test('walking catchingPole stays on the same side of the stick tip on lateral frames', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  hero.degree = 0
  hero.sprite.currentFrame = 1
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  assert.deepEqual(catchingPole.spawnOrigin, { x: -18, y: -9 })

  hero.sprite.currentFrame = 2
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: -18, y: -14 })

  hero.degree = 180
  hero.sprite.currentFrame = 1
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 17, y: -9 })

  hero.sprite.currentFrame = 2
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 16, y: -14 })
})

test('outbound catchingPole follows the action stick tip frames while being thrown', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  hero.degree = 270
  hero.currentSheet = 'actionSheet'
  hero.sprite.currentFrame = 5
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  assert.deepEqual(catchingPole.spawnOrigin, { x: 39, y: -10 })

  hero.degree = 180
  catchingPole.step()
  assert.deepEqual(catchingPole.spawnOrigin, { x: 42, y: -31 })
})

test('attached catchingPole renders under the horse and retracts above the hero again', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow({ treeCollision: () => ({ type: 'Tree' }) })
  const calls = []
  const hero = makeHero()
  hero.zIndex = 4
  const horse = makeHorse(calls)
  horse.zIndex = 30
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  assert.equal(catchingPole.zIndex, 29)

  catchingPole.step()
  assert.equal(catchingPole.state, 'retracting')
  assert.equal(catchingPole.zIndex, 6)
})

test('outbound catchingPole ignores a horse already held by another owner', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const otherOwner = { label: 'villager-2' }
  const horse = makeHorse(calls)
  horse.isCatchingPoleCaught = true
  horse.catchingPoleOwner = otherOwner
  const context = makeContext(calls)
  context.map.gaia.animals = [horse]
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.step()

  assert.equal(catchingPole.target, null)
  assert.equal(horse.isCatchingPoleCaught, true)
  assert.equal(horse.catchingPoleOwner, otherOwner)
})

test('clearing an owned catchingPole without release makes the horse capturable again', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  context.map.gaia.animals = [horse]
  const firstCatchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  firstCatchingPole.attachToHorse(horse)
  firstCatchingPole.clearCatchingPoleThrow({ releaseHorse: false })

  assert.equal(horse.isCatchingPoleCaught, false)
  assert.equal(horse.catchingPoleOwner, null)

  const secondCatchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)
  secondCatchingPole.step()

  assert.equal(secondCatchingPole.target, horse)
  assert.equal(horse.isCatchingPoleCaught, true)
  assert.equal(horse.catchingPoleOwner, hero)
})

test('released catchingPole stores a nearby horse when the owner is at the stable', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
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
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  catchingPole.clearCatchingPoleThrow()

  assert.equal(horse.isCatchingPoleCaught, false)
  assert.deepEqual(
    calls.filter(call => call[0] === 'horse.sendTo'),
    []
  )
  assert.deepEqual(stable.stableHorses, [{ horseColor: 'dark' }])
  assert.equal(stable.horseAmount, 1)
  assert.equal(
    calls.some(call => call[0] === 'horse.clear'),
    true
  )
  assert.equal(
    calls.some(call => call[0] === 'horse.isAttacked'),
    false
  )
})

test('horse returns to wild behavior if its target stable disappears', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow()
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
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  catchingPole.clearCatchingPoleThrow()
  stable.isDestroyed = true
  context.scheduler.tasks[1]()

  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(
    calls.some(call => call[0] === 'animalBehavior.start'),
    true
  )
  assert.equal(
    calls.some(call => call[0] === 'horse.isAttacked'),
    true
  )
})

test('attached catchingPole cuts when the rope crosses a tree trunk', () => {
  const HeroCatchingPoleThrow = loadHeroCatchingPoleThrow({ treeCollision: () => ({ type: 'Tree' }) })
  const calls = []
  const hero = makeHero()
  const horse = makeHorse(calls)
  const context = makeContext(calls)
  const catchingPole = new HeroCatchingPoleThrow(hero, { x: 220, y: 0 }, context)

  catchingPole.attachToHorse(horse)
  catchingPole.step()

  assert.equal(horse.isCatchingPoleCaught, false)
  assert.equal(horse.catchingPoleOwner, null)
  assert.equal(catchingPole.state, 'retracting')
  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.equal(
    calls.some(call => call[0] === 'animalBehavior.start'),
    true
  )
  assert.equal(
    calls.some(call => call[0] === 'horse.isAttacked'),
    true
  )
})
