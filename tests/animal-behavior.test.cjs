const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  return loadTsModule(relativePath, { mocks })
}

const constants = {
  ACTION_TYPES: { attack: 'attack' },
  FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal' },
  UNIT_TYPES: { villager: 'Villager' },
}

function createBehavior({
  nearby = [],
  elapsedMs = 0,
  altitude = 0,
  type = 'Deer',
  strategy = 'runaway',
  tamingStatus,
  ambientWalkDelayMin,
  ambientWalkDelayMax,
  ambientWalkRange,
  ambientCells,
} = {}) {
  const calls = []
  const alertCalls = []
  const findInstancesInSightCalls = []
  const cells = ambientCells ?? [
    { i: 4, j: 5, solid: false },
    { i: 5, j: 4, solid: false },
    { i: 7, j: 5, solid: false },
  ]
  const randomRangeCalls = []
  const map = {
    grid: Array.from({ length: 100 }, (_, i) =>
      Array.from({ length: 100 }, (_, j) => ({ i, j, solid: false, category: 'Land' }))
    ),
    randomItem: items => items[0],
    randomRange: (min, max) => {
      randomRangeCalls.push([min, max])
      return min
    },
  }
  const scheduler = {
    elapsedMs,
    add: () => 1,
    remove: () => {},
  }
  const animal = {
    type,
    wildlife: { homeI: 5, homeJ: 5, generation: 0 },
    tamingStatus,
    i: 5,
    j: 5,
    sight: 4,
    path: [],
    dest: null,
    isDead: false,
    isDestroyed: false,
    isFleeing: false,
    strategy,
    ambientWalkDelayMin,
    ambientWalkDelayMax,
    ambientWalkRange,
    altitude,
    context: { map, scheduler, editor: null },
    getActionCondition: () => true,
    runaway: villager => calls.push(['runaway', villager.label]),
    getReaction: villager => calls.push(['reaction', villager.label]),
    sendTo: cell => calls.push(['sendTo', cell.i, cell.j]),
    setDest: cell => {
      animal.dest = cell
    },
    setPath: path => {
      animal.path = path
      calls.push(['return', animal.dest.i, animal.dest.j])
    },
  }
  const lib = {
    AmbientMovementController: class {
      constructor(target, options) {
        this.target = target
        this.options = options
        this.nextMoveAt = 0
        this.taskId = null
      }
      get ready() {
        return this.target.context.scheduler.elapsedMs >= this.nextMoveAt
      }
      schedule() {
        const minDelay = this.options.delayMinMs(this.target)
        const maxDelay = this.options.delayMaxMs(this.target)
        this.nextMoveAt =
          this.target.context.scheduler.elapsedMs + this.target.context.map.randomRange(minDelay, maxDelay)
      }
      start() {}
      stop() {}
      tryMove() {
        const destination = this.options.pickDestination(this.target)
        if (destination) this.options.move(this.target, destination)
        this.schedule()
      }
    },
    findInstancesInSight: (_animal, condition, options) => {
      findInstancesInSightCalls.push(options)
      return nearby.filter(condition)
    },
    getCellsAroundPoint: (_i, _j, _grid, range, condition) =>
      cells.filter(
        cell => Math.abs(cell.i - animal.i) <= range && Math.abs(cell.j - animal.j) <= range && condition(cell)
      ),
    getInstancePath: (_animal, i, j) => [map.grid[i][j]],
    instancesDistance: (_animal, instance) => instance.distance,
  }
  const { AnimalBehavior } = loadModule('app/classes/animal/AnimalBehavior.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/buildings/passageCells': {
      canEntityUseCellAsIdleDestination: (_entity, cell, options = {}) =>
        !cell.solid && !(options.passageLookup?.has?.(cell) ?? cell.reservedPassage),
      createReservedPassageCellLookup: () => ({
        has: cell => Boolean(cell?.reservedPassage),
        size: 0,
      }),
      routeEntityAwayFromPassageCell: () => false,
    },
    '../../lib/combat/combatFeedback': { showAlertFeedback: target => alertCalls.push(target) },
    '../../lib/units/unitEnergy': { updateUnitEnergy: () => {} },
    './locomotion': { isAirborne: target => (target.altitude ?? 0) > 0 },
  })
  return {
    behavior: new AnimalBehavior(animal),
    calls,
    alertCalls,
    animal,
    findInstancesInSightCalls,
    randomRangeCalls,
    scheduler,
  }
}

test('a nearby villager interrupts idle behavior immediately', () => {
  const villager = { label: 'villager-1', family: 'unit', type: 'Villager', distance: 2 }
  const { behavior, calls, alertCalls, animal, findInstancesInSightCalls } = createBehavior({ nearby: [villager] })

  behavior.update()

  assert.deepEqual(findInstancesInSightCalls, [{ useInsightRange: true, includeResources: false }])
  assert.deepEqual(alertCalls, [animal])
  assert.deepEqual(calls, [['reaction', 'villager-1']])
})

