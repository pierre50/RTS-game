const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function scenario(t, size = 130) {
  let clock = 0,
    expanded = 0
  t.mock.method(performance, 'now', () => clock)
  const grid = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => ({ i, j })))
  const tasks = new Map()
  let id = 0
  const context = {
    map: { grid },
    scheduler: {
      elapsedMs: 0,
      add: (callback, interval, name, options) => {
        tasks.set(++id, { callback, options })
        return id
      },
      remove: key => tasks.delete(key),
    },
  }
  const mocks = {
    '../../lib/mapSpaces': { getEntitySpaceMapLike: (_unit, map) => map },
    '../../lib/units/unitSuspension': { isUnitSuspended: unit => Boolean(unit.suspended) },
    '../../lib/buildings/passageCells': {
      createReservedPassageCellLookup: () => new Set(),
      canUseReservedPassageCellForTransit: () => false,
    },
    '../../lib/units/village/villagerSchedule': {
      hasDailyRestSchedule: () => true,
      getDailyRoutinePhase: unit => unit.phase ?? 'evening',
    },
    './UnitRestState': {
      rememberRestState: (unit, state) =>
        (unit.shelterState = { previousDest: unit.shelterState?.previousDest ?? unit.dest, ...state }),
      stopUnitForRest: unit => {
        unit.path = []
        unit.stopped = true
      },
    },
    './UnitRestWake': {
      wakeUnitInstant: (unit, options) => {
        unit.shelterState = null
        unit.wakeMode = options.mode
      },
    },
    './UnitRestRules': {
      shouldRest: unit => !unit.danger && !unit.followingHero,
      isSleepTime: () => true,
      getNearestRestSite: () => {
        throw Error('live planning must not call the synchronous selector')
      },
    },
    './UnitRestTravel': { canReachRestWithPathLength: (unit, length) => length <= (unit.limit ?? Infinity) },
    './UnitRestRoute': { getRestRoute: (unit, to) => [{ from: grid[unit.i][unit.j], to }] },
    './UnitRestShelter': {
      getRestCandidates: unit => unit.candidates,
      getRestTargetTravelLimit: () => Infinity,
      getRestTargetSite: (_unit, target) => ({ restTarget: target, targetCell: target.cell }),
      isRestTargetAvailable: (_unit, target) => !target.taken,
      getCurrentOutsideRestSite: unit => ({ targetCell: grid[unit.i][unit.j] }),
    },
    '../lib/maths': {
      cellIsDiag: (a, b) => a.i !== b.i && a.j !== b.j,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
    },
    '../lib/grid/cells': {
      getSquareCellsAroundPoint: (x, y, cells, _distance, visit) => {
        expanded++
        clock += 0.005
        for (let i = x - 1; i <= x + 1; i++)
          for (let j = y - 1; j <= y + 1; j++) {
            if ((i !== x || j !== y) && cells[i]?.[j]) visit(cells[i][j])
          }
        return []
      },
    },
  }
  const moduleCache = new Map()
  const { RestPlanningQueue } = loadTsModule('app/services/rest/UnitRestPlanning.ts', { mocks, moduleCache })
  const { findInstancePath } = loadTsModule('app/services/Pathfinding.ts', { mocks, moduleCache })
  const queue = new RestPlanningQueue(context)
  const unit = candidates => ({ i: 0, j: 0, context, candidates, dest: null, action: null, path: [] })
  const advance = () => {
    context.scheduler.elapsedMs += 16.7 * 8
    queue.flush()
  }
  const drain = () => {
    for (let i = 0; tasks.size && i < 1000; i++) advance()
    assert.equal(tasks.size, 0)
  }
  return {
    grid,
    findInstancePath,
    queue,
    context,
    tasks,
    unit,
    advance,
    drain,
    expanded: () => expanded,
    clock: () => clock,
  }
}

