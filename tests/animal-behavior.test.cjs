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
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  FAMILY_TYPES: { unit: 'unit' },
  UNIT_TYPES: { villager: 'Villager' },
}

function createBehavior({ nearby = [], elapsedMs = 0 } = {}) {
  const calls = []
  const cells = [
    { i: 4, j: 5, solid: false },
    { i: 5, j: 4, solid: false },
  ]
  const map = {
    grid: [],
    randomItem: items => items[0],
    randomRange: () => 5000,
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
    context: { map, scheduler, editor: null },
    runaway: villager => calls.push(['runaway', villager.label]),
    sendTo: cell => calls.push(['sendTo', cell.i, cell.j]),
  }
  const lib = {
    findInstancesInSight: () => nearby,
    getCellsAroundPoint: (_i, _j, _grid, _range, condition) => cells.filter(condition),
    instancesDistance: (_animal, instance) => instance.distance,
  }
  const { AnimalBehavior } = loadModule('app/classes/animal/AnimalBehavior.js', {
    '../../constants': constants,
    '../../lib': lib,
  })
  return { behavior: new AnimalBehavior(animal), calls, scheduler }
}

test('a nearby villager interrupts idle behavior immediately', () => {
  const villager = { label: 'villager-1', family: 'unit', type: 'Villager', distance: 2 }
  const { behavior, calls } = createBehavior({ nearby: [villager] })

  behavior.update()

  assert.deepEqual(calls, [['runaway', 'villager-1']])
})

test('an idle animal occasionally walks to a nearby free cell', () => {
  const { behavior, calls, scheduler } = createBehavior({ elapsedMs: 10000 })
  behavior.nextAmbientWalkAt = 5000

  behavior.update()

  assert.deepEqual(calls, [['sendTo', 4, 5]])
  assert.equal(behavior.nextAmbientWalkAt, scheduler.elapsedMs + 5000)
})
