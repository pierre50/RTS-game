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
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function buildGrid(size, solidCells = []) {
  const grid = []
  for (let i = 0; i < size; i++) {
    grid[i] = []
    for (let j = 0; j < size; j++) {
      grid[i][j] = { i, j, solid: solidCells.some(([si, sj]) => si === i && sj === j) }
    }
  }
  return grid
}

function loadAnimalCombat({ isometricToCartesianImpl } = {}) {
  const constants = {
    ACTION_TYPES: { attack: 'attack' },
    FAMILY_TYPES: { unit: 'unit' },
    SHEET_TYPES: { action: 'action', flying: 'flying', running: 'running', standing: 'standing', walking: 'walking' },
  }
  const getCellsAroundPointCalls = []
  const lib = {
    applyCombatHit: () => ({ killed: false }),
    findInstancesInSight: () => [],
    getCellsAroundPoint: (i, j, grid, range, condition) => {
      getCellsAroundPointCalls.push([i, j, range])
      for (let di = -range; di <= range; di++) {
        for (let dj = -range; dj <= range; dj++) {
          const cell = grid[i + di]?.[j + dj]
          if (cell) condition(cell)
        }
      }
      return []
    },
    getClosestInstanceWithPath: () => null,
    getInstanceDegree: () => 0,
    instanceContactInstance: () => false,
    isometricToCartesian: isometricToCartesianImpl ?? (() => [0, 0]),
    pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    playAudibleSoundCue: () => {},
  }
  const { AnimalCombat } = loadModule('app/classes/animal/AnimalCombat.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/combatFeedback': {
      showAggressionFeedback: () => {},
      showAlertFeedback: () => {},
      showAlertThenAggressionFeedback: () => {},
    },
    './index': { FLYING_ALTITUDE: 20 },
    './locomotion': { isAirborne: () => false, resolveMovementSheet: (_animal, sheet) => sheet },
  })
  return { AnimalCombat, getCellsAroundPointCalls }
}

// Mirrors how the real Animal class wires itself: AnimalCombat.getReaction() calls
// back out to `animal.runaway(...)`, which on the real class delegates right back
// into the same AnimalCombat instance.
function createAnimalCombat({ solidCells = [], isometricToCartesianImpl, animalOverrides = {} } = {}) {
  const { AnimalCombat, getCellsAroundPointCalls } = loadAnimalCombat({ isometricToCartesianImpl })
  const calls = []
  const animal = {
    i: 5,
    j: 5,
    sight: 3,
    isDead: false,
    isFleeing: false,
    strategy: 'runaway',
    context: { editor: null, map: { grid: buildGrid(12, solidCells) } },
    sendTo: (dest, action, options) => calls.push(['sendTo', dest, action, options]),
    stop: () => calls.push(['stop']),
    setAltitude: altitude => calls.push(['setAltitude', altitude]),
    ...animalOverrides,
  }
  const combat = new AnimalCombat(animal)
  animal.runaway = (instance, hitDirection) => combat.runaway(instance, hitDirection)
  return { combat, animal, calls, getCellsAroundPointCalls }
}

test('isAttacked reacts even while the animal has an ambient-walk destination', () => {
  const { combat, animal, calls } = createAnimalCombat({ animalOverrides: { dest: { i: 6, j: 6 } } })

  combat.isAttacked({ i: 5, j: 8, label: 'shooter' })

  assert.equal(calls[0]?.[0], 'sendTo')
  assert.equal(animal.isFleeing, true)
})

test('isAttacked is ignored once the animal is already fleeing', () => {
  const { combat, calls } = createAnimalCombat({ animalOverrides: { isFleeing: true } })

  combat.isAttacked({ i: 5, j: 8, label: 'shooter' })

  assert.deepEqual(calls, [])
})

test('an aggressive animal charges attack targets with the running sheet when available', () => {
  const target = { i: 7, j: 5, label: 'villager' }
  const { combat, calls } = createAnimalCombat({
    animalOverrides: {
      strategy: 'attack',
      runningSheet: {},
    },
  })

  combat.getReaction(target)

  assert.deepEqual(calls, [['sendTo', target, 'attack', { movementSheet: 'running' }]])
})

test('an aggressive animal falls back to walking when it has no running sheet', () => {
  const target = { i: 7, j: 5, label: 'villager' }
  const { combat, calls } = createAnimalCombat({
    animalOverrides: {
      strategy: 'attack',
    },
  })

  combat.getReaction(target)

  assert.deepEqual(calls, [['sendTo', target, 'attack', { movementSheet: 'walking' }]])
})

test('runaway flees along the projectile direction instead of away from the shooter position', () => {
  // Pretend the shot travelled purely along the grid i-axis (towards higher i).
  const { combat, animal, calls, getCellsAroundPointCalls } = createAnimalCombat({
    solidCells: [[8, 5]],
    isometricToCartesianImpl: () => [1, 0],
  })
  // Shooter position is intentionally off-axis: a position-based flee would head
  // elsewhere, but the projectile's own direction should win.
  const shooter = { i: 5, j: 0, label: 'shooter' }

  combat.runaway(shooter, { x: 10, y: 0 })

  assert.equal(getCellsAroundPointCalls.length, 0)
  const [, dest] = calls[0]
  // (8, 5) is solid, so the farthest reachable cell along the direction is (7, 5).
  assert.deepEqual({ i: dest.i, j: dest.j }, { i: 7, j: 5 })
  assert.equal(animal.isFleeing, true)
})

test('runaway falls back to fleeing away from the shooter when no hit direction is known', () => {
  const { combat, calls, getCellsAroundPointCalls } = createAnimalCombat()
  const shooter = { i: 5, j: 8, label: 'shooter' }

  combat.runaway(shooter)

  assert.equal(getCellsAroundPointCalls.length, 1)
  const [, dest] = calls[0]
  assert.equal(dest.j < shooter.j, true)
})
