const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const grid = Array.from({ length: 32 }, (_, i) => Array.from({ length: 32 }, (_, j) => ({ i, j })))
  const context = { map: { grid }, scheduler: { elapsedMs: 0 } }
  const owner = { buildings: [], units: [] }
  const center = { type: 'TownCenter', owner, isBuilt: true, i: 10, j: 10, size: 3 }
  const fire = { type: 'FireCamp', owner, isBuilt: true, i: 20, j: 20, size: 1 }
  owner.buildings.push(center, fire)
  const calls = []
  const api = loadTsModule('app/lib/units/autonomy/villagerGathering.ts', {
    mocks: {
      '../buildings/passageCells': {
        canUnitUseCellAsIdleDestination: (_unit, cell) => !cell.solid && !cell.passage,
        createReservedPassageCellLookup: () => ({}),
      },
      '../economy/collectiveConstruction': { collectiveAnchor: () => center, belongsToSettlement: () => true },
      '../grid/movement': { getInstancePath: (_unit, i, j) => (grid[i][j].unreachable ? [] : [grid[i][j]]) },
      '../mapSpaces': { getEntitySpaceGrid: () => grid, sameMapSpace: (a, b) => a.spaceId === b.spaceId },
      './villagerAutonomyAvailability': {
        villagerAutonomySuspension: unit => unit.followingHero || unit.combatMode || unit.shelterState,
      },
    },
  })
  const addUnit = () => {
    const unit = {
      owner,
      context,
      i: 5,
      j: 5,
      inactif: true,
      sendToEvt(cell) {
        this.dest = cell
        this.inactif = false
        calls.push(cell)
      },
      stop() {
        this.dest = null
        this.inactif = true
      },
    }
    owner.units.push(unit)
    return unit
  }
  return { ...api, grid, context, owner, center, fire, calls, addUnit }
}

test('idle villagers prefer their fire, reserve spaced places and stay there', () => {
  const f = fixture()
  const a = f.addUnit()
  const b = f.addUnit()
  f.gatherIdleVillager(a)
  f.gatherIdleVillager(b)
  assert.equal(f.calls.length, 2)
  assert.ok(a.dest.i > 14 && a.dest.j > 14)
  assert.ok(Math.max(Math.abs(a.dest.i - b.dest.i), Math.abs(a.dest.j - b.dest.j)) >= 2)
  const cell = a.dest
  Object.assign(a, { i: cell.i, j: cell.j, dest: null, inactif: true })
  f.gatherIdleVillager(a)
  f.context.scheduler.elapsedMs = 60000
  f.gatherIdleVillager(a)
  assert.equal(f.calls.length, 2)
})

test('foreign or unfinished fires are ignored; the town center is the fallback', () => {
  for (const change of [{ owner: {} }, { isBuilt: false }, { isDestroyed: true }, { spaceId: 'interior' }]) {
    const f = fixture()
    Object.assign(f.fire, change)
    const unit = f.addUnit()
    f.gatherIdleVillager(unit)
    assert.ok(unit.dest.i < 15 && unit.dest.j < 15)
  }
})

test('unreachable and entrance cells are skipped and no anchor causes no movement', () => {
  const f = fixture()
  for (const row of f.grid)
    for (const cell of row) {
      if (cell.i > 14 || cell.j > 14) cell.unreachable = true
      if (cell.i === 7) cell.passage = true
    }
  const unit = f.addUnit()
  f.gatherIdleVillager(unit)
  assert.ok(unit.dest.i < 15 && unit.dest.j < 15)
  assert.notEqual(unit.dest.i, 7)
  const empty = fixture()
  empty.owner.buildings = []
  empty.gatherIdleVillager(empty.addUnit())
  assert.equal(empty.calls.length, 0)
})

test('combat, following, rest, work and manual movement are never replaced', () => {
  for (const extra of [
    { action: 'attack' },
    { followingHero: true },
    { combatMode: 'recover' },
    { shelterState: {} },
    { autonomousJob: 'food' },
    { collectiveTask: 'wood' },
    { inactif: false, dest: { i: 1, j: 1 } },
  ]) {
    const f = fixture()
    f.gatherIdleVillager(Object.assign(f.addUnit(), extra))
    assert.equal(f.calls.length, 0)
  }
  const f = fixture()
  const unit = f.addUnit()
  f.gatherIdleVillager(unit)
  assert.equal(f.isVillagerGathering(unit), true)
  unit.dest = { i: 1, j: 1 }
  assert.equal(f.isVillagerGathering(unit), false)
})

test('a destroyed gathering anchor releases its walkers and finds the town center', () => {
  const f = fixture()
  const unit = f.addUnit()
  f.gatherIdleVillager(unit)
  f.fire.isDestroyed = true
  f.gatherIdleVillager(unit)
  assert.equal(f.calls.length, 2)
  assert.ok(unit.dest.i < 15 && unit.dest.j < 15)
})

test('collective needs interrupt gathering while the villager is still walking', () => {
  for (const job of ['construction', 'food', 'wood']) {
    const f = fixture()
    const unit = Object.assign(f.addUnit(), { type: 'Villager' })
    let needed = false
    const site = { type: 'House' }
    unit.sendToBuilding = target => {
      unit.dest = target
      unit.action = 'build'
      unit.inactif = false
    }
    const { updateCollectiveVillage } = loadTsModule('app/services/CollectiveVillageWork.ts', {
      mocks: {
        '../lib/units/autonomy/villagerGathering': f,
        './CollectiveVillageEvents': { hasCollectiveVillageEvent: () => true, settleCollectiveVillageEvents: () => {} },
        '../lib/units/autonomy/villagerAutonomyAvailability': { villagerAutonomySuspension: () => null },
        '../lib/economy/collectiveTasks': {
          activeConstructionSite: () => null,
          planCollectiveTasks: (_owner, workers) =>
            new Map(needed ? workers.map(worker => [worker, { job, site }]) : []),
        },
        '../lib/units/autonomy/villagerAutonomy': {
          assignVillagerAutonomy: (worker, task) => {
            worker.action = task
            worker.dest = site
            worker.inactif = false
            return true
          },
        },
      },
    })
    updateCollectiveVillage(f.owner)
    assert.equal(f.isVillagerGathering(unit), true)
    assert.equal(unit.inactif, false)
    needed = true
    updateCollectiveVillage(f.owner)
    assert.equal(f.isVillagerGathering(unit), false)
    assert.equal(unit.dest, site)
    assert.equal(unit.collectiveTask, job)
  }
})
