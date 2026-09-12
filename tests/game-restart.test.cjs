const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadGame({ blueprintFailureReason = null, loadPregeneratedInteriorBlueprint, loadPregeneratedWorldMapBlueprint, realScheduler = false } = {}) {
  class MapBlueprintLoadError extends Error {
    constructor(reason, message) {
      super(message)
      this.name = 'MapBlueprintLoadError'
      this.reason = reason
    }
  }

  class Container {
    constructor() {
      this.children = []
      this.scale = { x: 1, y: 1, set: value => ((this.scale.x = value), (this.scale.y = value)) }
      this.position = { x: 0, y: 0, set: (x, y) => ((this.position.x = x), (this.position.y = y)) }
    }
    addChild(child) {
      this.children.push(child)
      return child
    }
    removeChildren() {
      this.children = []
    }
    destroy() {}
  }

  const mocks = {
    '../../services/world/WorldEconomy': { materializeInitialEconomy: initial => initial },
    '../../services/world/WorldEconomyRuntime': { economyRulesFor: () => ({}), initializeCampaignEconomy: async () => {} },
    '../../classes/players/GaiaPlayer': { ensureNeutralPlayer() {} },
    'pixi.js': { Container },
    '@pixi/sound': { sound: { stopAll() {} } },
    '../lib/lang': { t: key => key },
    '../classes/map/Map': class Map {},
    '../classes/Menu': class Menu {},
    '../classes/Controls': class Controls {},
    '../lib': {
      Modal: class Modal {},
      canPlayerStillAct: () => true,
      debounce: fn => fn,
      getGaiaAnimals: gaia => gaia?.units ?? [],
      isPlayedHeroDefeated: () => false,
    },
    '../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
    '../lib/combat/factions': {
      adjustFactionRelation: faction => faction,
      createFactionSave: () => ({}),
      FACTION_SCORE: {},
    },
    '../lib/combat/combatFeedback': { clearAllCombatFeedback() {} },
    '../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
    '../lib/ActionScheduler': {
      ActionScheduler: class ActionScheduler {
        clear() {}
        destroy() {}
      },
    },
    '../lib/audio/uiSound': { stopAllUiSounds() {} },
    '../serialization/SaveValidator': { validateSaveData() {} },
    '../serialization/SaveStorage': { save: () => ({}) },
    '../serialization/SaveSerializer': { serializeGame: () => ({}) },
    '../serialization/CampaignSave': {
      addChildWorldToCampaign: campaign => campaign,
      createInitialCampaignSave: save => ({
        format: 'campaign-v1',
        version: 1,
        currentWorldId: 'root',
        heroParty: {},
        worlds: { root: { id: 'root', state: save } },
        worldGraph: { rootWorldId: 'root', nodes: {} },
      }),
      enterCampaignWorld: campaign => campaign,
      getCurrentWorldState: campaign => campaign?.worlds?.[campaign.currentWorldId]?.state ?? null,
      isCampaignSave: save => save?.format === 'campaign-v1',
      returnToParentWorld: campaign => campaign,
      updateCurrentWorldState: campaign => campaign,
    },
    '../serialization/MapBlueprintLoader': {
      MapBlueprintLoadError,
      loadPregeneratedWorldMapBlueprint:
        loadPregeneratedWorldMapBlueprint ||
        (async () => {
          if (blueprintFailureReason) {
            throw new MapBlueprintLoadError(blueprintFailureReason, 'missing test world blueprint')
          }
          return { id: 'test-world-blueprint', size: 144, terrain: [], spawns: [], timings: {} }
        }),
      loadPregeneratedInteriorBlueprint:
        loadPregeneratedInteriorBlueprint ||
        (async () => {
          if (blueprintFailureReason) {
            throw new MapBlueprintLoadError(blueprintFailureReason, 'missing test interior blueprint')
          }
          return { id: 'test-interior-blueprint', kind: 'interior', mapType: 'interior', size: 13, terrain: [], spawns: [] }
        }),
    },
    '../dev-console/DevConsole': { DevConsole: class DevConsole {} },
    '../dev-console/actions/shared': { cleanupDebugArtifacts() {} },
    '../services/PerformanceMonitor': {
      PerformanceMonitor: class PerformanceMonitor {
        reset() {}
        destroy() {}
      },
    },
    '../services/weather/WeatherSystem': class WeatherSystem {
      constructor() {
        this.layer = {}
      }
      destroy() {}
    },
    '../services/lighting/LightSystem': {
      LightSystem: class LightSystem {
        constructor() {
          this.layer = {}
        }
        destroy() {}
      },
    },
    '../services/ShadowSystem': {
      ShadowSystem: class ShadowSystem {
        destroy() {}
      },
    },
    '../services/DayNightSystem': {
      DayNightSystem: class DayNightSystem {
        getDarknessLevel() {
          return 0
        }
        destroy() {}
      },
    },
    '../services/DailyWorldEventSystem': {
      DailyWorldEventSystem: class DailyWorldEventSystem {
        register() {}
        destroy() {}
      },
    },
    '../services/TributeRaidSystem': {
      TributeRaidSystem: class TributeRaidSystem {
        destroy() {}
      },
    },
    '../services/patrol/CampPatrolSystem': {
      CampPatrolSystem: class CampPatrolSystem {
        destroy() {}
      },
    },
    '../services/rest/UnitRestSystem': {
      UnitRestSystem: class UnitRestSystem {
        destroy() {}
      },
    },
    './game/GameBuildingInteriorTravel': {
      buildBuildingInteriorSessionSaveRecord: () => null,
      routeInteriorUnitToExit() {},
      synchronizeInteriorOccupantsAfterTimeJump() {},
      travelIntoBuildingInterior: async () => {},
      travelOutOfBuildingInterior: async () => {},
    },
    './game/GameResourceDelivery': {
      ResourceDeliverySystem: class ResourceDeliverySystem {
        destroy() {}
      },
      routeUnitResourceDelivery: async () => false,
    },
    './game/runtimeServices': {
      addRuntimeServiceLayers() {},
      createEmptyRuntimeServices: () => ({
        buildingInteriorEntryMarker: null,
        campPatrols: null,
        dailyWorldEvents: null,
        dayNight: null,
        heroFollowerPatrols: null,
        idleUnitPatrols: null,
        interiorExitMarker: null,
        lights: null,
        resourceDelivery: null,
        shadows: null,
        timeSkip: null,
        tributeRaids: null,
        unitEnergyRegen: null,
        unitRest: null,
        weather: null,
      }),
      createRuntimeServices: () => ({
        buildingInteriorEntryMarker: null,
        campPatrols: null,
        dailyWorldEvents: null,
        dayNight: null,
        heroFollowerPatrols: null,
        idleUnitPatrols: null,
        interiorExitMarker: null,
        lights: null,
        resourceDelivery: null,
        shadows: null,
        timeSkip: null,
        tributeRaids: null,
        unitEnergyRegen: null,
        unitRest: null,
        weather: null,
      }),
      destroyRuntimeServices: () => ({
        buildingInteriorEntryMarker: null,
        campPatrols: null,
        dailyWorldEvents: null,
        dayNight: null,
        heroFollowerPatrols: null,
        idleUnitPatrols: null,
        interiorExitMarker: null,
        lights: null,
        resourceDelivery: null,
        shadows: null,
        timeSkip: null,
        tributeRaids: null,
        unitEnergyRegen: null,
        unitRest: null,
        weather: null,
      }),
    },
    '../lib/audio/settings': {
      getCameraZoom: () => 1,
      getControlActionForKeyboardEvent: () => null,
      getGameSpeed: () => 1,
    },
    '../ui/GameLoadingScreen': {
      GameLoadingScreen: class GameLoadingScreen {
        update() {}
        destroy() {}
      },
    },
    '../ui/BuildingInteriorTransition': {
      playBuildingInteriorDoorTransition: async callback => callback(),
    },
    '../ui/OrientationGuard': {
      OrientationGuard: class OrientationGuard {
        destroy() {}
      },
    },
    '../config/civilizations': { CIVILIZATIONS: [{ value: 'Hellas' }] },
    '../config/environments': { getEnvironmentForCiv: () => 'temperate' },
    '../lib/maths': {
      cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
      getGroundReliefLevel: () => 0,
      getInstanceZIndex: instance => (instance?.i ?? 0) + (instance?.j ?? 0),
    },
    '../constants': {
      BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
      CELL_WIDTH: 64,
      CELL_HEIGHT: 32,
      ENVIRONMENT_IDS: ['temperate'],
      PLAYER_TYPES: { human: 'human', computer: 'computer' },
      UNIT_TYPES: { villager: 'Villager' },
    },
  }
  if (realScheduler) delete mocks['../lib/ActionScheduler']
  Object.assign(mocks, {
    '../../lib': mocks['../lib'],
    '../../lib/lang': mocks['../lib/lang'],
    '../../lib/equipment/equipmentStats': mocks['../lib/equipment/equipmentStats'],
    '../../lib/audio/settings': mocks['../lib/audio/settings'],
    '../../serialization/CampaignSave': mocks['../serialization/CampaignSave'],
    '../../serialization/MapBlueprintLoader': mocks['../serialization/MapBlueprintLoader'],
    '../../serialization/SaveValidator': mocks['../serialization/SaveValidator'],
    '../../serialization/SaveSerializer': mocks['../serialization/SaveSerializer'],
    '../../ui/GameLoadingScreen': mocks['../ui/GameLoadingScreen'],
    '../../ui/BuildingInteriorTransition': mocks['../ui/BuildingInteriorTransition'],
    '../../services/weather/WeatherSystem': mocks['../services/weather/WeatherSystem'],
    '../../services/lighting/LightSystem': mocks['../services/lighting/LightSystem'],
    '../../services/ShadowSystem': mocks['../services/ShadowSystem'],
    '../../services/DayNightSystem': mocks['../services/DayNightSystem'],
    '../../services/DailyWorldEventSystem': mocks['../services/DailyWorldEventSystem'],
    '../../services/TributeRaidSystem': mocks['../services/TributeRaidSystem'],
    '../../services/patrol/CampPatrolSystem': mocks['../services/patrol/CampPatrolSystem'],
    '../../services/rest/UnitRestSystem': mocks['../services/rest/UnitRestSystem'],
  })

  global.window = global.window || {}
  global.window.matchMedia = global.window.matchMedia || (() => ({ matches: false }))
  global.window.addEventListener = global.window.addEventListener || (() => {})
  global.window.removeEventListener = global.window.removeEventListener || (() => {})
  return loadTsModule('app/screens/Game.ts', { mocks }).default
}

