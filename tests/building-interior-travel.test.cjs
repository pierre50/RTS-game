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
      '../../services/rest/UnitRestLifecycle': { sleepOutside: () => {}, ...overrides.unitRestLifecycle },
      '../../services/rest/UnitRestRules': {
        canUseUnitRest: unit => !unit.isDead && !unit.isDestroyed && !unit.followingHero && unit.type !== 'Hero',
        getNearestShelter: unit => (unit.nextSleepShelter ? { shelter: unit.nextSleepShelter, targetCell: {} } : null),
        isSleepTime: context => context.dayNight?.state?.hour >= 18,
      },
      './GameStateHelpers': { applyPortableUnitState: () => {} },
      './GamePortalTravel': { refreshPortalPartyFog: () => {} },
    },
  })
}

function loadBuildingInteriorTravel(overrides = {}) {
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
        getFreeLandCellAroundInstance: overrides.getFreeLandCellAroundInstance ?? (() => null),
        resumeVillagerAutonomy: overrides.resumeVillagerAutonomy ?? (() => false),
      },
      '../../lib/buildings/interiors': {
        getBuildingInteriorBlueprintType: building => building.interior?.type || building.type,
        getBuildingInteriorEntryCell: overrides.getBuildingInteriorEntryCell ?? (() => null),
        getBuildingInteriorEntryPosition:
          overrides.getBuildingInteriorEntryPosition ?? (building => ({ i: building.i + 1, j: building.j + 2 })),
        getBuildingInteriorPortalId: building =>
          `${building.owner?.label || 'owner'}:${building.label || `${building.i},${building.j},${building.type}`}`,
        isBuildingInteriorSupported: () => true,
      },
      '../../lib/buildings/knownBuildings': {
        getKnownBuildings: context =>
          context.players?.flatMap(player => player.buildings ?? []) ?? context.player?.buildings ?? [],
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
        returnToParentWorld:
          overrides.returnToParentWorld ??
          (campaign => ({
            ...campaign,
            currentWorldId: campaign.worlds[campaign.currentWorldId]?.parentWorldId ?? campaign.currentWorldId,
          })),
        updateCurrentWorldState:
          overrides.updateCurrentWorldState ??
          ((campaign, state) => ({
            ...campaign,
            worlds: {
              ...campaign.worlds,
              [campaign.currentWorldId]: {
                ...campaign.worlds[campaign.currentWorldId],
                state,
              },
            },
          })),
      },
      '../../serialization/MapBlueprintLoader': {
        loadPregeneratedInteriorBlueprint:
          overrides.loadPregeneratedInteriorBlueprint ?? (async () => ({ id: 'test-interior' })),
      },
      '../../serialization/SaveSerializer': { serializeGame: overrides.serializeGame ?? (() => ({ players: [] })) },
      '../../services/rest/UnitRestRules': {
        isSleepTime: context => context.dayNight?.state?.hour >= 18 || context.dayNight?.state?.hour < 8,
      },
      '../../services/BuildingInteriorSpaceSystem': {
        getBuildingInteriorSpaceForUnit: overrides.getBuildingInteriorSpaceForUnit ?? (() => null),
        routeUnitOutOfBuildingInteriorSpace: overrides.routeUnitOutOfBuildingInteriorSpace ?? (() => false),
      },
      '../../ui/BuildingInteriorTransition': {
        BuildingInteriorTransition: class BuildingInteriorTransition {
          async finish() {}
          async playDeparture() {}
          update() {}
        },
        playBuildingInteriorDoorTransition: async callback => callback(),
      },
      './GameStateHelpers': {
        extractPortalParty: overrides.extractPortalParty ?? (() => ({ followers: [], hero: null })),
        withFogEnabledState: state => state,
        worldStateWithCampaignClock:
          overrides.worldStateWithCampaignClock ??
          ((state, elapsedMs) =>
            Number.isFinite(elapsedMs)
              ? { ...state, runtime: { ...(state.runtime ?? {}), dayNightElapsedMs: Math.max(0, elapsedMs) } }
              : state),
      },
      './GamePortalTravel': {
        applyPortalPartyToRuntime: overrides.applyPortalPartyToRuntime ?? (() => {}),
        runtimeHeroUnit: overrides.runtimeHeroUnit ?? (() => null),
        teleportRuntimeUnit: overrides.teleportRuntimeUnit ?? (() => {}),
      },
      './BuildingInteriorOccupants': {
        addInteriorOccupantsToRuntime: overrides.addInteriorOccupantsToRuntime ?? (() => []),
        extractBuildingInteriorOccupants: overrides.extractBuildingInteriorOccupants ?? (() => []),
        extractBuildingInteriorSleepArrivals: overrides.extractBuildingInteriorSleepArrivals ?? (() => []),
        removeBuildingInteriorOccupants:
          overrides.removeBuildingInteriorOccupants ??
          ((state, occupants) => {
            const labels = new Set(occupants.map(unit => unit.label).filter(Boolean))
            return {
              ...state,
              players: state.players.map(player => ({
                ...player,
                units: (player.units ?? []).filter(unit => !unit.label || !labels.has(unit.label)),
              })),
            }
          }),
        scheduleInteriorSleepArrivals: overrides.scheduleInteriorSleepArrivals ?? (() => {}),
      },
    },
  })
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => ({ i, j })))
}

function makeRuntimeGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      i,
      j,
      category: 'Grass',
      place(unit) {
        this.has = unit
      },
      removeFog() {},
      setFog() {},
    }))
  )
}

function extractTestPortalParty(state) {
  const played = state.players.find(player => player.isPlayed)
  const hero = played?.units?.find(unit => unit.controlMode === 'hero' || unit.type === 'Hero' || unit.isChief) ?? null
  return {
    hero,
    followers: (played?.units ?? []).filter(unit => unit !== hero && unit.followingHero === true),
  }
}

