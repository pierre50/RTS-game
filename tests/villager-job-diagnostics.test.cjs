const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { logStationaryVillager } = loadTsModule('app/lib/units/autonomy/villagerJobDiagnostics.ts')
test('stalled walking diagnostics report destination and obstacle without changing them', t => {
  const calls = []
  t.mock.method(console, 'warn', (...args) => calls.push(args))
  const occupant = {
    i: 2,
    j: 3,
    label: 'tree',
    type: 'Tree',
    quantity: 5,
    isDestroyed: false,
    solid: true,
    action: null,
  }
  const next = { i: 2, j: 3, has: occupant }
  const unit = {
    label: 'worker',
    i: 1,
    j: 2,
    x: 10,
    y: 20,
    path: [next],
    dest: occupant,
    spaceId: 'room',
    shelterState: { reason: 'rest' },
    spacePortalState: { portalId: 'door' },
    resourceDeliveryState: { phase: 'pickup' },
    context: { dayNight: { state: { hour: 10 } } },
  }
  logStationaryVillager(unit)
  assert.equal(calls[0][0], '[villager-stalled-walk]')
  const snapshot = calls[0][1]
  assert.deepEqual(snapshot.nextOccupant, {
    action: null,
    destroyed: false,
    i: 2,
    j: 3,
    label: 'tree',
    quantity: 5,
    solid: true,
    type: 'Tree',
  })
  assert.equal(snapshot.pathLength, 1)
  assert.equal(snapshot.space, 'room')
  assert.equal(snapshot.portal, 'door')
  assert.equal(unit.path[0], next)
  logStationaryVillager({
    path: [{ i: 0, j: 0, label: null, type: null, quantity: null, action: undefined }],
    dest: { i: 0, j: 0 },
  })
  assert.equal(calls[1][1].nextCell.label, null)
  assert.equal(calls[1][1].nextCell.quantity, null)
  logStationaryVillager({})
  assert.equal(calls[2][1].space, 'outside')
  assert.equal(calls[2][1].pathLength, 0)
  assert.equal(calls[2][1].destination, null)
  const previous = global.window
  delete global.window
  try {
    logStationaryVillager({})
    assert.equal(calls.length, 3)
  } finally {
    global.window = previous
  }
})