test('region resets keep character fades and pause state connected to the live runtime', () => {
  const Game = loadGame({ realScheduler: true })
  const game = new Game({ ticker: { add() {}, remove() {} } }, {}, null, null)
  const { fadeIn } = loadTsModule('app/lib/entities/entityFade.ts')
  game.context.performance = null
  const scheduler = game.context.scheduler

  for (let arrival = 0; arrival < 3; arrival++) {
    game.context.paused = true
    scheduler.clear()
    game._resetRuntimeState()
    game.context.paused = true
    const party = ['hero', 'follower'].map(label => ({ label, alpha: 1, context: game.context }))
    for (const unit of party) fadeIn(unit, 120)

    scheduler._tick(120)
    assert.deepEqual(party.map(unit => unit.alpha), [0, 0], 'arrival remains paused during the transition')

    game.context.paused = false
    scheduler._tick(120)
    assert.deepEqual(party.map(unit => unit.alpha), [1, 1], 'hero and follower must finish appearing after arrival')

    let actions = 0
    scheduler.add(() => actions++, 40)
    game.context.paused = true
    scheduler._tick(40)
    assert.equal(actions, 0, 'opening the inventory must pause the current runtime')
    game.context.paused = false
    scheduler._tick(40)
    assert.equal(actions, 1)
  }
})