test('entering a building interior through the runtime layer does not boot a separate map', async () => {
  const opened = []
  const autosaves = []
  const owner = { label: 'player-1' }
  const building = { i: 5, j: 5, isBuilt: true, label: 'tc-1', owner, type: 'TownCenter' }
  const exteriorState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 1234 },
    world: { mapType: 'continent', size: 64 },
    players: [{ buildings: [building], isPlayed: true, label: 'player-1', units: [] }],
    resources: [],
    animals: [],
  }
  const { travelIntoBuildingInterior } = loadBuildingInteriorTravel({
    serializeGame: () => structuredClone(exteriorState),
  })
  const game = {
    _buildingInteriorSession: null,
    _campaignSave: {
      clock: { dayNightElapsedMs: 0 },
      currentWorldId: 'root',
      format: 'campaign-v1',
      heroParty: { followerLabels: [] },
      version: 1,
      worlds: { root: { id: 'root', state: exteriorState } },
    },
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context: {
      controls: {},
      map: { grid: makeGrid(16), mapType: 'continent', random: () => 0, size: 15 },
      menu: {},
      player: { buildings: [building], units: [] },
      players: [],
    },
    _applyMapConfig() {
      assert.fail('runtime layer entry should not configure a new map')
    },
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    async _bootFromSave() {
      assert.fail('runtime layer entry should not boot a save')
    },
    _createRuntime() {
      assert.fail('runtime layer entry should not create a runtime')
    },
    _createUiRuntime() {
      assert.fail('runtime layer entry should not create UI runtime')
    },
    _destroyRuntime() {
      assert.fail('runtime layer entry should not destroy the runtime')
    },
    _gameContext() {
      return this.context
    },
    _map() {
      assert.fail('runtime layer entry should not need the legacy map boot path')
    },
    _mountRuntime() {
      assert.fail('runtime layer entry should not mount a new runtime')
    },
    async _openBuildingInteriorLayer(target) {
      opened.push(target.label)
    },
    async _updateLoading() {
      assert.fail('runtime layer entry should not show the legacy loading transition')
    },
  }

  await travelIntoBuildingInterior(game, building)

  assert.deepEqual(opened, ['tc-1'])
  assert.equal(game._isRestarting, false)
  assert.equal(game._campaignSave.currentWorldId, 'root')
  assert.deepEqual(game._campaignSave.worlds.root.state, exteriorState)
  assert.equal(autosaves.length, 1)
})

test('leaving a building interior runtime layer keeps the exterior map alive', async () => {
  const closed = []
  const autosaves = []
  const exteriorState = {
    camera: { x: 10, y: 20 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 4321 },
    world: { mapType: 'continent', size: 64 },
    players: [{ buildings: [], isPlayed: true, label: 'player-1', units: [] }],
    resources: [],
    animals: [],
  }
  const { travelOutOfBuildingInterior } = loadBuildingInteriorTravel({
    serializeGame: () => structuredClone(exteriorState),
  })
  const game = {
    _buildingInteriorSession: null,
    _campaignSave: {
      clock: { dayNightElapsedMs: 0 },
      currentWorldId: 'root',
      format: 'campaign-v1',
      heroParty: { followerLabels: [] },
      version: 1,
      worlds: { root: { id: 'root', state: { ...exteriorState, camera: { x: 0, y: 0 } } } },
    },
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context: {
      controls: {},
      map: { grid: makeGrid(16), mapType: 'continent', random: () => 0, size: 15 },
      menu: {},
      player: { buildings: [], units: [] },
      players: [],
    },
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    _closeBuildingInteriorLayer() {
      closed.push(true)
    },
    _gameContext() {
      return this.context
    },
    _isBuildingInteriorLayerOpen() {
      return true
    },
    _map() {
      assert.fail('runtime layer exit should not inspect the legacy interior map')
    },
  }

  await travelOutOfBuildingInterior(game)

  assert.deepEqual(closed, [true])
  assert.equal(game._campaignSave.currentWorldId, 'root')
  assert.deepEqual(game._campaignSave.worlds.root.state, exteriorState)
  assert.equal(autosaves.length, 1)
})

