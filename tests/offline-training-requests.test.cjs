const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { advanceOfflineTrainingRequests } = loadTsModule('app/services/world/OfflineTrainingRequests.ts', {
  mocks: {
    '../../lib/chief': { playerNeedsChiefForCommand: () => false, hasLivingChief: () => true },
    '../../lib/units/villagerSchedule': { getVillagerWorkingMinutes: (_unit, from, to) => to - from },
    './OfflineWorldWork': { travelMs: () => 9000 },
  },
})
function fixture() {
  const building = {
    type: 'Barracks',
    label: 'b',
    i: 0,
    j: 0,
    isBuilt: true,
    trainingRequests: [{ type: 'Fantassin' }],
  }
  const player = {
    buildings: [building],
    units: [
      { type: 'Villager', label: 'near', i: 1, j: 0 },
      { type: 'Villager', label: 'far', i: 3, j: 0 },
    ],
  }
  const spatial = { findNear: () => ({ i: 0, j: 1 }), reachable: unit => unit.label !== 'near', release: () => {} }
  const rules = { buildingConfig: () => ({ units: ['Fantassin'] }), unitConfig: () => ({ trainingDays: 3 }) }
  return {
    building,
    player,
    run(from, to) {
      advanceOfflineTrainingRequests(player, 0, 2, from, to, 1000, spatial, rules)
    },
  }
}

test('offline requests skip unreachable recruits and preserve the remaining travel time across saves', () => {
  const f = fixture()
  f.run(0, 4)
  assert.equal(f.building.trainingRequests[0].traineeLabel, 'far')
  assert.equal(f.building.trainingRequests[0].travelRemainingMs, 6000)
  f.building.trainingRequests = JSON.parse(JSON.stringify(f.building.trainingRequests))
  f.run(4, 9)
  assert.equal(f.building.trainingQueue, undefined)
  f.run(9, 10)
  assert.equal(f.building.trainingQueue.length, 1)
  assert.equal(f.building.trainingQueue[0].trainingStartedDay, 2)
  assert.equal(f.building.trainingQueue[0].trainingCompleteDay, 5)
})

test('saved incoming recruits wait at a full building rather than exceeding five trainees', () => {
  const f = fixture()
  f.run(0, 4)
  f.building.trainingQueue = Array.from({ length: 5 }, () => ({ type: 'Fantassin' }))
  f.run(4, 20)
  assert.equal(f.building.trainingQueue.length, 5)
  assert.equal(f.building.trainingRequests.length, 1)
  f.building.trainingQueue.pop()
  f.run(20, 21)
  assert.equal(f.building.trainingQueue.length, 5)
  assert.equal(f.building.trainingRequests.length, 0)
})

test('offline recruitment leaves heroes, followers, fighters and occupied transports alone', () => {
  for (const extra of [
    { followingHero: true },
    { controlMode: 'hero' },
    { action: 'attack' },
    { isFleeing: true },
    { resourceDelivery: {} },
    { spaceId: 'interior' },
    { cavePosition: { caveId: 'cave', i: 0, j: 0 } },
  ]) {
    const f = fixture()
    Object.assign(f.player.units[1], extra)
    f.run(0, 30)
    assert.equal(f.building.trainingQueue, undefined)
    assert.equal(f.building.trainingRequests[0].traineeLabel, undefined)
  }
})
