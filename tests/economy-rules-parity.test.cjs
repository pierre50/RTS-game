const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const load = file => loadTsModule(file, { moduleCache: cache })
const live = load('app/classes/unit/UnitResourceGathering.ts')
const { advanceOfflineWorker } = load('app/services/world/offline/OfflineWorldWork.ts')
const { advanceConstruction, getResourceGatherSwings } = load('app/lib/economy/workRules.ts')
const { getBuildRateXpMultiplier } = load('app/lib/units/unitExperience.ts')
const { updateTrainingEntryProgress } = load('app/classes/building/BuildingTrainingProgress.ts')
const { completeOfflineTraining } = load('app/services/world/offline/OfflineWorldTraining.ts')
const { getWorkCycleMs } = load('app/lib/economy/workTiming.ts')
const { getUnitSpritesheetAnimationSpeed } = load('app/lib/entities/spriteTextures.ts')
const { getConfiguredActionFrameSequence } = load('app/lib/animations/actionFrameSequences.ts')
const { getVillagerWorkingMinutes, shouldVillagerWork } = load('app/lib/units/villagerSchedule.ts')

function fixture() {
  const worker = { type: 'Villager', label: 'worker', i: 0, j: 0, work: 'woodcutter', autonomousJob: 'wood' }
  const tree = { type: 'Tree', label: 'tree', i: 0, j: 0, quantity: 1000, hitPoints: 0 }
  const center = { type: 'TownCenter', label: 'center', i: 0, j: 0, isBuilt: true, inventory: { resources: {} } }
  const player = { type: 'Human', label: 'p', units: [worker], buildings: [center] }
  const state = { players: [player], resources: [tree], animals: [] }
  const spatial = {
    entity: () => tree,
    reachable: () => true,
    findNear: target => ({ i: target.i, j: target.j }),
    move: (unit, point) => Object.assign(unit, point),
    reserve() {},
    release() {},
  }
  const config = { gatherAmount: { woodcutter: 2 }, speed: 1.5 }
  const rules = {
    unitConfig: () => config,
    buildingConfig: () => ({ totalHitPoints: 100, constructionTime: 25 }),
    cycleMs: () => 1000,
    buildingCapacity: () => 0,
    wheatMatureFrame: 0,
  }
  const report = { gathered: {}, buildingsCompleted: 0, resourcesDepleted: 0, trainingsCompleted: 0 }
  return { worker, tree, center, player, state, spatial, config, rules, report }
}

test('animated and simulated gathering use the same amount, impact count and saved bonus', () => {
  for (const experience of [undefined, { woodcutting: 600 }]) {
    const f = fixture()
    f.worker.experience = experience
    const animated = { ...f.worker, gatherAmount: f.config.gatherAmount }
    let wood = 0
    for (let impact = 0; impact < 10; impact++) {
      if (live.shouldReleaseGatheredResource(animated, f.tree, 'wood')) wood += live.getGatherAmount(animated)
    }
    advanceOfflineWorker(f.state, f.player, 0, f.worker, 10000, 1, f.spatial, f.rules, f.report)
    assert.equal(f.report.gathered.wood, wood)
    assert.equal(f.tree.quantity + wood, 1000)
  }
})

test('construction advances identically in individual impacts and catch-up, including saved experience', () => {
  const f = fixture()
  const building = { type: 'House', label: 'house', i: 0, j: 0, hitPoints: 1, totalHitPoints: 100, isBuilt: false }
  f.player.buildings.push(building)
  Object.assign(f.worker, { work: 'builder', autonomousJob: 'construction', experience: { building: 600 } })
  f.spatial.entity = () => building
  let expected = 1
  for (let impact = 0; impact < 10; impact++)
    expected = advanceConstruction(expected, 100, 25, getBuildRateXpMultiplier(f.worker))
  advanceOfflineWorker(f.state, f.player, 0, f.worker, 10000, 1, f.spatial, f.rules, f.report)
  assert.equal(building.hitPoints, expected)
  assert.ok(expected > 41, 'saved experience must affect distant construction too')
})

