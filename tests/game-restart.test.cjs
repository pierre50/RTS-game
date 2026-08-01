const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadGame() {
  const filename = path.join(__dirname, '../app/screens/Game.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

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
    '../lib/combatFeedback': { clearAllCombatFeedback() {} },
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
    '../serialization/MapBlueprintLoader': { loadPregeneratedMapBlueprint: async () => null },
    '../dev-console/DevConsole': class DevConsole {},
    '../dev-console/actions/shared': { cleanupDebugArtifacts() {} },
    '../services/PerformanceMonitor': {
      PerformanceMonitor: class PerformanceMonitor {
        reset() {}
        destroy() {}
      },
    },
    '../services/WeatherSystem': class WeatherSystem {},
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
    '../services/AmbientBirds': class AmbientBirds {},
    '../constants': { CELL_WIDTH: 64, CELL_HEIGHT: 32, AMBIENT_BIRD_WORLD_ZINDEX: 0 },
  }

  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  global.window = global.window || {}
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.default
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
  game.checkVictory = () => false

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
