const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadWorldRegionTravel() {
  return loadTsModule('app/services/world/WorldRegionTravelSystem.ts', {
    mocks: {
      '../../lib/mapSpaces': {
        getEntityMapPoint: unit => ({ x: unit.x ?? 0, y: unit.y ?? 0 }),
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
      },
    },
  })
}

function loadTravelParty(arrivalCell = null) {
  return loadTsModule('app/screens/game/GameTravelParty.ts', {
    mocks: {
      '../../lib': {
        getFreeLandCellAroundInstance: () => arrivalCell,
        teleportRuntimeUnitToCell: (_map, unit, cell) => Object.assign(unit, cell),
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

for (const freshWorld of [true, false]) {
  test(`arrival explores only the destination viewport in a ${freshWorld ? 'new' : 'visited'} world`, () => {
    const { applyTravelPartyToRuntime } = loadTravelParty()
    const hero = { type: 'Hero', x: 100, y: 100 }
    const explored = new Set(freshWorld ? ['temporary spawn'] : ['previous visit'])
    let camera = 'temporary spawn'
    const context = {
      paused: true,
      player: {
        units: [hero],
        views: {
          removeViewerEverywhere() {},
          clearVisibility() {},
          clearExploration: () => explored.clear(),
        },
      },
      controls: {
        heroUnit: hero,
        runtimeInputEnabled: false,
        focusHeroCamera() {
          camera = `${hero.x}:${hero.y}`
          this.updateVisibleCells()
        },
        updateVisibleCells: () => explored.add(camera),
        init() {}, // Input-bound camera changes are blocked during travel.
      },
      menu: {},
      map: {},
    }
    applyTravelPartyToRuntime(
      { _gameContext: () => context },
      { hero: null, followers: [] },
      { i: 2, j: 3, x: 1000, y: 2000 },
      { freshWorld }
    )
    assert.deepEqual([...explored], freshWorld ? ['1000:2000'] : ['previous visit', '1000:2000'])
  })
}

test('converted followers retain their original civilization before their destination sprite is constructed', () => {
  const { applyTravelPartyToRuntime, extractTravelParty } = loadTravelParty({ i: 1, j: 1 })
  const hero = { type: 'Hero', label: 'hero' }
  let created
  const player = {
    civ: 'Hellas', units: [hero], views: { removeViewerEverywhere: () => [] },
    createUnit(options) {
      assert.equal(options.assetCiv, 'Kemet')
      assert.equal(options.assetAge, 1)
      assert.deepEqual(options.appearanceVariants, { gender: 'female' })
      created = { ...options, renderedCiv: options.assetCiv || this.civ }
      this.units.push(created)
      return created
    },
  }
  const context = { player, controls: { heroUnit: hero }, map: { revealEverything: true } }
  const snapshot = JSON.parse(JSON.stringify({ players: [{ isPlayed: true, units: [hero, {
    type: 'Villager', label: 'converted', followingHero: true,
    assetCiv: 'Kemet', assetAge: 1, appearanceVariants: { gender: 'female' },
  }] }] }))
  applyTravelPartyToRuntime({ _gameContext: () => context }, extractTravelParty(snapshot))
  assert.equal(created.renderedCiv, 'Kemet')
  assert.equal(created.followingHero, true)
})

test('travel party refreshes the restored facing before revealing the paused world', () => {
  const { applyTravelPartyToRuntime } = loadTravelParty()
  const rendered = []
  const hero = {
    type: 'Hero',
    degree: 12,
    setTextures(sheet) {
      rendered.push([sheet, this.degree])
    },
  }
  const context = {
    paused: true,
    player: { units: [hero], views: { removeViewerEverywhere: () => [] } },
    controls: { heroUnit: hero },
    map: { revealEverything: true },
  }
  applyTravelPartyToRuntime(
    { _gameContext: () => context },
    {
      hero: { type: 'Hero', degree: 270 },
      followers: [],
    }
  )
  assert.deepEqual(rendered, [['standingSheet', 270]])
  assert.equal(context.paused, true)
})

function loadWorldRegionTravelRuntime(calls) {
  return loadTsModule('app/screens/game/GameWorldRegionTravel.ts', {
    mocks: {
      '../../lib': { getReliefOffset: () => 0 },
      '../../lib/mapSpaces': {
        getEntityMapPoint: unit => ({ x: unit.x ?? 0, y: unit.y ?? 0 }),
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
      },
      '../../serialization/CampaignSave': {
        addChildWorldToCampaign: (campaign, state, options) => {
          calls.addedWorlds.push(options.worldId)
          return {
            ...campaign,
            currentWorldId: options.worldId,
            worlds: {
              ...campaign.worlds,
              [options.worldId]: { id: options.worldId, state },
            },
          }
        },
        createInitialCampaignSave: state => ({
          currentWorldId: 'initial',
          worlds: { initial: { id: 'initial', state } },
          worldGraph: { nodes: {} },
        }),
        enterCampaignWorld: (campaign, worldId) => ({
          ...campaign,
          currentWorldId: worldId,
        }),
        updateCurrentWorldState: (campaign, state) => ({
          ...campaign,
          worlds: {
            ...campaign.worlds,
            [campaign.currentWorldId]: {
              ...campaign.worlds[campaign.currentWorldId],
              state,
            },
          },
        }),
      },
      '../../serialization/SaveSerializer': { serializeGame: context => context.serialized },
      '../../services/world/WorldRegionTravelSystem': {
        worldRegionSourceSize: map => map.size,
        arrivalCellForRegionEdge: () => ({ i: 9, j: 9 }),
        findOpenWorldTravelCell: () => ({ i: 9, j: 9 }),
      },
      '../../ui/BuildingInteriorTransition': {
        playBuildingInteriorDoorTransition: async (callback, options) => {
          calls.concealed = true
          calls.blockInput = options.blockInput
          try {
            await callback()
            if (calls.checkArrivalFrame) await options.beforeReveal?.()
            calls.revealed = true
          } finally {
            calls.fadeDestroyed = true
          }
        },
      },
      './GameTravelParty': {
        applyTravelPartyToRuntime: (...args) => calls.travelPartyApplications.push(args),
        extractTravelParty: state => ({
          followers: [],
          hero: state.players?.[0]?.units?.find(unit => unit.type === 'Hero') ?? null,
        }),
        runtimeHeroUnit: game => game._gameContext().hero ?? null,
      },
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

function createSparseMap() {
  const { localToGrid } = loadTsModule('app/lib/localMapLayout.ts')
  const localGridLayout = { columns: 12, rows: 45 }
  const grid = Array.from({ length: 34 }, () => [])
  for (let row = 0; row < localGridLayout.rows; row++) {
    for (let column = 0; column < localGridLayout.columns - (row % 2); column++) {
      const point = localToGrid(column, row, localGridLayout)
      grid[point.i][point.j] = { ...point, category: 'Grass' }
    }
  }
  return { grid, size: 33, localGridLayout }
}

test('sparse region arrivals use opposite display edges and stay outside the crossing margin', () => {
  const { localToGrid, gridToLocal } = loadTsModule('app/lib/localMapLayout.ts')
  const { arrivalCellForRegionEdge, WorldRegionTravelSystem } = loadWorldRegionTravel()
  const map = createSparseMap()
  Object.assign(map, {
    worldId: 'world',
    worldRegionId: 'current',
    worldRegion: { x: 2, y: 2 },
    worldManifest: {
      maps: [
        { id: 'current', size: 20, region: { x: 2, y: 2 } },
        { id: 'east', size: 20, region: { x: 3, y: 2 } },
        { id: 'west', size: 20, region: { x: 1, y: 2 } },
        { id: 'north', size: 20, region: { x: 2, y: 1 } },
        { id: 'south', size: 20, region: { x: 2, y: 3 } },
      ],
    },
  })
  const crossings = []
  const context = { map, app: { ticker: { add() {}, remove() {} } }, controls: { heroUnit: null } }
  const system = new WorldRegionTravelSystem(context, {
    preloadWorldRegion: async () => {},
    travelToWorldRegion: async (id, edge) => crossings.push([id, edge]),
  })
  for (const [column, row] of [
    [1, 20],
    [10, 20],
    [5, 1],
    [5, 43],
  ]) {
    context.controls.heroUnit = { ...localToGrid(column, row, map.localGridLayout), isChief: true }
    system.update(160)
  }
  assert.equal(crossings.length, 0, 'penultimate display tiles must not trigger travel')
  for (const [edge, column, row, expected] of [
    ['west', 0, 21, { column: 8, row: 21 }],
    ['east', 10, 21, { column: 2, row: 21 }],
    ['north', 5, 0, { column: 5, row: 40 }],
    ['south', 5, 44, { column: 5, row: 4 }],
  ]) {
    const previous = localToGrid(column, row, map.localGridLayout)
    context.controls.heroUnit = { ...previous, isChief: true }
    system._travelling = false
    system.update(160)
    assert.deepEqual(crossings.at(-1), [edge, edge])
    const arrival = arrivalCellForRegionEdge(map, edge, previous)
    assert.deepEqual(gridToLocal(arrival.i, arrival.j, map.localGridLayout), expected)
    context.controls.heroUnit = arrival
    system._travelling = false
    const count = crossings.length
    system.update(160)
    assert.equal(crossings.length, count)
  }
  map.mapType = 'interior'
  context.controls.heroUnit = localToGrid(0, 20, map.localGridLayout)
  system.update(160)
  assert.equal(crossings.length, 4)
})

test('world region travel stays disabled while the hero is inside a building space', () => {
  const { WorldRegionTravelSystem } = loadWorldRegionTravel()
  const travelled = []
  const map = {
    size: 12,
    mapType: 'world-region',
    worldId: 'world-test',
    worldRegion: { x: 2, y: 2 },
    worldManifest: {
      maps: [{ id: 'west', region: { x: 2, y: 1 }, size: 12 }],
    },
  }
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: { heroUnit: { isChief: true, i: 0, j: 6, spaceId: 'interior:house', x: 0, y: 0 }, setCamera: () => {} },
    map,
    menu: { showMessage: () => {} },
  }
  const system = new WorldRegionTravelSystem(context, {
    preloadWorldRegion: async () => {},
    travelToWorldRegion: async (regionId, edge) => travelled.push([regionId, edge]),
  })

  system.update(160)
  system.crossToNeighbor('west')

  assert.deepEqual(travelled, [])
})

test('sparse arrival searches skip missing, occupied, water and border cells', () => {
  const { localToGrid } = loadTsModule('app/lib/localMapLayout.ts')
  const { arrivalCellForRegionEdge } = loadWorldRegionTravel()
  const map = createSparseMap()
  for (const row of map.grid) for (const cell of row) if (cell) cell.solid = true
  const target = localToGrid(2, 20, map.localGridLayout)
  delete map.grid[target.i][target.j]
  const open = localToGrid(4, 20, map.localGridLayout)
  map.grid[open.i][open.j].solid = false
  assert.equal(
    arrivalCellForRegionEdge(map, 'east', localToGrid(11, 20, map.localGridLayout)),
    map.grid[open.i][open.j]
  )
  map.grid[open.i][open.j].category = 'Water'
  assert.equal(arrivalCellForRegionEdge(map, 'east', localToGrid(11, 20, map.localGridLayout)), null)
})

test('world region travel arrives inside the opposite edge with a safety inset', () => {
  const { arrivalCellForRegionEdge } = loadWorldRegionTravel()
  const map = createMap()

  assert.deepEqual(arrivalCellForRegionEdge(map, 'west', { i: 0, j: 5 }), map.grid[11][5])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'east', { i: 12, j: 5 }), map.grid[1][5])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'north', { i: 6, j: 0 }), map.grid[6][11])
  assert.deepEqual(arrivalCellForRegionEdge(map, 'south', { i: 6, j: 12 }), map.grid[6][1])
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
        { id: 'west', region: { x: 1, y: 2 }, size: 12 },
        { id: 'east', region: { x: 3, y: 2 }, size: 12 },
        { id: 'north', region: { x: 2, y: 1 }, size: 12 },
        { id: 'south', region: { x: 2, y: 3 }, size: 12 },
      ],
    },
  }
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: { heroUnit: { isChief: true, i: 0, j: 6, x: 0, y: 0 }, setCamera: () => {} },
    map,
    menu: { showMessage: () => {} },
  }
  const system = new WorldRegionTravelSystem(context, {
    preloadWorldRegion: async () => {},
    travelToWorldRegion: async (regionId, edge) => travelled.push([regionId, edge]),
  })

  system.crossToNeighbor('west')
  context.controls.heroUnit = { isChief: true, i: 12, j: 6, x: 0, y: 0 }
  system._travelling = false
  system.crossToNeighbor('east')
  context.controls.heroUnit = { isChief: true, i: 6, j: 0, x: 0, y: 0 }
  system._travelling = false
  system.crossToNeighbor('north')
  context.controls.heroUnit = { isChief: true, i: 6, j: 12, x: 0, y: 0 }
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
    players: [
      { isPlayed: true, units: [hero, follower, idleVillager, deadFollower, destroyedFollower] },
      { isPlayed: false, units: [{ ...follower, label: 'hostile-follower' }] },
    ],
  })

  assert.equal(party.hero, hero)
  assert.deepEqual(party.followers, [follower])
})

