const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(t, realPassages = false) {
  let clock = 0
  t.mock.method(performance, 'now', () => clock)
  let id = 0
  const tasks = new Map()
  const context = {
    map: { grid: Array.from({ length: 40 }, (_, i) => Array.from({ length: 40 }, (_, j) => ({ i, j }))) },
    scheduler: {
      elapsedMs: 0,
      add: callback => {
        tasks.set(++id, callback)
        return id
      },
      remove: key => tasks.delete(key),
    },
  }
  const moduleCache = new Map()
  const mocks = {
    '../lib/units/autonomy/villagerAutonomyAvailability': {
      villagerAutonomySuspension: unit =>
        unit.suspended || unit.isDead || unit.shelterState || unit.controlMode === 'hero',
    },
    '../mapSpaces': {
      getEntitySpaceMapLike: (_unit, map) => map,
      sameMapSpace: () => true,
      sameCellMapSpace: () => true,
      getCellSpaceId: cell => cell?.spaceId ?? 'outside',
    },
    '../../../classes/resources/CompactResourceSet': { resolveResource: target => target },
    '../playerTargetKnowledge': { knownTarget: (_owner, target) => target },
    '../combat/targetPursuit': { isPursuingRememberedTarget: () => false },
    './villagerDropoffDistance': { nearestDropoffDistance: () => 0 },
    '../../buildings/passageCells': {
      createReservedPassageCellLookup: () => new Set(),
      canUnitUseCellAsIdleDestination: () => true,
      canUseReservedPassageCellForTransit: () => false,
    },
  }
  if (realPassages) delete mocks['../../buildings/passageCells']
  const load = file => loadTsModule(file, { mocks, moduleCache })
  const planning = load('app/services/AutonomyPlanningQueue.ts')
  const targeting = load('app/lib/units/autonomy/villagerAutonomyTargeting.ts')
  const movement = load('app/lib/grid/movement.ts')
  const queue = new planning.AutonomyPlanningQueue(context)
  const unit = () => ({ i: 1, j: 1, type: 'Villager', autonomousJob: 'wood', context, getActionCondition: () => true })
  const advance = () => {
    context.scheduler.elapsedMs += 17
    queue.flush()
  }
  const drain = () => {
    for (let n = 0; tasks.size && n < 2000; n++) advance()
    assert.equal(tasks.size, 0)
  }
  return {
    ...planning,
    ...targeting,
    ...movement,
    context,
    queue,
    tasks,
    unit,
    advance,
    drain,
    addTime: value => {
      clock += value
    },
    now: () => clock,
  }
}

test('all villagers share a frame budget and pending work cannot commit early', t => {
  const f = fixture(t)
  let steps = 0,
    completed = 0
  const units = Array.from({ length: 6 }, f.unit)
  for (const unit of units)
    f.runAutonomyPlan(unit, function* () {
      for (let n = 0; n < 100; n++) {
        steps++
        yield
      }
      completed++
      return true
    })
  assert.equal(steps, 0)
  f.advance()
  assert.equal(steps, 64)
  assert.equal(completed, 0)
  f.queue.flush()
  assert.equal(steps, 64)
  f.drain()
  assert.equal(completed, 6)
  assert.equal(
    units.some(unit => unit.assigningAutonomousJob),
    false
  )
})

for (const change of ['manual-order', 'move', 'space', 'job', 'death', 'rest', 'suspension', 'map']) {
  test(`planning is cancelled after ${change} without overwriting the new state`, t => {
    const f = fixture(t),
      unit = f.unit(),
      results = []
    let committed = false
    f.runAutonomyPlan(
      unit,
      function* () {
        for (let n = 0; n < 100; n++) yield
        committed = true
        return true
      },
      result => results.push(result)
    )
    f.advance()
    if (change === 'manual-order') unit.dest = { i: 3, j: 3 }
    if (change === 'move') unit.i++
    if (change === 'space') unit.spaceId = 'interior'
    if (change === 'job') unit.autonomousJob = 'stone'
    if (change === 'death') unit.isDead = true
    if (change === 'rest') unit.shelterState = {}
    if (change === 'suspension') unit.suspended = true
    if (change === 'map') f.context.map = { grid: [] }
    f.drain()
    assert.equal(committed, false)
    assert.deepEqual(results, [false])
  })
}

test('real unreachable A* searches span frames and cached failures expire or clear on movement', t => {
  const f = fixture(t),
    unit = f.unit()
  for (const cell of f.context.map.grid[20]) cell.solid = true
  let slices = 0
  f.context.map.context = {
    performance: {
      record: () => {
        slices++
        f.addTime(0.4)
      },
    },
  }
  const target = { i: 30, j: 20, label: 'tree', type: 'Tree', size: 1 }
  const candidate = {
    target,
    action: 'chopwood',
    work: 'woodcutter',
    send: () => {
      throw Error('unreachable')
    },
  }
  let result
  f.runAutonomyPlan(
    unit,
    incremental => f.planVillagerJobCandidates(unit, 'wood', [candidate], { incremental, targetWorkerLoad: () => 0 }),
    value => {
      result = value
    }
  )
  const before = f.now()
  f.advance()
  assert.equal(result, undefined)
  assert.ok(slices > 0)
  assert.ok(f.now() - before <= 2.5)
  f.drain()
  assert.equal(result, false)
  const after = slices
  const retry = () => f.tryVillagerJobCandidates(unit, 'wood', [candidate], { targetWorkerLoad: () => 0 })
  retry()
  assert.equal(slices, after)
  f.addTime(8001)
  retry()
  assert.ok(slices > after)
  const expired = slices
  unit.j++
  retry()
  assert.ok(slices > expired)
})

