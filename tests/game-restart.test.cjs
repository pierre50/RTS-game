const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadGame() {
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
    'pixi.js': { Container },
    '@pixi/sound': { sound: { stopAll() {} } },
    '../lib/lang': { t: key => key },
    '../classes/map': class Map {},
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
    '../lib/factions': {
      adjustFactionRelation: faction => faction,
      createFactionSave: () => ({}),
      FACTION_SCORE: {},
    },
    '../lib/combatFeedback': { clearAllCombatFeedback() {} },
    '../lib/equipmentStats': { refreshUnitEquipmentStats() {} },
    '../lib/resourceCarry': { syncHeroResourceLoadState() {} },
    '../lib/ActionScheduler': {
      ActionScheduler: class ActionScheduler {
        clear() {}
        destroy() {}
      },
    },
    '../lib/uiSound': { stopAllUiSounds() {} },
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
    '../serialization/MapBlueprintLoader': { loadPregeneratedMapBlueprint: async () => null },
    '../dev-console/DevConsole': { DevConsole: class DevConsole {} },
    '../dev-console/actions/shared': { cleanupDebugArtifacts() {} },
    '../services/PerformanceMonitor': {
      PerformanceMonitor: class PerformanceMonitor {
        reset() {}
        destroy() {}
      },
    },
    '../services/WeatherSystem': class WeatherSystem {
      constructor() {
        this.layer = {}
      }
      destroy() {}
    },
    '../services/LightSystem': {
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
    '../services/CampPatrolSystem': {
      CampPatrolSystem: class CampPatrolSystem {
        destroy() {}
      },
    },
    '../services/VillagerShelterSystem': {
      VillagerShelterSystem: class VillagerShelterSystem {
        destroy() {}
      },
    },
    '../lib/settings': {
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
    '../ui/PortalTravelTransition': {
      PortalTravelTransition: class PortalTravelTransition {
        async playDeparture() {}
        async finish() {}
        play() {}
        destroy() {}
      },
      WorldRevealTransition: class WorldRevealTransition {
        async revealFrom() {}
        destroy() {}
      },
    },
    '../ui/OrientationGuard': {
      OrientationGuard: class OrientationGuard {
        destroy() {}
      },
    },
    '../config/mapTypes': { DEFAULT_MAP_TYPE: 'continent' },
    '../config/civilizations': { CIVILIZATIONS: [{ value: 'Greek' }] },
    '../config/environments': { getEnvironmentForCiv: () => 'temperate' },
    '../lib/maths': {
      cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
      getGroundReliefLevel: () => 0,
      getInstanceZIndex: instance => (instance?.i ?? 0) + (instance?.j ?? 0),
    },
    '../constants': {
      CELL_WIDTH: 64,
      CELL_HEIGHT: 32,
      ENVIRONMENT_IDS: ['temperate'],
      PLAYER_TYPES: { human: 'human', computer: 'computer' },
    },
  }
  Object.assign(mocks, {
    '../../lib': mocks['../lib'],
    '../../lib/equipmentStats': mocks['../lib/equipmentStats'],
    '../../lib/resourceCarry': mocks['../lib/resourceCarry'],
    '../../serialization/CampaignSave': mocks['../serialization/CampaignSave'],
    '../../serialization/SaveSerializer': mocks['../serialization/SaveSerializer'],
    '../../ui/PortalTravelTransition': mocks['../ui/PortalTravelTransition'],
    '../../services/WeatherSystem': mocks['../services/WeatherSystem'],
    '../../services/LightSystem': mocks['../services/LightSystem'],
    '../../services/ShadowSystem': mocks['../services/ShadowSystem'],
    '../../services/DayNightSystem': mocks['../services/DayNightSystem'],
    '../../services/DailyWorldEventSystem': mocks['../services/DailyWorldEventSystem'],
    '../../services/TributeRaidSystem': mocks['../services/TributeRaidSystem'],
    '../../services/CampPatrolSystem': mocks['../services/CampPatrolSystem'],
    '../../services/VillagerShelterSystem': mocks['../services/VillagerShelterSystem'],
  })

  global.window = global.window || {}
  global.window.matchMedia = global.window.matchMedia || (() => ({ matches: false }))
  global.window.addEventListener = global.window.addEventListener || (() => {})
  global.window.removeEventListener = global.window.removeEventListener || (() => {})
  return loadTsModule('app/screens/Game.ts', { mocks }).default
}

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
