const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function square(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({ i, j, category: 'Land', solid: false }))
  )
}

test('spawn zones require all cells, including holes and map edges', () => {
  const { getZoneInGridWithCondition, getRandomZoneInGridWithCondition } = loadTsModule('app/lib/grid/cells.ts')
  const grid = square(3)
  const zone = { minX: 1, maxX: 1, minY: 1, maxY: 1 }
  const check = () => true
  assert.deepEqual(getZoneInGridWithCondition(zone, grid, 1, check), { i: 1, j: 1 })
  delete grid[0][0]
  assert.equal(getZoneInGridWithCondition(zone, grid, 1, check), null)
  assert.equal(getRandomZoneInGridWithCondition(zone, grid, 1, check, 1), null)
  assert.equal(getZoneInGridWithCondition({ minX: 2, maxX: 2, minY: 2, maxY: 2 }, grid, 1, check), null)
  assert.deepEqual(getZoneInGridWithCondition(zone, grid, 0, check), { i: 1, j: 1 })
})

test('pathfinding rejects missing endpoints and diagonal shortcuts across holes', () => {
  const { findInstancePath } = loadTsModule('app/services/Pathfinding.ts', {
    mocks: { '../lib/maths': {
      cellIsDiag: (a, b) => a.i !== b.i && a.j !== b.j,
      instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
    } },
  })
  const grid = square(5)
  grid[0] = []
  grid[2][2] = undefined
  const map = { grid, size: 4 }
  const start = grid[2][1]
  const path = findInstancePath(start, 2, 3, map)
  assert.ok(path.length > 2)
  let previous = start
  for (const cell of [...path].reverse()) {
    assert.equal(grid[cell.i][cell.j], cell)
    if (previous.i !== cell.i && previous.j !== cell.j) {
      assert.ok(grid[previous.i][cell.j])
      assert.ok(grid[cell.i][previous.j])
    }
    previous = cell
  }
  assert.deepEqual(findInstancePath(start, 2, 2, map), [])
  assert.deepEqual(findInstancePath({ i: 0, j: 0 }, 2, 3, map), [])
  grid[1][2] = undefined
  grid[3][2] = undefined
  grid[4][2] = undefined
  assert.deepEqual(findInstancePath(start, 2, 3, map), [])
})

test('sync and async ambient generation visit only present cells', async () => {
  const { generateAmbientAnimalSets, generateAmbientAnimalSetsAsync } = loadTsModule(
    'app/classes/map/generation/AmbientAnimalGeneration.ts',
    { mocks: { '../../../lib': { hasWaterBorderWithin: () => false } } }
  )
  const grid = [[], new Array(3), [undefined, { i: 2, j: 1, category: 'Land' }, undefined]]
  const map = { grid, size: 2, random: () => 0 }
  for (const generate of [generateAmbientAnimalSets, generateAmbientAnimalSetsAsync]) {
    const placed = []
    await generate(map, {
      hasSolidNeighbor: (i, j) => { assert.ok(grid[i][j]); return false },
      hasWaterNeighbor: () => false,
      pickType: () => 'Deer',
      placeGroup: (i, j) => placed.push([i, j]),
      yieldToBrowser: async () => {},
    })
    assert.deepEqual(placed, [[2, 1]])
  }
})

test('pause collection skips holes and deduplicates corpses', () => {
  const { collectPausableInstances } = loadTsModule('app/screens/game/pausableRuntime.ts', {
    mocks: { '../../lib': { getGaiaAnimals: () => [] } },
  })
  const corpse = { pause() {} }
  const destroyed = { pause() {}, isDestroyed: true }
  const grid = [[], new Array(3), [undefined, { corpses: new Set([corpse, destroyed]) }]]
  const instances = collectPausableInstances({ grid }, [{ corpses: [corpse] }])
  assert.deepEqual([...instances], [corpse])
})

test('fresh-world party reset clears player exploration without traversing the grid', () => {
  const { applyTravelPartyToRuntime } = loadTsModule('app/screens/game/GameTravelParty.ts', {
    mocks: {
      '../../lib': { updateInstanceVisibility() {} },
      '../../lib/buildings/passageCells': {},
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
      './GameStateHelpers': {},
    },
  })
  let visibilityResets = 0
  let explorationResets = 0
  const hero = { type: 'Hero' }
  const player = {
    units: [hero], cellViewed: 7,
    views: { clearVisibility() { visibilityResets++ }, clearExploration() { explorationResets++ }, removeViewerEverywhere: () => [] },
  }
  const context = {
    map: { get grid() { assert.fail('reset must not traverse cells') } },
    player, controls: {}, menu: {},
  }
  applyTravelPartyToRuntime({ _gameContext: () => context }, { followers: [], hero: null }, null, { freshWorld: true })
  assert.equal(visibilityResets, 1)
  assert.equal(explorationResets, 1)
  assert.equal(player.cellViewed, 0)
})

