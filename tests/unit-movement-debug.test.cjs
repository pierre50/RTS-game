const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const restoredGlobals = new WeakMap()
function replaceGlobal(t, key, value) {
  let keys = restoredGlobals.get(t)
  if (!keys) {
    keys = new Set()
    restoredGlobals.set(t, keys)
  }
  if (!keys.has(key)) {
    keys.add(key)
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    })
  }
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
function setup(t) {
  const api = loadTsModule('app/classes/unit/movement/UnitMovementDebug.ts', {
    mocks: {
      '../../../constants': { ACTION_TYPES: { hunt: 'hunt', attack: 'attack' }, WORK_TYPES: { attacker: 'attacker' } },
    },
  })
  const settings = new Map()
  replaceGlobal(t, 'window', {
    localStorage: { getItem: key => settings.get(key), setItem: (key, value) => settings.set(key, value) },
  })
  let now = 1000
  replaceGlobal(t, 'performance', { now: () => now })
  t.mock.method(Date, 'now', () => now)
  const debug = t.mock.method(console, 'debug', () => {})
  const warn = t.mock.method(console, 'warn', () => {})
  return {
    api,
    settings,
    debug,
    warn,
    time: value => {
      now = value
    },
  }
}
function unit() {
  return { label: 'u', type: 'Villager', i: 1, j: 2, x: 12.3456, y: 23.4567 }
}

test('movement debug switches support browser settings, missing storage and server globals', t => {
  const { api } = setup(t)
  assert.equal(api.isMovementDebugEnabled(), false)
  api.setMovementDebugEnabled(true)
  assert.equal(api.isMovementDebugEnabled(), true)
  api.setMovementDebugEnabled(false)
  assert.equal(api.isMovementDebugEnabled(), false)
  window.localStorage = undefined
  api.setMovementDebugEnabled(true)
  assert.equal(api.isMovementDebugEnabled(), false)
  replaceGlobal(t, 'window', undefined)
  replaceGlobal(t, 'RTS_DEBUG_UNIT_MOVEMENT', false)
  api.setMovementDebugEnabled(true)
  assert.equal(api.isMovementDebugEnabled(), true)
  api.setMovementDebugEnabled(false)
  assert.equal(api.isMovementDebugEnabled(), false)
})

test('cell diagnostics distinguish empty cells, occupants and the unit itself', t => {
  const { api } = setup(t)
  const actor = unit()
  assert.equal(api.serializeDirectMoveDebugCell(null), null)
  assert.equal(api.serializeDirectMoveDebugCell({ i: 0, j: 0 }).has, null)
  const cell = { i: 1, j: 2, solid: true, has: actor }
  assert.equal(api.serializeDirectMoveDebugCell(cell, actor).has.sameObject, true)
  assert.equal(api.serializeDirectMoveDebugCell(cell, {}).has.sameObject, false)
  assert.equal(api.serializeDirectMoveDebugCell(cell).has.sameObject, undefined)
})

test('direct probes preserve recent snapshots while throttling console output', t => {
  const { api, debug, time } = setup(t)
  const actor = unit()
  assert.equal(api.getLastDirectMoveDebugSnapshot(), null)
  api.debugDirectMoveProbe(actor, 'disabled', {}, 1, 0)
  assert.equal(api.getLastDirectMoveDebugSnapshot(), null)
  api.setMovementDebugEnabled(true)
  actor.currentCell = { i: 1, j: 2 }
  api.debugDirectMoveProbe(actor, 'first', { blocked: false }, 0.123456, -0.123456)
  let snapshot = api.getLastDirectMoveDebugSnapshot()
  assert.deepEqual(snapshot.dir, { x: 0.123, y: -0.123 })
  assert.equal(snapshot.unit.x, 12.35)
  assert.equal(snapshot.unit.y, 23.46)
  assert.equal(snapshot.unit.currentCell.i, 1)
  assert.equal(debug.mock.callCount(), 1)
  time(1100)
  api.debugDirectMoveProbe(actor, 'latest', {}, 0, 1)
  assert.equal(api.getLastDirectMoveDebugSnapshot().reason, 'latest')
  assert.equal(debug.mock.callCount(), 1)
  time(1250)
  api.debugDirectMoveProbe(actor, 'next', {}, 0, 1)
  assert.equal(debug.mock.callCount(), 2)
  replaceGlobal(t, 'performance', undefined)
  time(1500)
  api.debugBlockedDirectMove({ i: 0, j: 0 }, 'blocked', {}, 1, 0)
  snapshot = api.getLastDirectMoveDebugSnapshot()
  assert.equal(snapshot.at, 1500)
  assert.equal(snapshot.unit.x, 0)
  assert.equal(snapshot.unit.y, 0)
  assert.equal(snapshot.unit.currentCell, undefined)
  assert.equal(debug.mock.calls.at(-1).arguments[0], '[direct-move-blocked]')
  time(1510)
  api.debugBlockedDirectMove(actor, 'throttled', {}, 0, 0)
  assert.equal(debug.mock.callCount(), 3)
  api.setMovementDebugEnabled(false)
  api.debugBlockedDirectMove(actor, 'offline', {}, 0, 0)
  assert.equal(api.getLastDirectMoveDebugSnapshot().reason, 'offline')
  assert.equal(debug.mock.callCount(), 3)
})

