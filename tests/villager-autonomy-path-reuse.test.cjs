const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const moduleCache = new Map()
  let searches = 0
  let lookups = 0
  const maps = {
    getEntitySpaceMapLike: (_unit, map) => map,
    sameCellMapSpace: () => true,
    sameMapSpace: () => true,
  }
  const mocks = {
    '../mapSpaces': maps,
    '../../mapSpaces': maps,
    '../../../classes/resources/CompactResourceSet': { resolveResource: target => target },
    '../playerTargetKnowledge': { knownTarget: (_owner, target) => target },
    '../combat/targetPursuit': { isPursuingRememberedTarget: () => false },
    './villagerDropoffDistance': { nearestDropoffDistance: () => 0 },
    '../../buildings/passageCells': {
      createReservedPassageCellLookup: () => {
        lookups++
        return { has: () => false }
      },
      canUnitUseCellAsIdleDestination: () => true,
      canUseReservedPassageCellForTransit: () => false,
    },
  }
  const load = file => loadTsModule(file, { moduleCache, mocks })
  const movement = load('app/lib/grid/movement.ts')
  const prepared = load('app/lib/grid/preparedContactPath.ts')
  const targeting = load('app/lib/units/autonomy/villagerAutonomyTargeting.ts')
  const grid = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => ({ i, j })))
  const map = { grid, context: { performance: { record: () => searches++ } } }
  const unit = { i: 0, j: 0, context: { map }, getActionCondition: () => true }
  const target = { i: 6, j: 6, size: 1, label: 'tree', type: 'Tree', hitPoints: 10 }
  grid[6][6].solid = true
  return { ...movement, ...prepared, ...targeting, unit, target, map, searches: () => searches, lookups: () => lookups }
}

test('autonomy dispatch reuses the selected contact path without a second search', () => {
  const f = fixture()
  let beforeSend
  const candidate = {
    action: 'chopwood',
    work: 'woodcutter',
    target: f.target,
    send: target => {
      beforeSend = f.searches()
      assert.ok(f.getInstanceClosestFreeCellPath(f.unit, target, f.map).length)
      assert.equal(f.searches(), beforeSend)
      f.unit.dest = target
      f.unit.action = 'chopwood'
    },
  }
  assert.equal(f.tryVillagerJobCandidates(f.unit, 'wood', [candidate], { targetWorkerLoad: () => 0 }), true)
  assert.ok(beforeSend > 0)
  f.getInstanceClosestFreeCellPath(f.unit, f.target, f.map)
  assert.ok(f.searches() > beforeSend)
})

test('invalid actions do not build passages or search routes; valid candidates share one lookup', () => {
  const f = fixture()
  const candidates = [f.target, { ...f.target, i: 5, label: 'other' }].map(target => ({
    target,
    action: 'chopwood',
    work: 'woodcutter',
    send: () => false,
  }))
  f.unit.getActionCondition = () => false
  f.tryVillagerJobCandidates(f.unit, 'wood', candidates, { targetWorkerLoad: () => 0 })
  assert.equal(f.searches(), 0)
  assert.equal(f.lookups(), 0)
  f.unit.getActionCondition = () => true
  f.tryVillagerJobCandidates(f.unit, 'wood', candidates, { targetWorkerLoad: () => 0 })
  assert.ok(f.searches() > 0)
  assert.equal(f.lookups(), 1)
})

for (const change of ['obstacle', 'diagonal', 'target', 'start', 'grid', 'passage']) {
  test(`prepared route falls back after changing ${change}`, () => {
    const f = fixture()
    const path = f.getInstanceClosestFreeCellPath(f.unit, f.target, f.map)
    const commit = f.prepareContactPath(f.unit, f.target, f.map, path)
    let allowed
    if (change === 'obstacle') path[1].solid = true
    if (change === 'diagonal') f.map.grid[0][1].solid = true
    if (change === 'target') f.target.i--
    if (change === 'start') f.unit.i++
    if (change === 'grid') f.map.grid = f.map.grid.map(row => row.map(cell => ({ ...cell })))
    if (change === 'passage') allowed = () => false
    const before = f.searches()
    commit(() => {
      assert.equal(f.takePreparedContactPath(f.unit, f.target, f.map, allowed), null)
      f.getInstanceClosestFreeCellPath(f.unit, f.target, f.map)
    })
    assert.ok(f.searches() > before)
  })
}

test('prepared routes are isolated from other targets and cleared even when sending throws', () => {
  const f = fixture()
  const path = f.getInstanceClosestFreeCellPath(f.unit, f.target, f.map)
  const commit = f.prepareContactPath(f.unit, f.target, f.map, path)
  assert.throws(
    () =>
      commit(() => {
        assert.equal(f.takePreparedContactPath(f.unit, { ...f.target }, f.map), null)
        throw new Error('cancel')
      }),
    /cancel/
  )
  assert.equal(f.takePreparedContactPath(f.unit, f.target, f.map), null)
})