test('runtime region travel ignores direct calls while the hero is inside a building space', async () => {
  const calls = { addedWorlds: [], travelPartyApplications: [] }
  const { debugTeleportWorldMap, travelToWorldRegion } = loadWorldRegionTravelRuntime(calls)
  const snapshot = {
    config: { worldId: 'world-test' },
    players: [{ units: [{ type: 'Hero' }] }],
    resources: [],
    animals: [],
  }
  const context = {
    controls: {
      setRuntimeInputEnabled: enabled => {
        calls.input = enabled
      },
    },
    hero: { isChief: true, i: 0, j: 6, spaceId: 'interior:house', x: 0, y: 0 },
    map: { mapType: 'world-region', size: 12, worldId: 'world-test', worldRegionId: 'region-a' },
    serialized: snapshot,
  }
  const game = {
    context,
    config: snapshot.config,
    _campaignSave: null,
    _gameContext: () => context,
    _map: () => context.map,
    _loadRequiredWorldMapBlueprint: async () => {
      calls.preloaded = true
    },
    _destroyRuntime: () => {
      calls.destroyed = true
    },
    _bootFromConfig: async () => {
      calls.booted = true
    },
    _bootFromSave: async () => {},
    _autosaveCampaign: () => {
      calls.autosaved = true
    },
    _restartSaveData: null,
    _worldRegionTransitioning: false,
    togglePause: () => {},
  }

  await travelToWorldRegion(game, 'region-b', 'west')
  await debugTeleportWorldMap(game, { worldI: 0, worldJ: 0, worldRegionId: 'region-a' })

  assert.equal(game._worldRegionTransitioning, false)
  assert.equal(calls.input, undefined)
  assert.equal(calls.preloaded, undefined)
  assert.equal(calls.booted, undefined)
  assert.equal(calls.travelPartyApplications.length, 0)
})

