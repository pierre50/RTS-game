const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTimeSkipModule(soundState = { suppressed: false }, input = {}) {
  return loadTsModule('app/services/TimeSkipSystem.ts', {
    mocks: {
      '../lib/audio/settings': { getGamepadEnabled: () => input.enabled !== false },
      '../lib/input/gamepad': { getActiveGamepad: () => input.pad ?? null },
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
    getAnimations: () => [],
    className: '',
    dataset: {},
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

    assert.equal(
      timeSkip.start(1, { completedMessage: 'Slept until morning', onComplete: () => calls.push(['complete']) }).ok,
      true
    )
    setElapsedMs(60 * 1000)
    getTick()()

    assert.ok(calls.some(call => call[0] === 'complete'))
    assert.ok(calls.some(call => call[0] === 'message' && call[1] === 'Slept until morning'))

    assert.equal(timeSkip.start(1, { onComplete: () => calls.push(['cancelled-complete']) }).ok, true)
    getKeydownHandler()({ key: 'Escape', preventDefault: () => {}, stopImmediatePropagation: () => {} })

    assert.equal(
      calls.some(call => call[0] === 'cancelled-complete'),
      false
    )
  })
})

test('next morning hours target the next 06:00', () => {
  const { getHoursUntilNextMorning } = loadTimeSkipModule()

  assert.equal(getHoursUntilNextMorning(23, 30), 6.5)
  assert.equal(getHoursUntilNextMorning(5, 45), 0.25)
  assert.equal(getHoursUntilNextMorning(6, 0), 24)
})

test('sleep controls show Escape and connected gamepad cancellation without leaking held buttons', () => {
  withDocument(() => {
    const input = { pad: { index: 0, buttons: [{ pressed: false }, { pressed: true }] } }
    const { TimeSkipSystem } = loadTimeSkipModule({ suppressed: false }, input)
    const { context, getTick } = createContext()
    let cancelled = 0
    const timeSkip = new TimeSkipSystem(context)
    timeSkip.start(3, { onCancel: () => cancelled++ })
    const hints = context.gamebox.children[0].children[0].children[2]
    assert.equal(hints.children[0].children[0].textContent, 'Esc')
    assert.equal(hints.children[1].children[0].textContent, 'B')
    assert.equal(hints.children[1].hidden, false)
    getTick()()
    assert.equal(timeSkip.active, true, 'button held when sleep starts must not cancel')
    input.pad.buttons[1].pressed = false
    getTick()()
    input.pad.buttons[1].pressed = true
    getTick()()
    assert.equal(timeSkip.active, false)
    assert.equal(cancelled, 1)
    assert.equal(context.app.ticker.speed, 1.5)
    assert.equal(context.scheduler.timeScale, 1.5)
    assert.equal(context.gamebox.children.length, 0)
  })
})

test('sleep gamepad hints follow connection and enabled setting', () => {
  withDocument(() => {
    const input = {}
    const { TimeSkipSystem } = loadTimeSkipModule({ suppressed: false }, input)
    const { context, getTick } = createContext()
    const timeSkip = new TimeSkipSystem(context)
    timeSkip.start(3)
    const hint = context.gamebox.children[0].children[0].children[2].children[1]
    assert.equal(hint.hidden, true)
    input.pad = { index: 0, buttons: [{ pressed: false }, { pressed: true }] }
    getTick()()
    assert.equal(hint.hidden, false)
    assert.equal(timeSkip.active, true, 'connecting with B held must not cancel')
    input.enabled = false
    getTick()()
    assert.equal(hint.hidden, true)
    assert.equal(timeSkip.active, true)
    timeSkip.destroy()
  })
})

test('sleep drives coarse simulation while freezing animation time and restores before waking', () => {
  withDocument(() => {
    const { TimeSkipSystem } = loadTimeSkipModule()
    const { context, getTick, setElapsedMs } = createContext()
    context.dayNight.setElapsedMs = setElapsedMs
    context.scheduler.advanceSleepTime = () => {}
    const order = []
    const simulation = {
      busy: false,
      begin: () => order.push('begin'),
      step: target => {
        order.push('step')
        setElapsedMs(target)
      },
      end: () => order.push('end'),
    }
    const skip = new TimeSkipSystem(context, simulation)
    context.timeSkip = skip
    assert.equal(
      skip.start(8, {
        mode: 'sleep',
        onComplete() {
          assert.equal(context.scheduler.suspended, false)
          assert.equal(skip.simulatingSleep, false)
          order.push('wake')
        },
      }).ok,
      true
    )
    assert.equal(context.app.ticker.speed, 0)
    assert.equal(context.scheduler.suspended, true)
    getTick()()
    assert.deepEqual(order, ['begin'])
    getTick()()
    assert.deepEqual(order, ['begin', 'step', 'end', 'wake'])
    assert.equal(context.dayNight.getElapsedMs(), 480000)
    assert.equal(context.app.ticker.speed, 1.5)
    assert.equal(context.scheduler.timeScale, 1.5)
  })
})

