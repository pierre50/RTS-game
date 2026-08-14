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

test('death flash restores tint if the sprite textures change before completion', () => {
  const { startDeathFlash } = loadModule('app/lib/deathFlash.ts')
  const originalTextures = ['dying-0', 'dying-1']
  const corpseTextures = ['corpse']
  const sprite = {
    currentFrame: 0,
    onFrameChange: null,
    textures: originalTextures,
    tint: 0xabcdef,
  }

  startDeathFlash(sprite)
  assert.equal(sprite.tint, 0xff3030)

  sprite.textures = corpseTextures
  sprite.onFrameChange(1)

  assert.equal(sprite.tint, 0xabcdef)
  assert.equal(sprite.onFrameChange, null)
})