test('restart ignores clicks before the initial restart snapshot exists', async () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  let destroyCalls = 0
  game._destroyRuntime = () => destroyCalls++

  await game.restart()

  assert.equal(destroyCalls, 0)
})

test('restart coalesces repeated ingame menu clicks while rebooting', async () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  let destroyCalls = 0
  let resolveYield
  const bootSaves = []

  game._restartSaveData = {
    version: 2,
    world: {},
    config: {},
    players: [],
    camera: { x: 0, y: 0 },
    resources: [],
    animals: [],
  }
  game._destroyRuntime = () => destroyCalls++
  game._yieldToBrowser = () => new Promise(resolve => (resolveYield = resolve))
  game._bootFromSave = async save => bootSaves.push(save)

  const firstRestart = game.restart()
  const secondRestart = game.restart()

  assert.equal(destroyCalls, 1)
  resolveYield()
  await Promise.all([firstRestart, secondRestart])

  assert.equal(destroyCalls, 1)
  assert.equal(bootSaves.length, 1)
  assert.equal(game._isRestarting, false)
})

test('restored saves initialize hero controls before mounting runtime', async () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  const calls = []
  const map = {
    size: 0,
    generateFromJSON: () => calls.push('generateFromJSON'),
  }

  game._createRuntime = () => calls.push('createRuntime')
  game._map = () => map
  game._createUiRuntime = () => {
    calls.push('createUiRuntime')
    game.context.controls = { init: () => calls.push('controls.init') }
  }
  game._mountRuntime = () => calls.push('mountRuntime')

  await game._bootFromSave({
    version: 1,
    config: {},
    map: [[{ type: 'Grass', z: 0 }]],
    players: [],
    camera: { x: 0, y: 0 },
    resources: [],
    animals: [],
  })

  assert.deepEqual(calls, ['createRuntime', 'createUiRuntime', 'generateFromJSON', 'controls.init', 'mountRuntime'])
})

