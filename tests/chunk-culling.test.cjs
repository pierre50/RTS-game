const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadChunkCulling() {
  const filename = path.join(__dirname, '../app/lib/graphics/chunkCulling.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { rectangleIntersectsViewport } = loadChunkCulling()
const viewport = {
  visibleLeft: 100,
  visibleTop: 200,
  visibleWidth: 800,
  visibleHeight: 600,
}

test('keeps chunks intersecting the viewport edges renderable', () => {
  assert.equal(
    rectangleIntersectsViewport({ minX: 900, minY: 300, width: 200, height: 200 }, viewport),
    true
  )
})

test('rejects chunks fully outside the viewport', () => {
  assert.equal(
    rectangleIntersectsViewport({ minX: 901, minY: 300, width: 200, height: 200 }, viewport),
    false
  )
})

test('uses a preload margin to avoid popping while the camera moves', () => {
  const chunk = { minX: 950, minY: 300, width: 100, height: 100 }
  assert.equal(rectangleIntersectsViewport(chunk, viewport), false)
  assert.equal(rectangleIntersectsViewport(chunk, viewport, 100), true)
})
