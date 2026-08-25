const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSoundModule() {
  const filename = path.join(__dirname, '../app/lib/sound.ts')
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
    '../config/soundDistance': {
      SOUND_DISTANCE_PROFILES: {
        default: { curve: 2, maxDistance: 100, maxVolume: 1, minVolume: 0 },
        footstep: { curve: 2, maxDistance: 100, maxVolume: 1, minVolume: 0.1 },
      },
    },
    './random': {
      pickRandomItem: items => items[0],
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('hero distance sound volume attenuates from the hero and stops out of range', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { x: 0, y: 0 }
  const instance = { x: 0, y: 0, context: { controls: { heroUnit: hero } } }

  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 0.5), 0.5)

  instance.x = 50
  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 1), 0.25)

  instance.x = 100
  assert.equal(getHeroDistanceSoundVolume(instance, 'default', 1), 0)
})

test('hero distance sound volume supports profile minimums', () => {
  const { getHeroDistanceSoundVolume } = loadSoundModule()
  const hero = { x: 0, y: 0 }
  const instance = { x: 90, y: 0, context: { controls: { heroUnit: hero } } }

  assert.ok(getHeroDistanceSoundVolume(instance, 'footstep', 1) > 0.1)
  assert.ok(getHeroDistanceSoundVolume(instance, 'footstep', 1) < 0.2)
})