test('cancelling mid-interval settles all owners before releasing the clock', () => {
  withDocument(() => {
    const { TimeSkipSystem } = loadTimeSkipModule()
    const { context, getTick, setElapsedMs } = createContext()
    context.dayNight.setElapsedMs = setElapsedMs
    context.scheduler.advanceSleepTime = () => {}
    let steps = 0,
      cancelled = 0
    const simulation = {
      busy: false,
      begin() {},
      end() {
        assert.equal(this.busy, false)
      },
      step() {
        steps++
        this.busy = steps === 1
        if (!this.busy) setElapsedMs(60000)
      },
    }
    const skip = new TimeSkipSystem(context, simulation)
    context.timeSkip = skip
    skip.start(8, { mode: 'sleep', onCancel: () => cancelled++ })
    getTick()()
    getTick()()
    skip.cancel()
    assert.equal(skip.active, true)
    assert.equal(context.scheduler.suspended, true)
    context.paused = true
    getTick()()
    assert.equal(steps, 2)
    assert.equal(cancelled, 1)
    assert.equal(skip.active, false)
    assert.equal(context.dayNight.getElapsedMs(), 60000)
    assert.equal(context.scheduler.suspended, false)
  })
})

test('sleep refuses missing simulation and invalid durations without changing runtime', () => {
  const { TimeSkipSystem } = loadTimeSkipModule()
  const { context } = createContext()
  const skip = new TimeSkipSystem(context)
  for (const hours of [0, -1, NaN, Infinity]) assert.equal(skip.start(hours).ok, false)
  assert.equal(skip.start(8, { mode: 'sleep' }).ok, false)
  assert.equal(skip.active, false)
  assert.equal(context.app.ticker.speed, 1.5)
})

for (const mode of ['sleep', undefined]) {
  test(`black fade finishes before ${mode ?? 'fast-forward'} changes runtime or simulates`, () => {
    withDocument(() => {
      const sound = { suppressed: false }
      const { TimeSkipSystem } = loadTimeSkipModule(sound)
      const { context, getTick, setElapsedMs } = createContext()
      context.dayNight.setElapsedMs = setElapsedMs
      context.scheduler.advanceSleepTime = () => {}
      const calls = []
      const simulation = {
        busy: false,
        begin: () => calls.push('begin'),
        step: () => calls.push('step'),
        end: () => calls.push('end'),
      }
      const skip = new TimeSkipSystem(context, simulation)
      skip.start(8, { mode, fadeToBlack: true })
      const animation = { pending: true, playState: 'running' }
      skip.overlay.root.getAnimations = () => [animation]
      for (let frame = 0; frame < 10; frame++) getTick()()
      assert.equal(context.app.ticker.speed, 1.5)
      assert.equal(context.scheduler.timeScale, 1.5)
      assert.equal(context.scheduler.suspended, undefined)
      assert.equal(skip.simulatingSleep, false)
      assert.equal(sound.suppressed, false)
      assert.deepEqual(calls, [])
      animation.pending = false
      animation.playState = 'finished'
      getTick()()
      assert.equal(context.app.ticker.speed, mode === 'sleep' ? 0 : 72)
      assert.equal(sound.suppressed, true)
      assert.deepEqual(calls, [])
      getTick()()
      if (mode === 'sleep') assert.deepEqual(calls, ['begin'])
      skip.cancel()
      assert.equal(context.app.ticker.speed, 1.5)
    })
  })
}

test('cancelling during the fade never starts sleep, including a later restart', () => {
  withDocument(() => {
    const { TimeSkipSystem } = loadTimeSkipModule()
    const { context, getTick, setElapsedMs } = createContext()
    context.dayNight.setElapsedMs = setElapsedMs
    context.scheduler.advanceSleepTime = () => {}
    const simulation = {
      busy: false,
      begin: () => assert.fail('cancelled sleep must never begin'),
      step: () => assert.fail('cancelled sleep must never advance'),
      end: () => assert.fail('unstarted sleep must not reconcile'),
    }
    const skip = new TimeSkipSystem(context, simulation)
    let cancelled = false
    skip.start(8, {
      mode: 'sleep',
      fadeToBlack: true,
      onCancel: () => {
        cancelled = true
      },
    })
    const oldTick = getTick()
    skip.cancel()
    oldTick()
    assert.equal(cancelled, true)
    assert.equal(context.app.ticker.speed, 1.5)
    assert.equal(context.gamebox.children.length, 0)
    skip.start(1)
    getTick()()
    assert.equal(context.app.ticker.speed, 72)
    skip.cancel()
  })
})

test('reduced-motion sleep starts after rendering black without waiting for an animation event', () => {
  withDocument(() => {
    const { TimeSkipSystem } = loadTimeSkipModule()
    const { context, getTick, setElapsedMs } = createContext()
    context.dayNight.setElapsedMs = setElapsedMs
    context.scheduler.advanceSleepTime = () => {}
    let began = false
    const skip = new TimeSkipSystem(context, {
      busy: false,
      begin: () => {
        began = true
      },
      end() {},
    })
    skip.start(8, { mode: 'sleep', fadeToBlack: true })
    getTick()()
    assert.equal(began, false)
    getTick()()
    assert.equal(began, true)
    skip.cancel()
  })
})
