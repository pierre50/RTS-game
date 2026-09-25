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
    ...loadTsModule('app/lib/units/villageActivity.ts', { mocks, moduleCache }),
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
