const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const calls = []
  const rules = {
    admit: true,
    attack: null,
    redundant: false,
    remembered: false,
    path: [],
    arrival: null,
    idle: true,
    transit: false,
    resolved: true,
    contact: false,
    detour: false,
  }
  const { UnitMovementRouting } = loadTsModule('app/classes/unit/movement/UnitMovementRoutingRuntime.ts', {
    mocks: {
      '../../../lib': {
        getInstancePath: () => rules.path,
        getInstanceClosestFreeCellPath: () => rules.path,
        getInstanceDegree: () => 45,
      },
      '../../../lib/buildings/passageCells': {
        canUnitUseCellAsIdleDestination: () => rules.idle,
        canUseReservedPassageCellForTransit: () => rules.transit,
        createReservedPassageCellLookup: () => new Set(),
      },
      '../../../lib/mapSpaces': {
        getEntitySpaceMapLike: unit => unit.context?.map,
        sameMapSpace: (a, b) => a.spaceId === b.spaceId,
        sameCellMapSpace: (a, b) => a.spaceId === b.spaceId,
      },
      '../../../lib/units/autonomy/villagerExploration': { cancelVillagerExplorationResume() {} },
      '../../../lib/units/targetPursuit': { routeToRememberedTarget: () => rules.remembered },
      '../../../lib/units/unitEnergy': { cancelEnergyWait() {} },
      './ManualMoveState': { clearManualMoveWorkState() {} },
      './UnitActionArrivalCells': { getActionArrivalCell: () => rules.arrival },
      './UnitBlockedApproach': {
        findReachableApproachCell: () => null,
        startBlockedGatherApproach: () => rules.detour,
        retryBlockedGatherApproach: () => false,
        handleBlockedApproachFailure: () => calls.push('blocked'),
        routeToReachableWaterApproach: () => calls.push('water'),
      },
      './UnitContactApproach': { tryStartUnitContactApproach: () => rules.contact },
      './UnitMoveOrderAdmission': {
        admitMoveOrder: () => rules.admit,
        isRedundantMoveOrder: () => rules.redundant,
        resolveAttackOrder: () => rules.attack,
      },
      './UnitMovementDebug': { debugCombatMove() {} },
      './UnitMovementHelpers': {
        isDestroyedEntity: dest => dest.isDestroyed,
        isRuntimeEntity: dest => Boolean(dest?.family),
        resumeAutonomyBeforeStopping: unit => Boolean(unit.resume),
        syncVillagerWorkForAction() {},
      },
      './UnitMovementPassage': {
        allowsUnitPassageStop: () => false,
        createPassagePathfindingOptions: () => ({}),
        resolvePassageDestination: (_u, dest) => (rules.resolved ? dest : null),
      },
    },
  })
  const cell = { i: 0, j: 0 },
    dest = { i: 1, j: 1, family: 'resource' }
  const unit = {
    i: 0,
    j: 0,
    context: { map: { grid: [[cell], [null, dest]] } },
    currentCell: cell,
    affectNewDest: () => calls.push('replace'),
    setDest: dest => calls.push(['dest', dest]),
    setPath: path => calls.push(['path', path]),
    getAction: action => calls.push(['action', action]),
    queueOrder: (...args) => {
      calls.push(['queue', ...args])
      return true
    },
  }
  return { routing: new UnitMovementRouting(unit), rules, calls, unit, dest }
}
test('routing refuses inadmissible, redundant, destroyed and cross-space orders', () => {
  const { routing, rules, calls, unit, dest } = fixture()
  rules.admit = false
  assert.equal(routing.sendToEvt(dest, null), false)
  rules.admit = true
  rules.redundant = true
  routing.sendToEvt(dest, null)
  rules.redundant = false
  rules.remembered = true
  routing.sendToEvt(dest, 'attack')
  rules.remembered = false
  routing.sendToEvt(null, null)
  routing.sendToEvt({ ...dest, isDestroyed: true }, null)
  unit.isDead = true
  routing.sendToEvt(dest, null)
  unit.isDead = false
  assert.deepEqual(calls, [])
  routing.sendToEvt({ ...dest, spaceId: 'other' }, 'chopwood')
  assert.deepEqual(calls, ['replace'])
  assert.equal(routing.targetIsInUnitSpace(null), false)
  delete unit.context
  calls.length = 0
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls, [])
})
test('locked routing queues both destinations and cancellation without replacing active work', () => {
  const { routing, calls, unit, dest } = fixture()
  unit.actionLocked = true
  assert.equal(routing.sendToEvt(dest, 'attack'), true)
  assert.deepEqual(calls[0], ['queue', dest, 'attack'])
  routing.sendToEvt(null, null)
  assert.equal(typeof calls[1][1], 'function')
  assert.doesNotThrow(calls[1][1])
})
test('routing handles blocked arrival cells, immediate arrival and failed paths', () => {
  const { routing, rules, calls, unit, dest } = fixture()
  rules.arrival = { i: 1, j: 0 }
  rules.idle = false
  routing.sendToEvt(dest, 'train')
  assert.deepEqual(calls.pop(), 'replace')
  rules.idle = true
  rules.arrival = { i: 0, j: 0 }
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls.pop(), ['action', ''])
  assert.equal(unit.degree, 45)
  rules.arrival = { i: 0, j: 1 }
  calls.length = 0
  routing.sendToEvt(dest, 'train')
  assert.deepEqual(calls, ['replace'])
  rules.arrival = null
  rules.resolved = false
  calls.length = 0
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls, ['replace'])
})
test('routing falls back through water, contact, blocked gather and unreachable movement', () => {
  const { routing, rules, calls, unit, dest } = fixture()
  rules.contact = true
  routing.sendToEvt(dest, 'attack')
  assert.deepEqual(calls, [])
  rules.contact = false
  dest.category = 'Water'
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls.pop(), 'water')
  delete dest.category
  rules.detour = true
  routing.sendToEvt(dest, 'chopwood')
  assert.deepEqual(calls, [])
  rules.detour = false
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls.pop(), 'replace')
  unit.currentCell = null
  routing.sendToEvt({ i: 9, j: 9 }, null, { allowBlockedGatherApproach: false })
  assert.deepEqual(calls.pop(), 'replace')
  unit.resume = true
  routing.sendToEvt(dest, null)
  assert.deepEqual(calls, [])
  assert.equal(routing.findClosestReachableCellNearTarget(dest), null)
  assert.equal(routing.approachBlockedGatherTarget(dest, 'chopwood'), false)
  assert.equal(routing.retryBlockedGatherApproach(), false)
  routing.handleBlockedApproachFailure(dest, null, false)
  assert.equal(calls.pop(), 'blocked')
})
