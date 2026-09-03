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

function makeBuilding(overrides = {}) {
  const parent = { label: 'map-layer' }
  return {
    context: { app: {}, scheduler: {}, ...overrides.context },
    family: 'building',
    i: overrides.i ?? 5,
    isDead: false,
    isDestroyed: false,
    j: overrides.j ?? 5,
    parent,
    size: overrides.size,
    sprite: { parent: { label: 'building-container' }, texture: { source: {} } },
    type: 'House',
    x: 10,
    y: 20,
    ...overrides,
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

test('combat building impact fragments settle onto the building isometric footprint', () => {
  const calls = []
  const nowRef = { value: 3000 }
  const { restorePerformance, spawnCombatBuildingImpactFragments } = loadCombatBuildingImpactFragments(calls, nowRef)

  try {
    const building = makeBuilding({ i: 4, j: 4, size: 2 })
    const footprintCells = [
      { i: 4, j: 4, x: 0, y: 128, zIndex: 8, has: building },
      { i: 4, j: 5, x: -32, y: 144, zIndex: 9, has: building },
      { i: 5, j: 4, x: 32, y: 144, zIndex: 9, has: building },
      { i: 5, j: 5, x: 0, y: 160, zIndex: 10, has: building },
    ]
    building.context.map = {
      grid: [
        [],
        [],
        [],
        [],
        [undefined, undefined, undefined, undefined, footprintCells[0], footprintCells[1]],
        [undefined, undefined, undefined, undefined, footprintCells[2], footprintCells[3]],
      ],
      size: 12,
    }

    spawnCombatBuildingImpactFragments(building, 8)

    assert.deepEqual(calls[0].groundTargets, [
      { x: 0, y: 128, zIndex: 8 },
      { x: -32, y: 144, zIndex: 9 },
      { x: 32, y: 144, zIndex: 9 },
      { x: 0, y: 160, zIndex: 10 },
    ])
  } finally {
    restorePerformance()
  }
})