for (const { square, legacyRoot, duplicate, debug } of [
  { square: false },
  { square: true },
  { square: true, legacyRoot: true },
  { square: true, legacyRoot: true, duplicate: true },
  { square: true, legacyRoot: true, duplicate: true, debug: true },
])
  test(`world region travel restores a visited region (${JSON.stringify({ square, legacyRoot, duplicate, debug })})`, async () => {
    const calls = { addedWorlds: [], travelPartyApplications: [], checkArrivalFrame: true }
    const { travelToWorldRegion, debugTeleportWorldMap } = loadWorldRegionTravelRuntime(calls)
    const savedWorldId = legacyRoot ? 'world-4242' : 'region-b'
    const departureState = {
      config: { worldId: 'world-test', worldRegionId: 'region-a' },
      players: [{ isPlayed: true, units: [{ i: 2, j: 2, label: 'hero', type: 'Hero' }] }],
      runtime: {
        heroEquippedItem: 'bow',
        dayNightElapsedMs: 100,
        weather: { phase: 'rainHeavy', phaseEndsAt: 8000, rainIntensity: 0.9 },
      },
      world: { worldId: 'world-test', worldRegionId: 'region-a' },
    }
    const visitedRegionState = {
      config: { worldId: 'world-test', worldRegionId: 'region-b' },
      players: [
        {
          isPlayed: true,
          views: [[{ viewed: true, viewBy: ['woodcutter'] }]],
          buildings: [{ type: 'TownCenter', inventory: { resources: { wood: 123 } } }],
          units: [
            { i: 3, j: 3, label: 'hero', type: 'Hero' },
            { action: 'wood', i: 4, j: 4, label: 'woodcutter', type: 'Villager' },
          ],
        },
      ],
      runtime: { dayNightElapsedMs: 200 },
      world: { worldId: 'world-test', worldRegionId: 'region-b' },
    }
    let currentContext = {
      app: { canvas: {}, render: () => {
        assert.equal(calls.paused, true)
        assert.equal(calls.lightingRefreshed, true)
        assert.notEqual(calls.revealed, true)
        calls.arrivalRendered = true
      } },
      controls: {
        setEquippedItem: item => {
          calls.equippedItem = item
        },
        camera: { x: 0, y: 0 },
        init: () => {},
        localToScreen: (x, y) => ({ x, y }),
        setCamera: () => {},
        setRuntimeInputEnabled: () => {},
        updateVisibleCells: () => {},
        getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 100, visibleWidth: 200, visibleHeight: 100 }),
      },
      dayNight: { getElapsedMs: () => 555 },
      unitRest: {
        synchronizeAfterTimeJump: () => {
          calls.restSynchronized = true
        },
      },
      hero: { isChief: true, i: 2, j: 2, x: 0, y: 0 },
      map: { size: 12, worldId: 'world-test', localGridLayout: square ? { columns: 8, rows: 29 } : undefined },
      menu: { refreshMiniMap: () => {}, show: () => {}, updateHeroStatus: () => {} },
      serialized: departureState,
    }
    const game = {
      _refreshSceneLighting: () => {
        assert.equal(calls.paused, true)
        assert.equal(calls.travelPartyApplications.length, 1)
        calls.lightingRefreshed = true
      },
      _campaignSave: {
        currentWorldId: 'region-a',
        worlds: {
          'region-a': { id: 'region-a', state: departureState },
          ...(duplicate ? { 'region-b': { id: 'region-b', state: { ...visitedRegionState, players: [] } } } : {}),
          [savedWorldId]: { id: savedWorldId, state: visitedRegionState },
        },
        worldGraph: { rootWorldId: legacyRoot ? savedWorldId : 'region-a', nodes: {} },
      },
      _autosaveCampaign: () => {
        game.autosaved = true
      },
      _bootFromConfig: async () => {
        game.bootedFromConfig = true
      },
      _bootFromSave: async state => {
        assert.equal(state.runtime.offlineFromElapsedMs, 200)
        delete state.runtime.offlineFromElapsedMs
        game.bootedFromSave = state
        currentContext = { ...currentContext, hero: { isChief: true, i: 3, j: 3, x: 0, y: 0 }, serialized: state }
      },
      _destroyRuntime: () => {},
      _loadRequiredWorldMapBlueprint: async () => {
        calls.preloaded = true
      },
      togglePause: paused => {
        calls.paused = paused
      },
      _gameContext: () => currentContext,
      _map: () => currentContext.map,
      _restartSaveData: null,
      _worldRegionTransitioning: false,
      config: departureState.config,
      context: currentContext,
    }

    if (debug) await debugTeleportWorldMap(game, { worldRegionId: 'region-b', worldI: 9, worldJ: 9 })
    else await travelToWorldRegion(game, 'region-b', 'east')

    assert.equal(calls.arrivalRendered, true)
    assert.equal(game.bootedFromConfig, undefined)
    assert.equal(calls.equippedItem, 'bow')
    assert.equal(game.bootedFromSave.players[0].units[1].label, 'woodcutter')
    assert.equal(game.bootedFromSave.runtime.dayNightElapsedMs, 555)
    assert.equal(calls.restSynchronized, true)
    assert.equal(visitedRegionState.runtime.dayNightElapsedMs, 200)
    assert.equal(game.bootedFromSave.runtime.weather.phase, 'rainHeavy')
    assert.equal(calls.travelPartyApplications[0][3].freshWorld, false)
    assert.equal(calls.addedWorlds.length, 0)
    assert.equal(game._campaignSave.currentWorldId, savedWorldId)
    assert.equal(game._campaignSave.worlds[savedWorldId].state.players[0].units[1].label, 'woodcutter')
    assert.deepEqual(game.bootedFromSave.players[0].views, visitedRegionState.players[0].views)
    assert.deepEqual(game.bootedFromSave.players[0].buildings, visitedRegionState.players[0].buildings)
    assert.equal(game._restartSaveData.currentWorldId, savedWorldId)
    assert.equal(game.autosaved, true)
    assert.equal(calls.paused, false)
    assert.equal(game._worldRegionTransitioning, false)
    if (!debug) assert.equal(calls.preloaded, true)
    assert.equal(calls.concealed, true)
    assert.equal(calls.revealed, true)
    assert.equal(calls.fadeDestroyed, true)
  })