test('entering a building interior opens the runtime layer and removes stale child worlds', async () => {
  const autosaves = []
  const opened = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const exteriorState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 1234 },
    world: { mapType: 'continent', size: 64 },
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        label: 'player-1',
        units: [
          { i: 6, j: 7, label: 'hero', type: 'Hero', controlMode: 'hero', hitPoints: 10 },
          { i: 5, j: 5, label: 'inside-now', type: 'Villager' },
        ],
      },
    ],
    resources: [],
    animals: [],
  }
  const legacyInteriorWorldId = 'root-interior-TownCenter-player-1-tc-1'
  const legacyInteriorState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'interior', size: 15 },
    runtime: { dayNightElapsedMs: 1234 },
    world: { mapType: 'interior', size: 15 },
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          { i: 3, j: 3, label: 'old-sleeper', type: 'Villager' },
        ],
      },
    ],
    resources: [],
    animals: [],
  }
  const sourcePlayer = {
    buildings: [townCenter],
    civ: 'Greek',
    color: 'blue',
    factionId: null,
    gender: 'female',
    heroAppearance: null,
    name: 'Player',
    team: 1,
    units: [],
  }
  const context = {
    controls: { equippedItem: null, init() {} },
    map: { grid: makeGrid(16), mapType: 'continent', random: () => 0, size: 15 },
    menu: { init() {}, show() {} },
    player: sourcePlayer,
    players: [sourcePlayer],
  }
  const serializeRuntime = () => {
    if (context.map.mapType !== 'interior') return structuredClone(exteriorState)
    return {
      camera: { x: 0, y: 0 },
      config: { mapType: 'interior', size: 15 },
      runtime: { dayNightElapsedMs: 2345 },
      world: { mapType: 'interior', size: 15 },
      players: [
        {
          buildings: context.player.buildings,
          isPlayed: true,
          label: 'player-1',
          units: context.player.units.map(unit => ({
            controlMode: unit.controlMode,
            hitPoints: unit.hitPoints,
            i: unit.i,
            j: unit.j,
            label: unit.label,
            type: unit.type,
          })),
        },
      ],
      resources: [],
      animals: [],
    }
  }
  const { travelIntoBuildingInterior } = loadBuildingInteriorTravel({
    extractPortalParty: extractTestPortalParty,
    serializeGame: serializeRuntime,
  })
  const game = {
    _buildingInteriorSession: null,
    _campaignSave: {
      clock: { dayNightElapsedMs: 1234 },
      currentWorldId: 'root',
      format: 'campaign-v1',
      heroParty: { followerLabels: [] },
      version: 1,
      worlds: {
        root: { id: 'root', state: exteriorState },
        [legacyInteriorWorldId]: {
          id: legacyInteriorWorldId,
          entryPortalId: 'player-1:tc-1',
          parentWorldId: 'root',
          state: legacyInteriorState,
        },
      },
      worldGraph: {
        rootWorldId: 'root',
        nodes: {
          root: {
            children: [legacyInteriorWorldId],
            color: 'neutral',
            discoveredAt: 1,
            id: 'root',
            name: 'Root',
            parentId: null,
            visitedAt: 1,
          },
          [legacyInteriorWorldId]: {
            children: [],
            color: 'neutral',
            discoveredAt: 1,
            id: legacyInteriorWorldId,
            kind: 'interior',
            name: 'Interior',
            parentId: 'root',
            visitedAt: 1,
          },
        },
      },
    },
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context,
    _applyMapConfig(map, config) {
      map.mapType = config.mapType
      map.size = config.size
      map.grid = makeRuntimeGrid(config.size + 1)
      map.revealEverything = config.revealEverything
    },
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    async _bootFromSave() {},
    _createRuntime() {
      context.map = {
        bakeTerrainToChunks() {},
        generateFromBlueprint: async () => {},
        generatePlayers: () => [
          {
            buildings: [],
            createBuilding(config) {
              const building = { ...config, owner: this }
              this.buildings.push(building)
              return building
            },
            createUnit(config) {
              const unit = { ...config }
              this.units.push(unit)
              return unit
            },
            units: [],
          },
        ],
        grid: makeRuntimeGrid(16),
        mapType: 'interior',
        random: () => 0,
        rebuildTerrainAppearance() {},
        size: 15,
        _flushFogQueue() {},
        _initFogChunks() {},
      }
    },
    _createUiRuntime() {
      context.controls = { equippedItem: null, init() {} }
      context.menu = { init() {}, show() {} }
    },
    _destroyRuntime() {},
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
    _mountRuntime(dayNightElapsedMs) {
      mounted.push(dayNightElapsedMs)
    },
    async _openBuildingInteriorLayer(target) {
      opened.push(target.label)
    },
    async _updateLoading() {},
  }

  await travelIntoBuildingInterior(game, townCenter)

  assert.deepEqual(opened, ['tc-1'])
  assert.equal(context.map.mapType, 'continent')
  assert.equal(game._campaignSave.currentWorldId, 'root')
  assert.equal(game._campaignSave.worlds[legacyInteriorWorldId], undefined)
  assert.equal(game._campaignSave.worldGraph.nodes[legacyInteriorWorldId], undefined)
  assert.deepEqual(game._campaignSave.worldGraph.nodes.root.children, [])
  assert.equal(game._buildingInteriorSession, null)
  assert.equal(autosaves.length, 1)
})

test('session interior sleepers can leave without a campaign child world', () => {
  const autosaves = []
  const destroyed = []
  const removed = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const sourceState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 2000 },
    world: { mapType: 'continent', size: 64 },
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 6, j: 7, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
    resources: [],
    animals: [],
  }
  const interiorState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'interior', size: 15 },
    runtime: { dayNightElapsedMs: 3000 },
    world: { mapType: 'interior', size: 15 },
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          { i: 7, j: 11, label: 'sleeper', type: 'Villager' },
        ],
      },
    ],
    resources: [],
    animals: [],
  }
  const grid = makeRuntimeGrid(12)
  const exitCell = grid[7][11]
  const sleeper = {
    currentCell: exitCell,
    i: 7,
    isDead: false,
    isDestroyed: false,
    j: 11,
    label: 'sleeper',
    shelterState: null,
    type: 'Villager',
    destroy: () => destroyed.push('sleeper'),
  }
  exitCell.has = sleeper
  exitCell.solid = true
  const context = {
    dayNight: { state: { hour: 10 } },
    controls: { equippedItem: null },
    map: {
      grid,
      mapType: 'interior',
      random: () => 0,
      removeChild: unit => removed.push(['child', unit.label]),
      removeFromInstanceBucket: unit => removed.push(['bucket', unit.label]),
      size: 11,
    },
    player: {
      buildings: [],
      units: [{ label: 'hero', type: 'Hero', controlMode: 'hero' }, sleeper],
    },
    scheduler: { remove() {} },
  }
  const { routeInteriorUnitToExit } = loadBuildingInteriorTravel({
    extractPortalParty: extractTestPortalParty,
    serializeGame: () => interiorState,
  })
  const game = {
    _buildingInteriorSession: {
      entryPortalId: 'player-1:tc-1',
      returnedOccupants: [],
      sourceCampaign: {
        clock: { dayNightElapsedMs: 2000 },
        currentWorldId: 'root',
        format: 'campaign-v1',
        heroParty: { followerLabels: [] },
        version: 1,
        worlds: { root: { id: 'root', state: sourceState } },
        worldGraph: { rootWorldId: 'root', nodes: {} },
      },
      sourceWorldId: 'root',
      sourceWorldState: sourceState,
    },
    _campaignSave: {
      clock: { dayNightElapsedMs: 2000 },
      currentWorldId: 'root',
      format: 'campaign-v1',
      heroParty: { followerLabels: [] },
      version: 1,
      worlds: { root: { id: 'root', state: sourceState } },
      worldGraph: { rootWorldId: 'root', nodes: {} },
    },
    _isRestarting: false,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  routeInteriorUnitToExit(game, sleeper)

  assert.deepEqual(
    context.player.units.map(unit => unit.label),
    ['hero']
  )
  assert.deepEqual(removed, [
    ['bucket', 'sleeper'],
    ['child', 'sleeper'],
  ])
  assert.deepEqual(destroyed, ['sleeper'])
  assert.equal(game._campaignSave.currentWorldId, 'root')
  assert.deepEqual(Object.keys(game._campaignSave.worlds), ['root'])
  assert.deepEqual(
    game._campaignSave.worlds.root.state.players[0].units.map(unit => [unit.label, unit.i, unit.j]),
    [
      ['hero', 6, 7],
      ['sleeper', 6, 7],
    ]
  )
  assert.equal(game._campaignSave.clock.dayNightElapsedMs, 3000)
  assert.equal(autosaves.length, 1)
})

