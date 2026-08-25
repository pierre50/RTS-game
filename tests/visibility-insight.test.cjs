const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  return loadTsModule(relativePath, { mocks })
}

const constants = {
  FAMILY_TYPES: { building: 'building', unit: 'unit' },
}

test('slow unit movement reduces the effective insight detection range', () => {
  const { getInsightDetectionRange, instanceIsInInsightRange } = loadModule('app/lib/insightDetection.ts', {
    '../constants': constants,
    '../constants/heroControls': { HERO_STEALTH_ANIMAL_DETECTION_FACTOR: 0.55 },
  })
  const animal = { i: 0, j: 0, sight: 8 }
  const walkingVillager = { i: 5, j: 0, family: 'unit', requestedMoveSpeedFactor: 0.5 }
  const closeWalkingVillager = { i: 4, j: 0, family: 'unit', requestedMoveSpeedFactor: 0.5 }
  const building = { i: 5, j: 0, family: 'building', requestedMoveSpeedFactor: 0.5 }

  assert.equal(getInsightDetectionRange(animal, walkingVillager), 4)
  assert.equal(instanceIsInInsightRange(animal, walkingVillager), false)
  assert.equal(instanceIsInInsightRange(animal, closeWalkingVillager), true)
  assert.equal(instanceIsInInsightRange(animal, building), true)
})

test('hero stealth and slow movement share the same insight range calculation', () => {
  const { getInsightDetectionRange } = loadModule('app/lib/insightDetection.ts', {
    '../constants': constants,
    '../constants/heroControls': { HERO_STEALTH_ANIMAL_DETECTION_FACTOR: 0.55 },
  })
  const hero = { i: 0, j: 0, family: 'unit', requestedMoveSpeedFactor: 0.5 }
  const controls = { heroUnit: hero, isHeroStealthMode: () => true }
  const animal = { i: 0, j: 0, sight: 8, context: { controls } }

  assert.equal(getInsightDetectionRange(animal, hero), 4)
})

test('findInstancesInSight can filter targets by effective insight range', () => {
  const { findInstancesInSight } = loadModule('app/lib/grid/visibility.ts', {
    '../../constants': { ...constants, BUCKET_SIZE: 10 },
    '../../constants/heroControls': { HERO_STEALTH_ANIMAL_DETECTION_FACTOR: 0.55 },
    '../../services/FogOfWar': { updateVisibility: () => {} },
  })
  const fastEnemy = { i: 5, j: 0, x: 5, y: 0, label: 'fast-enemy', family: 'unit' }
  const slowEnemy = { i: 5, j: 0, x: 5, y: 0, label: 'slow-enemy', family: 'unit', requestedMoveSpeedFactor: 0.5 }
  const observer = {
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    label: 'observer',
    sight: 8,
    context: { map: { instanceBuckets: [[new Set([fastEnemy, slowEnemy])]] } },
  }

  assert.deepEqual(
    findInstancesInSight(observer, target => target.family === 'unit').map(target => target.label),
    ['fast-enemy', 'slow-enemy']
  )
  assert.deepEqual(
    findInstancesInSight(observer, target => target.family === 'unit', { useInsightRange: true }).map(
      target => target.label
    ),
    ['fast-enemy']
  )
})
