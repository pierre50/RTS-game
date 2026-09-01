const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadWorkImpactFragments(calls, nowRef = { value: 1000 }) {
  const previousPerformance = global.performance
  global.performance = { ...(previousPerformance || {}), now: () => nowRef.value }

  const constants = {
    ACTION_TYPES: {
      build: 'build',
      chopwood: 'chopwood',
      farm: 'farm',
      forageberry: 'forageberry',
      minecopper: 'minecopper',
      minegold: 'minegold',
      mineiron: 'mineiron',
      minestone: 'minestone',
    },
    FAMILY_TYPES: {
      building: 'building',
      resource: 'resource',
    },
    RESOURCE_TYPES: {
      berrybush: 'Berrybush',
      copper: 'Copper',
      gold: 'Gold',
      iron: 'Iron',
      stone: 'Stone',
      tree: 'Tree',
      wheat: 'Wheat',
    },
  }

  const module = loadTsModule('app/lib/entities/workImpactFragments.ts', {
    mocks: {
      '../../constants': constants,
      './spriteFragmentBurst': {
        spawnSpriteFragmentBurst: options => calls.push(options),
      },
    },
  })

  return {
    ...module,
    restorePerformance: () => {
      global.performance = previousPerformance
    },
  }
}

function makeTarget(type, family = 'resource') {
  return {
    context: { app: {}, scheduler: {} },
    family,
    isDead: false,
    isDestroyed: false,
    parent: { label: 'map-layer' },
    sprite: { texture: { source: {} } },
    type,
    x: 12,
    y: 24,
  }
}

test('work impact fragments map tool actions to reusable fragment bursts', () => {
  const calls = []
  const { restorePerformance, spawnWorkImpactFragments } = loadWorkImpactFragments(calls)

  try {
    const tree = makeTarget('Tree')
    spawnWorkImpactFragments({ action: 'chopwood' }, tree)

    const stone = makeTarget('Stone')
    spawnWorkImpactFragments({ action: 'minestone' }, stone)

    const building = makeTarget('House', 'building')
    spawnWorkImpactFragments({ action: 'build' }, building)

    const wheat = makeTarget('Wheat')
    spawnWorkImpactFragments({ action: 'farm' }, wheat)

    const berrybush = makeTarget('Berrybush')
    spawnWorkImpactFragments({ action: 'forageberry' }, berrybush)

    assert.equal(calls.length, 5)
    assert.deepEqual(
      calls.map(call => [call.host.type, call.maxFragments, call.lockX, call.layer?.label]),
      [
        ['Tree', 5, true, 'map-layer'],
        ['Stone', 6, true, 'map-layer'],
        ['House', 5, true, 'map-layer'],
        ['Wheat', 7, true, 'map-layer'],
        ['Berrybush', 7, true, 'map-layer'],
      ]
    )
  } finally {
    restorePerformance()
  }
})

test('work impact fragments throttle repeated bursts on the same target and action', () => {
  const calls = []
  const nowRef = { value: 2000 }
  const { restorePerformance, spawnWorkImpactFragments } = loadWorkImpactFragments(calls, nowRef)

  try {
    const tree = makeTarget('Tree')
    spawnWorkImpactFragments({ action: 'chopwood' }, tree)
    nowRef.value += 80
    spawnWorkImpactFragments({ action: 'chopwood' }, tree)
    nowRef.value += 50
    spawnWorkImpactFragments({ action: 'chopwood' }, tree)

    assert.equal(calls.length, 2)
  } finally {
    restorePerformance()
  }
})
