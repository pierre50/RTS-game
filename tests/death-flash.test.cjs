const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const spriteTransientEffects = loadModule('app/lib/spriteTransientEffects.ts', {})
const deathFlashMocks = {
  './spriteTransientEffects': spriteTransientEffects,
}

test('death flash restores tint if the sprite textures change before completion', () => {
  const { runAfterDeathFlash } = loadModule('app/lib/deathFlash.ts', deathFlashMocks)
  const originalTextures = ['dying-0', 'dying-1']
  const corpseTextures = ['corpse']
  const sprite = {
    currentFrame: 0,
    onFrameChange: null,
    textures: originalTextures,
    tint: 0xabcdef,
  }

  runAfterDeathFlash(sprite, () => {})
  assert.equal(sprite.tint, 0xff3030)

  sprite.textures = corpseTextures
  sprite.onFrameChange(1)

  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, null)
})

test('death flash can be cleared even if sprite callbacks were replaced', () => {
  const { clearDeathFlash, runAfterDeathFlash } = loadModule('app/lib/deathFlash.ts', deathFlashMocks)
  const replacementFrameChange = () => {}
  const sprite = {
    currentFrame: 0,
    destroyed: false,
    onFrameChange: null,
    textures: ['dying-0', 'dying-1'],
    tint: 0xabcdef,
  }

  runAfterDeathFlash(sprite, () => {})
  assert.equal(sprite.tint, 0xff3030)

  sprite.onFrameChange = replacementFrameChange
  clearDeathFlash(sprite)

  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, replacementFrameChange)
})

test('starting a new death flash restores the previous flash tint first', () => {
  const { runAfterDeathFlash } = loadModule('app/lib/deathFlash.ts', deathFlashMocks)
  const sprite = {
    currentFrame: 0,
    destroyed: false,
    onFrameChange: null,
    textures: ['dying-0', 'dying-1'],
    tint: 0xabcdef,
  }

  const stopFirst = runAfterDeathFlash(sprite, () => {})
  sprite.tint = 0x123456
  const stopSecond = runAfterDeathFlash(sprite, () => {})

  stopFirst()
  assert.equal(sprite.tint, 0xff3030)

  stopSecond()
  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, null)
})
