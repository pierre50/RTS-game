const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const advances = []
  const moduleCache = new Map()
  const mocks = {
    './VillageWorkSimulation': {
      advanceVillageWork(_context, home, owner, units, ms, from) {
        advances.push({ home, owner, units, ms, from })
      },
    },
    '../../lib/units/unitEnergy': { cancelEnergyWait() {}, updateUnitEnergy() {} },
  }
  const { PlayerWorkActivitySystem } = loadTsModule('app/services/world/PlayerWorkActivitySystem.ts', {
    mocks,
    moduleCache,
  })
  const rules = {
    ...loadTsModule('app/lib/units/village/villageActivity.ts', { mocks, moduleCache }),
    ...loadTsModule('app/lib/units/unitSuspension.ts', { mocks, moduleCache }),
  }
  const owner = { isPlayed: true, units: [], buildings: [] }
  const hero = { type: 'Hero', i: 500, j: 500 }
  const context = {
    players: [owner],
    map: { grid: [], spaces: new Map() },
    controls: { heroUnit: hero, instanceInCamera: () => false },
    scheduler: { elapsedMs: 0 },
  }
  const unit = {
    owner,
    label: 'worker',
    type: 'Villager',
    i: 50,
    j: 50,
    work: 'woodcutter',
    action: 'chopwood',
    dest: { i: 51, j: 50 },
    path: [],
    sendToEvt() {
      this.resumed = true
    },
  }
  owner.units.push(unit)
  const system = new PlayerWorkActivitySystem(context)
  return { system, context, unit, hero, advances, rules }
}
test('player worker sleeps without a town center, settles only on flush and resumes on hero arrival', () => {
  const { system, context, unit, hero, advances, rules } = fixture()
  system.update()
  assert.equal(rules.isUnitSuspended(unit), true)
  context.scheduler.elapsedMs = 5000
  system.update()
  assert.equal(advances.length, 0)
  system.flush()
  system.flush()
  assert.deepEqual(
    advances.map(a => a.ms),
    [5000]
  )
  context.scheduler.elapsedMs = 6000
  Object.assign(hero, { i: 50, j: 50 })
  system.update()
  assert.deepEqual(
    advances.map(a => a.ms),
    [5000, 1000]
  )
  assert.equal(rules.isUnitSuspended(unit), false)
  assert.equal(unit.resumed, true)
})
test('camera, combat and explicit wake settle work without replaying previous time', () => {
  for (const reason of ['camera', 'combat', 'order']) {
    const { system, context, unit, advances, rules } = fixture()
    system.update()
    context.scheduler.elapsedMs = 1000
    if (reason === 'camera') context.controls.instanceInCamera = () => true
    else if (reason === 'combat') context.players.push({ units: [{ action: 'attack', i: 51, j: 50 }] })
    else rules.wakeUnitSimulation(unit)
    system.update()
    assert.equal(rules.isUnitSuspended(unit), false, reason)
    assert.deepEqual(
      advances.map(a => a.ms),
      [1000]
    )
    system.destroy()
    assert.equal(advances.length, 1)
  }
})
test('hero, followers, training and routes outside the snapshot stay in the live runtime', () => {
  for (const patch of [
    { controlMode: 'hero' },
    { followingHero: true },
    { trainingTargetType: 'Soldier' },
    { dest: { i: 200, j: 50 } },
    { resourceDeliveryState: {} },
  ]) {
    const { system, unit, rules } = fixture()
    Object.assign(unit, patch)
    system.update()
    assert.equal(rules.isUnitSuspended(unit), false)
  }
})
test('failed settlement keeps the previous checkpoint for retry', () => {
  const { system, context, unit, advances, rules } = fixture()
  system.update()
  context.scheduler.elapsedMs = 1000
  const original = advances.push
  advances.push = () => {
    throw new Error('failed')
  }
  assert.throws(() => rules.wakeUnitSimulation(unit), /failed/)
  assert.equal(rules.isUnitSuspended(unit), true)
  advances.push = original
  rules.wakeUnitSimulation(unit)
  assert.equal(advances[0].ms, 1000)
})

