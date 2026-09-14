const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const skip of [false, true]) {
  test(`new game loads before prologue choice and starts the scene after reveal (skip=${skip})`, async () => {
    const events = []
    let finishReveal
    let reportReveal
    const fading = new Promise(resolve => { reportReveal = resolve })
    const revealed = new Promise(resolve => { finishReveal = resolve })
    let finishLoading
    let reportWaiting
    const loading = new Promise(resolve => { finishLoading = resolve })
    const waiting = new Promise(resolve => { reportWaiting = resolve })
    let choose
    const choice = new Promise(resolve => { choose = resolve })
    const { startGameRuntime } = loadTsModule('app/screens/game/GameBootFlow.ts', {
      mocks: {
        '../../ui/TutorialPrologue': { TutorialPrologue: class {
          chooseSkip() { return choice }
          async reveal() { events.push('reveal'); reportReveal(); await revealed }
          destroy() {}
        } },
        '../../services/tutorial/TutorialVillage': { tutorialVillageConfig: () => ({ heroOnlyStart: false, villageStarts: { Hellas: {} } }) },
        '../../lib/lang': { t: key => key },
        '../../lib': { Modal: class {} },
        '../../serialization/SaveValidator': {},
        '../../serialization/CampaignSave': {},
        '../../lib/audio/settings': { getGameSpeed: () => 1 },
        '../../ui/GameLoadingScreen': {},
        '../../ui/BuildingInteriorTransition': { playBuildingInteriorDoorTransition: () => assert.fail('Duplicate transition') },
        './GameStateHelpers': {},
      },
    })
    const hero = {}
    const game = {
      config: {},
      context: { app: { ticker: {}, render() { events.push('render') } }, menu: { show() {} } },
      _acquireWakeLock() {},
      async _yieldToBrowser() {},
      async _bootFromConfig(_config, options) {
        assert.equal(options.startPaused, true)
        events.push('loading')
        choose(skip)
        const setup = await options.startingSetup
        assert.equal(setup.heroOnlyStart, skip)
        reportWaiting()
        await loading
      },
      async _prepareTutorial() { events.push('tutorial') },
      async _prepareIntroduction() { events.push('camp') },
      _runtimeHeroUnit: () => hero,
      _measure: (_name, callback) => callback(),
      _startTutorial() { events.push('start') },
    }
    const boot = startGameRuntime(game)
    await waiting
    assert.deepEqual(events, ['loading'], 'Finishing narration must not reveal or start a still-loading game')
    finishLoading()
    await fading
    assert.equal(events.includes('start'), false, 'the scene must not start while the prologue is fading')
    finishReveal()
    await boot
    assert.deepEqual(events, ['loading', skip ? 'camp' : 'tutorial', 'render', 'reveal', 'start'])
    assert.equal(hero.devInvincible, undefined)
  })
}

test('tutorial defeat prepares a normal camp under black and starts it after reveal', async () => {
  const events = []
  const { recoverGameAfterDefeat } = loadTsModule('app/screens/game/GameBootFlow.ts', {
    mocks: {
      '../../ui/TutorialPrologue': {},
      '../../services/tutorial/TutorialVillage': {},
      '../../lib/lang': { t: key => key },
      '../../lib': {},
      '../../serialization/SaveValidator': {},
      '../../serialization/CampaignSave': {},
      '../../lib/audio/settings': { getGameSpeed: () => 1 },
      '../../ui/GameLoadingScreen': {},
      '../../ui/BuildingInteriorTransition': { async playBuildingInteriorDoorTransition(prepare) {
        events.push('black')
        await prepare()
        events.push('reveal')
      } },
      './GameStateHelpers': {},
    },
  })
  const game = {
    config: { players: [{ civ: 'Xia', gender: 'female' }], villageStarts: { Xia: {} } },
    _campaignSave: { tutorial: {} },
    context: { app: { ticker: {}, render() {} }, defeat: true },
    togglePause() {},
    _destroyRuntime() { events.push('destroy') },
    async _bootFromConfig(config, options) {
      assert.equal(options.startPaused, true)
      assert.equal(this._campaignSave, null)
      assert.equal(config.heroOnlyStart, true)
      assert.equal(config.villageStarts, undefined)
      assert.deepEqual(config.players, this.config.players)
      events.push('boot')
    },
    async _prepareIntroduction() { events.push('prepare') },
    _showIntroduction() { events.push('show') },
    _startIntroduction() { events.push('start') },
  }
  await recoverGameAfterDefeat(game, true)
  assert.deepEqual(events, ['black', 'destroy', 'boot', 'prepare', 'show', 'reveal', 'start'])
})

test('normal death restores the last saved world and clock under one fade before resuming', async () => {
  const events = []
  const checkpoint = { currentWorldId: 'home', clock: { dayNightElapsedMs: 123 }, worlds: { home: { state: { name: 'saved-world' } } } }
  const { recoverGameAfterDefeat } = loadTsModule('app/screens/game/GameBootFlow.ts', { mocks: {
    '../../ui/TutorialPrologue': {},
    '../../services/tutorial/TutorialVillage': {},
    '../../services/tutorial/TutorialVillageMigration': { migrateTutorialVillageOwner() {} },
    '../../lib/lang': { t: key => key },
    '../../lib': {},
    '../../serialization/SaveValidator': { validateSaveData: value => value },
    '../../serialization/CampaignSave': { isCampaignSave: () => true, getCurrentWorldState: save => save.worlds[save.currentWorldId].state },
    '../../lib/audio/settings': { getGameSpeed: () => 1 },
    '../../ui/GameLoadingScreen': {},
    '../../ui/BuildingInteriorTransition': { async playBuildingInteriorDoorTransition(prepare) {
      events.push('black')
      await prepare()
      assert.equal(game.context.paused, true)
      events.push('reveal')
    } },
    './GameStateHelpers': { ensureCampaignPlayerRoster: value => value, worldStateWithCampaignClock: (state, clock) => ({ ...state, clock }) },
  } })
  const game = {
    config: {}, _lastSavedRecord: checkpoint,
    _restartSaveData: { name: 'unsaved-changes' },
    _campaignSave: { clock: { dayNightElapsedMs: 999 } },
    context: { defeat: true, app: { ticker: {}, render() { events.push('render') } } },
    togglePause(value) { this.context.paused = value },
    _destroyRuntime() { events.push('destroy') },
    async _bootFromSave(state) {
      assert.deepEqual(state, { name: 'saved-world', clock: 123 })
      assert.equal(this.context.paused, true)
      events.push('load')
    },
    async _restoreTutorial() {},
    _startIntroduction() { assert.equal(this.context.paused, false); events.push('start') },
  }
  await recoverGameAfterDefeat(game)
  assert.deepEqual(events, ['black', 'destroy', 'load', 'render', 'reveal', 'start'])
  assert.deepEqual(checkpoint.clock, { dayNightElapsedMs: 123 })
})