test('session occupants that exit before the hero are restored around the parent door', async () => {
  const bootedStates = []
  const destroyed = []
  const removed = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const sourceState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 2000 },
    world: { mapType: 'continent', size: 64 },
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 6, j: 7, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
    resources: [],
    animals: [],
  }
  const grid = makeRuntimeGrid(12)
  const exitCell = grid[7][11]
  const scheduler = {
    elapsedMs: 1000,
    remove() {},
  }
  const hero = { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' }
  const sleeper = {
    currentCell: exitCell,
    dest: null,
    i: 7,
    isDead: false,
    isDestroyed: false,
    j: 11,
    label: 'sleeper',
    path: [],
    shelterState: null,
    type: 'Villager',
    destroy: () => destroyed.push('sleeper'),
  }
  exitCell.has = sleeper
  exitCell.solid = true
  const context = {
    dayNight: { state: { hour: 10 } },
    controls: { equippedItem: null },
    map: {
      grid,
      mapType: 'interior',
      random: () => 0,
      removeChild: unit => removed.push(['child', unit.label]),
      removeFromInstanceBucket: unit => removed.push(['bucket', unit.label]),
      size: 11,
    },
    player: {
      buildings: [],
      units: [hero, sleeper],
    },
    players: [],
    scheduler,
    unitRest: { synchronizeAfterTimeJump() {} },
  }
  const serializeRuntime = () => ({
    camera: { x: 0, y: 0 },
    config: { mapType: context.map.mapType, size: context.map.size },
    runtime: { dayNightElapsedMs: 3000 },
    world: { mapType: context.map.mapType, size: context.map.size },
    players: [
      {
        buildings: context.player.buildings,
        isPlayed: true,
        units: context.player.units.map(unit => ({
          controlMode: unit.controlMode,
          i: unit.i,
          j: unit.j,
          label: unit.label,
          type: unit.type,
        })),
      },
    ],
    resources: [],
    animals: [],
  })
  const { routeInteriorUnitToExit, travelOutOfBuildingInterior } = loadBuildingInteriorTravel({
    applyPortalPartyToRuntime: (_game, party, arrivalCell) => {
      const runtimeHero = context.player.units.find(unit => unit.label === party.hero?.label)
      if (runtimeHero && arrivalCell) {
        runtimeHero.i = arrivalCell.i
        runtimeHero.j = arrivalCell.j
      }
    },
    extractPortalParty: state => ({ followers: [], hero: state.players[0].units.find(unit => unit.label === 'hero') }),
    getBuildingInteriorEntryCell: () => ({ i: 6, j: 7 }),
    getFreeLandCellAroundInstance: (_anchor, runtimeGrid) => runtimeGrid[6][8],
    runtimeHeroUnit: () => hero,
    serializeGame: serializeRuntime,
    teleportRuntimeUnit: (_game, unit, cell) => {
      unit.i = cell.i
      unit.j = cell.j
      unit.currentCell = cell
    },
  })
  const campaign = {
    clock: { dayNightElapsedMs: 2000 },
    currentWorldId: 'root',
    format: 'campaign-v1',
    heroParty: { followerLabels: [] },
    version: 1,
    worlds: { root: { id: 'root', state: sourceState } },
    worldGraph: { rootWorldId: 'root', nodes: {} },
  }
  const game = {
    _buildingInteriorSession: {
      entryPortalId: 'player-1:tc-1',
      returnedOccupants: [],
      sourceCampaign: campaign,
      sourceWorldId: 'root',
      sourceWorldState: sourceState,
    },
    _campaignSave: structuredClone(campaign),
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {},
    async _bootFromSave(state) {
      bootedStates.push(structuredClone(state))
      context.map = { grid: makeRuntimeGrid(12), mapType: 'continent', random: () => 0, size: 11 }
      context.player.buildings = [townCenter]
      context.players = [context.player]
      context.player.units = structuredClone(state.players[0].units)
    },
    _destroyRuntime() {},
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  routeInteriorUnitToExit(game, sleeper)
  await travelOutOfBuildingInterior(game)

  assert.deepEqual(removed, [
    ['bucket', 'sleeper'],
    ['child', 'sleeper'],
  ])
  assert.deepEqual(destroyed, ['sleeper'])
  assert.deepEqual(
    bootedStates[0].players[0].units.map(unit => [unit.label, unit.i, unit.j]),
    [
      ['hero', 6, 7],
      ['sleeper', 6, 7],
    ]
  )
  assert.deepEqual(
    context.player.units.map(unit => [unit.label, unit.i, unit.j]),
    [
      ['hero', 6, 7],
      ['sleeper', 6, 8],
    ]
  )
  assert.equal(game._buildingInteriorSession, null)
  assert.deepEqual(Object.keys(game._campaignSave.worlds), ['root'])
})

