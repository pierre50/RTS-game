const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTimeSkipModule(soundState = { suppressed: false }) {
  return loadTsModule('app/services/TimeSkipSystem.ts', {
    mocks: {
      '../lib/audio/sound': {
        isGameplaySoundSuppressed: () => soundState.suppressed,
        setGameplaySoundSuppressed: value => {
          soundState.suppressed = value
        },
      },
    },
  })
}

function loadTimeSkipSystem(soundState = { suppressed: false }) {
  return loadTimeSkipModule(soundState).TimeSkipSystem
}

function createFakeElement() {
  return {
    children: [],
    className: '',
    parent: null,
    style: {},
    textContent: '',
    appendChild(child) {
      child.parent = this
      this.children.push(child)
      return child
    },
    remove() {
      if (!this.parent) return
      this.parent.children = this.parent.children.filter(child => child !== this)
      this.parent = null
    },
  }
}

function withDocument(callback) {
  const previousDocument = global.document
  let keydownHandler = null
  const calls = []
  global.document = {
    addEventListener: (event, handler, capture) => {
      calls.push(['addEventListener', event, capture])
      keydownHandler = handler
    },
    createElement: () => createFakeElement(),
    removeEventListener: (event, handler, capture) => {
      calls.push(['removeEventListener', event, handler === keydownHandler, capture])
    },
  }
  try {
    callback({ calls, getKeydownHandler: () => keydownHandler })
  } finally {
    global.document = previousDocument
  }
}

function createContext({ elapsedMs = 0 } = {}) {
  let currentElapsedMs = elapsedMs
  let fastForwardTick = null
  const calls = []
  const context = {
    app: {
      ticker: {
        speed: 1.5,
        add: callback => {
          fastForwardTick = callback
          calls.push(['addTick'])
        },
        remove: callback => {
          assert.equal(callback, fastForwardTick)
          calls.push(['removeTick'])
        },
      },
    },
    controls: {
      stopKeyboardMove: () => calls.push(['stopKeyboardMove']),
    },
    dayNight: {
      getDayLabel: () => 'Day 1',
      getElapsedMs: () => currentElapsedMs,
      getTimeLabel: () => '09:00',
    },
    gamebox: createFakeElement(),
    menu: {
      showMessage: (...args) => calls.push(['message', ...args]),
      updateTopbar: () => calls.push(['topbar']),
    },
    scheduler: {
      timeScale: 1.5,
    },
  }
  return {
    calls,
    context,
    getTick: () => fastForwardTick,
    setElapsedMs: value => {
      currentElapsedMs = value
    },
  }
}

test('time skip starts fast-forward mode and restores runtime state on completion', () => {
  withDocument(() => {
    const soundState = { suppressed: false }
    const TimeSkipSystem = loadTimeSkipSystem(soundState)
    const { calls, context, getTick, setElapsedMs } = createContext()
    const timeSkip = new TimeSkipSystem(context)
    context.timeSkip = timeSkip

    const result = timeSkip.start(1)

    assert.equal(result.ok, true)
    assert.equal(result.message, 'Fast-forwarding 1h at 72x...')
    assert.equal(timeSkip.active, true)
    assert.equal(timeSkip.suppressAudio, true)
    assert.equal(timeSkip.suppressCosmetics, true)
    assert.equal(timeSkip.dayNightMaxDeltaMs, 1000)
    assert.equal(context.app.ticker.speed, 72)
    assert.equal(context.scheduler.timeScale, 72)
    assert.equal(soundState.suppressed, true)

    setElapsedMs(60 * 1000)
    getTick()()

    assert.equal(timeSkip.active, false)
    assert.equal(timeSkip.suppressAudio, false)
    assert.equal(timeSkip.suppressCosmetics, false)
    assert.equal(timeSkip.dayNightMaxDeltaMs, undefined)
    assert.equal(context.app.ticker.speed, 1.5)
    assert.equal(context.scheduler.timeScale, 1.5)
    assert.equal(soundState.suppressed, false)
    assert.ok(calls.some(call => call[0] === 'message' && call[1] === 'Time advanced to Day 1 09:00'))
  })
})

test('time skip overlay tracks remaining whole hours while the progress bar fills', () => {
  withDocument(() => {
    const TimeSkipSystem = loadTimeSkipSystem()
    const { context, getTick, setElapsedMs } = createContext()
    const timeSkip = new TimeSkipSystem(context)
    context.timeSkip = timeSkip

    assert.equal(timeSkip.start(2).ok, true)
    const overlay = context.gamebox.children[0]
    const panel = overlay.children[0]
    const label = panel.children[0]
    const fill = panel.children[1].children[0]

    assert.equal(label.textContent, 'Waiting... 2 hours remaining')
    assert.equal(fill.style.width, '0%')

    setElapsedMs(60 * 1000)
    getTick()()

    assert.equal(label.textContent, 'Waiting... 1 hour remaining')
    assert.equal(fill.style.width, '50%')
  })
})

test('time skip cancels on Escape and restores previous suppressed audio state', () => {
  withDocument(({ calls, getKeydownHandler }) => {
    const soundState = { suppressed: true }
    const TimeSkipSystem = loadTimeSkipSystem(soundState)
    const setup = createContext()
    const timeSkip = new TimeSkipSystem(setup.context)
    setup.context.timeSkip = timeSkip

    assert.equal(timeSkip.start(3).ok, true)

    getKeydownHandler()({
      key: 'Escape',
      preventDefault: () => calls.push(['preventDefault']),
      stopImmediatePropagation: () => calls.push(['stopImmediatePropagation']),
    })

    assert.equal(timeSkip.active, false)
    assert.equal(setup.context.app.ticker.speed, 1.5)
    assert.equal(setup.context.scheduler.timeScale, 1.5)
    assert.equal(soundState.suppressed, true)
    assert.ok(calls.some(call => call[0] === 'removeEventListener' && call[2] === true && call[3] === true))
    assert.ok(setup.calls.some(call => call[0] === 'message' && call[1] === 'Time skip cancelled'))
  })
})

test('time skip completion callback runs only after completed skips', () => {
  withDocument(({ getKeydownHandler }) => {
    const TimeSkipSystem = loadTimeSkipSystem()
    const { calls, context, getTick, setElapsedMs } = createContext()
    const timeSkip = new TimeSkipSystem(context)
    context.timeSkip = timeSkip

    assert.equal(timeSkip.start(1, { completedMessage: 'Slept until morning', onComplete: () => calls.push(['complete']) }).ok, true)
    setElapsedMs(60 * 1000)
    getTick()()

    assert.ok(calls.some(call => call[0] === 'complete'))
    assert.ok(calls.some(call => call[0] === 'message' && call[1] === 'Slept until morning'))

    assert.equal(timeSkip.start(1, { onComplete: () => calls.push(['cancelled-complete']) }).ok, true)
    getKeydownHandler()({ key: 'Escape', preventDefault: () => {}, stopImmediatePropagation: () => {} })

    assert.equal(calls.some(call => call[0] === 'cancelled-complete'), false)
  })
})

test('next morning hours target the next 07:00', () => {
  const { getHoursUntilNextMorning } = loadTimeSkipModule()

  assert.equal(getHoursUntilNextMorning(23, 30), 7.5)
  assert.equal(getHoursUntilNextMorning(6, 45), 0.25)
  assert.equal(getHoursUntilNextMorning(7, 0), 24)
})
