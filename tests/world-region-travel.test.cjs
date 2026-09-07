const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadWorldRegionTravel() {
  return loadTsModule('app/services/world/WorldRegionTravelSystem.ts', {
    mocks: {
      '../../lib/mapSpaces': { getEntityMapPoint: unit => ({ x: unit.x ?? 0, y: unit.y ?? 0 }) },
    },
  })
}

function loadTravelParty() {
  return loadTsModule('app/screens/game/GameTravelParty.ts', {
    mocks: {
      '../../lib': {
        getFreeLandCellAroundInstance: () => null,
        teleportRuntimeUnitToCell: () => {},
        updateInstanceVisibility: () => {},
      },
      '../../lib/buildings/passageCells': { createNonReservedPassageCellCondition: () => () => true },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats: () => {} },
      './GameStateHelpers': { applyPortableUnitState: Object.assign },
    },
  })
}

function loadWorldRegionPlayers() {
  return loadTsModule('app/screens/game/WorldRegionPlayers.ts', {
    mocks: {
      '../../config/civilizations': { CIVILIZATIONS: [{ value: 'Hellas' }, { value: 'Norse' }, { value: 'Kemet' }] },
      '../../lib/graphics/colors': { playerColors: ['blue', 'red', 'green'] },
    },
  })
}

function loadMapPlayerGeneration() {
  class TestHuman {
    constructor(options) {
      Object.assign(this, options, { type: 'human', units: [], buildings: [] })
    }
  }
  class TestAI {
    constructor(options) {
      Object.assign(this, options, { type: 'AI', units: [], buildings: [] })
    }
  }
  return loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
    mocks: {
      '../../lib': { playerColors: ['blue', 'red', 'green'] },
      '../../constants': {
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        PLAYER_TYPES: { ai: 'AI', bandits: 'Bandits' },
        POPULATION_MAX: 200,
        UNIT_TYPES: { hero: 'Hero', villager: 'Villager' },
      },
      '../../lib/resources/playerResourceTotals': {
        expandLegacyFoodAmount: resources => resources,
        syncPlayerResourceFieldsFromChests: () => {},
      },
      '../players': { AI: TestAI, Human: TestHuman },
      './BanditCampGeneration': { ensureBanditCampOwner: () => null },
      './CivilizationStartingKit': { applyCivilizationLevelStartingKit: () => {} },
    },
  })
}

function createMap(size = 12) {
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      category: 'Grass',
      has: null,
      solid: false,
      border: i === 0 || j === 0 || i === size || j === size,
      waterBorder: false,
    }))
  )
  return { grid, size }
}

test('world region travel arrives inside the opposite edge with a safety inset', () => {
  const { arrivalCellForRegionEdge } = loadWorldRegionTravel()
  const map = createMap()

  assert.deepEqual(arrivalCellForRegionEdge(map, 'west', { i: 0, j: 5 }), map.grid[8][5])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'east', { i: 12, j: 5 }), map.grid[4][5])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'north', { i: 6, j: 0 }), map.grid[6][8])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'south', { i: 6, j: 12 }), map.grid[6][4])
})

test('world region travel maps isometric edges to the matching macro-world neighbor', () => {
  const { WorldRegionTravelSystem } = loadWorldRegionTravel()
  const travelled = []
  const map = {
    size: 12,
    mapType: 'world-region',
    worldId: 'world-test',
    worldRegion: { x: 2, y: 2 },
    worldManifest: {
      maps: [
        { id: 'west', region: { x: 2, y: 1 }, size: 12 },
        { id: 'east', region: { x: 2, y: 3 }, size: 12 },
        { id: 'north', region: { x: 1, y: 2 }, size: 12 },
        { id: 'south', region: { x: 3, y: 2 }, size: 12 },
      ],
    },
  }
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: { heroUnit: { i: 0, j: 6, x: 0, y: 0 }, setCamera: () => {} },
    map,
    menu: { showMessage: () => {} },
  }
  const system = new WorldRegionTravelSystem(context, {
    preloadWorldRegion: async () => {},
    travelToWorldRegion: async (regionId, edge) => travelled.push([regionId, edge]),
  })

  system.crossToNeighbor('west')
  context.controls.heroUnit = { i: 12, j: 6, x: 0, y: 0 }
  system._travelling = false
  system.crossToNeighbor('east')
  context.controls.heroUnit = { i: 6, j: 0, x: 0, y: 0 }
  system._travelling = false
  system.crossToNeighbor('north')
  context.controls.heroUnit = { i: 6, j: 12, x: 0, y: 0 }
  system._travelling = false
  system.crossToNeighbor('south')

  assert.deepEqual(travelled, [
    ['west', 'west'],
    ['east', 'east'],
    ['north', 'north'],
    ['south', 'south'],
  ])
})

