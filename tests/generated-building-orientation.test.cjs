const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { generatedBuildingMirrored } = loadTsModule('app/lib/buildings/generatedBuildingOrientation.ts')

test('generated buildings vary deterministically and choose the accessible entrance', () => {
  const choices = []
  for (let i = 5; i < 105; i++) {
    const point = { i, j: 12 }
    const choice = generatedBuildingMirrored('House', point, 4242, () => true)
    choices.push(choice)
    assert.equal(
      generatedBuildingMirrored('House', point, 4242, () => true),
      choice
    )
    assert.equal(
      generatedBuildingMirrored('House', point, 4242, p => p.i === i + 2),
      true
    )
    assert.equal(
      generatedBuildingMirrored('House', point, 4242, p => p.i === i + 1),
      false
    )
  }
  const mirrored = choices.filter(Boolean).length
  assert.ok(mirrored > 30 && mirrored < 70)
  for (const type of ['Farm', 'SmallWall', 'Cave', 'FireCamp'])
    assert.equal(
      generatedBuildingMirrored(type, { i: 4, j: 5 }, 4242, () => true),
      false
    )
})

test('live AI construction varies orientation while respecting explicit and human choices', () => {
  const { buyPlayerBuilding } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', {
    mocks: {
      '../../lib': {
        canAfford: () => true,
        payCost() {},
        isBuildingLimitReached: () => false,
        canPlaceBuildingAt: () => true,
        hasBuildingPlacementClearance: () => true,
      },
      '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => new Set() },
      '../../lib/entities/entityFade': {},
      '../../lib/mapSpaces': { getMapSpace: () => null },
      '../Resource': {},
      '../../lib/objectives/ageObjectives': {},
    },
  })
  const grid = Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => ({ category: 'Land' })))
  const player = {
    type: 'AI',
    age: 0,
    isPlayed: false,
    config: { buildings: { House: { size: 2, cost: {} } } },
    isBuildingEligible: () => true,
    context: { map: { grid, seed: 4242 }, players: [], menu: {} },
    spawnBuilding(building) {
      this.spawned = building
    },
  }
  const choices = new Set()
  for (let i = 5; i < 20; i++) {
    assert.equal(buyPlayerBuilding(player, i, 5, 'House'), true)
    choices.add(player.spawned.placementMirrored)
  }
  assert.equal(choices.size, 2)
  for (const placementMirrored of [false, true]) {
    buyPlayerBuilding(player, 5, 5, 'House', { placementMirrored })
    assert.equal(player.spawned.placementMirrored, placementMirrored)
  }
  player.type = 'Human'
  buyPlayerBuilding(player, 5, 5, 'House')
  assert.equal(player.spawned.placementMirrored, false)
})