test('idle autonomous villagers enter catch-up without a pre-existing job', () => {
  const { system, context, unit, rules, advances } = fixture()
  Object.assign(unit, { work: null, action: null, dest: null, autonomousJob: null, inactif: true })
  system.update()
  assert.equal(rules.isUnitSuspended(unit), true)
  context.scheduler.elapsedMs = 5000
  system.flush()
  assert.equal(advances[0].ms, 5000)
})

test('workers sharing stocks settle together and newcomers do not receive earlier work', () => {
  const { system, context, unit, advances } = fixture()
  system.update()
  context.scheduler.elapsedMs = 1000
  const second = { ...unit, label: 'second', i: 49 }
  unit.owner.units.push(second)
  system.update()
  assert.deepEqual(
    advances.map(a => [a.ms, a.units.length]),
    [[1000, 1]]
  )
  context.scheduler.elapsedMs = 4000
  system.flush()
  assert.deepEqual(
    advances.map(a => [a.ms, a.units.length]),
    [
      [1000, 1],
      [3000, 2],
    ]
  )
  system.flush()
  assert.equal(advances.length, 2)
})

test('a remote supply trip stays live at the resource, on return and with no target', () => {
  for (const stage of ['harvest', 'return', 'blocked']) {
    const { system, unit, rules } = fixture()
    Object.assign(unit, {
      collectiveTask: 'wood',
      collectiveHome: { i: 200, j: 50, spaceId: 'outside' },
      autonomousJob: 'wood',
    })
    if (stage === 'return')
      Object.assign(unit, { collectiveTask: 'construction', action: 'build', dest: { i: 200, j: 50 } })
    if (stage === 'blocked') Object.assign(unit, { dest: null, action: null, autonomyBlockedJob: 'wood' })
    system.update()
    assert.equal(rules.isUnitSuspended(unit), false, stage)
  }
})

test('distant depots, delivery return targets and paths leaving the snapshot keep workers live', () => {
  for (const reason of ['depot', 'return', 'detour']) {
    const { system, unit, rules } = fixture()
    if (reason === 'depot') unit.owner.buildings.push({ type: 'StoragePit', i: 200, j: 50, isBuilt: true })
    if (reason === 'return')
      unit.resourceDeliveryState = {
        pickup: { wood: 10 },
        building: { i: 51, j: 50 },
        returnTask: { dest: { i: 200, j: 50 } },
      }
    if (reason === 'detour')
      unit.path = [
        { i: 50, j: 90 },
        { i: 51, j: 50 },
      ]
    const path = unit.path
    system.update()
    assert.equal(rules.isUnitSuspended(unit), false, reason)
    assert.equal(unit.path, path, 'live travel must not lose its path')
  }
})

test('a complete local supply loop can still be simulated', () => {
  const { system, unit, rules } = fixture()
  Object.assign(unit, { collectiveTask: 'wood', collectiveHome: { i: 45, j: 50, spaceId: 'outside' } })
  unit.owner.buildings.push({ type: 'StoragePit', i: 46, j: 50, isBuilt: true })
  system.update()
  assert.equal(rules.isUnitSuspended(unit), true)
})

test('a new distant return depot wakes a simulated worker without replaying elapsed time', () => {
  const { system, context, unit, rules, advances } = fixture()
  system.update()
  context.scheduler.elapsedMs = 1000
  unit.owner.buildings.push({ type: 'StoragePit', i: 200, j: 50, isBuilt: true })
  system.update()
  assert.equal(rules.isUnitSuspended(unit), false)
  assert.deepEqual(
    advances.map(a => a.ms),
    [1000]
  )
  system.update()
  assert.equal(advances.length, 1)
})

test('a second settlement does not disable simulation of a complete local collective loop', () => {
  const { system, unit, rules } = fixture()
  Object.assign(unit, { collectiveTask: 'wood', collectiveHome: { i: 45, j: 50, spaceId: 'outside' } })
  unit.owner.buildings.push(
    { type: 'StoragePit', i: 46, j: 50, isBuilt: true },
    { type: 'StoragePit', i: 250, j: 250, isBuilt: true }
  )
  system.update()
  assert.equal(rules.isUnitSuspended(unit), true)
})