test('new games fail when the world has no compatible region blueprint', async () => {
  const previousConsoleError = console.error
  console.error = () => {}

  try {
    const Game = loadGame({ blueprintFailureReason: 'no-compatible-map' })
    const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
    let runtimeGenerationCalls = 0
    const map = {
      size: 144,
      environment: 'temperate',
      generateMapAsync: async () => runtimeGenerationCalls++,
      generateFromBlueprint: async () => {},
    }

    game._createRuntime = () => {}
    game._map = () => map
    game._applyMapConfig = () => {}
    game._createUiRuntime = () => {}

    await assert.rejects(() => game._bootFromConfig({ size: 144 }), /mapBlueprintUnavailable/)

    assert.equal(runtimeGenerationCalls, 0)
    assert.equal(map.pregeneratedBlueprintId, undefined)
  } finally {
    console.error = previousConsoleError
  }
})

test('world-region boot keeps the played civilization as the active player', async () => {
  const Game = loadGame({
    loadPregeneratedWorldMapBlueprint: async () => ({
      id: 'world-4242-r0-0-steppe',
      size: 144,
      terrain: [],
      spawns: [],
      settlements: [
        { civ: 'Norse', kind: 'village', local: { i: 20, j: 20 } },
        { civ: 'Hellas', kind: 'village', local: { i: 80, j: 80 } },
      ],
      timings: {},
    }),
  })
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  const players = [
    { civ: 'Norse', isPlayed: false },
    { civ: 'Hellas', isPlayed: true },
  ]
  const generatedConfigs = []
  const map = {
    size: 144,
    generateFromBlueprint: async () => {},
    generatePlayers: configs => {
      generatedConfigs.push(...configs)
      return players
    },
    stylishMap: async () => {},
  }

  game._createRuntime = () => {}
  game._map = () => map
  game._applyMapConfig = (_map, config) => {
    _map.size = config.size
  }
  game._createUiRuntime = () => {
    game.context.menu = { init() {} }
    game.context.controls = { init() {} }
  }
  game._mountRuntime = () => {}
  game._gameContext = () => ({ map, player: game.context.player, players: game.context.players })
  game._autosaveCampaign = () => {}
  game._updateLoading = async () => {}
  game._campaignSave = {
    factions: {
      'civ-norse': {
        id: 'civ-norse',
        civilization: 'Norse',
        color: 'red',
        homeWorldId: 'world-4242-r2-2-steppe',
        knownWorldIds: [],
        name: 'Clan Nord',
      },
      'civ-hellas': {
        id: 'civ-hellas',
        civilization: 'Hellas',
        color: 'blue',
        homeWorldId: 'world-4242-r2-2-steppe',
        knownWorldIds: [],
        name: 'Maison Hellas',
      },
    },
    worldGraph: { rootWorldId: 'world-4242-r2-2-steppe' },
    worlds: {},
  }

  await game._bootFromConfig({
    size: 144,
    players: [{ civ: 'Hellas', isHuman: true }],
    worldId: 'world-4242',
    worldRegionId: 'world-4242-r0-0-steppe',
  })

  assert.equal(game.context.player.civ, 'Hellas')
  assert.equal(game.context.player.isPlayed, true)
  assert.deepEqual(
    generatedConfigs.map(config => ({
      civ: config.civ,
      color: config.color,
      factionId: config.factionId,
      isHuman: config.isHuman,
      name: config.name,
    })),
    [
      { civ: 'Norse', color: 'red', factionId: 'civ-norse', isHuman: false, name: 'Clan Nord' },
      { civ: 'Hellas', color: 'blue', factionId: 'civ-hellas', isHuman: true, name: undefined },
    ]
  )
})

