const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadLifecycle({ calls, soundSuppressed, defeated = false }) {
  return loadTsModule('app/screens/game/GameRuntimeLifecycle.ts', {
    mocks: {
      '@pixi/sound': {
        sound: {
          pauseAll: () => calls.push(['pauseAll']),
          resumeAll: () => calls.push(['resumeAll']),
          stopAll: () => calls.push(['stopAll']),
        },
      },
      '../../lib/lang': { t: key => key },
      '../../lib': {
        debounce: fn => fn,
        getGaiaAnimals: gaia => gaia?.units ?? [],
        isPlayedHeroDefeated: () => defeated,
      },
      '../../lib/audio/settings': {
        getCameraZoom: () => 1,
        getControlActionForKeyboardEvent: () => null,
      },
      '../../lib/audio/sound': {
        isGameplaySoundSuppressed: () => soundSuppressed.value,
        setGameplaySoundSuppressed: value => {
          soundSuppressed.value = value
          calls.push(['suppressed', value])
        },
      },
      '../../lib/audio/uiSound': { stopAllUiSounds: () => calls.push(['stopAllUiSounds']) },
      '../../lib/combat/combatFeedback': { clearAllCombatFeedback: () => {} },
    },
  })
}

test('toggleGamePause pauses current sounds and suppresses new gameplay audio until resume', () => {
  const calls = []
  const soundSuppressed = { value: false }
  const { toggleGamePause } = loadLifecycle({ calls, soundSuppressed })
  const game = {
    _pausedByOrientation: false,
    _pausedByVisibility: false,
    context: {
      defeat: false,
      map: { gaia: null, grid: [], waterOverlayPaused: false },
      paused: false,
      players: [],
    },
  }
  global.document = {
    getElementById: () => null,
    createElement: () => ({ id: '', className: '', innerText: '' }),
    body: { appendChild() {} },
  }

  toggleGamePause(game, true, { silent: true })
  assert.equal(soundSuppressed.value, true)
  assert.equal(game.context.map.waterOverlayPaused, true)

  toggleGamePause(game, false, { silent: true })
  assert.equal(soundSuppressed.value, false)
  assert.equal(game.context.map.waterOverlayPaused, false)
  assert.deepEqual(calls, [['suppressed', true], ['pauseAll'], ['suppressed', false], ['resumeAll']])
})

test('toggleGamePause restores a previously suppressed audio state', () => {
  const calls = []
  const soundSuppressed = { value: true }
  const { toggleGamePause } = loadLifecycle({ calls, soundSuppressed })
  const game = {
    _pausedByOrientation: false,
    _pausedByVisibility: false,
    context: {
      defeat: false,
      map: { gaia: null, grid: [], waterOverlayPaused: false },
      paused: false,
      players: [],
    },
  }
  global.document = {
    getElementById: () => null,
    createElement: () => ({ id: '', className: '', innerText: '' }),
    body: { appendChild() {} },
  }

  toggleGamePause(game, true, { silent: true })
  toggleGamePause(game, false, { silent: true })

  assert.equal(soundSuppressed.value, true)
  assert.deepEqual(calls, [['suppressed', true], ['pauseAll'], ['suppressed', true], ['resumeAll']])
})

for (const scripted of [false, true]) {
  test(`defeat waits for the death animation without an overlay (tutorial=${scripted})`, async () => {
    const { checkGameDefeat } = loadLifecycle({ calls: [], soundSuppressed: { value: false }, defeated: true })
    const previousDocument = global.document
    const overlays = []
    let transitions = 0
    global.document = { createElement: () => ({}), body: { appendChild: element => overlays.push(element) } }
    let finishDeath
    const deathAnimationComplete = new Promise(resolve => { finishDeath = resolve })
    const game = {
      context: { player: {}, defeat: false, controls: { heroUnit: { deathAnimationComplete } } },
      _handleDefeat() {
        transitions++
        this.context.defeat = true
        return true
      },
    }
    try {
      assert.equal(checkGameDefeat(game), true)
      assert.equal(checkGameDefeat(game), false)
      assert.equal(transitions, 0, 'no transition while the hurt animation is playing')
      finishDeath()
      await deathAnimationComplete
      await Promise.resolve()
      assert.equal(overlays.length, 0)
      assert.equal(transitions, 1)
    } finally { global.document = previousDocument }
  })
}