test('saving during a building interior session writes the parent world as the current world', () => {
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const sourceState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'continent', size: 64 },
    runtime: { dayNightElapsedMs: 1000 },
    world: { mapType: 'continent', size: 64 },
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 6, j: 7, label: 'hero', type: 'Hero', controlMode: 'hero', hitPoints: 8 }],
      },
    ],
    resources: [],
    animals: [],
  }
  const interiorState = {
    camera: { x: 0, y: 0 },
    config: { mapType: 'interior', size: 15 },
    runtime: { dayNightElapsedMs: 4000 },
    world: { mapType: 'interior', size: 15 },
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero', hitPoints: 3 },
          { i: 3, j: 3, label: 'sleeper', type: 'Villager' },
        ],
      },
    ],
    resources: [],
    animals: [],
  }
  const { buildBuildingInteriorSessionSaveRecord } = loadBuildingInteriorTravel({
    extractPortalParty: extractTestPortalParty,
    serializeGame: () => interiorState,
  })
  const campaign = {
    clock: { dayNightElapsedMs: 1000 },
    currentWorldId: 'root',
    format: 'campaign-v1',
    heroParty: { followerLabels: [] },
    version: 1,
    worlds: { root: { id: 'root', state: sourceState } },
    worldGraph: { rootWorldId: 'root', nodes: {} },
  }
  const game = {
    _buildingInteriorSession: {
      entryPortalId: 'player-1:tc-1',
      returnedOccupants: [],
      sourceCampaign: campaign,
      sourceWorldId: 'root',
      sourceWorldState: sourceState,
    },
    _campaignSave: structuredClone(campaign),
    context: {
      player: {
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          { i: 3, j: 3, label: 'sleeper', type: 'Villager' },
        ],
      },
    },
    _gameContext() {
      return this.context
    },
  }

  const record = buildBuildingInteriorSessionSaveRecord(game, 5000)

  assert.equal(record.currentWorldId, 'root')
  assert.equal(record.worlds.root.state.config.mapType, 'continent')
  assert.equal(record.worlds.root.state.runtime.dayNightElapsedMs, 4000)
  assert.deepEqual(
    record.worlds.root.state.players[0].units.map(unit => [unit.label, unit.hitPoints, unit.i, unit.j]),
    [
      ['hero', 3, 6, 7],
      ['sleeper', undefined, 6, 7],
    ]
  )
})

test('leaving an interior returns passive occupants to the parent world for time jumps', async () => {
  const bootedStates = []
  const teleports = []
  const syncCalls = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const parentState = {
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 1, j: 1, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
  }
  const interiorState = {
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          {
            currentFrame: 2,
            currentSheet: 'dyingSheet',
            i: 0,
            inactif: true,
            j: 0,
            label: 'sleeper',
            type: 'Villager',
          },
        ],
      },
    ],
  }
  const context = {
    controls: { equippedItem: null },
    map: { grid: makeGrid(12), mapType: 'interior', random: () => 0, size: 11 },
    player: {
      buildings: [],
      units: [
        { label: 'hero', type: 'Hero', controlMode: 'hero' },
        { label: 'sleeper', type: 'Villager', shelterState: { status: 'outside', reason: 'sleep' } },
      ],
    },
    unitRest: {
      synchronizeAfterTimeJump: () => syncCalls.push('sync'),
    },
  }
  const { travelOutOfBuildingInterior } = loadBuildingInteriorTravel({
    extractPortalParty: () => ({
      followers: [],
      hero: { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
    }),
    getBuildingInteriorEntryCell: () => ({ i: 6, j: 7 }),
    serializeGame: () => interiorState,
    teleportRuntimeUnit: (_game, unit, cell) => teleports.push([unit.label, cell.i, cell.j]),
  })
  const game = {
    _campaignSave: {
      currentWorldId: 'interior',
      worlds: {
        interior: {
          entryPortalId: 'player-1:tc-1',
          parentWorldId: 'parent',
          state: interiorState,
        },
        parent: {
          state: parentState,
        },
      },
    },
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {},
    async _bootFromSave(state) {
      bootedStates.push(state)
      context.map.mapType = 'continent'
      context.player.buildings = [townCenter]
      context.players = [context.player]
      context.player.units = structuredClone(state.players[0].units)
    },
    _destroyRuntime() {},
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  await travelOutOfBuildingInterior(game)

  const parentUnits = bootedStates[0].players[0].units
  assert.deepEqual(
    parentUnits.map(unit => unit.label),
    ['hero', 'sleeper']
  )
  assert.deepEqual(
    parentUnits.find(unit => unit.label === 'sleeper'),
    {
      action: null,
      currentFrame: undefined,
      currentSheet: undefined,
      dest: null,
      followingHero: false,
      i: 6,
      inactif: false,
      j: 7,
      label: 'sleeper',
      loop: undefined,
      path: [],
      realDest: null,
      type: 'Villager',
    }
  )
  assert.deepEqual(teleports, [['sleeper', 6, 7]])
  assert.deepEqual(syncCalls, ['sync'])
})