test('a target that moves during an incremental search is not ordered or cached as unreachable', t => {
  const f = fixture(t),
    unit = f.unit()
  const target = { i: 30, j: 30, label: 'animal', size: 1 }
  let sent = 0
  const generator = f.planVillagerJobCandidates(
    unit,
    'wood',
    [{ target, action: 'hunt', work: 'hunter', send: () => sent++ }],
    { incremental: true, targetWorkerLoad: () => 0 }
  )
  generator.next() // Before candidate evaluation.
  generator.next() // Inside the contact route search.
  target.i--
  let step = generator.next()
  while (!step.done) step = generator.next()
  assert.equal(step.value, false)
  assert.equal(sent, 0)
  assert.equal(f.isVillagerWorkTargetRejected(unit, target), false)
})

test('destroy cancels pending callbacks once and unregisters the scheduler task', t => {
  const f = fixture(t),
    results = []
  f.runAutonomyPlan(
    f.unit(),
    function* () {
      yield
      return true
    },
    value => results.push(value)
  )
  f.queue.destroy()
  f.queue.destroy()
  assert.deepEqual(results, [false])
  assert.equal(f.tasks.size, 0)
})

test('a live completed plan reuses its path when issuing the order', t => {
  const f = fixture(t),
    unit = f.unit()
  const target = { i: 8, j: 8, label: 'tree', type: 'Tree', size: 1 }
  f.context.map.grid[8][8].solid = true
  let searches = 0,
    sends = 0
  f.context.map.context = { performance: { record: () => searches++ } }
  const candidate = {
    target,
    action: 'chopwood',
    work: 'woodcutter',
    send: () => {
      const before = searches
      const route = f.getInstanceClosestFreeCellPath(unit, target, f.context.map)
      assert.ok(route.length)
      assert.equal(searches, before)
      unit.dest = target
      unit.action = 'chopwood'
      sends++
    },
  }
  const results = []
  f.runAutonomyPlan(
    unit,
    incremental => f.planVillagerJobCandidates(unit, 'wood', [candidate], { incremental, targetWorkerLoad: () => 0 }),
    value => results.push(value)
  )
  assert.equal(sends, 0)
  f.drain()
  assert.equal(sends, 1)
  assert.deepEqual(results, [true])
})

test('a route blocked just before dispatch is skipped without a synchronous replacement search', t => {
  const f = fixture(t),
    unit = f.unit()
  const target = { i: 8, j: 8, label: 'tree', size: 1 }
  let checks = 0,
    searches = 0,
    beforeDispatch = 0,
    sent = 0
  f.context.map.context = { performance: { record: () => searches++ } }
  unit.getActionCondition = () => {
    if (++checks === 2) {
      beforeDispatch = searches
      f.context.map.grid[2][2].solid = true
    }
    return true
  }
  const candidate = { target, action: 'chopwood', work: 'woodcutter', send: () => sent++ }
  f.runAutonomyPlan(unit, incremental =>
    f.planVillagerJobCandidates(unit, 'wood', [candidate], { incremental, targetWorkerLoad: () => 0 })
  )
  f.drain()
  assert.equal(checks, 2)
  assert.equal(sent, 0)
  assert.equal(searches, beforeDispatch)
})

test('replanning clears the stopped activity so the same target can restart its work interval', t => {
  const f = fixture(t),
    unit = f.unit()
  const target = { i: 1, j: 2, label: 'tree', size: 1 }
  unit.dest = target
  unit.action = 'chopwood'
  unit.path = [{ i: 2, j: 1 }]
  let stopped = 0,
    restarted = 0
  unit.stopInterval = () => stopped++
  unit.isUnitAtDest = () => true
  const candidate = {
    target,
    action: 'chopwood',
    work: 'woodcutter',
    send: () => {
      if (unit.dest === target && unit.action === 'chopwood') return false
      restarted++
      unit.dest = target
      unit.action = 'chopwood'
    },
  }
  f.runAutonomyPlan(unit, incremental =>
    f.planVillagerJobCandidates(unit, 'wood', [candidate], { incremental, targetWorkerLoad: () => 0 })
  )
  assert.equal(stopped, 1)
  assert.equal(unit.action, null)
  assert.deepEqual(unit.path, [])
  f.drain()
  assert.equal(restarted, 1)
})

test('multiple pickup plans reach the exact ground cell and reuse their prepared routes', t => {
  const f = fixture(t, true)
  let searches = 0,
    completed = 0
  f.context.map.context = { performance: { record: () => searches++ } }
  f.context.performance = f.context.map.context.performance
  for (let n = 0; n < 6; n++) {
    const unit = f.unit()
    const target = { i: 30, j: 30 + n, type: 'GroundWood', size: 1 }
    f.context.map.grid[target.i][target.j].has = target
    f.runAutonomyPlan(unit, function* (incremental) {
      const route = yield* f.planResourceApproach(unit, target, '', incremental)
      assert.ok(route.length > 0)
      assert.equal(route.valid(), true)
      const before = searches
      route.commit(() => {
        // The same prepared-route consumer is used by the runtime order dispatcher.
        const path = f.getInstanceClosestFreeCellPath(unit, target, f.context.map)
        assert.equal(path[0].i, target.i)
        assert.equal(path[0].j, target.j)
        assert.equal(searches, before)
        completed++
      })
      return true
    })
  }
  assert.equal(completed, 0)
  f.drain()
  assert.equal(completed, 6)
  assert.ok(searches > 0)
})