test('border travel leaves hostile units and animals in their source region without scheduling pursuit', async () => {
  const calls = { addedWorlds: [], travelPartyApplications: [] }
  const { travelToWorldRegion } = loadWorldRegionTravelRuntime(calls)
  const hero = { isChief: true, label: 'old-hero', type: 'Hero', i: 2, j: 2 }
  const enemy = { label: 'enemy-unit', type: 'Villager', i: 2, j: 3, sight: 5, hitPoints: 12, dest: hero }
  const wolf = { label: 'wolf', type: 'Wolf', i: 2, j: 4, sight: 5, hitPoints: 12, dest: hero }
  const snapshot = {
    config: { worldId: 'world-test' },
    resources: [],
    animals: [wolf],
    players: [
      { label: 'human', isPlayed: true, units: [hero] },
      { label: 'enemy', units: [enemy] },
    ],
  }
  let context = {
    hero,
    serialized: snapshot,
    players: snapshot.players,
    controls: {},
    menu: {},
    map: { size: 12, worldId: 'world-test', gaia: { animals: [wolf] } },
  }
  const game = {
    context,
    config: snapshot.config,
    _campaignSave: {
      currentWorldId: 'source',
      worlds: { source: { id: 'source', state: snapshot } },
      worldGraph: { nodes: {} },
    },
    _gameContext: () => context,
    _map: () => context.map,
    _destroyRuntime() {},
    _loadRequiredWorldMapBlueprint: async () => {},
    _bootFromConfig: async () => {
      context = {
        ...context,
        hero: { ...hero, label: 'new-hero' },
        worldPursuit: {
          enqueue: entries => {
            calls.pending = entries
          },
        },
      }
      game.context = context
    },
    _autosaveCampaign() {},
  }
  await travelToWorldRegion(game, 'destination', 'east')
  assert.equal(calls.pending, undefined)
  assert.deepEqual(game._campaignSave.worlds.source.state.players[1].units, [enemy])
  assert.deepEqual(game._campaignSave.worlds.source.state.animals, [wolf])
  assert.equal(snapshot.players[1].units[0], enemy)
})