test('seed saves without a blueprint id load a world region blueprint', async () => {
  const calls = []
  const Game = loadGame({
    loadPregeneratedWorldMapBlueprint: async options => {
      calls.push(['world', options])
      return { id: 'world-4242-r0-0-steppe', size: 144, terrain: [], spawns: [], timings: {} }
    },
  })
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  let runtimeGenerationCalls = 0
  const map = {
    size: 144,
    generateMapAsync: async () => runtimeGenerationCalls++,
    generateFromBlueprint: async blueprint => calls.push(['generate', blueprint.id]),
    mapGeneration: { applySavedStateToGeneratedMap: () => calls.push(['applySavedState']) },
    prepareTerrainForSavedState: async () => calls.push(['prepareTerrain']),
  }

  game._createRuntime = () => calls.push(['createRuntime'])
  game._map = () => map
  game._applyMapConfig = (_map, config) => {
    calls.push(['applyMapConfig', config.worldId])
    _map.size = config.size
  }
  game._createUiRuntime = () => {
    calls.push(['createUiRuntime'])
    game.context.controls = { init: () => calls.push(['controls.init']) }
  }
  game._mountRuntime = () => calls.push(['mountRuntime'])

  await game._bootFromSeedSave({
    version: 2,
    runtime: { elapsedMs: 0 },
    world: { seed: 42, size: 144, pregeneratedBlueprintId: null, worldId: 'world-4242' },
    config: { seed: 42, size: 144 },
    players: [],
    camera: { x: 0, y: 0 },
    resources: [],
    animals: [],
  })

  assert.equal(runtimeGenerationCalls, 0)
  assert.deepEqual(calls.find(call => call[0] === 'world'), [
    'world',
    { size: 144, playerCiv: undefined, worldId: 'world-4242', worldRegionId: undefined },
  ])
  assert.deepEqual(calls.find(call => call[0] === 'generate'), ['generate', 'world-4242-r0-0-steppe'])
})

test('interior seed saves load their blueprint from the interior manifest', async () => {
  const calls = []
  const Game = loadGame({
    loadPregeneratedInteriorBlueprint: async options => {
      calls.push(['interior', options])
      return { id: options.id, kind: 'interior', mapType: 'interior', size: 13, terrain: [], spawns: [] }
    },
    loadPregeneratedWorldMapBlueprint: async options => {
      calls.push(['world', options])
      return { id: options.id, size: 144, terrain: [], spawns: [], timings: {} }
    },
  })
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  const map = {
    generateFromBlueprint: async blueprint => calls.push(['generate', blueprint.id]),
    mapGeneration: { applySavedStateToGeneratedMap: () => calls.push(['applySavedState']) },
    prepareTerrainForSavedState: async () => calls.push(['prepareTerrain']),
    size: 0,
  }

  game._createRuntime = () => calls.push(['createRuntime'])
  game._map = () => map
  game._applyMapConfig = (_map, config) => {
    calls.push(['applyMapConfig', config.mapType])
    _map.mapType = config.mapType
    _map.size = config.size
  }
  game._createUiRuntime = () => {
    calls.push(['createUiRuntime'])
    game.context.controls = { init: () => calls.push(['controls.init']) }
  }
  game._mountRuntime = () => calls.push(['mountRuntime'])

  await game._bootFromSeedSave({
    version: 2,
    runtime: { elapsedMs: 0 },
    world: {
      seed: 42,
      size: 13,
      mapType: 'interior',
      pregeneratedBlueprintId: 'house-circle-001',
    },
    config: { seed: 42, size: 13, mapType: 'interior' },
    players: [],
    camera: { x: 0, y: 0 },
    resources: [],
    animals: [],
  })

  assert.deepEqual(calls.find(call => call[0] === 'interior'), ['interior', { id: 'house-circle-001' }])
  assert.equal(calls.some(call => call[0] === 'world'), false)
  assert.deepEqual(calls.find(call => call[0] === 'generate'), ['generate', 'house-circle-001'])
})

