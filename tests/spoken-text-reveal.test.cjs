const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('shared reveal preserves paragraph order, voice and volume, and cancels stale callbacks', () => {
  const previous = { Audio: global.Audio, window: global.window, clearTimeout: global.clearTimeout }
  const timers = new Map(), sounds = []
  let id = 0
  global.window = { setTimeout: fn => { timers.set(++id, fn); return id } }
  global.clearTimeout = key => timers.delete(key)
  global.Audio = class {
    constructor(path) { this.path = path; this.plays = 0; sounds.push(this) }
    play() { this.plays++; return Promise.resolve() }
    pause() { this.paused = true }
  }
  const element = () => ({ textContent: '', classList: { add() {}, remove() {} } })
  const tick = () => { const [key, fn] = [...timers][0]; timers.delete(key); fn() }
  try {
    const { SpokenTextReveal } = loadTsModule('app/ui/SpokenTextReveal.ts', {
      mocks: { '../lib/audio/settings': { getVolume: () => 0.25 } },
    })
    const reveal = new SpokenTextReveal()
    let completed = 0
    const first = element(), second = element()
    reveal.show([{ element: first, text: 'Long ago' }, { element: second, text: 'Your story began' }], 'female', () => completed++)
    assert.equal(first.textContent, 'Long')
    assert.equal(second.textContent, '')
    tick()
    assert.equal(first.textContent, 'Long ago')
    tick()
    assert.equal(second.textContent, 'Your')
    assert.equal(sounds[1].plays, 3)
    assert.equal(sounds[1].volume, 0.25)
    assert.equal(sounds[0].plays, 0)
    const stale = [...timers.values()][0]
    reveal.stop()
    assert.equal(timers.size, 0)
    stale()
    assert.equal(second.textContent, 'Your')
    assert.equal(completed, 0, 'cancelling a narration must not complete it')
    assert.ok(sounds.every(audio => audio.paused && audio.currentTime === 0))
    reveal.show([{ element: first, text: 'New message' }], 'male', () => completed++)
    tick(); tick()
    assert.equal(first.textContent, 'New message')
    assert.equal(completed, 1)
    assert.equal(timers.size, 0)
    assert.equal(reveal.revealAll(), false)
    reveal.show([{ element: first, text: 'Finish this paragraph' }, { element: second, text: 'And this one too' }])
    const pending = [...timers.values()][0]
    assert.equal(reveal.revealAll(), true)
    assert.equal(first.textContent, 'Finish this paragraph')
    assert.equal(second.textContent, 'And this one too')
    assert.equal(timers.size, 0)
    const plays = sounds[0].plays
    pending()
    assert.equal(sounds[0].plays, plays)
    assert.ok(sounds.every(audio => audio.paused))
    assert.equal(reveal.revealAll(), false)
  } finally {
    Object.assign(global, previous)
  }
})