test('world map debug teleport in the current region uses the fade transition', async () => {
  const calls = { addedWorlds: [], travelPartyApplications: [] }
  const { debugTeleportWorldMap } = loadWorldRegionTravelRuntime(calls)
  const snapshot = {
    config: { worldId: 'world-test', worldRegionId: 'region-a' },
    players: [{ isPlayed: true, units: [{ i: 2, j: 2, label: 'hero', type: 'Hero' }] }],
    world: { worldId: 'world-test', worldRegionId: 'region-a' },
  }
  const context = {
    controls: {
      focusHeroCamera: () => {
        calls.cameraFocused = true
        calls.visibilityUpdated = true
      },
      captureMovementInput: () => () => ({ KeyS: 'heroDown' }),
      restoreMovementInput: held => {
        assert.equal(calls.input, true)
        assert.equal(calls.paused, false)
        calls.restoredMovement = held
      },
      setRuntimeInputEnabled: enabled => {
        calls.input = enabled
      },
      updateVisibleCells: () => {
        calls.visibilityUpdated = true
      },
    },
    hero: { isChief: true, i: 2, j: 2, x: 0, y: 0 },
    map: { mapType: 'world-region', size: 12, worldId: 'world-test', worldRegionId: 'region-a' },
    menu: {
      refreshMiniMap: () => {
        calls.minimapRefreshed = true
      },
      updateHeroStatus: () => {
        calls.heroStatusUpdated = true
      },
    },
    serialized: snapshot,
  }
  const game = {
    context,
    config: snapshot.config,
    _campaignSave: null,
    _gameContext: () => context,
    _map: () => context.map,
    _loadRequiredWorldMapBlueprint: async () => {},
    _destroyRuntime: () => {},
    _bootFromConfig: async () => {},
    _bootFromSave: async () => {},
    _autosaveCampaign: () => {
      calls.autosaved = true
    },
    _restartSaveData: null,
    _worldRegionTransitioning: false,
    togglePause: paused => {
      calls.paused = paused
    },
  }

  await debugTeleportWorldMap(game, { worldI: 4, worldJ: 4, worldRegionId: 'region-a' })

  assert.equal(calls.concealed, true)
  assert.equal(calls.revealed, true)
  assert.equal(calls.fadeDestroyed, true)
  assert.equal(calls.blockInput, true)
  assert.deepEqual(calls.restoredMovement, { KeyS: 'heroDown' })
  assert.equal(calls.input, true)
  assert.equal(calls.paused, false)
  assert.equal(calls.travelPartyApplications.length, 1)
  assert.equal(calls.cameraFocused, true)
  assert.equal(calls.visibilityUpdated, true)
})