test('unreachable searches yield, share one frame budget at 8x, and eventually fall back', t => {
  const s = scenario(t)
  for (const cell of s.grid[65]) cell.solid = true
  const target = { cell: s.grid[129][129] }
  let finished = 0
  for (let i = 0; i < 4; i++)
    s.queue.request(s.unit([target]), undefined, site => {
      assert.equal(site.restTarget, undefined)
      finished++
      return true
    })
  assert.equal(finished, 0)
  assert.ok(s.clock() < 2.5, `planning consumed ${s.clock()}ms`)
  const before = s.expanded()
  s.queue.flush()
  s.queue.flush()
  assert.equal(s.expanded(), before, 'catch-up callbacks cannot reset the frame budget')
  for (const task of s.tasks.values()) assert.equal(task.options.maxRunsPerTick, 1)
  s.drain()
  assert.equal(finished, 4)
})

test('a new order or morning cancels queued rest without applying its destination', t => {
  const s = scenario(t)
  for (const cell of s.grid[65]) cell.solid = true
  const target = { cell: s.grid[129][129] }
  const ordered = s.unit([target]),
    morning = s.unit([target])
  let committed = 0
  s.queue.request(ordered, undefined, () => {
    committed++
    return true
  })
  s.queue.request(morning, undefined, () => {
    committed++
    return true
  })
  const newOrder = { i: 2, j: 0 }
  ordered.dest = newOrder
  morning.phase = 'work'
  s.drain()
  assert.equal(committed, 0)
  assert.equal(ordered.dest, newOrder)
  assert.equal(ordered.wakeMode, 'order')
  assert.equal(morning.wakeMode, 'resume')
})

test('candidate search stops at the first reachable bed and skips impossible travel times', t => {
  const s = scenario(t, 20)
  const near = { cell: s.grid[2][2] },
    far = { cell: s.grid[19][19] }
  const resident = s.unit([far, near])
  resident.limit = 5
  let chosen
  s.queue.request(resident, undefined, site => {
    chosen = site.restTarget
    return true
  })
  s.drain()
  assert.equal(chosen, near)
  assert.ok(s.expanded() < 10)
})

test('destroy drops pending searches and their scheduler callback', t => {
  const s = scenario(t)
  for (const cell of s.grid[65]) cell.solid = true
  s.queue.request(s.unit([{ cell: s.grid[129][129] }]), undefined, () => {
    assert.fail('destroyed plan committed')
  })
  s.queue.destroy()
  s.advance()
  assert.equal(s.tasks.size, 0)
})

test('committing a rest destination reuses its computed route', t => {
  const s = scenario(t, 20)
  const target = { cell: s.grid[19][19] }
  const resident = s.unit([target])
  let applied = false
  s.queue.request(resident, undefined, site => {
    const before = s.expanded()
    const path = s.findInstancePath(resident, site.targetCell.i, site.targetCell.j, s.context.map)
    assert.equal(path[0], target.cell)
    assert.equal(s.expanded(), before, 'movement must consume the prepared route without another search')
    applied = true
    return true
  })
  s.drain()
  assert.equal(applied, true)
})

test('a bed reserved during a suspended search is rechecked before commitment', t => {
  const s = scenario(t)
  for (const cell of s.grid[65]) if (cell.j !== 0) cell.solid = true
  const target = { cell: s.grid[129][129] }
  const resident = s.unit([target])
  let selected = 'pending'
  s.queue.request(resident, undefined, site => {
    selected = site.restTarget
    return true
  })
  assert.equal(selected, 'pending')
  target.taken = true
  s.drain()
  assert.equal(selected, undefined)
})

test('a declined bed replacement preserves the previous rest state and walking path', t => {
  const s = scenario(t, 20)
  const resident = s.unit([])
  const oldState = {
    status: 'movingToRest',
    reason: 'sleep',
    targetCell: s.grid[3][3],
    previousDest: { label: 'work' },
  }
  const oldPath = [s.grid[3][3], s.grid[2][2], s.grid[1][1]]
  resident.shelterState = oldState
  resident.path = oldPath
  resident.setPath = path => {
    resident.path = path
  }
  s.queue.request(resident, undefined, () => false)
  s.drain()
  assert.equal(resident.shelterState, oldState)
  assert.deepEqual(resident.path, oldPath)
})
