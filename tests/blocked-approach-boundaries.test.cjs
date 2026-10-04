const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const calls = []
  const rings = new Map()
  const paths = new Map()
  const map = { grid: [] }
  const api = loadTsModule('app/classes/unit/movement/UnitBlockedApproach.ts', {
    mocks: {
      '../../../lib': {
        getCellsAroundPoint: (_i, _j, _grid, distance, allowed) => (rings.get(distance) ?? []).filter(allowed),
        getInstancePath: (_unit, i, j) => paths.get(`${i},${j}`) ?? [],
        getInstanceDegree: () => 90,
        markVillagerAutonomyTargetRejected: (_unit, target) => calls.push(['reject', target]),
      },
      '../../../lib/buildings/passageCells': {
        createReservedPassageCellLookup: () => new Set(),
        canUnitWaitOnCell: (_u, cell) => !cell.solid,
      },
      '../../../lib/mapSpaces': { getEntitySpaceMapLike: unit => unit.context?.map },
      './UnitMovementPassage': { createPassagePathfindingOptions: () => ({}) },
      './UnitMovementHelpers': {
        BLOCKED_GATHER_APPROACH_ACTIONS: new Set(['chopwood']),
        MAX_BLOCKED_GATHER_APPROACH_DISTANCE: 6,
        isRuntimeEntity: value => Boolean(value?.family),
        resumeAutonomyBeforeStopping: unit => Boolean(unit.resume),
      },
    },
  })
  const unit = {
    type: 'Villager',
    i: 0,
    j: 0,
    context: { map },
    getActionCondition: () => true,
    setDest: dest => calls.push(['dest', dest]),
    setPath: path => calls.push(['path', path]),
    sendToEvt: (...args) => calls.push(['send', ...args]),
    affectNewDest: () => calls.push(['replace']),
    stop: () => calls.push(['stop']),
    getAction: action => calls.push(['action', action]),
  }
  const target = { family: 'resource', i: 4, j: 4, x: 4, y: 4 }
  return { api, calls, rings, paths, unit, target }
}
test('blocked approach picks shortest reachable path in nearest usable ring', () => {
  const { api, rings, paths, unit, target } = fixture()
  const first = { i: 2, j: 4 },
    best = { i: 4, j: 2 },
    blocked = { i: 3, j: 3, solid: true }
  rings.set(2, [first, blocked, best])
  paths.set('2,4', [{}, {}, {}])
  paths.set('4,2', [{}])
  assert.deepEqual(api.findReachableApproachCell(unit, target), { cell: best, path: [{}] })
  assert.equal(api.findReachableApproachCell({}, target), null)
  paths.clear()
  assert.equal(api.findReachableApproachCell(unit, target), null)
  rings.set(3, [{ i: 0, j: 0 }])
  assert.deepEqual(api.findReachableApproachCell(unit, target, 2, true), { cell: { i: 0, j: 0 }, path: [] })
})
test('gather detour refuses invalid requests and preserves the real work target', () => {
  const { api, rings, paths, calls, unit, target } = fixture()
  for (const [actor, dest, action] of [
    [{ ...unit, type: 'Hero' }, target, 'chopwood'],
    [unit, target, 'attack'],
    [unit, null, 'chopwood'],
    [unit, { ...target, isDestroyed: true }, 'chopwood'],
    [{ ...unit, getActionCondition: undefined }, target, 'chopwood'],
    [{ ...unit, blockedGatherApproach: { target, action: 'chopwood' } }, target, 'chopwood'],
  ])
    assert.equal(api.startBlockedGatherApproach(actor, dest, action), false)
  assert.equal(api.startBlockedGatherApproach(unit, target, 'chopwood'), false)
  const cell = { i: 2, j: 4 }
  rings.set(2, [cell])
  paths.set('2,4', [cell])
  assert.equal(api.startBlockedGatherApproach(unit, target, 'chopwood'), true)
  assert.equal(unit.action, 'chopwood')
  assert.deepEqual(calls, [
    ['dest', target],
    ['path', [cell]],
  ])
  assert.equal(api.retryBlockedGatherApproach(unit), true)
  assert.equal(unit.blockedGatherApproach, null)
  assert.deepEqual(calls.at(-1), ['send', target, 'chopwood', { forceRepath: true, allowBlockedGatherApproach: false }])
  assert.equal(api.retryBlockedGatherApproach(unit), false)
  unit.blockedGatherApproach = { target: { ...target, isDestroyed: true }, action: 'chopwood' }
  api.retryBlockedGatherApproach(unit)
  assert.deepEqual(calls.at(-1), ['replace'])
})
test('water detours keep autonomy, act from an existing approach and recover from no route', () => {
  const { api, rings, paths, calls, unit, target } = fixture()
  api.routeToReachableWaterApproach(unit, target, null, false)
  assert.deepEqual(calls.pop(), ['stop'])
  api.handleBlockedApproachFailure({ ...unit, resume: true }, target, null, false)
  assert.equal(calls.length, 0)
  api.handleBlockedApproachFailure(unit, target, 'attack', false)
  assert.deepEqual(calls.pop(), ['replace'])
  rings.set(1, [{ i: 0, j: 0 }])
  api.routeToReachableWaterApproach(unit, target, null, false)
  assert.deepEqual(calls.pop(), ['send', { i: 0, j: 0 }, null, { preserveAutonomy: true }])
  api.routeToReachableWaterApproach(unit, target, 'chopwood', false)
  assert.equal(unit.degree, 90)
  assert.deepEqual(calls.pop(), ['action', 'chopwood'])
  rings.set(1, [{ i: 1, j: 1 }])
  paths.set('1,1', [{ i: 1, j: 1 }])
  api.routeToReachableWaterApproach(unit, target, 'chopwood', false)
  assert.deepEqual(calls.at(-1), ['path', [{ i: 1, j: 1 }]])
})