for (const debug of [false, true])
  for (const failure of ['preload', 'boot', 'restore'])
    test(`failed fade travel restores input and departure state (${failure}, debug=${debug})`, async () => {
      const calls = { addedWorlds: [], travelPartyApplications: [] }
      const { travelToWorldRegion, debugTeleportWorldMap } = loadWorldRegionTravelRuntime(calls)
      const snapshot = {
        config: { worldId: 'world-test' },
        players: [{ units: [{ type: 'Hero' }] }],
        resources: [],
        animals: [],
      }
      const context = {
        app: { canvas: {} },
        serialized: snapshot,
        hero: { isChief: true },
        map: { size: 12, worldId: 'world-test', localGridLayout: { columns: 8, rows: 29 } },
        controls: {
          setRuntimeInputEnabled: enabled => {
            calls.input = enabled
          },
        },
        menu: { show() {} },
      }
      const game = {
        context,
        config: snapshot.config,
        _campaignSave: null,
        _gameContext: () => context,
        _map: () => context.map,
        _loadRequiredWorldMapBlueprint: async () => {
          if (failure === 'preload') throw new Error('preload failure')
        },
        _destroyRuntime: () => {
          calls.destroyed = true
        },
        _bootFromConfig: async () => {
          throw new Error('boot failure')
        },
        _bootFromSave: async saved => {
          calls.restored = saved
          if (failure === 'restore') throw new Error('restore failure')
        },
        _autosaveCampaign() {},
        togglePause: paused => {
          calls.paused = paused
        },
      }
      const travel = debug
        ? debugTeleportWorldMap(game, { worldI: 2, worldJ: 2, worldRegionId: 'other' })
        : travelToWorldRegion(game, 'other', 'south')
      if (failure === 'restore') {
        await assert.rejects(travel, error => {
          assert.deepEqual(
            error.errors.map(item => item.message),
            ['boot failure', 'restore failure']
          )
          return true
        })
        assert.equal(calls.input, false)
        assert.equal(context.map.ready, false)
        assert.equal(game._worldRegionTransitioning, false)
        return
      }
      await assert.rejects(travel, new RegExp(`${failure} failure`))
      assert.equal(calls.input, true)
      assert.equal(calls.paused, false)
      assert.equal(game._worldRegionTransitioning, false)
      assert.equal(calls.fadeDestroyed, true)
      if (failure === 'boot') assert.equal(calls.restored, snapshot)
      else assert.equal(calls.destroyed, undefined)
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
  assert.notDeepEqual({ i: players[0].i, j: players[0].j }, { i: 2, j: 2 })
  assert.deepEqual(
    players.map(player => ({ civ: player.civ, i: player.i, j: player.j })),
    [
      { civ: 'Hellas', i: 6, j: 6 },
      { civ: 'Norse', i: 2, j: 2 },
    ]
  )
})

