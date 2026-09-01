const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const spriteTransientEffects = loadModule('app/lib/entities/spriteTransientEffects.ts', {})
const deathFlashMocks = {
  './spriteTransientEffects': spriteTransientEffects,
}

test('death completion no longer tints the sprite red', () => {
  const { runAfterDeathFlash } = loadModule('app/lib/entities/deathFlash.ts', deathFlashMocks)
  const sprite = {
    currentFrame: 0,
    destroyed: false,
    onFrameChange: null,
    textures: ['dying-0', 'dying-1'],
    tint: 0xabcdef,
  }

  const completeDeath = runAfterDeathFlash(sprite, () => {})

  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, null)

  completeDeath()

  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, null)
})

test('death completion still runs the corpse transition callback', () => {
  const { runAfterDeathFlash } = loadModule('app/lib/entities/deathFlash.ts', deathFlashMocks)
  const sprite = {
    currentFrame: 0,
    destroyed: false,
    onFrameChange: null,
    textures: ['dying-0', 'dying-1'],
    tint: 0xabcdef,
  }
  let completed = false

  runAfterDeathFlash(sprite, () => {
    completed = true
  })()

  assert.equal(completed, true)
})
