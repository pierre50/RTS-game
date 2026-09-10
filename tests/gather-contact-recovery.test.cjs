const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const targeting = loadTsModule('app/lib/units/villagerAutonomyTargeting.ts', {
  mocks: {
    '../buildings/passageCells': {},
    '../grid/movement': {},
    './autonomy/villagerJobDiagnostics': { logGoldMinerFlow: () => {} },
  },
})
const { tryStartUnitContactApproach } = loadTsModule('app/classes/unit/movement/UnitContactApproach.ts', {
  mocks: {
    '../../../lib/units/villagerAutonomyTargeting': targeting,
    '../../../lib/units/unitControl': { isHeroControlled: () => false },
    '../../../lib/mapSpaces': { sameMapSpace: () => true },
    '../../../lib/actions/contactActions': {
      usesUnitContactAction: () => true,
      isWorkContactAction: () => true,
      sampleActionApproach: (unit, target) => ({
        point: { x: target.x, y: 0 },
        degree: 180,
        distance: target.x - unit.x,
        reachable: target.x - unit.x <= 20,
      }),
    },
  },
})

function harness(move = () => false) {
  const target = { family: 'resource', type: 'Tree', label: 'tree-a', x: 50, y: 0, i: 1, j: 1 }
  let tick
  let probes = 0
  let reroutes = 0
  let arrivals = 0
  const unit = {
    type: 'Villager',
    family: 'unit',
    work: 'woodcutter',
    action: 'chopwood',
    x: 0,
    y: 0,
    i: 0,
    j: 0,
    speed: 2,
    dest: target,
    sprite: { stop() {} },
    moveDirect(dx, dy, step) {
      probes++
      return move(this, dx, dy, step)
    },
    getActionCondition: () => true,
    setDest(target) {
      this.dest = target
    },
    startInterval(callback) {
      tick = callback
      this.interval = 1
    },
    stopInterval() {
      tick = null
      this.interval = null
    },
    getAction() {
      arrivals++
    },
    affectNewDest() {
      reroutes++
    },
    sendToEvt() {
      throw new Error('must not repath to the congested resource')
    },
  }
  return {
    unit,
    target,
    start: () => tryStartUnitContactApproach(unit, target, 'chopwood'),
    run(count) {
      for (let i = 0; tick && i < count; i++) tick()
    },
    counts: () => ({ probes, reroutes, arrivals }),
  }
}

test('blocked gatherers wait briefly, then reject the resource without repeatedly restarting pathfinding', () => {
  const h = harness()
  assert.equal(h.start(), true)
  h.run(20)
  assert.equal(h.counts().reroutes, 0)
  assert.ok(h.counts().probes <= 5)
  h.run(20)
  assert.equal(h.counts().reroutes, 1)
  assert.equal(targeting.isVillagerWorkTargetRejected(h.unit, h.target), true)
  assert.equal(h.start(), false)
})

test('a passing blocker can clear before rejection, letting the worker reach the resource', () => {
  let blocked = true
  const h = harness((unit, dx, _dy, step) => {
    if (blocked) return false
    unit.x += dx * step
    return true
  })
  h.start()
  h.run(10)
  blocked = false
  h.run(50)
  assert.equal(h.counts().arrivals, 1)
  assert.equal(h.counts().reroutes, 0)
  assert.equal(targeting.isVillagerWorkTargetRejected(h.unit, h.target), false)
})

test('successful lateral movements without net progress also abandon the congested approach', () => {
  const h = harness(unit => {
    unit.y = unit.y === 0 ? 1 : 0
    return true
  })
  h.start()
  h.run(40)
  assert.equal(h.counts().reroutes, 1)
  assert.equal(h.counts().arrivals, 0)
})

test('new orders and death cancel the wait without rejecting targets or assigning new work', () => {
  for (const change of [
    unit => {
      unit.action = null
    },
    unit => {
      unit.isDead = true
    },
  ]) {
    const h = harness()
    h.start()
    change(h.unit)
    h.run(40)
    assert.equal(h.counts().reroutes, 0)
    assert.equal(targeting.isVillagerWorkTargetRejected(h.unit, h.target), false)
  }
})