for (const [edge, i, j] of [['west', 0, 6], ['east', 12, 6], ['north', 6, 0], ['south', 6, 12]]) {
  test(`non-chief hero cannot cross the ${edge} border until promoted`, () => {
    const { WorldRegionTravelSystem } = loadWorldRegionTravel()
    const alerts = []
    const travelled = []
    const preloaded = []
    const hero = { type: 'Hero', isChief: false, i, j }
    const context = {
      app: { ticker: { add() {}, remove() {} } },
      controls: { heroUnit: hero },
      menu: { showMessage: (...args) => alerts.push(args) },
      map: {
        size: 12, worldId: 'world', worldRegion: { x: 2, y: 2 },
        worldManifest: { maps: [
          { id: 'west', region: { x: 1, y: 2 }, size: 12 },
          { id: 'east', region: { x: 3, y: 2 }, size: 12 },
          { id: 'north', region: { x: 2, y: 1 }, size: 12 },
          { id: 'south', region: { x: 2, y: 3 }, size: 12 },
        ] },
      },
    }
    const system = new WorldRegionTravelSystem(context, {
      preloadWorldRegion: async id => preloaded.push(id),
      travelToWorldRegion: async (...args) => travelled.push(args),
    })
    for (let tick = 0; tick < 10; tick++) system.update(160)
    assert.deepEqual(travelled, [])
    assert.deepEqual(preloaded, [])
    assert.equal(system._travelling, false)
    assert.equal(alerts.length, 1, 'staying at the border must not repeat the alert')
    assert.equal(alerts[0][1], 'warning')
    Object.assign(hero, { i: 6, j: 6 })
    system.update(160)
    Object.assign(hero, { i, j })
    system.update(160)
    assert.equal(alerts.length, 2, 'returning to the border shows the alert again')
    hero.isChief = true
    system.update(160)
    assert.deepEqual(travelled, [[edge, edge]])
    assert.equal(alerts.length, 2)
  })
}