test('a tamed horse keeps walking around a nearby villager without fleeing', () => {
  const villager = { label: 'villager-1', family: 'unit', type: 'Villager', distance: 2 }
  const { behavior, calls, alertCalls } = createBehavior({
    nearby: [villager],
    type: 'Horse',
    tamingStatus: 'tamed',
  })

  behavior.update()

  assert.deepEqual(alertCalls, [])
  assert.equal(
    calls.some(call => call[0] === 'reaction'),
    false
  )
  assert.deepEqual(calls, [['sendTo', 4, 5]])
})

test('an idle animal occasionally walks to a nearby free cell', () => {
  const { behavior, calls, scheduler } = createBehavior({ elapsedMs: 10000 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 4, 5]])
  assert.equal(behavior.nextAmbientWalkAt, scheduler.elapsedMs + 4000)
})

test('idle animals skip building passage cells when picking ambient walks', () => {
  const { behavior, calls, scheduler } = createBehavior({
    elapsedMs: 10000,
    ambientCells: [
      { i: 4, j: 5, solid: false, reservedPassage: true },
      { i: 5, j: 4, solid: false },
    ],
  })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 5, 4]])
  assert.equal(behavior.nextAmbientWalkAt, scheduler.elapsedMs + 4000)
})

test('ambient walk timing and range can vary by animal species', () => {
  const { behavior, calls, randomRangeCalls, scheduler } = createBehavior({
    elapsedMs: 10000,
    ambientWalkDelayMin: 9000,
    ambientWalkDelayMax: 18000,
    ambientWalkRange: 1,
  })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 4, 5]])
  assert.deepEqual(randomRangeCalls, [[9000, 18000]])
  assert.equal(behavior.nextAmbientWalkAt, scheduler.elapsedMs + 9000)
})

test('an aggressive animal attacks instead of fleeing through ambient behavior', () => {
  const villager = { label: 'villager-1', family: 'unit', type: 'Villager', distance: 2 }
  const { behavior, calls } = createBehavior({ nearby: [villager], strategy: 'attack', elapsedMs: 10000 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['reaction', 'villager-1']])
})

test('an aggressive animal ignores nearby buildings instead of charging them', () => {
  const house = { label: 'house-1', family: 'building', type: 'House', distance: 2 }
  const { behavior, calls } = createBehavior({ nearby: [house], strategy: 'attack', elapsedMs: 10000 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 4, 5]])
})

test('an animal still in the air does not start an ambient walk', () => {
  const { behavior, calls } = createBehavior({ elapsedMs: 10000, altitude: 5 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [])
})

test('wandering stays within the saved home area after many walks', () => {
  const f = createBehavior({
    ambientCells: [
      { i: 14, j: 5 },
      { i: 12, j: 5 },
    ],
  })
  f.animal.i = 13
  for (let n = 0; n < 20; n++) {
    const dest = f.behavior.findAmbientDestination(f.animal)
    assert.ok(dest)
    assert.ok(Math.hypot(dest.i - 5, dest.j - 5) <= 8)
  }
  assert.equal(f.animal.wildlife.homeI, 5)
})

test('fleeing keeps the home and only returns after ten calm seconds', () => {
  const nearby = [{ label: 'hero', family: 'unit', distance: 2 }]
  const f = createBehavior({ nearby })
  f.behavior.update()
  f.animal.i = 25
  f.animal.isFleeing = true
  f.scheduler.elapsedMs = 3000
  f.behavior.update()
  nearby.length = 0
  f.animal.isFleeing = false
  f.scheduler.elapsedMs = 12999
  f.behavior.update()
  assert.equal(
    f.calls.some(call => call[0] === 'return'),
    false
  )
  f.scheduler.elapsedMs = 13000
  f.behavior.update()
  assert.equal(f.calls.at(-1)[0], 'return')
  assert.ok(Math.hypot(f.animal.dest.i - 5, f.animal.dest.j - 5) <= 8)
  assert.equal(f.animal.wildlife.homeI, 5)
})

test('a hero still occupying home prevents return without relocating it', () => {
  const f = createBehavior()
  f.animal.i = 25
  f.animal.sight = 20
  f.animal.context.controls = { heroUnit: { i: 5, j: 5 } }
  f.behavior.update()
  assert.equal(f.calls.length, 0)
  assert.equal(f.animal.wildlife.homeI, 5)
  assert.equal(f.behavior.nextAmbientWalkAt, 4000)
  delete f.animal.context.controls
  f.scheduler.elapsedMs = 4000
  f.behavior.update()
  assert.equal(f.calls.at(-1)[0], 'return')
})

test('tamed companions are not pulled back to their former wild home', () => {
  const f = createBehavior({ type: 'Horse', tamingStatus: 'tamed', ambientCells: [{ i: 26, j: 5 }] })
  f.animal.i = 25
  f.behavior.update()
  assert.deepEqual(f.calls, [['sendTo', 26, 5]])
})
