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

const constants = {
  ACTION_TYPES: { attack: 'attack' },
  FAMILY_TYPES: { unit: 'unit' },
  UNIT_TYPES: { villager: 'Villager' },
}

function createBehavior({
  nearby = [],
  elapsedMs = 0,
  altitude = 0,
  strategy = 'runaway',
  ambientWalkDelayMin,
  ambientWalkDelayMax,
  ambientWalkRange,
} = {}) {
  const calls = []
  const alertCalls = []
  const cells = [
    { i: 4, j: 5, solid: false },
    { i: 5, j: 4, solid: false },
    { i: 7, j: 5, solid: false },
  ]
  const randomRangeCalls = []
  const map = {
    grid: [],
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
    runaway: villager => calls.push(['runaway', villager.label]),
    getReaction: villager => calls.push(['reaction', villager.label]),
    sendTo: cell => calls.push(['sendTo', cell.i, cell.j]),
  }
  const lib = {
    findInstancesInSight: () => nearby,
    getCellsAroundPoint: (_i, _j, _grid, range, condition) =>
      cells.filter(
        cell => Math.abs(cell.i - animal.i) <= range && Math.abs(cell.j - animal.j) <= range && condition(cell)
      ),
    instancesDistance: (_animal, instance) => instance.distance,
  }
  const { AnimalBehavior } = loadModule('app/classes/animal/AnimalBehavior.ts', {
    '../../constants': constants,
    '../../lib': lib,
    '../../lib/combatFeedback': { showAlertFeedback: target => alertCalls.push(target) },
    './locomotion': { isAirborne: target => (target.altitude ?? 0) > 0 },
  })
  return { behavior: new AnimalBehavior(animal), calls, alertCalls, animal, randomRangeCalls, scheduler }
}

test('a nearby villager interrupts idle behavior immediately', () => {
  const villager = { label: 'villager-1', family: 'unit', type: 'Villager', distance: 2 }
  const { behavior, calls, alertCalls, animal } = createBehavior({ nearby: [villager] })

  behavior.update()

  assert.deepEqual(alertCalls, [animal])
  assert.deepEqual(calls, [['reaction', 'villager-1']])
})

test('an idle animal occasionally walks to a nearby free cell', () => {
  const { behavior, calls, scheduler } = createBehavior({ elapsedMs: 10000 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 4, 5]])
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

test('an animal still in the air does not start an ambient walk', () => {
  const { behavior, calls } = createBehavior({ elapsedMs: 10000, altitude: 5 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [])
})