test('daytime time jump inside an interior moves passive occupants back to the parent save', () => {
  const autosaves = []
  const removed = []
  const destroyed = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const parentState = {
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 1, j: 1, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
  }
  const interiorState = {
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          {
            currentFrame: 2,
            currentSheet: 'dyingSheet',
            i: 0,
            inactif: true,
            j: 0,
            label: 'sleeper',
            type: 'Villager',
          },
        ],
      },
    ],
  }
  const sleeper = {
    currentCell: { has: null, i: 0, j: 0, solid: true },
    i: 0,
    j: 0,
    label: 'sleeper',
    shelterState: { status: 'outside', reason: 'sleep' },
    type: 'Villager',
    destroy: () => destroyed.push('sleeper'),
  }
  sleeper.currentCell.has = sleeper
  const context = {
    dayNight: { state: { hour: 10 } },
    controls: { equippedItem: null },
    map: {
      grid: makeGrid(12),
      mapType: 'interior',
      random: () => 0,
      removeChild: unit => removed.push(['child', unit.label]),
      removeFromInstanceBucket: unit => removed.push(['bucket', unit.label]),
      size: 11,
    },
    player: {
      buildings: [],
      units: [{ label: 'hero', type: 'Hero', controlMode: 'hero' }, sleeper],
    },
  }
  const { synchronizeInteriorOccupantsAfterTimeJump } = loadBuildingInteriorTravel({
    extractPortalParty: () => ({
      followers: [],
      hero: { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
    }),
    serializeGame: () => interiorState,
  })
  const game = {
    _campaignSave: {
      currentWorldId: 'interior',
      worlds: {
        interior: {
          entryPortalId: 'player-1:tc-1',
          parentWorldId: 'parent',
          state: interiorState,
        },
        parent: {
          state: parentState,
        },
      },
    },
    _isRestarting: false,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  synchronizeInteriorOccupantsAfterTimeJump(game)

  assert.deepEqual(
    context.player.units.map(unit => unit.label),
    ['hero']
  )
  assert.equal(sleeper.currentCell.has, null)
  assert.equal(sleeper.currentCell.solid, false)
  assert.deepEqual(removed, [
    ['bucket', 'sleeper'],
    ['child', 'sleeper'],
  ])
  assert.deepEqual(destroyed, ['sleeper'])
  assert.equal(autosaves.length, 1)
  assert.deepEqual(
    game._campaignSave.worlds.interior.state.players[0].units.map(unit => unit.label),
    ['hero']
  )
  assert.deepEqual(
    game._campaignSave.worlds.parent.state.players[0].units.map(unit => unit.label),
    ['hero', 'sleeper']
  )
  assert.deepEqual(
    game._campaignSave.worlds.parent.state.players[0].units.find(unit => unit.label === 'sleeper'),
    {
      action: null,
      currentFrame: undefined,
      currentSheet: undefined,
      dest: null,
      followingHero: false,
      i: 6,
      inactif: false,
      j: 7,
      label: 'sleeper',
      loop: undefined,
      path: [],
      realDest: null,
      type: 'Villager',
    }
  )
})

test('daytime interior sleepers walk to the exit before returning to the parent world', () => {
  const autosaves = []
  const destroyed = []
  const removed = []
  const removedTasks = []
  const sent = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const parentState = {
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 1, j: 1, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
  }
  const interiorState = {
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: [
          { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' },
          { currentSheet: 'standingSheet', i: 0, inactif: true, j: 0, label: 'sleeper', type: 'Villager' },
        ],
      },
    ],
  }
  const grid = makeGrid(12)
  const sleeperCell = { ...grid[0][0], has: null, solid: true }
  grid[0][0] = sleeperCell
  const exitCell = { ...grid[7][11], has: null, solid: false }
  grid[7][11] = exitCell
  const scheduler = {
    elapsedMs: 1000,
    nextId: 1,
    tasks: new Map(),
    add(callback, interval, name) {
      const id = this.nextId++
      this.tasks.set(id, { callback, interval, name })
      return id
    },
    remove(id) {
      removedTasks.push(id)
      this.tasks.delete(id)
    },
  }
  const sleeper = {
    currentCell: sleeperCell,
    dest: null,
    i: 0,
    isDestroyed: false,
    isDead: false,
    j: 0,
    label: 'sleeper',
    path: [],
    shelterState: null,
    type: 'Villager',
    context: null,
    destroy: () => destroyed.push('sleeper'),
    sendToEvt(target, action, options) {
      sent.push([target, action, options])
      this.dest = target
      this.path = [{ i: target.i, j: target.j }]
    },
  }
  sleeperCell.has = sleeper
  const context = {
    dayNight: { state: { hour: 10 } },
    controls: { equippedItem: null },
    map: {
      grid,
      mapType: 'interior',
      random: () => 0,
      removeChild: unit => removed.push(['child', unit.label]),
      removeFromInstanceBucket: unit => removed.push(['bucket', unit.label]),
      size: 11,
    },
    player: {
      buildings: [],
      units: [{ label: 'hero', type: 'Hero', controlMode: 'hero' }, sleeper],
    },
    scheduler,
  }
  sleeper.context = context
  const { routeInteriorUnitToExit } = loadBuildingInteriorTravel({
    serializeGame: () => interiorState,
  })
  const game = {
    _campaignSave: {
      currentWorldId: 'interior',
      worlds: {
        interior: {
          entryPortalId: 'player-1:tc-1',
          parentWorldId: 'parent',
          state: interiorState,
        },
        parent: {
          state: parentState,
        },
      },
    },
    _isRestarting: false,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {
      autosaves.push(structuredClone(this._campaignSave))
    },
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  routeInteriorUnitToExit(game, sleeper)

  assert.equal(sleeper.dest, exitCell)
  assert.equal(sleeper.interiorExitState.targetCell, exitCell)
  assert.equal(sleeper.interiorExitState.taskId, 1)
  assert.deepEqual(sent, [[exitCell, null, { forceRepath: true, preserveAutonomy: true, allowPassageStop: true }]])
  assert.equal(autosaves.length, 0)

  routeInteriorUnitToExit(game, sleeper)

  assert.equal(sent.length, 1)

  sleeper.i = 7
  sleeper.j = 11
  sleeper.currentCell = exitCell
  sleeper.dest = null
  sleeper.path = []
  exitCell.has = sleeper
  exitCell.solid = true
  scheduler.tasks.get(1).callback()

  assert.equal(scheduler.tasks.size, 0)
  assert.deepEqual(removedTasks, [1])
  assert.equal(sleeper.interiorExitState, null)
  assert.deepEqual(
    context.player.units.map(unit => unit.label),
    ['hero']
  )
  assert.equal(exitCell.has, null)
  assert.equal(exitCell.solid, false)
  assert.deepEqual(removed, [
    ['bucket', 'sleeper'],
    ['child', 'sleeper'],
  ])
  assert.deepEqual(destroyed, ['sleeper'])
  assert.equal(autosaves.length, 1)
  assert.deepEqual(
    game._campaignSave.worlds.interior.state.players[0].units.map(unit => unit.label),
    ['hero']
  )
  assert.deepEqual(
    game._campaignSave.worlds.parent.state.players[0].units.find(unit => unit.label === 'sleeper'),
    {
      action: null,
      currentFrame: undefined,
      currentSheet: undefined,
      dest: null,
      followingHero: false,
      i: 6,
      inactif: false,
      j: 7,
      label: 'sleeper',
      loop: undefined,
      path: [],
      realDest: null,
      type: 'Villager',
    }
  )
})

