const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { requestBuildingTraining, dispatchTrainingRequests, completeTrainingRequest, cancelBuildingTrainingRequest } =
  loadTsModule('app/lib/training/trainingRequests.ts', {
    mocks: {
      '../units/villagerSchedule': { shouldVillagerWork: () => true },
      '../units/unitSuspension': { wakeUnitSimulation: () => {} },
    },
  })
function fixture(count = 10) {
  const owner = {
    label: 'player',
    units: [],
    buildings: [],
    config: { units: { Fantassin: { category: 'Infantry' }, Priest: { category: 'Civilian' } } },
  }
  const building = {
    label: 'barracks',
    type: 'Barracks',
    isBuilt: true,
    i: 0,
    j: 0,
    units: ['Fantassin'],
    owner,
    queue: [],
    trainingQueue: [],
  }
  owner.buildings.push(building)
  for (let index = 0; index < count; index++) {
    const unit = {
      label: `v${index}`,
      type: 'Villager',
      i: index + 1,
      j: 0,
      owner,
      action: 'chopwood',
      autonomousJob: 'wood',
      collectiveTask: 'wood',
      sendToEvt(dest, action) {
        this.dest = dest
        this.action = action
      },
    }
    owner.units.push(unit)
  }
  return { owner, building }
}
function enter(building, unit) {
  building.trainingQueue.push({ type: unit.trainingTargetType, trainee: { label: unit.label } })
  building.owner.units.splice(building.owner.units.indexOf(unit), 1)
  completeTrainingRequest(building, unit.label)
}
test('ten requests reserve five places including incoming recruits and release the next batch only after completion', () => {
  const { owner, building } = fixture()
  assert.equal(requestBuildingTraining(building, 'Fantassin', 10), true)
  assert.equal(building.trainingRequests.filter(request => request.traineeLabel).length, 5)
  for (const unit of [...owner.units].filter(unit => unit.trainingTargetType)) enter(building, unit)
  dispatchTrainingRequests(owner)
  assert.equal(building.trainingQueue.length, 5)
  assert.equal(building.trainingRequests.length, 5)
  assert.equal(
    owner.units.some(unit => unit.trainingTargetType),
    false
  )
  building.trainingQueue.splice(0, 1)
  dispatchTrainingRequests(owner)
  assert.equal(owner.units.filter(unit => unit.trainingTargetType).length, 1)
  dispatchTrainingRequests(owner)
  assert.equal(owner.units.filter(unit => unit.trainingTargetType).length, 1)
})
test('combat and following take priority; interrupted recruitment remains queued', () => {
  const { owner, building } = fixture(3)
  owner.units[0].action = 'attack'
  owner.units[1].followingHero = true
  requestBuildingTraining(building, 'Fantassin', 3)
  assert.equal(owner.units[0].trainingTargetType, undefined)
  assert.equal(owner.units[1].trainingTargetType, undefined)
  assert.equal(owner.units[2].trainingTargetType, 'Fantassin')
  owner.units[2].action = 'attack'
  owner.units[2].dest = { label: 'enemy' }
  dispatchTrainingRequests(owner)
  assert.equal(building.trainingRequests.length, 3)
  assert.equal(
    building.trainingRequests.some(request => request.traineeLabel),
    false
  )
  assert.equal(owner.units[2].action, 'attack')
})
test('several buildings never recruit the same villager and the temple accepts priest requests', () => {
  const { owner, building } = fixture(6)
  const temple = {
    ...building,
    type: 'Temple',
    label: 'temple',
    units: ['Priest'],
    trainingQueue: [],
    trainingRequests: [],
  }
  owner.buildings.push(temple)
  requestBuildingTraining(building, 'Fantassin', 5)
  requestBuildingTraining(temple, 'Priest', 5)
  assert.equal(temple.trainingRequests.filter(request => request.traineeLabel).length, 1)
  assert.equal(
    new Set(
      [...building.trainingRequests, ...temple.trainingRequests].map(request => request.traineeLabel).filter(Boolean)
    ).size,
    6
  )
})
test('missing recruits and rejected paths keep requests pending without consuming places', () => {
  const { owner, building } = fixture(1)
  owner.units[0].sendToEvt = () => false
  requestBuildingTraining(building, 'Fantassin', 10)
  assert.equal(building.trainingRequests.length, 10)
  assert.equal(
    building.trainingRequests.some(request => request.traineeLabel),
    false
  )
  assert.equal(owner.units[0].trainingTargetType, null)
})
test('saving and reloading incoming reservations does not dispatch duplicate recruits', () => {
  const { owner, building } = fixture()
  requestBuildingTraining(building, 'Fantassin', 10)
  building.trainingRequests = JSON.parse(JSON.stringify(building.trainingRequests))
  dispatchTrainingRequests(owner)
  assert.equal(owner.units.filter(unit => unit.trainingTargetType).length, 5)
  assert.equal(building.trainingRequests.length, 10)
})

test('mounted training waits for horses instead of repeatedly recalling soldiers to an empty stable', () => {
  const { owner, building } = fixture(2)
  building.type = 'Stable'
  building.stableHorses = []
  owner.units.forEach(unit => {
    unit.type = 'Fantassin'
    unit.action = null
  })
  requestBuildingTraining(building, 'Fantassin', 2)
  assert.equal(
    building.trainingRequests.some(request => request.traineeLabel),
    false
  )
  building.stableHorses.push({ horseColor: 'brown', tamingStatus: 'tamed' })
  dispatchTrainingRequests(owner)
  assert.equal(building.trainingRequests.filter(request => request.traineeLabel).length, 1)
})

test('cancelling an incoming request releases only its recruit and does not overwrite combat', () => {
  const { building, owner } = fixture(2)
  requestBuildingTraining(building, 'Fantassin', 2)
  const request = building.trainingRequests[0]
  const unit = owner.units.find(unit => unit.label === request.traineeLabel)
  let stopped = 0
  unit.stop = () => {
    stopped++
    unit.action = null
    unit.dest = null
  }
  cancelBuildingTrainingRequest(building, request)
  assert.equal(stopped, 1)
  assert.equal(unit.trainingTargetType, null)
  assert.equal(building.trainingRequests.length, 1)
  const other = owner.units.find(unit => unit.label === building.trainingRequests[0].traineeLabel)
  other.action = 'attack'
  other.stop = () => assert.fail('combat must not be stopped')
  cancelBuildingTrainingRequest(building, building.trainingRequests[0])
  assert.equal(other.action, 'attack')
  assert.equal(building.trainingRequests.length, 0)
})


test('renovation blocks recruitment and dispatch until the building reopens', () => {
  const { owner, building } = fixture(1)
  building.buildingUpgrade = { targetLevel: 1 }
  assert.equal(requestBuildingTraining(building, 'Fantassin', 1), false)
  assert.equal(building.trainingRequests, undefined)
  building.trainingRequests = [{ type: 'Fantassin' }]
  dispatchTrainingRequests(owner)
  assert.equal(owner.units[0].trainingTargetType, undefined)
  delete building.buildingUpgrade
  dispatchTrainingRequests(owner)
  assert.equal(owner.units[0].trainingTargetType, 'Fantassin')
})