test('classic group gathering selects another accessible resource and excludes the blocked target', () => {
  const workers = Array.from({ length: 4 }, () => harness())
  const resources = workers.map((h, i) => ({ ...h.target, label: `free-${i}`, x: 70 + i * 10 }))
  const blockedTarget = workers[0].target
  const taken = new Set()
  const { affectNewDest } = loadTsModule('app/classes/unit/movement/UnitAffectNewDest.ts', {
    mocks: {
      '../../../lib/units/villagerAutonomyTargeting': targeting,
      './playerTargetKnowledge': {
        playerSeesTarget: () => true,
        observeTarget() {},
      },
      '../../../lib/units/unitControl': { isHeroControlled: () => false },
      './UnitMovementHelpers': { isRuntimeEntity: value => Boolean(value?.family) },
      '../../../lib': {
        findInstancesInSight: (_unit, filter) => [blockedTarget, ...resources].filter(filter),
        getClosestInstanceWithPath: (_unit, candidates) => {
          assert.ok(!candidates.includes(blockedTarget))
          const target = candidates.find(candidate => !taken.has(candidate))
          if (!target) return null
          taken.add(target)
          return { instance: target, path: [{ i: 2, j: 2 }] }
        },
        instanceContactInstance: () => false,
      },
    },
  })
  for (const h of workers) {
    h.unit.dest = blockedTarget
    h.unit.setPath = path => {
      h.unit.path = path
    }
    h.unit.affectNewDest = () => affectNewDest(h.unit)
    tryStartUnitContactApproach(h.unit, blockedTarget, 'chopwood')
  }
  for (let i = 0; i < 40; i++) for (const h of workers) h.run(1)
  assert.equal(taken.size, 4)
  for (const h of workers) {
    assert.notEqual(h.unit.dest, blockedTarget)
    assert.equal(h.unit.action, 'chopwood')
    assert.equal(h.unit.path.length, 1)
  }
})

test('accepting another autonomous target preserves rejection until its timeout expires', t => {
  const previousPerformance = global.performance
  let now = 100
  global.performance = { now: () => now }
  t.after(() => {
    global.performance = previousPerformance
  })
  const h = harness()
  targeting.markVillagerAutonomyTargetRejected(h.unit, h.target)
  const other = { ...h.target, label: 'tree-b' }
  const accepted = targeting.tryVillagerJobCandidates(
    h.unit,
    'wood',
    [
      {
        target: other,
        action: 'chopwood',
        work: 'woodcutter',
        send: target => {
          h.unit.dest = target
          return true
        },
      },
    ],
    { targetWorkerLoad: () => 0 }
  )
  assert.equal(accepted, true)
  assert.equal(targeting.isVillagerWorkTargetRejected(h.unit, h.target), true)
  now += 8001
  assert.equal(targeting.isVillagerWorkTargetRejected(h.unit, h.target), false)
})

test('without another reachable resource, classic gathering stops instead of retrying the rejected tree', () => {
  const h = harness()
  let stopped = 0
  const { affectNewDest } = loadTsModule('app/classes/unit/movement/UnitAffectNewDest.ts', {
    mocks: {
      '../../../lib/units/villagerAutonomyTargeting': targeting,
      './playerTargetKnowledge': {
        playerSeesTarget: () => true,
        observeTarget() {},
      },
      '../../../lib/units/unitControl': { isHeroControlled: () => false },
      './UnitMovementHelpers': { isRuntimeEntity: value => Boolean(value?.family) },
      '../../../lib': {
        findInstancesInSight: (_unit, filter) => [h.target].filter(filter),
        resumeVillagerAutonomy: () => false,
        showConfusionFeedback: () => {},
      },
    },
  })
  h.unit.stop = () => {
    stopped++
  }
  h.unit.affectNewDest = () => affectNewDest(h.unit)
  h.start()
  h.run(100)
  assert.equal(stopped, 1)
  assert.equal(h.counts().arrivals, 0)
  assert.equal(h.start(), false)
})
