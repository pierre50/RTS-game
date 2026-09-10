const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const preparedContent = loadTsModule('app/classes/map/generation/PreparedMapContent.ts')

class MockGaia {}

function loadModule(relativePath, mocks) {
  return loadTsModule(relativePath, { mocks })
}

function loadMapGeneration() {
  return loadModule('app/classes/map/MapGeneration.ts', {
    './generation/PreparedMapContent': preparedContent,
    './MapOfflineWorldSimulation': { applyOfflineWorldSimulation: () => {} },
    'pixi.js': {
      Assets: {
        cache: {
          get: key =>
            key === 'config'
              ? {
                  animals: { Deer: {}, Hare: {}, BlackGrouse: {}, Fox: {}, Boar: {}, Wolf: {}, Horse: {} },
                  resources: {},
                  cells: {},
                }
              : {},
        },
      },
      Sprite: { from: () => ({}) },
    },
    '../Resource': { Resource: class {} },
    '../players': {
      Human: class {},
      AI: class {},
      Gaia: MockGaia,
    },
    '../../lib': {
      colors: {},
      getZoneInGridWithCondition: () => null,
      updateInstanceVisibility: () => {},
      getGaiaAnimals: () => [],
      getTextureByFrame: () => null,
      getPositionInGridAroundInstance: () => null,
      canPlaceBuildingAt: () => false,
      hasWaterBorderWithin: () => false,
      getBuildingFootprintCells: () => [],
      getBuildingFootprintRadius: () => 1,
      getPlainCellsAroundPoint: () => [],
    },
    '../../services/FogOfWar': { rehydrateAIKnowledge: () => {} },
    '../../ai/config': {
      MAX_BUILDING_BY_AGE: {},
      MAX_INFANTRY_BY_AGE: {},
      MAX_ARCHER_BY_AGE: {},
    },
    '../../ai/unitGroups': {
      getBestUnitFromTechs: () => null,
      INFANTRY_TECH_UPGRADES: {},
      ARCHER_TECH_UPGRADES: {},
    },
    '../../config/resourcePresets': {
      CIVILIZATION_LEVEL_RESOURCE_BONUS: {},
    },
    '../../config/mapSizes': {
      getIdealSpawnRangeForMapSize: () => ({ minSpawns: 1, maxSpawns: 2 }),
    },
    '../../constants': {
      BUILDING_TYPES: {},
      FAMILY_TYPES: {},
      LABEL_TYPES: {},
      RESOURCE_TYPES: {},
      UNIT_TYPES: {},
      WATER_BORDER_PLACEMENT_CLEARANCE: 2,
      ANIMAL_PLAYER_SAFE_DIST: 14,
      AMBIENT_ANIMAL_CHANCE: 0.0015,
      getEnvironmentTerrainParams: () => ({}),
    },
    '../cell': {
      Cell: class {},
      GenerationCell: class {},
    },
    './generation/MapBlueprintGeneration': {
      MapBlueprintGeneration: class {
        constructor() {}
      },
    },
    './MapSaveRestore': {
      processUnit: () => {},
      restoreAIState: () => {},
      restoreBuildingAssignments: () => {},
      restorePlayerEntitiesFromSave: () => {},
      restorePlayerViewsAndFog: () => {},
      restoreSelection: () => {},
      restoreTransportCargo: () => {},
    },
  }).MapGeneration
}

function createGenerator({ random = () => 0, randomRange, environment, terrainType } = {}) {
  const placed = []
  const size = 20
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      type: terrainType,
      solid: false,
      has: null,
      border: false,
      waterBorder: false,
      inclined: false,
      category: 'Land',
    }))
  )
  const map = {
    grid,
    size,
    environment,
    playersPos: [],
    context: {},
    random,
    randomRange: randomRange || ((min, max) => Math.floor((min + max) / 2)),
    randomItem: items => items[0],
    gaia: Object.assign(new MockGaia(), {
      createAnimal: animal => {
        placed.push(animal)
        grid[animal.i][animal.j].has = animal
        grid[animal.i][animal.j].solid = true
      },
    }),
  }
  const MapGeneration = loadMapGeneration()
  return { generation: new MapGeneration(map), placed, grid }
}

test('ambient deer spawn as a nearby group', () => {
  const { generation, placed } = createGenerator({
    random: () => 0,
    randomRange: (min, max) => (min === 3 && max === 6 ? 4 : min),
  })

  generation.placeAmbientAnimalGroup(10, 10, 'Deer')

  assert.equal(placed.length, 4)
  assert.deepEqual(placed[0], { i: 10, j: 10, type: 'Deer' })
  assert.ok(placed.every(animal => Math.hypot(animal.i - 10, animal.j - 10) <= 3))
})

test('ambient foxes usually spawn isolated', () => {
  const { generation, placed } = createGenerator({ random: () => 0.9 })

  generation.placeAmbientAnimalGroup(10, 10, 'Fox')

  assert.deepEqual(placed, [{ i: 10, j: 10, type: 'Fox' }])
})

test('ambient selection excludes wolves and can pick horses', () => {
  const { generation } = createGenerator({ random: () => 0.999 })

  assert.equal(generation.pickAmbientAnimalType(10, 10), 'Horse')
})

test('open grass ambient selection can still pick horses', () => {
  const { generation } = createGenerator({ terrainType: 'Grass', random: () => 0.999 })

  assert.equal(generation.pickAmbientAnimalType(10, 10), 'Horse')
})

test('steppe ambient selection favors horses over open grass defaults', () => {
  const { generation } = createGenerator({ environment: 'Steppe', random: () => 0.75 })

  assert.equal(generation.pickAmbientAnimalType(10, 10), 'Horse')
})

test('closed and cold biomes do not spawn wild horses', () => {
  for (const terrainType of ['DarkForest', 'Jungle', 'Snow']) {
    const { generation } = createGenerator({ terrainType, random: () => 0.999 })

    assert.notEqual(generation.pickAmbientAnimalType(10, 10), 'Horse')
  }
})

test('prepared wildlife loads its list without scanning or rolling new groups', async () => {
  const { generation, placed, grid } = createGenerator({ random: () => assert.fail('no animal generation at load') })
  grid[11][11].has = { type: 'TownCenter' }
  preparedContent.registerPreparedMapContent(generation.map, {
    animals: [
      { i: 10, j: 10, type: 'Deer' },
      { i: 11, j: 11, type: 'Hare' },
    ],
  })
  await generation.generateSetsAsync()
  assert.deepEqual(placed, [{ i: 10, j: 10, type: 'Deer' }])
  const empty = createGenerator({ random: () => assert.fail('an empty saved population is authoritative') })
  preparedContent.registerPreparedMapContent(empty.generation.map, { animals: [] })
  await empty.generation.generateSetsAsync()
  assert.deepEqual(empty.placed, [])
})
