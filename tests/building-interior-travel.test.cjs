const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingInteriorOccupants(overrides = {}) {
  return loadTsModule('app/screens/game/BuildingInteriorOccupants.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      '../../lib': {
        getBuildingFootprintCells: (i, j, grid, size = 1) => {
          const result = []
          const footprintSize = Math.max(1, Math.floor(size))
          const before = Math.floor((footprintSize - 1) / 2)
          const after = footprintSize - before - 1
          for (let x = i - before; x <= i + after; x++) {
            for (let y = j - before; y <= j + after; y++) {
              if (grid[x]?.[y]) result.push(grid[x][y])
            }
          }
          return result
        },
        getFreeLandCellAroundInstance: instance => ({ i: instance.i, j: instance.j }),
      },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats: () => {} },
      '../../services/VillagerShelterLifecycle': { sleepOutside: () => {}, ...overrides.villagerShelterLifecycle },
      '../../services/VillagerShelterRules': {
        getNearestShelter: unit => (unit.nextSleepShelter ? { shelter: unit.nextSleepShelter, targetCell: {} } : null),
        isSleepTime: context => context.dayNight?.state?.hour >= 18,
      },
      './GameStateHelpers': { applyPortableUnitState: () => {} },
      './GamePortalTravel': { refreshPortalPartyFog: () => {} },
    },
  })
}

function loadBuildingInteriorTravel() {
  return loadTsModule('app/screens/game/GameBuildingInteriorTravel.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
          campBucket: 'CampBucket',
          campCrate: 'CampCrate',
          campJarLarge: 'CampJarLarge',
          campJarSmall: 'CampJarSmall',
          campRockPile: 'CampRockPile',
          fireCamp: 'FireCamp',
          house: 'House',
          townCenter: 'TownCenter',
        },
      },
      '../../lib': {
        getFreeLandCellAroundInstance: () => null,
      },
      '../../lib/buildings/interiors': {
        getBuildingInteriorEntryCell: () => null,
        isBuildingInteriorSupported: () => true,
      },
      '../../lib/buildings/interiorExits': {
        getInteriorExitCell: map => map.grid?.[7]?.[11] ?? null,
      },
      '../../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
      '../../serialization/CampaignSave': {
        addChildWorldToCampaign: campaign => campaign,
        createInitialCampaignSave: state => ({ currentWorldId: 'root', worlds: { root: { state } } }),
        enterCampaignWorld: campaign => campaign,
        getCurrentWorldState: campaign => campaign.worlds[campaign.currentWorldId].state,
        returnToParentWorld: campaign => campaign,
        updateCurrentWorldState: campaign => campaign,
      },
      '../../serialization/MapBlueprintLoader': { loadPregeneratedInteriorBlueprint: async () => ({}) },
      '../../serialization/SaveSerializer': { serializeGame: () => ({ players: [] }) },
      '../../ui/BuildingInteriorTransition': {
        BuildingInteriorTransition: class BuildingInteriorTransition {
          async finish() {}
          async playDeparture() {}
          update() {}
        },
      },
      './GameStateHelpers': {
        extractPortalParty: () => ({ followers: [], hero: null }),
        withFogEnabledState: state => state,
        worldStateWithCampaignClock: state => state,
      },
      './GamePortalTravel': {
        applyPortalPartyToRuntime: () => {},
        runtimeHeroUnit: () => null,
      },
      './BuildingInteriorOccupants': {
        addInteriorOccupantsToRuntime: () => [],
        extractBuildingInteriorOccupants: () => [],
        extractBuildingInteriorSleepArrivals: () => [],
        removeBuildingInteriorOccupants: state => state,
        scheduleInteriorSleepArrivals: () => {},
      },
    },
  })
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => ({ i, j })))
}