test('hunt diagnostics respect activation, range and time limits and serialize entities and cells', t => {
  const { api, settings, debug, time } = setup(t)
  const actor = unit()
  const target = { type: 'Deer', label: 'deer' }
  api.debugHuntRangeCheck(actor, 'hunt', target, 4, 3)
  assert.equal(debug.mock.callCount(), 0)
  settings.set('rts.debug.huntRange', '1')
  api.debugHuntRangeCheck(actor, 'attack', target, 4, 3)
  api.debugHuntRangeCheck(actor, 'hunt', target, 0, 3)
  assert.equal(debug.mock.callCount(), 0)
  api.debugHuntRangeCheck(actor, 'hunt', target, 4, 3.456)
  let value = debug.mock.calls.at(-1).arguments[1]
  assert.equal(value.targetType, 'Deer')
  assert.equal(value.ownerAge, 0)
  assert.equal(value.distanceToTarget, 3.46)
  assert.equal(value.inRange, true)
  time(1100)
  api.debugHuntRangeCheck(actor, 'hunt', target, 4, 3)
  assert.equal(debug.mock.callCount(), 1)
  time(1250)
  actor.owner = { age: 2 }
  api.debugHuntRangeCheck(actor, 'hunt', { has: null, corpses: [] }, 4, 5)
  value = debug.mock.calls.at(-1).arguments[1]
  assert.equal(value.targetType, 'cell')
  assert.equal(value.targetLabel, undefined)
  assert.equal(value.ownerAge, 2)
  assert.equal(value.inRange, false)
  window.localStorage = undefined
  api.debugHuntRangeCheck(actor, 'hunt', target, 4, 3)
  replaceGlobal(t, 'window', undefined)
  replaceGlobal(t, 'RTS_DEBUG_HUNT_RANGE', false)
  api.debugHuntRangeCheck(actor, 'hunt', target, 4, 3)
  globalThis.RTS_DEBUG_HUNT_RANGE = true
  time(1500)
  api.debugHuntRangeCheck(actor, 'hunt', { has: null }, 4, 3)
  assert.equal(debug.mock.callCount(), 3)
})

test('combat diagnostics cover bandit identity and combat roles without logging idle civilians', t => {
  const { api, warn } = setup(t)
  api.debugCombatMove(unit(), 'disabled', {})
  api.setMovementDebugEnabled(true)
  api.debugCombatMove(unit(), 'idle', {})
  assert.equal(warn.mock.callCount(), 0)
  const variants = [
    { category: 'Bandit' },
    { type: 'BANDIT' },
    { name: 'bandit' },
    { owner: { name: 'Bandit' } },
    { owner: { label: 'bandit' } },
    { combatMode: true },
    { action: 'attack' },
    { waitingForEnergyAction: 'attack' },
    { work: 'attacker' },
  ]
  for (const [index, variant] of variants.entries()) {
    const actor = {
      ...unit(),
      ...variant,
      label: `unit-${index}`,
      dest: { label: 'target', type: 'Tree', family: 'resource', i: 3, j: 4 },
      path: [{}],
      sprite: { playing: true },
    }
    api.debugCombatMove(actor, 'blocked', { has: actor }, { probe: index })
    const call = warn.mock.calls.at(-1).arguments
    assert.equal(call[0], index < 5 ? '[bandit-move]' : '[combat-move]')
    assert.equal(call[2].cell.has.sameObject, true)
    assert.equal(call[2].dest.label, 'target')
    assert.equal(call[2].pathLength, 1)
    assert.equal(call[2].probe, index)
  }
  assert.equal(warn.mock.callCount(), variants.length)
})

test('combat diagnostic throttles are per unit and tolerate missing optional state', t => {
  const { api, warn, time } = setup(t)
  api.setMovementDebugEnabled(true)
  replaceGlobal(t, 'performance', undefined)
  const actor = { i: 1, j: 2, combatMode: true, dest: { i: 4, j: 5, solid: true } }
  api.debugCombatMove(actor, 'first', {})
  let value = warn.mock.calls[0].arguments[2]
  assert.equal(value.unit.x, 0)
  assert.equal(value.cell.has, null)
  assert.equal(value.dest.solid, true)
  assert.equal(value.dest.label, undefined)
  assert.equal(value.pathLength, 0)
  time(1100)
  api.debugCombatMove(actor, 'throttled', {})
  assert.equal(warn.mock.callCount(), 1)
  api.debugCombatMove({ ...actor, type: 'Scout' }, 'another', {})
  assert.equal(warn.mock.callCount(), 2)
  time(1600)
  delete actor.dest
  api.debugCombatMove(actor, 'retry', { has: { label: 'other' } })
  value = warn.mock.calls.at(-1).arguments[2]
  assert.equal(value.dest, null)
  assert.equal(value.cell.has.sameObject, false)
  assert.equal(value.cell.has.sameLabel, false)
  assert.equal(warn.mock.callCount(), 3)
})