test('live and offline training agree before, at and after the completion day, including immediate training', () => {
  for (const end of [1, 4])
    for (const day of [1, 2, 3, 4, 5]) {
      const f = fixture()
      const entry = {
        type: 'Fantassin',
        trainee: { label: 'recruit', type: 'Villager' },
        trainingStartedDay: 1,
        trainingCompleteDay: end,
      }
      const animated = structuredClone(entry)
      updateTrainingEntryProgress({ currentTrainingDay: () => day }, animated)
      f.center.trainingQueue = [entry]
      // A blocked exit keeps the completed entry available for progress comparison.
      f.spatial.findNear = () => null
      completeOfflineTraining(f.state, day, f.spatial, f.rules, f.report)
      assert.equal(entry.loading, animated.loading)
      assert.equal(entry.loading === 100, day >= end)
    }
})

test('work timing reads the same animation speed and frame sequence as live playback', () => {
  const sheet = { data: { animationSpeed: 0.25 } }
  const frames = getConfiguredActionFrameSequence({ work: 'woodcutter', action: 'chopwood' }).length
  const animationMs = (frames / (getUnitSpritesheetAnimationSpeed(sheet) * 60)) * 1000
  assert.equal(getWorkCycleMs({ energyCosts: { chopwood: 0 }, energyRegenDelay: 0 }, 'woodcutter', sheet), animationMs)
})

test('catch-up work minutes equal minute-by-minute live availability through meals and nights', () => {
  const worker = { type: 'Villager', label: 'schedule-parity', i: 0, j: 0, context: { dayNight: { state: {} } } }
  let minutes = 0
  for (let minute = 0; minute < 3 * 1440; minute++) {
    worker.context.dayNight.state = { hour: Math.floor((minute % 1440) / 60), minute: minute % 60 }
    if (shouldVillagerWork(worker)) minutes++
  }
  assert.equal(getVillagerWorkingMinutes(worker, 0, 3 * 1440), minutes)
  assert.equal(getVillagerWorkingMinutes(worker, 0, 1234) + getVillagerWorkingMinutes(worker, 1234, 3 * 1440), minutes)
})

test('a simulated partial release waits for all live impacts and retains progress across slices', () => {
  const f = fixture()
  advanceOfflineWorker(
    f.state,
    f.player,
    0,
    f.worker,
    (getResourceGatherSwings('wood') - 1) * 1000,
    1,
    f.spatial,
    f.rules,
    f.report
  )
  assert.equal(f.report.gathered.wood ?? 0, 0)
  advanceOfflineWorker(f.state, f.player, 0, f.worker, 1000, 1, f.spatial, f.rules, f.report)
  assert.equal(f.report.gathered.wood, 2)
  assert.equal(f.worker.offlineWork.milliseconds, 0)
})

test('final harvests consume a full release without creating resources beyond the remaining node', () => {
  const { getHarvestAmount } = load('app/lib/economy/workRules.ts')
  const f = fixture()
  f.tree.quantity = 1
  advanceOfflineWorker(
    f.state,
    f.player,
    0,
    f.worker,
    (getResourceGatherSwings('wood') - 1) * 1000,
    1,
    f.spatial,
    f.rules,
    f.report
  )
  assert.equal(f.report.gathered.wood ?? 0, 0)
  advanceOfflineWorker(f.state, f.player, 0, f.worker, 1000, 1, f.spatial, f.rules, f.report)
  assert.equal(
    f.report.gathered.wood,
    getHarvestAmount(live.getGatherAmount({ ...f.worker, gatherAmount: f.config.gatherAmount, work: 'woodcutter' }), 1)
  )
  assert.equal(f.tree.quantity, 0)
})

test('the shared miner profession uses the actual copper or iron action energy cost', () => {
  const config = { energyCosts: { minegold: 1, minecopper: 2, mineiron: 4 }, energyRegenRate: 1, energyRegenDelay: 0 }
  const sheet = { data: { animationSpeed: 0.25 } }
  assert.equal(getWorkCycleMs(config, 'goldminer', sheet, 'minecopper'), 2000)
  assert.equal(getWorkCycleMs(config, 'goldminer', sheet, 'mineiron'), 4000)
})