test('building interior occupants are playable non-party units on the building footprint', () => {
  const { extractBuildingInteriorOccupants } = loadBuildingInteriorOccupants()
  const state = {
    players: [
      {
        isPlayed: true,
        units: [
          { i: 5, j: 5, label: 'hero', type: 'Hero' },
          { i: 4, j: 5, label: 'follower', type: 'Villager' },
          { i: 5, j: 4, label: 'inside', type: 'Villager' },
          { i: 8, j: 8, label: 'outside', type: 'Villager' },
          { i: 5, j: 6, label: 'dead', isDead: true, type: 'Villager' },
        ],
      },
      {
        isPlayed: false,
        units: [{ i: 5, j: 5, label: 'enemy', type: 'Villager' }],
      },
    ],
  }
  const map = { grid: makeGrid(12) }
  const building = { i: 5, j: 5, size: 3, type: 'TownCenter' }

  const occupants = extractBuildingInteriorOccupants(state, map, building, {
    hero: state.players[0].units[0],
    followers: [state.players[0].units[1]],
  })

  assert.deepEqual(
    occupants.map(unit => unit.label),
    ['inside']
  )
})

test('sleeping villagers inside a town center are transferred even after leaving the footprint', () => {
  const { extractBuildingInteriorOccupants } = loadBuildingInteriorOccupants()
  const townCenter = { i: 5, j: 5, label: 'tc-1', size: 3, type: 'TownCenter' }
  const state = {
    players: [
      {
        isPlayed: true,
        units: [
          { i: 2, j: 2, label: 'sleeping-villager', type: 'Villager' },
          { i: 2, j: 3, label: 'awake-villager', type: 'Villager' },
        ],
      },
    ],
  }
  const runtimeUnits = [
    {
      label: 'sleeping-villager',
      shelterState: { status: 'inside', reason: 'sleep', location: 'shelter', shelter: townCenter },
    },
    {
      label: 'awake-villager',
      shelterState: null,
    },
  ]

  const occupants = extractBuildingInteriorOccupants(
    state,
    { grid: makeGrid(12) },
    townCenter,
    { hero: null, followers: [] },
    runtimeUnits
  )

  assert.deepEqual(
    occupants.map(unit => [unit.label, unit.sleepInInterior]),
    [['sleeping-villager', true]]
  )
})

test('runtime followers on a building footprint are not transferred as passive occupants', () => {
  const { extractBuildingInteriorOccupants } = loadBuildingInteriorOccupants()
  const townCenter = { i: 5, j: 5, label: 'tc-1', size: 3, type: 'TownCenter' }
  const state = {
    players: [
      {
        isPlayed: true,
        units: [{ i: 5, j: 5, label: 'runtime-follower', type: 'Villager' }],
      },
    ],
  }
  const runtimeUnits = [{ label: 'runtime-follower', followingHero: true }]

  const occupants = extractBuildingInteriorOccupants(
    state,
    { grid: makeGrid(12) },
    townCenter,
    { hero: null, followers: [] },
    runtimeUnits
  )

  assert.deepEqual(occupants, [])
})

test('villagers whose next sleep target is the town center are queued as interior night arrivals', () => {
  const { extractBuildingInteriorSleepArrivals } = loadBuildingInteriorOccupants()
  const townCenter = { i: 5, j: 5, label: 'tc-1', size: 3, type: 'TownCenter' }
  const otherHouse = { i: 1, j: 1, label: 'house-1', size: 2, type: 'House' }
  const state = {
    players: [
      {
        isPlayed: true,
        units: [
          { i: 2, j: 2, label: 'future-sleeper', type: 'Villager' },
          { i: 2, j: 3, label: 'other-sleeper', type: 'Villager' },
          { i: 2, j: 4, label: 'follower', followingHero: true, type: 'Villager' },
          { i: 2, j: 5, label: 'soldier', type: 'Fantassin' },
        ],
      },
    ],
  }
  const runtimeUnits = [
    { label: 'future-sleeper', nextSleepShelter: townCenter },
    { label: 'other-sleeper', nextSleepShelter: otherHouse },
    { label: 'follower', nextSleepShelter: townCenter },
    { label: 'soldier', nextSleepShelter: townCenter },
  ]

  const arrivals = extractBuildingInteriorSleepArrivals(
    state,
    townCenter,
    { hero: null, followers: [] },
    runtimeUnits
  )

  assert.deepEqual(
    arrivals.map(unit => [unit.label, unit.sleepInInterior]),
    [['future-sleeper', true]]
  )
})