test('portable hero state preserves mounted horse color across worlds', () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  const target = {
    context: {
      scheduler: { elapsedMs: 1000 },
    },
  }

  game._applyPortableUnitState(target, {
    i: 0,
    j: 0,
    type: 'Hero',
    mountedOnHorse: true,
    horseColor: 'gray',
    companionHorseColor: 'gray',
    hitPoints: 20,
    totalHitPoints: 30,
  })

  assert.equal(target.mountedOnHorse, true)
  assert.equal(target.horseColor, 'gray')
  assert.equal(target.companionHorseColor, 'gray')
})

test('portable hero state preserves all facing directions including zero', () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  for (const degree of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const target = { degree: 123 }
    game._applyPortableUnitState(target, { i: 0, j: 0, type: 'Hero', degree })
    assert.equal(target.degree, degree)
    game._applyPortableUnitState(target, { i: 0, j: 0, type: 'Hero' })
    assert.equal(target.degree, degree)
  }
})

test('pause applies to live units, buildings, gaia animals and corpses once', () => {
  const Game = loadGame()
  const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
  const calls = []
  const makePausable = label => ({
    label,
    pause: () => calls.push(['pause', label]),
    resume: () => calls.push(['resume', label]),
  })
  const unit = makePausable('unit')
  const building = makePausable('building')
  const ownerCorpse = makePausable('owner-corpse')
  const cellCorpse = makePausable('cell-corpse')
  const sharedCorpse = makePausable('shared-corpse')
  const gaiaAnimal = makePausable('gaia-animal')

  game.context.map = {
    gaia: { units: [gaiaAnimal] },
    grid: [
      [
        {
          corpses: new Set([cellCorpse, sharedCorpse]),
        },
      ],
    ],
  }
  game.context.players = [
    {
      units: [unit],
      buildings: [building],
      corpses: [ownerCorpse, sharedCorpse],
    },
  ]
  global.document = {
    getElementById: () => null,
    createElement: () => ({ id: '', className: '', innerText: '' }),
    body: { appendChild() {} },
  }

  game.togglePause(true, { silent: true })

  assert.deepEqual(calls, [
    ['pause', 'gaia-animal'],
    ['pause', 'unit'],
    ['pause', 'building'],
    ['pause', 'owner-corpse'],
    ['pause', 'shared-corpse'],
    ['pause', 'cell-corpse'],
  ])
  assert.equal(calls.filter(([, label]) => label === 'shared-corpse').length, 1)
})

test('Escape opens the in-game pause menu', () => {
  const previousWindow = global.window
  const previousDocument = global.document
  const listeners = new Map()
  global.window = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener() {},
  }
  global.document = {
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  }

  try {
    const Game = loadGame()
    const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
    let openCalls = 0
    let pauseCalls = 0
    let preventDefaultCalls = 0
    game.context.menu = { pauseMenu: { open: () => openCalls++ } }
    game.context.pause = () => pauseCalls++

    game._attachWindowListeners()
    listeners.get('keydown')({
      key: 'Escape',
      defaultPrevented: false,
      preventDefault: () => preventDefaultCalls++,
    })

    assert.equal(openCalls, 1)
    assert.equal(pauseCalls, 0)
    assert.equal(preventDefaultCalls, 1)
  } finally {
    global.window = previousWindow
    global.document = previousDocument
  }
})

test('Escape does not open the in-game menu after another handler consumes it', () => {
  const previousWindow = global.window
  const previousDocument = global.document
  const listeners = new Map()
  global.window = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener() {},
  }
  global.document = {
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  }

  try {
    const Game = loadGame()
    const game = new Game({ ticker: { speed: 1 } }, {}, null, null)
    let openCalls = 0
    game.context.menu = { pauseMenu: { open: () => openCalls++ } }

    game._attachWindowListeners()
    listeners.get('keydown')({
      key: 'Escape',
      defaultPrevented: true,
      preventDefault: () => {},
    })

    assert.equal(openCalls, 0)
  } finally {
    global.window = previousWindow
    global.document = previousDocument
  }
})