test('stale unit and animal paths stop before entering missing cells', () => {
  const map = { grid: [[], new Array(3)] }
  let stopped = 0
  const unit = {
    context: { map }, path: [{ i: 1, j: 1 }],
    stopInterval() { stopped++ }, affectNewDest() {},
  }
  const { moveUnitToPath } = loadTsModule('app/classes/unit/movement/UnitPathMovement.ts', {
    mocks: {
      '../../../lib': {}, './UnitMovementDebug': {}, './UnitMovementHelpers': {},
      '../../../lib/units/unitWalkingAnimation': {},
      '../../../lib/units/unitCrouchPose': { resetUnitCrouchPose() {} },
      '../../../lib/units/unitLocomotion': {}, '../../../lib/buildings/passageCells': {},
      '../../../lib/mapSpaces': { getEntitySpaceMapLike: () => map },
    },
  })
  moveUnitToPath(unit, () => false)
  assert.deepEqual(unit.path, [])
  assert.equal(stopped, 1)
  const { moveAnimalToPath } = loadTsModule('app/classes/animal/AnimalMovementStep.ts', {
    mocks: {
      '../../lib': {}, '../../lib/mapSpaces': { getEntitySpaceMapLike: () => map },
      '../../lib/units/unitEnergy': { updateUnitEnergy() {} },
    },
  })
  const animal = { context: { map }, path: [{ i: 1, j: 1 }], stop() { stopped++ } }
  moveAnimalToPath(animal)
  assert.deepEqual(animal.path, [])
  assert.equal(stopped, 2)
})

test('hero start ignores a settlement hole and finds land on the outer row', () => {
  const { generatePlayers } = loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
    mocks: {
      '../../lib': { playerColors: ['blue'] },
      '../../lib/resources/playerResourceTotals': {},
      '../players': { Human: class { constructor(options) { Object.assign(this, options) } } },
      './BanditCampGeneration': {},
    },
  })
  const grid = Array.from({ length: 5 }, () => [])
  grid[4][2] = { i: 4, j: 2, category: 'Land' }
  const map = {
    grid, size: 4, heroOnlyStart: true, noAI: true, startingAge: 0,
    settlements: [{ kind: 'village', civ: 'Hellas', local: { i: 1, j: 1 } }],
    context: { app: {}, gamebox: {}, map: {}, scheduler: {} },
  }
  const [heroOwner] = generatePlayers(map, [{ isHuman: true, civ: 'Hellas' }])
  assert.deepEqual([heroOwner.i, heroOwner.j], [4, 2])
  delete grid[4][2]
  assert.throws(() => generatePlayers(map), /no available land cell/)
})

test('forest generation can place trees when the first row is empty', () => {
  const { generateForestAroundPlayer } = loadTsModule('app/classes/map/resources/MapForestResources.ts', {
    mocks: {
      '../../../lib': { hasWaterBorderWithin: () => false },
      '../../Resource': { Resource: class { constructor(options) { Object.assign(this, options) } } },
      './MapResourceSpacing': { hasSpacedResourceAround: () => false },
      './TreeResourceTextures': { pickTreeTextureNameForFamily: () => undefined },
    },
  })
  const grid = Array.from({ length: 10 }, () => [])
  grid[5][5] = { i: 5, j: 5, type: 'Grass', category: 'Land' }
  const map = {
    grid, size: 9, context: {}, resources: new Set(), random: () => 0.5,
    randomItem: items => items[0],
    addChild(child) { assert.ok(grid[child.i][child.j]); return child },
  }
  generateForestAroundPlayer(map, { i: 5, j: 5 }, 5, 0, 1, 1, 0, 0)
  assert.equal(map.resources.size, 1)
})

test('instance buckets cover sparse local map rows beyond the first row length', () => {
  const grid = Array.from({ length: 220 }, () => [])
  grid[0][73] = { i: 0, j: 73 }
  grid[146][210] = { i: 146, j: 210 }
  grid[146][219] = { i: 146, j: 219 }

  const { createRuntimeMapSpaceBuckets, ensureOutsideMapSpace, addEntityToRuntimeMapSpaceBucket } =
    loadTsModule('app/lib/mapSpaces.ts')
  const { findInstancesInSight } = loadTsModule('app/lib/grid/visibility.ts', {
    mocks: { '../../services/UnitPerception': { updateVisibility() {} } },
  })
  const map = {
    grid, size: 219, spaces: new Map(), instanceBuckets: createRuntimeMapSpaceBuckets(grid, 219),
    addChild() {}, removeChild() {},
  }
  const outside = ensureOutsideMapSpace(map)
  outside.instanceBuckets = map.instanceBuckets
  const hero = { i: 146, j: 210, sight: 12, context: { map } }
  const animal = { i: 146, j: 219, sight: 8, context: { map } }

  addEntityToRuntimeMapSpaceBucket(outside, animal)

  assert.deepEqual(findInstancesInSight(hero, target => target === animal, 12), [animal])
})