test('world region travel avoids blocked arrival cells', () => {
  const { arrivalCellForRegionEdge } = loadWorldRegionTravel()
  const map = createMap()
  map.grid[4][5].solid = true
  map.grid[4][4].category = 'Water'
  map.grid[5][5].has = { label: 'occupied' }

  const arrival = arrivalCellForRegionEdge(map, 'east', { i: 12, j: 5 })

  assert.ok(arrival)
  assert.equal(arrival.solid, false)
  assert.equal(arrival.category, 'Grass')
  assert.equal(arrival.has, null)
  assert.equal(arrival.border, false)
})

test('world region travel carries living hero followers only', () => {
  const { extractTravelParty } = loadTravelParty()
  const hero = { i: 4, j: 4, label: 'hero', type: 'Hero' }
  const follower = { i: 5, j: 4, label: 'follower', followingHero: true, type: 'Villager' }
  const idleVillager = { i: 6, j: 4, label: 'idle', followingHero: false, type: 'Villager' }
  const deadFollower = { i: 7, j: 4, isDead: true, label: 'dead-follower', followingHero: true, type: 'Villager' }
  const destroyedFollower = {
    i: 8,
    j: 4,
    isDestroyed: true,
    label: 'destroyed-follower',
    followingHero: true,
    type: 'Villager',
  }

  const party = extractTravelParty({
    players: [{ isPlayed: true, units: [hero, follower, idleVillager, deadFollower, destroyedFollower] }],
  })

  assert.equal(party.hero, hero)
  assert.deepEqual(party.followers, [follower])
})

test('world region player configs keep the human civilization even without a local village', () => {
  const { buildWorldRegionPlayerConfigs } = loadWorldRegionPlayers()

  const configs = buildWorldRegionPlayerConfigs(
    {
      players: [{ civ: 'Hellas', color: 'blue', factionId: 'civ-hellas', isHuman: true }],
    },
    {
      settlements: [
        { civ: 'Norse', kind: 'village', local: { i: 10, j: 10 } },
        { civ: 'Kemet', kind: 'village', local: { i: 30, j: 30 } },
      ],
    },
    {
      'civ-norse': { id: 'civ-norse', civilization: 'Norse', color: 'red', name: 'Clan Nord' },
      'civ-kemet': { id: 'civ-kemet', civilization: 'Kemet', color: 'green', name: 'Maison Kemet' },
    }
  )

  assert.deepEqual(
    configs.map(config => ({
      civ: config.civ,
      factionId: config.factionId,
      isHuman: config.isHuman,
      name: config.name,
    })),
    [
      { civ: 'Hellas', factionId: 'civ-hellas', isHuman: true, name: undefined },
      { civ: 'Norse', factionId: 'civ-norse', isHuman: false, name: 'Clan Nord' },
      { civ: 'Kemet', factionId: 'civ-kemet', isHuman: false, name: 'Maison Kemet' },
    ]
  )
})

test('hero-only world starts avoid occupying another civilization settlement', () => {
  const { generatePlayers } = loadMapPlayerGeneration()
  const map = createMap(12)
  Object.assign(map, {
    allTechnologies: false,
    banditCampPositions: [],
    context: { app: {}, gamebox: {}, map: null, scheduler: {} },
    difficulty: 'medium',
    heroOnlyStart: true,
    noAI: false,
    playersPos: [],
    settlements: [{ civ: 'Norse', kind: 'village', local: { i: 2, j: 2 } }],
    startingAge: 0,
    startingResources: {},
  })
  map.context.map = map

  const players = generatePlayers(map, [
    { civ: 'Hellas', color: 'blue', factionId: 'civ-hellas', isHuman: true },
    { civ: 'Norse', color: 'red', factionId: 'civ-norse' },
  ])

  assert.equal(players[0].civ, 'Hellas')
  assert.equal(players[0].isPlayed, true)
  assert.notDeepEqual(
    { i: players[0].i, j: players[0].j },
    { i: 2, j: 2 }
  )
  assert.deepEqual(
    players.map(player => ({ civ: player.civ, i: player.i, j: player.j })),
    [
      { civ: 'Hellas', i: 6, j: 6 },
      { civ: 'Norse', i: 2, j: 2 },
    ]
  )
})
