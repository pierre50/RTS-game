const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const api = loadTsModule('app/lib/units/autonomy/walkAround.ts', {
  mocks: {
    '../../grid': { getCellsAroundPoint: (_i, _j, grid, _range, allow) => grid.flat().filter(allow) },
    '../../mapSpaces': { getEntitySpaceMapLike: unit => unit.spaceMap },
    '../../buildings/passageCells': {
      canUnitUseCellAsIdleDestination: (_u, cell) => !cell.solid,
      createReservedPassageCellLookup: () => new Set(),
    },
  },
})
test('ambient walking never interrupts active tasks or transitions', () => {
  assert.equal(api.canUnitStartAmbientWalk({}), true)
  for (const patch of [
    { isDead: true },
    { isDestroyed: true },
    { shelterState: {} },
    { action: 'attack' },
    { dest: {} },
    { path: [{}] },
    { combatMode: 'attack' },
    { combatMode: 'recover' },
    { combatMode: 'flee' },
    { pendingOrder: {} },
    { spacePortalState: {} },
    { resourceDeliveryState: {} },
  ])
    assert.equal(api.canUnitStartAmbientWalk(patch), false)
})
test('ambient destinations exclude the occupied position and blocked cells', () => {
  const unit = {
    i: 0,
    j: 0,
    context: {
      map: {
        grid: [
          [
            { i: 0, j: 0 },
            { i: 0, j: 1 },
            { i: 1, j: 0, solid: true },
          ],
        ],
        randomItem: cells => cells[0],
      },
    },
  }
  assert.equal(api.findUnitWalkAroundDestination({}, null, 1), null)
  assert.equal(api.findUnitWalkAroundDestination(unit, null, 1), null)
  assert.deepEqual(api.findUnitWalkAroundDestination(unit, { i: 0, j: 0 }, 1), { i: 0, j: 1 })
  unit.spaceMap = { grid: [[{ i: 1, j: 0 }]] }
  assert.deepEqual(api.findUnitWalkAroundDestination(unit, { i: 0, j: 0 }, 1), { i: 1, j: 0 })
  unit.spaceMap.grid = []
  assert.equal(api.findUnitWalkAroundDestination(unit, { i: 0, j: 0 }, 1), null)
})
test('scheduled wandering respects permission changes and supports legacy movement', () => {
  assert.equal(api.scheduleUnitWalkAround({}, {}), null)
  assert.equal(api.scheduleUnitWalkAround({ context: { map: {} } }, {}), null)
  for (const modern of [false, true]) {
    let tick
    const calls = []
    let allowed = false
    const destination = { i: 1, j: 0 }
    const unit = {
      i: 0,
      j: 0,
      context: {
        map: { grid: [[destination]], randomItem: cells => cells[0], randomRange: min => min },
        scheduler: {
          addOneShot: fn => {
            tick = fn
            return 7
          },
        },
      },
    }
    unit[modern ? 'sendToEvt' : 'sendTo'] = (...args) => calls.push(args)
    const options = {
      anchor: () => ({ i: 0, j: 0 }),
      range: () => 2,
      delayMinMs: () => 10,
      delayMaxMs: () => 20,
      shouldContinue: () => true,
      canMove: () => allowed,
      taskName: 'ambient',
    }
    assert.equal(api.scheduleUnitWalkAround(unit, options), 7)
    tick()
    assert.deepEqual(calls, [])
    allowed = true
    tick()
    assert.deepEqual(
      calls[0],
      modern ? [destination, null, { forceRepath: true, preserveAutonomy: true }] : [destination]
    )
    delete options.canMove
    api.scheduleUnitWalkAround(unit, options)
    tick()
    assert.equal(calls.length, 2)
  }
})
