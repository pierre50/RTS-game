const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const mode of ['new', 'continue']) {
  test(`${mode}: camera, lighting and render complete with loading visible before the black transition`, async () => {
    const events = []
    let loadingVisible = false
    let transitioning = false
    const traces = []
    const { startGameRuntime, loadGameRuntime } = loadTsModule('app/screens/game/GameBootFlow.ts', {
      mocks: {
        '../../lib/loadDiagnostics': {
          traceLoad(name, callback) {
            traces.push(name)
            return callback()
          },
          async traceLoadAsync(name, callback) {
            traces.push(name)
            return callback()
          },
        },
        '../../services/tutorial/TutorialVillageMigration': { migrateTutorialVillageOwner() {} },
        '../../services/tutorial/TutorialVillage': {},
        '../../ui/TutorialPrologue': {},
        '../../lib/lang': { t: key => key },
        '../../lib': { Modal: class {} },
        '../../serialization/validation/SaveValidator': { validateSaveData: value => value },
        '../../serialization/CampaignSave': {
          isCampaignSave: () => true,
          getCurrentWorldState: value => value.worlds.home.state,
        },
        '../../lib/audio/settings': { getGameSpeed: () => 1 },
        '../../ui/GameLoadingScreen': {
          GameLoadingScreen: class {
            constructor() {
              loadingVisible = true
            }
            update(message, value) {
              if (value === 1) assert.ok(events.includes('render'), '100% must follow first render')
              if (message === 'finishingLoad') events.push('preparing')
            }
            destroy() {
              assert.ok(transitioning)
              loadingVisible = false
              events.push('hideLoading')
            }
          },
        },
        '../../ui/BuildingInteriorTransition': {
          async playBuildingInteriorDoorTransition(show, options) {
            assert.deepEqual(events.slice(-4), ['lighting', 'render', 'paint', 'paint'])
            assert.equal(loadingVisible, true)
            assert.equal(options.beforeReveal, undefined, 'No expensive scene preparation under black')
            transitioning = true
            events.push('black')
            await show()
            events.push('reveal')
          },
        },
        './GameStateHelpers': {
          ensureCampaignPlayerRoster: value => value,
          worldStateWithCampaignClock: value => value,
        },
      },
    })
    const prepared = name => {
      assert.equal(loadingVisible, true)
      assert.equal(transitioning, false)
      events.push(name)
    }
    const game = {
      config: { worldId: 'world-test-1000' },
      context: {
        app: { ticker: {}, render: () => prepared('render') },
        controls: { focusHeroCamera: () => prepared('camera') },
      },
      _acquireWakeLock() {},
      _runtimeHeroUnit: () => null,
      _measure: (_name, callback) => callback(),
      _refreshSceneLighting: () => prepared('lighting'),
      async _yieldToBrowser() {
        if (events.at(-1) === 'render' || events.at(-1) === 'paint') events.push('paint')
      },
      async _bootFromConfig() {},
      async _bootFromSave() {},
      _destroyRuntime(options) {
        assert.equal(options.preserveLoadingScreen, true)
      },
      togglePause() {},
      quit() {
        assert.fail('Unexpected load failure')
      },
    }
    if (mode === 'new') await startGameRuntime(game)
    else await loadGameRuntime(game, { currentWorldId: 'home', worlds: { home: { state: {} } } })
    assert.deepEqual(events, [
      'preparing',
      'camera',
      'lighting',
      'render',
      'paint',
      'paint',
      'black',
      'hideLoading',
      'reveal',
    ])
    assert.deepEqual(traces, [
      'boot.prepareCamera',
      'boot.prepareLighting',
      'boot.firstRender',
      'boot.firstRenderFrames',
    ])
    assert.equal(game._loadingScreen, null)
  })
}
