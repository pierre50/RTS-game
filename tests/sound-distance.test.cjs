const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadSoundModule({ played = [], instances = new Map() } = {}) {
  const filename = path.join(__dirname, '../app/lib/audio/sound.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '@pixi/sound': {
      sound: {
        play: (...args) => {
          played.push(args)
          const active = instances.get(String(args[0])) ?? []
          active.push({})
          instances.set(String(args[0]), active)
        },
        exists: id => instances.has(id),
        find: id => ({ instances: instances.get(id) }),
      },
    },
    '../../config/soundDistance': {
      SOUND_DISTANCE_PROFILES: {
        default: { curve: 2, maxCells: 10, maxVolume: 1, minVolume: 0 },
        footstep: { curve: 2, maxCells: 10, maxVolume: 1, minVolume: 0.1 },
        voice: { curve: 1.4, maxCells: 12, maxVolume: 1, minVolume: 0.2 },
      },
    },
    '../random': {
      pickRandomItem: items => items[0],
    },
    '../mapSpaces': {
      sameMapSpace: (a, b) => (a?.spaceId ?? 'outside') === (b?.spaceId ?? 'outside'),
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('gameplay sound suppression skips cue playback and restores normally', () => {
  const played = []
  const soundModule = loadSoundModule({ played })
  soundModule.setGameplaySoundSuppressed(true)

  const cue = soundModule.playSoundCue('unit-command')

  assert.equal(cue, null)
  assert.equal(played.length, 0)
  assert.equal(soundModule.isGameplaySoundSuppressed(), true)

  soundModule.setGameplaySoundSuppressed(false)
  assert.equal(soundModule.isGameplaySoundSuppressed(), false)
  assert.equal(soundModule.playSoundCue('unit-command'), 'unit-command')
  assert.equal(played.length, 1)
})

test('hero distance sound volume attenuates from the hero and stops out of range', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { i: 0, j: 0, x: 0, y: 0 }
  const instance = { i: 0, j: 0, x: 0, y: 0, context: { controls: { heroUnit: hero } } }

  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 0.5), 0.5)

  instance.i = 5
  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 1), 0.25)

  instance.i = 10
  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 1), 0)
})

test('hero distance sound volume supports profile minimums', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { i: 0, j: 0, x: 0, y: 0 }
  const instance = { i: 9, j: 0, x: 0, y: 0, context: { controls: { heroUnit: hero } } }

  assert.ok(getHeroDistanceSoundVolume(instance, 'footstep', 1) > 0.1)
  assert.ok(getHeroDistanceSoundVolume(instance, 'footstep', 1) < 0.2)
})

test('hero distance sound volume falls back to isometric coordinates when cells are missing', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { x: 0, y: 0 }
  const instance = { x: 160, y: 80, context: { controls: { heroUnit: hero } } }

  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 1), 0.25)
})

test('hero distance sound volume mutes sources from another map space', () => {
  const { getHeroDistanceSoundVolume, playAudibleSoundCue } = loadSoundModule()
  const hero = { i: 0, j: 0, x: 0, y: 0, spaceId: 'interior:town-center' }
  const outsideInstance = {
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    context: { controls: { heroUnit: hero, instanceIsAudible: () => true } },
  }

  assert.equal(getHeroDistanceSoundVolume(outsideInstance, 'default', 1), 0)
  assert.equal(playAudibleSoundCue(outsideInstance, 'outside-fire'), null)
})

test('hero distance sound volume keeps sources audible inside the same map space', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { i: 0, j: 0, x: 0, y: 0, spaceId: 'interior:town-center' }
  const insideInstance = {
    i: 5,
    j: 0,
    x: 0,
    y: 0,
    spaceId: 'interior:town-center',
    context: { controls: { heroUnit: hero } },
  }

  assert.equal(getHeroDistanceSoundVolume(insideInstance, 'default', 1), 0.25)
})

test('selection voice does not fall back to hit sounds', () => {
  const { playSelectionSound } = loadSoundModule()
  const audibleContext = { controls: { instanceIsAudible: () => true } }

  assert.equal(playSelectionSound({ context: audibleContext, sounds: { hit: 'target-hit' } }), null)
  assert.equal(
    playSelectionSound({ context: audibleContext, sounds: { command: 'unit-command', hit: 'target-hit' } }),
    'unit-command'
  )
})

test('work sounds follow camera volume regardless of hero distance and respect visibility', () => {
  const played = []
  const { playAudibleSoundCue } = loadSoundModule({ played })
  const controls = { heroUnit: { i: 100, j: 100 }, instanceIsAudible: () => true, getWorkSoundVolume: () => 0.6 }
  const instance = { i: 0, j: 0, context: { controls } }
  assert.equal(playAudibleSoundCue(instance, 'chop', { profile: 'work', volume: 0.5 }), 'chop')
  assert.equal(played[0][1].volume, 0.3)
  controls.instanceIsAudible = () => false
  assert.equal(playAudibleSoundCue(instance, 'chop', { profile: 'work' }), null)
  controls.instanceIsAudible = () => true
  controls.getWorkSoundVolume = () => 0
  assert.equal(playAudibleSoundCue(instance, 'chop', { profile: 'work' }), null)
  assert.equal(played.length, 1)
})

test('work sound limits release slots when playback ends or stops, without limiting other sounds', () => {
  const played = []
  const instances = new Map()
  const { playAudibleSoundCue } = loadSoundModule({ played, instances })
  const instance = { context: { controls: { instanceIsAudible: () => true, getWorkSoundVolume: () => 0.7 } } }
  const work = cue => playAudibleSoundCue(instance, cue, { profile: 'work' })
  for (const cue of ['chop', 'mine', 'farm']) {
    assert.equal(work(cue), cue)
    assert.equal(work(cue), cue)
    assert.equal(work(cue), null)
  }
  assert.equal(work('build'), null)
  assert.equal(playAudibleSoundCue(instance, 'voice'), 'voice')
  instances.get('chop').pop()
  assert.equal(work('build'), 'build')
  instances.clear()
  assert.equal(work('chop'), 'chop')
})

test('camera work volume fades at all edges and scales with viewport zoom and position', () => {
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const { getCameraWorkVolume } = loadTsModule('app/lib/audio/cameraWorkVolume.ts')
  for (const viewport of [
    { visibleLeft: 0, visibleTop: 0, visibleWidth: 1000, visibleHeight: 600 },
    { visibleLeft: 2000, visibleTop: -500, visibleWidth: 500, visibleHeight: 300 },
  ]) {
    const volume = (x, y) =>
      getCameraWorkVolume(
        {
          x: viewport.visibleLeft + x * viewport.visibleWidth,
          y: viewport.visibleTop + y * viewport.visibleHeight,
        },
        viewport
      )
    assert.equal(volume(0.5, 0.5), 0.72)
    assert.ok(volume(0.9, 0.5) > 0)
    assert.ok(volume(0.9, 0.5) < volume(0.75, 0.5))
    for (const [x, y] of [
      [0, 0.5],
      [1, 0.5],
      [0.5, 0],
      [0.5, 1],
      [1.1, 0.5],
    ]) {
      assert.equal(volume(x, y), 0)
    }
  }
})
