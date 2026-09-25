const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { GameLoadingScreen } = loadTsModule('app/ui/GameLoadingScreen.ts', {
  mocks: { '../lib/lang': { t: value => value } },
})

test('loading stays monotonic and reserves 100 percent for explicit completion', () => {
  const screen = Object.create(GameLoadingScreen.prototype)
  const attributes = {}
  Object.assign(screen, {
    lastPercent: 0,
    root: { style: { setProperty() {} } },
    track: {
      setAttribute(key, value) {
        attributes[key] = value
      },
    },
    percent: {},
    status: {},
  })
  screen.update('terrain', 0.25)
  screen.update('resources', 0.2)
  assert.equal(screen.percent.textContent, '25%')
  screen.update('saving 31 / 32', 0.99)
  screen.setProgress(0.9999)
  assert.equal(screen.percent.textContent, '99%')
  screen.update('publishing', Number.NaN)
  assert.equal(attributes['aria-valuenow'], '99')
  screen.update('worldReady', 1)
  assert.equal(screen.percent.textContent, '100%')
})

test('continue paints before reading, reports blocks and removes the read screen after handoff or failure', async () => {
  const previousFrame = global.requestAnimationFrame
  const events = []
  global.requestAnimationFrame = callback => {
    events.push('paint')
    callback()
  }
  let fail = false
  const { loadSavedGame } = loadTsModule('app/ui/LoadSavedGame.ts', {
    mocks: {
      '../lib/lang': { t: value => value },
      '../lib/loadDiagnostics': { traceLoadAsync: (_name, fn) => fn() },
      './GameLoadingScreen': {
        GameLoadingScreen: class {
          constructor(title) {
            events.push(title)
          }
          update(label) {
            events.push(label)
          }
          destroy() {
            events.push('destroy')
          }
        },
      },
      '../serialization/SaveStorage': {
        loadSaveAsync: async (_key, progress) => {
          assert.ok(events.includes('paint'))
          events.push('read')
          await progress(32, 64)
          if (fail) throw new Error('SAVE_CORRUPT')
          await progress(64, 64)
          return { saved: true }
        },
      },
    },
  })
  try {
    await loadSavedGame('save_1', value => {
      assert.deepEqual(value, { saved: true })
      events.push('handoff')
    })
    assert.ok(events.includes('readingSave 32 / 64'))
    assert.ok(events.includes('readingSave 64 / 64'))
    assert.deepEqual(events.slice(-2), ['handoff', 'destroy'])
    fail = true
    await assert.rejects(
      loadSavedGame('save_1', () => assert.fail('must not load corrupt save')),
      /SAVE_CORRUPT/
    )
    assert.equal(events.at(-1), 'destroy')
    fail = false
    await loadSavedGame('save_1', () => events.push('retry'))
    assert.ok(events.includes('retry'))
  } finally {
    global.requestAnimationFrame = previousFrame
  }
})

test('saved-game loading keeps its screen through runtime cleanup and restoration', async () => {
  const events = []
  let screen
  const state = { players: [] }
  const { loadGameRuntime } = loadTsModule('app/screens/game/GameBootFlow.ts', {
    mocks: {
      '../../ui/TutorialPrologue': {},
      '../../services/tutorial/TutorialVillage': {},
      '../../services/tutorial/TutorialVillageMigration': { migrateTutorialVillageOwner() {} },
      '../../lib/lang': { t: key => key },
      '../../lib': { Modal: class {} },
      '../../serialization/SaveValidator': { validateSaveData: value => value },
      '../../serialization/CampaignSave': {
        isCampaignSave: () => true,
        getCurrentWorldState: () => state,
      },
      '../../lib/audio/settings': { getGameSpeed: () => 1 },
      '../../ui/GameLoadingScreen': {
        GameLoadingScreen: class {
          constructor() {
            screen = this
            this.destroyed = false
          }
          update(label) {
            assert.equal(this.destroyed, false)
            events.push(label)
          }
          destroy() {
            this.destroyed = true
            events.push('destroy')
          }
        },
      },
      '../../ui/BuildingInteriorTransition': { playBuildingInteriorDoorTransition: async fn => fn() },
      './GameStateHelpers': {
        ensureCampaignPlayerRoster: value => value,
        worldStateWithCampaignClock: value => value,
      },
    },
  })
  const game = {
    context: {
      app: {
        ticker: {},
        render() {
          assert.equal(screen.destroyed, false)
          events.push('render')
        },
      },
      menu: {
        show() {
          events.push('showGame')
        },
      },
    },
    _yieldToBrowser: async () => {},
    _measure: (_name, fn) => fn(),
    _destroyRuntime({ preserveLoadingScreen = false } = {}) {
      events.push('cleanup')
      if (!preserveLoadingScreen) {
        this._loadingScreen.destroy()
        this._loadingScreen = null
      }
    },
    async _bootFromSave() {
      assert.equal(this._loadingScreen, screen)
      assert.equal(screen.destroyed, false)
      this._loadingScreen.update('restoringResources', 0.7)
      await Promise.resolve()
      assert.equal(screen.destroyed, false)
      events.push('ready')
    },
    quit() {
      assert.fail('loading must succeed')
    },
  }
  await loadGameRuntime(game, { worlds: {} })
  assert.deepEqual(events, [
    'readingSave',
    'cleanup',
    'restoringResources',
    'ready',
    'finishingLoad',
    'render',
    'worldReady',
    'destroy',
    'showGame',
  ])
  assert.equal(game._loadingScreen, null)
})