test('runtime followers are not queued as interior night arrivals', () => {
  const { extractBuildingInteriorSleepArrivals } = loadBuildingInteriorOccupants()
  const townCenter = { i: 5, j: 5, label: 'tc-1', size: 3, type: 'TownCenter' }
  const state = {
    players: [
      {
        isPlayed: true,
        units: [{ i: 2, j: 2, label: 'runtime-follower', type: 'Villager' }],
      },
    ],
  }
  const runtimeUnits = [{ label: 'runtime-follower', followingHero: true, nextSleepShelter: townCenter }]

  const arrivals = extractBuildingInteriorSleepArrivals(
    state,
    townCenter,
    { hero: null, followers: [] },
    runtimeUnits
  )

  assert.deepEqual(arrivals, [])
})

test('interior night arrivals respect the target building sleep capacity', () => {
  const { extractBuildingInteriorSleepArrivals } = loadBuildingInteriorOccupants()
  const house = { i: 5, j: 5, label: 'house-1', size: 2, type: 'House' }
  const state = {
    players: [
      {
        isPlayed: true,
        units: Array.from({ length: 7 }, (_, index) => ({
          i: 2,
          j: index,
          label: `sleeper-${index}`,
          type: 'Villager',
        })),
      },
    ],
  }
  const runtimeUnits = state.players[0].units.map(unit => ({ label: unit.label, nextSleepShelter: house }))

  const arrivals = extractBuildingInteriorSleepArrivals(state, house, { hero: null, followers: [] }, runtimeUnits)

  assert.deepEqual(
    arrivals.map(unit => unit.label),
    ['sleeper-0', 'sleeper-1', 'sleeper-2', 'sleeper-3', 'sleeper-4']
  )
})

test('transferred building occupants and queued sleepers are removed from the parent save', () => {
  const { removeBuildingInteriorOccupants } = loadBuildingInteriorOccupants()
  const state = {
    players: [
      {
        isPlayed: true,
        selectedUnitLabel: 'inside',
        selectedUnitLabels: ['inside', 'future-sleeper', 'outside'],
        units: [
          { i: 5, j: 5, label: 'inside', type: 'Villager' },
          { i: 4, j: 8, label: 'future-sleeper', type: 'Villager' },
          { i: 8, j: 8, label: 'outside', type: 'Villager' },
        ],
      },
      {
        isPlayed: false,
        units: [{ i: 5, j: 5, label: 'inside', type: 'Villager' }],
      },
    ],
  }

  const nextState = removeBuildingInteriorOccupants(state, [
    { i: 5, j: 5, label: 'inside', type: 'Villager' },
    { i: 4, j: 8, label: 'future-sleeper', sleepInInterior: true, type: 'Villager' },
  ])

  assert.deepEqual(
    nextState.players[0].units.map(unit => unit.label),
    ['outside']
  )
  assert.equal(nextState.players[0].selectedUnitLabel, undefined)
  assert.deepEqual(nextState.players[0].selectedUnitLabels, ['outside'])
  assert.deepEqual(
    nextState.players[1].units.map(unit => unit.label),
    ['inside']
  )
})