test('direct region travel rejects a non-chief hero before saving or starting a transition', async () => {
  const { travelToWorldRegion } = loadWorldRegionTravelRuntime({})
  const alerts = []
  const context = {
    hero: { type: 'Hero', isChief: false },
    menu: { showMessage: (...args) => alerts.push(args) },
    get serialized() { throw new Error('Blocked travel must not serialize the world') },
  }
  await travelToWorldRegion({ _gameContext: () => context }, 'other', 'east')
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0][1], 'warning')
})

test('guest start creates a real AI village of the same civilization beside the human owner', () => {
  const { buildWorldRegionPlayerConfigs } = loadWorldRegionPlayers()
  const { generatePlayers } = loadMapPlayerGeneration()
  const settlements = [{ civ: 'Hellas', kind: 'village', local: { i: 2, j: 2 } }]
  const configs = buildWorldRegionPlayerConfigs({ heroStartVillage: 'Hellas', players: [{ civ: 'Hellas', isHuman: true }] }, { settlements })
  assert.equal(configs.length, 2)
  assert.deepEqual(configs.map(p => p.isHuman), [true, false])
  const map = createMap(12)
  Object.assign(map, { banditCampPositions: [], context: { app: {}, gamebox: {}, scheduler: {} },
    heroOnlyStart: true, noAI: false, playersPos: [], settlements, startingResources: {}, startingAge: 0 })
  map.context.map = map
  const owners = generatePlayers(map, configs)
  assert.equal(owners.length, 2)
  assert.equal(owners[0].isPlayed, true)
  assert.notEqual(owners[1].isPlayed, true)
  assert.equal(owners[0].factionId, owners[1].factionId)
  assert.equal(owners[1].i, 2)
  assert.equal(owners[1].j, 2)
})
