const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadSoundModule() {
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
        play: () => {},
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
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

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

test('selection voice does not fall back to hit sounds', () => {
  const { playSelectionSound } = loadSoundModule()
  const audibleContext = { controls: { instanceIsAudible: () => true } }

  assert.equal(playSelectionSound({ context: audibleContext, sounds: { hit: 'target-hit' } }), null)
  assert.equal(playSelectionSound({ context: audibleContext, sounds: { command: 'unit-command', hit: 'target-hit' } }), 'unit-command')
})