test('scheduled interior sleep arrivals can wait for the scheduler and report saved arrivals', () => {
  const sleepOutsideCalls = []
  const { scheduleInteriorSleepArrivals } = loadBuildingInteriorOccupants({
    villagerShelterLifecycle: {
      sleepOutside: (unit, reason, options) => sleepOutsideCalls.push([unit.label, reason, options]),
    },
  })
  const scheduled = []
  const arrivals = []
  const createdUnits = []
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = { ...options, label: options.label }
      this.units.push(unit)
      createdUnits.push(unit)
      return unit
    },
  }
  const game = {
    _gameContext() {
      return {
        dayNight: { state: { hour: 22 } },
        map: { random: () => 0, revealEverything: true },
        player,
        scheduler: {
          add(callback) {
            scheduled.push(callback)
            return 7
          },
          remove: id => arrivals.push(['remove', id]),
        },
      }
    },
  }

  scheduleInteriorSleepArrivals(
    game,
    [{ i: 1, j: 1, label: 'sleeper', sleepInInterior: true, type: 'Villager' }],
    () => ({ i: 3, j: 3 }),
    {
      flushImmediately: false,
      onArrival: (occupant, units) => arrivals.push(['arrival', occupant.label, units[0]?.label]),
    }
  )

  assert.equal(createdUnits.length, 0)
  scheduled[0]()
  assert.deepEqual(arrivals, [
    ['arrival', 'sleeper', 'sleeper'],
    ['remove', 7],
  ])
  assert.deepEqual(sleepOutsideCalls, [['sleeper', 'sleep', { visual: 'animate' }]])
  assert.equal(createdUnits[0].i, 3)
  assert.equal(createdUnits[0].j, 3)
})

test('interior sleepers spawn already on the final sleep frame', () => {
  const sleepOutsideCalls = []
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants({
    villagerShelterLifecycle: {
      sleepOutside: (unit, reason, options) => sleepOutsideCalls.push([unit.label, reason, options]),
    },
  })
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = {
        ...options,
        context: {},
        label: options.label,
      }
      this.units.push(unit)
      return unit
    },
  }
  const game = {
    _gameContext() {
      return {
        map: { grid: makeGrid(12), random: () => 0 },
        player,
      }
    },
  }

  addInteriorOccupantsToRuntime(game, [{ i: 1, j: 1, label: 'sleeper', sleepInInterior: true, type: 'Villager' }], {
    i: 3,
    j: 3,
  })

  assert.deepEqual(sleepOutsideCalls, [['sleeper', 'sleep', { visual: 'finalFrame' }]])
})

test('awake interior occupants spawn on the interior exit cell when it is free', () => {
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants()
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = { ...options, label: options.label }
      this.units.push(unit)
      return unit
    },
  }
  const game = {
    _gameContext() {
      return {
        map: { random: () => 0 },
        player,
      }
    },
  }

  const [occupant] = addInteriorOccupantsToRuntime(game, [{ i: 1, j: 1, label: 'awake', type: 'Villager' }], {
    i: 7,
    j: 11,
  })

  assert.equal(occupant.i, 7)
  assert.equal(occupant.j, 11)
})

test('interior occupants preserve gendered appearance before initialization', () => {
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants()
  const created = []
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      created.push(options)
      const unit = { ...options, label: options.label }
      this.units.push(unit)
      return unit
    },
  }
  const game = {
    _gameContext() {
      return {
        map: { random: () => 0 },
        player,
      }
    },
  }

  addInteriorOccupantsToRuntime(
    game,
    [
      {
        i: 1,
        j: 1,
        label: 'occupant-1',
        name: 'Julia',
        gender: 'female',
        appearanceVariants: { gender: 'female' },
        type: 'Villager',
      },
    ],
    { i: 7, j: 11 }
  )

  assert.equal(created[0].gender, 'female')
  assert.deepEqual(created[0].appearanceVariants, { gender: 'female' })
  assert.equal(created[0].label, 'occupant-1')
})

test('interior sleepers are placed away from the exit cell', () => {
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants({
    villagerShelterLifecycle: {
      sleepOutside: () => {},
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ i, j, category: 'Dirt', solid: false, terrainHidden: false }))
  )
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = { ...options, label: options.label }
      this.units.push(unit)
      grid[options.i][options.j].has = unit
      grid[options.i][options.j].solid = true
      return unit
    },
  }
  const game = {
    _gameContext() {
      return {
        map: { grid, interiorExits: [{ i: 2, j: 2 }], mapType: 'interior', random: () => 0, size: 2 },
        player,
      }
    },
  }

  const [sleeper] = addInteriorOccupantsToRuntime(
    game,
    [{ i: 1, j: 1, label: 'sleeper', sleepInInterior: true, type: 'Villager' }],
    { i: 2, j: 2 }
  )

  assert.notDeepEqual([sleeper.i, sleeper.j], [2, 2])
})
