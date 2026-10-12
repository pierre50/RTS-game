const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getBuildingTrainingCapacity, getTrainingStartingExperience } = loadTsModule('app/lib/training/trainingRules.ts')
const { startTrainingWithUnit } = loadTsModule('app/classes/building/BuildingTraineeTraining.ts', {
  mocks: {
    '../../lib/entities/entityFade': { fadeOut: () => {} },
    '../../lib/chief': { playerNeedsChiefForCommand: () => false },
  },
})

test('military capacities follow each building level and other training buildings keep five places', () => {
  for (const type of ['Barracks', 'ArcheryRange', 'Stable']) {
    assert.deepEqual(
      [0, 1, 2].map(buildingLevel => getBuildingTrainingCapacity({ type, buildingLevel })),
      type === 'ArcheryRange' ? [3, 8, 8] : [3, 5, 8]
    )
    assert.equal(getBuildingTrainingCapacity({ type, assetLevel: 2 }), 8)
    assert.equal(getBuildingTrainingCapacity({ type, buildingLevel: 0, assetLevel: 2 }), 3)
  }
  assert.equal(getBuildingTrainingCapacity({ type: 'Temple', buildingLevel: 2 }), 5)
})

test('live admission awards only the unit specialty and captures it in saved training extras', () => {
  const { serializeTrainingExtra } = loadTsModule('app/serialization/TrainingSave.ts')
  for (const [type, unitType, skill] of [
    ['Barracks', 'Fantassin', 'melee'],
    ['ArcheryRange', 'Bowman', 'ranged'],
  ]) {
    for (const [buildingLevel, xp] of (type === 'ArcheryRange' ? [0, 150, 150] : [0, 50, 150]).entries()) {
      const owner = { units: [], config: { units: { [unitType]: { category: 'Military' } } } }
      const building = { type, buildingLevel, owner, units: [unitType], trainingQueue: [] }
      const trainee = {
        type: 'Villager',
        label: 'recruit',
        owner,
        trainingTargetType: unitType,
        experience: { woodcutting: 900 },
      }
      owner.units.push(trainee)
      let saved
      assert.equal(
        startTrainingWithUnit(building, trainee, (_type, _paid, _force, extra) => {
          saved = serializeTrainingExtra(extra)
          return true
        }),
        true
      )
      assert.deepEqual(saved.experience, xp ? { [skill]: xp } : {})
      building.buildingLevel = 2
      assert.deepEqual(JSON.parse(JSON.stringify(saved)).experience, xp ? { [skill]: xp } : {})
    }
  }
})

test('stable preserves all experience without adding or sharing mutable XP', () => {
  const previous = { melee: 275, defense: 90, woodcutting: 20 }
  for (const buildingLevel of [0, 1, 2]) {
    const result = getTrainingStartingExperience({ type: 'Stable', buildingLevel }, 'Fantassin', previous)
    assert.deepEqual(result, previous)
    assert.notEqual(result, previous)
  }
  assert.deepEqual(getTrainingStartingExperience({ type: 'Temple', buildingLevel: 2 }, 'Priest'), {})
})

test('saved training completion uses captured XP rather than the upgraded building level', () => {
  const { completeOfflineTraining } = loadTsModule('app/services/world/offline/OfflineWorldTraining.ts')
  for (const [type, unitType, previous, expected] of [
    ['Barracks', 'Fantassin', undefined, { melee: 50 }],
    ['ArcheryRange', 'Bowman', undefined, { ranged: 150 }],
    ['Stable', 'Fantassin', { melee: 280, defense: 60 }, { melee: 280, defense: 60 }],
  ]) {
    const extra = { experience: getTrainingStartingExperience({ type, buildingLevel: 1 }, unitType, previous) }
    const building = {
      type,
      buildingLevel: 2,
      isBuilt: true,
      trainingQueue: [
        {
          type: unitType,
          trainee: { type: type === 'Stable' ? unitType : 'Villager', label: 'r' },
          extra,
          trainingStartedDay: 1,
          trainingCompleteDay: 3,
        },
      ],
    }
    const state = JSON.parse(JSON.stringify({ players: [{ units: [], buildings: [building] }] }))
    const report = { trainingsCompleted: 0 }
    completeOfflineTraining(
      state,
      3,
      { findNear: () => ({ i: 1, j: 1 }), reachable: () => true, reserve() {} },
      { unitConfig: () => ({ totalHitPoints: 30 }) },
      report
    )
    assert.equal(report.trainingsCompleted, 1)
    assert.deepEqual(state.players[0].units[0].experience, expected)
    completeOfflineTraining(state, 4, {}, {}, report)
    assert.equal(report.trainingsCompleted, 1)
    assert.equal(state.players[0].units.length, 1)
  }
})

test('distant AI admissions use building-level specialty experience', () => {
  const { planAbstractTraining } = loadTsModule('app/services/world/distantVillages/AbstractVillageEconomy.ts')
  const building = { type: 'Barracks', buildingLevel: 2, isBuilt: true, i: 0, j: 0 }
  const player = {
    type: 'AI',
    aiState: { phase: 'military_build' },
    buildings: [building],
    units: Array.from({ length: 20 }, (_, i) => ({ type: 'Villager', label: `v${i}`, i: 1, j: 0 })),
  }
  planAbstractTraining({ players: [player] }, 1, { unitConfig: () => ({ trainingDays: 2 }) }, { release() {} })
  assert.ok(building.trainingQueue.length > 0)
  assert.ok(building.trainingQueue.length <= 8)
  for (const entry of building.trainingQueue) assert.deepEqual(entry.extra.experience, { melee: 150 })
})
