const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const babel = require('@babel/core')
const filename = path.join(__dirname, '../app/lib/units/autonomy/villagerJobDiagnostics.ts')
const { code } = babel.transformFileSync(filename, {
  presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
})
const factory = new Function('module', 'exports', 'window', 'document', code)
function load(window, document) {
  const module = { exports: {} }
  factory(module, module.exports, window, document)
  return module.exports.logGoldMinerFlow
}

test('gold miner diagnostics require a browser and an active or remembered gold job', t => {
  const info = t.mock.method(console, 'info', () => {})
  for (const [window, document] of [
    [undefined, undefined],
    [{}, undefined],
    [undefined, {}],
  ])
    load(window, document)({ autonomousJob: 'gold' }, 'disabled')
  const log = load({}, {})
  log({}, 'other-job')
  assert.equal(info.mock.callCount(), 0)
  for (const state of [{ autonomousJob: 'gold' }, { work: 'goldminer' }, { action: 'minegold' }]) log(state, 'active')
  for (const task of [{ autonomousJob: 'gold' }, { work: 'goldminer' }, { action: 'minegold' }])
    log({}, 'return', {}, task)
  assert.equal(info.mock.callCount(), 6)
  const value = info.mock.calls[0].arguments[1]
  assert.equal(value.unit, null)
  assert.equal(value.time, null)
  assert.equal(value.space, 'outside')
  assert.equal(value.gold, 0)
  assert.equal(value.pathLength, 0)
  assert.equal(value.destination, null)
  assert.equal(value.blockedTarget, null)
  assert.equal(value.delivery, null)
  assert.equal(value.returnTask, null)
})

test('gold miner diagnostics record target, blocked approach, delivery and return-task state', t => {
  const info = t.mock.method(console, 'info', () => {})
  const log = load({}, {})
  const destination = {
    action: 'work',
    isDestroyed: true,
    i: 1,
    j: 2,
    label: 'ore',
    quantity: 5,
    solid: true,
    type: 'Gold',
  }
  const task = { action: 'minegold', autonomousJob: 'gold', dest: destination, work: 'goldminer' }
  const unit = {
    label: 'worker',
    i: 3,
    j: 4,
    spaceId: 'mine',
    action: 'delivery',
    work: 'goldminer',
    autonomousJob: 'gold',
    actionLocked: true,
    inactif: false,
    path: [{}, {}],
    dest: destination,
    blockedGatherApproach: { target: destination },
    context: { dayNight: { state: { hour: 7, minute: 5 } } },
    inventory: { resources: { gold: 12 } },
    resourceDeliveryState: {
      phase: 'unloading',
      building: { label: 'store' },
      chest: { label: 'chest' },
      spaceId: 'inside',
      returnTask: task,
    },
  }
  log(unit, 'arrive', { reason: 'full' })
  const value = info.mock.calls[0].arguments[1]
  assert.equal(value.time, '07:05')
  assert.equal(value.unit, 'worker')
  assert.deepEqual(value.position, { i: 3, j: 4 })
  assert.equal(value.pathLength, 2)
  assert.equal(value.gold, 12)
  assert.equal(value.actionLocked, true)
  assert.equal(value.inactive, false)
  assert.deepEqual(value.destination, {
    action: 'work',
    destroyed: true,
    i: 1,
    j: 2,
    label: 'ore',
    quantity: 5,
    solid: true,
    type: 'Gold',
  })
  assert.deepEqual(value.blockedTarget, value.destination)
  assert.deepEqual(value.delivery, { phase: 'unloading', building: 'store', chest: 'chest', spaceId: 'inside' })
  assert.equal(value.returnTask.destination.type, 'Gold')
  assert.equal(value.reason, 'full')
})

test('partial cells and delivery records produce explicit absent values without throwing', t => {
  const info = t.mock.method(console, 'info', () => {})
  const log = load({}, {})
  const unit = {
    autonomousJob: 'gold',
    dest: { i: 1, j: 2 },
    inventory: {},
    resourceDeliveryState: { phase: 'walking', returnTask: {} },
  }
  log(unit, 'partial')
  let value = info.mock.calls.at(-1).arguments[1]
  assert.equal(value.destination.action, undefined)
  assert.equal(value.destination.destroyed, undefined)
  assert.equal(value.destination.quantity, undefined)
  assert.equal(value.destination.solid, undefined)
  assert.equal(value.destination.label, null)
  assert.equal(value.destination.type, null)
  assert.deepEqual(value.delivery, { phase: 'walking', building: null, chest: null, spaceId: null })
  assert.deepEqual(value.returnTask, { action: null, autonomousJob: null, destination: null, work: null })
  unit.dest = {
    action: undefined,
    label: undefined,
    quantity: undefined,
    type: undefined,
    isDestroyed: false,
    solid: false,
  }
  log(unit, 'empty-values', {}, null)
  value = info.mock.calls.at(-1).arguments[1]
  assert.equal(value.destination.action, null)
  assert.equal(value.destination.quantity, null)
  assert.equal(value.destination.destroyed, false)
  assert.equal(value.returnTask, null)
})
