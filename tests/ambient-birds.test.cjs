const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  AMBIENT_BIRD_ANIMATION_SPEED: 0.24,
  AMBIENT_BIRD_ASSETS: [],
  AMBIENT_BIRD_FIRST_PASS_MAX_MS: 16000,
  AMBIENT_BIRD_FIRST_PASS_MIN_MS: 8000,
  AMBIENT_BIRD_PASS_DURATION_MAX_MS: 11000,
  AMBIENT_BIRD_PASS_DURATION_MIN_MS: 7000,
  AMBIENT_BIRD_PASS_INTERVAL_MAX_MS: 55000,
  AMBIENT_BIRD_PASS_INTERVAL_MIN_MS: 28000,
  AMBIENT_BIRD_PATH_OFFSET_RATIO: 0.3,
  AMBIENT_BIRD_SCREEN_MARGIN: 100,
  AMBIENT_BIRD_SHADOW_ALPHA: 0.28,
  AMBIENT_BIRD_SHADOW_OFFSET_X: 14,
  AMBIENT_BIRD_SHADOW_OFFSET_Y: 20,
}

const { createBirdPath, getBirdDirectionalFrames } = loadModule('app/services/AmbientBirds.js', {
  'pixi.js': {
    AnimatedSprite: class {},
    Assets: {},
    Container: class {},
  },
  '../constants': constants,
  '../lib': {
    getMirroredHalfArcFrameIndex: degree => ({
      frameIndex: degree === 180 ? 8 : 0,
      mirrored: degree > 180,
    }),
  },
})

test('bird paths cross the viewport from opposite sides', () => {
  const values = [0, 0.5]
  const path = createBirdPath({ x: 0, y: 0, width: 800, height: 600 }, () => values.shift())

  assert.ok(path.start.x < 0)
  assert.ok(path.end.x > 800)
  assert.equal(path.start.y, 300)
  assert.equal(path.end.y, 300)
  assert.equal(path.degree, 180)
})

test('directional frames select one complete animation set', () => {
  const textures = Object.fromEntries(
    Array.from({ length: 108 }, (_, index) => [`${String(index).padStart(3, '0')}_404.png`, index])
  )

  const result = getBirdDirectionalFrames(textures, 180, 12)

  assert.deepEqual(
    result.frames,
    Array.from({ length: 12 }, (_, index) => index + 96)
  )
  assert.equal(result.mirrored, false)
})
