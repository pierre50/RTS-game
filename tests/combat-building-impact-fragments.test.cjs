const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadCombatBuildingImpactFragments(calls, nowRef = { value: 1000 }) {
  const previousPerformance = global.performance
  global.performance = { ...(previousPerformance || {}), now: () => nowRef.value }

  const module = loadTsModule('app/lib/entities/combatBuildingImpactFragments.ts', {
    mocks: {
      '../constants': { FAMILY_TYPES: { building: 'building' } },
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

function makeBuilding() {
  const parent = { label: 'map-layer' }
  return {
    context: { app: {}, scheduler: {} },
    family: 'building',
    isDead: false,
    isDestroyed: false,
    parent,
    sprite: { parent: { label: 'building-container' }, texture: { source: {} } },
    type: 'House',
    x: 10,
    y: 20,
  }
}

test('combat building impact fragments spawn for building hits and scale with damage', () => {
  const calls = []
  const nowRef = { value: 1000 }
  const { restorePerformance, spawnCombatBuildingImpactFragments } = loadCombatBuildingImpactFragments(calls, nowRef)

  try {
    const weakHit = makeBuilding()
    spawnCombatBuildingImpactFragments(weakHit, 1)

    const mediumHit = makeBuilding()
    nowRef.value += 100
    spawnCombatBuildingImpactFragments(mediumHit, 9)

    const heavyHit = makeBuilding()
    nowRef.value += 100
    spawnCombatBuildingImpactFragments(heavyHit, 100)

    assert.equal(calls.length, 3)
    assert.equal(calls[0].layer.label, 'map-layer')
    assert.equal(calls[0].maxFragments, 5)
    assert.equal(calls[1].maxFragments, 9)
    assert.equal(calls[2].maxFragments, 24)
    assert.equal(calls[1].maxFragments > calls[0].maxFragments, true)
  } finally {
    restorePerformance()
  }
})

test('combat building impact fragments throttle repeated hits on the same building', () => {
  const calls = []
  const nowRef = { value: 2000 }
  const { restorePerformance, spawnCombatBuildingImpactFragments } = loadCombatBuildingImpactFragments(calls, nowRef)

  try {
    const building = makeBuilding()
    spawnCombatBuildingImpactFragments(building, 8)
    nowRef.value += 50
    spawnCombatBuildingImpactFragments(building, 8)
    nowRef.value += 50
    spawnCombatBuildingImpactFragments(building, 8)

    assert.equal(calls.length, 2)
  } finally {
    restorePerformance()
  }
})