test('runtime layer occupants route out through their active interior space portal', () => {
  const routed = []
  const space = { id: 'building-space' }
  const sleeper = {
    controlMode: 'standard',
    followingHero: false,
    isDead: false,
    isDestroyed: false,
    label: 'sleeper',
    shelterState: null,
    type: 'Villager',
  }
  const context = {
    dayNight: { state: { hour: 10 } },
    map: { grid: makeGrid(16), mapType: 'continent', size: 15 },
  }
  const { routeInteriorUnitToExit } = loadBuildingInteriorTravel({
    getBuildingInteriorSpaceForUnit: unit => (unit === sleeper ? space : null),
    routeUnitOutOfBuildingInteriorSpace: (ctx, unit, targetSpace) => {
      routed.push([ctx, unit.label, targetSpace.id])
      return true
    },
  })
  const game = {
    _campaignSave: null,
    _isBuildingInteriorLayerOpen: () => true,
    _isRestarting: false,
    _restartSaveData: null,
    context,
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  routeInteriorUnitToExit(game, sleeper)

  assert.deepEqual(routed, [[context, 'sleeper', 'building-space']])
  assert.equal(sleeper.interiorExitState, undefined)
})

test('occupants that exited before the hero stay available on the parent exterior door', async () => {
  const bootedStates = []
  const destroyed = []
  const removed = []
  const owner = { label: 'player-1' }
  const townCenter = { i: 5, j: 5, label: 'tc-1', owner, type: 'TownCenter' }
  const parentState = {
    players: [
      {
        buildings: [townCenter],
        isPlayed: true,
        units: [{ i: 1, j: 1, label: 'hero', type: 'Hero', controlMode: 'hero' }],
      },
    ],
  }
  const grid = makeGrid(12)
  const exitCell = { ...grid[7][11], has: null, solid: false }
  grid[7][11] = exitCell
  const scheduler = {
    elapsedMs: 1000,
    nextId: 1,
    tasks: new Map(),
    add(callback, interval, name) {
      const id = this.nextId++
      this.tasks.set(id, { callback, interval, name })
      return id
    },
    remove(id) {
      this.tasks.delete(id)
    },
  }
  const hero = { i: 7, j: 11, label: 'hero', type: 'Hero', controlMode: 'hero' }
  const sleeper = {
    currentCell: { has: null, i: 0, j: 0, solid: true },
    dest: null,
    i: 0,
    isDestroyed: false,
    isDead: false,
    j: 0,
    label: 'sleeper',
    path: [],
    shelterState: null,
    type: 'Villager',
    context: null,
    destroy: () => destroyed.push('sleeper'),
    sendToEvt(target) {
      this.dest = target
      this.path = [{ i: target.i, j: target.j }]
    },
  }
  sleeper.currentCell.has = sleeper
  const context = {
    dayNight: { state: { hour: 10 } },
    controls: { equippedItem: null },
    map: {
      grid,
      mapType: 'interior',
      random: () => 0,
      removeChild: unit => removed.push(['child', unit.label]),
      removeFromInstanceBucket: unit => removed.push(['bucket', unit.label]),
      size: 11,
    },
    player: {
      buildings: [],
      units: [hero, sleeper],
    },
    scheduler,
  }
  sleeper.context = context
  const serializeRuntime = () => ({
    players: [
      {
        buildings: [],
        isPlayed: true,
        units: context.player.units.map(unit => ({
          controlMode: unit.controlMode,
          i: unit.i,
          j: unit.j,
          label: unit.label,
          type: unit.type,
        })),
      },
    ],
  })
  const { routeInteriorUnitToExit, travelOutOfBuildingInterior } = loadBuildingInteriorTravel({
    extractPortalParty: state => ({ followers: [], hero: state.players[0].units.find(unit => unit.label === 'hero') }),
    applyPortalPartyToRuntime: (_game, party, arrivalCell) => {
      const runtimeHero = context.player.units.find(unit => unit.label === party.hero?.label)
      if (runtimeHero && arrivalCell) {
        runtimeHero.i = arrivalCell.i
        runtimeHero.j = arrivalCell.j
      }
    },
    getBuildingInteriorEntryCell: () => ({ i: 6, j: 7 }),
    getFreeLandCellAroundInstance: (_anchor, runtimeGrid) => runtimeGrid[6][8],
    runtimeHeroUnit: () => hero,
    serializeGame: serializeRuntime,
    teleportRuntimeUnit: (_game, unit, cell) => {
      unit.i = cell.i
      unit.j = cell.j
      unit.currentCell = cell
    },
  })
  const game = {
    _campaignSave: {
      currentWorldId: 'interior',
      worlds: {
        interior: {
          entryPortalId: 'player-1:tc-1',
          parentWorldId: 'parent',
          state: serializeRuntime(),
        },
        parent: {
          state: parentState,
        },
      },
    },
    _isRestarting: false,
    _loadingScreen: null,
    _restartSaveData: null,
    context,
    _autosaveCampaign() {},
    async _bootFromSave(state) {
      bootedStates.push(structuredClone(state))
      context.map.mapType = 'continent'
      context.player.buildings = [townCenter]
      context.players = [context.player]
      context.player.units = structuredClone(state.players[0].units)
    },
    _destroyRuntime() {},
    _gameContext() {
      return context
    },
    _map() {
      return context.map
    },
  }

  routeInteriorUnitToExit(game, sleeper)
  sleeper.i = 7
  sleeper.j = 11
  sleeper.currentCell = exitCell
  sleeper.dest = null
  sleeper.path = []
  exitCell.has = sleeper
  exitCell.solid = true
  scheduler.tasks.get(1).callback()

  await travelOutOfBuildingInterior(game)

  assert.deepEqual(removed, [
    ['bucket', 'sleeper'],
    ['child', 'sleeper'],
  ])
  assert.deepEqual(destroyed, ['sleeper'])
  assert.deepEqual(
    bootedStates[0].players[0].units.map(unit => [unit.label, unit.i, unit.j]),
    [
      ['hero', 1, 1],
      ['sleeper', 6, 7],
    ]
  )
  assert.deepEqual(
    context.player.units.map(unit => [unit.label, unit.i, unit.j]),
    [
      ['hero', 6, 7],
      ['sleeper', 6, 8],
    ]
  )
})

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

test('rest-capable units whose next sleep target is the town center are queued as interior night arrivals', () => {
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

  const arrivals = extractBuildingInteriorSleepArrivals(state, townCenter, { hero: null, followers: [] }, runtimeUnits)

  assert.deepEqual(
    arrivals.map(unit => [unit.label, unit.sleepInInterior]),
    [
      ['future-sleeper', true],
      ['soldier', true],
    ]
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

  const arrivals = extractBuildingInteriorSleepArrivals(state, townCenter, { hero: null, followers: [] }, runtimeUnits)

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
    unitRestLifecycle: {
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

test('interior sleepers enter through the exit before walking to a sleep spot', () => {
  const sleepOutsideCalls = []
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants({
    unitRestLifecycle: {
      sleepOutside: (unit, reason, options) => {
        unit.shelterState = { status: 'outside', reason }
        sleepOutsideCalls.push([unit.label, reason, options])
      },
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ i, j, category: 'Dirt', solid: false, terrainHidden: false }))
  )
  const sent = []
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = {
        ...options,
        context: { scheduler: { elapsedMs: 1200 } },
        label: options.label,
        sendToEvt: (target, action, sendOptions) => sent.push([target, action, sendOptions]),
      }
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
    {
      i: 2,
      j: 2,
    },
    { sleepVisual: 'animate' }
  )

  assert.equal(sleeper.i, 2)
  assert.equal(sleeper.j, 2)
  assert.deepEqual(sent, [[grid[0][0], null, { forceRepath: true, preserveAutonomy: true }]])
  assert.equal(sleeper.shelterState.status, 'movingToRest')
  assert.equal(sleeper.shelterState.targetCell, grid[0][0])
  assert.deepEqual(sleepOutsideCalls, [])
})

test('interior sleepers already sheltered spawn asleep at their sleep spot', () => {
  const sleepOutsideCalls = []
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants({
    unitRestLifecycle: {
      sleepOutside: (unit, reason, options) => {
        unit.shelterState = { status: 'outside', reason }
        sleepOutsideCalls.push([unit.label, reason, options])
      },
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ i, j, category: 'Dirt', solid: false, terrainHidden: false }))
  )
  const sent = []
  const player = {
    buildings: [],
    units: [],
    createUnit(options) {
      const unit = {
        ...options,
        context: { scheduler: { elapsedMs: 1200 } },
        label: options.label,
        sendToEvt: (target, action, sendOptions) => sent.push([target, action, sendOptions]),
      }
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

  assert.equal(sleeper.i, 0)
  assert.equal(sleeper.j, 0)
  assert.deepEqual(sent, [])
  assert.equal(sleeper.shelterState.status, 'outside')
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

test('interior sleepers use the exit cell before heading away to sleep', () => {
  const { addInteriorOccupantsToRuntime } = loadBuildingInteriorOccupants({
    unitRestLifecycle: {
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
      const unit = { ...options, label: options.label, context: { scheduler: { elapsedMs: 0 } }, sendToEvt() {} }
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
    { i: 2, j: 2 },
    { sleepVisual: 'animate' }
  )

  assert.deepEqual([sleeper.i, sleeper.j], [2, 2])
  assert.notDeepEqual([sleeper.shelterState.targetCell.i, sleeper.shelterState.targetCell.j], [2, 2])
})
