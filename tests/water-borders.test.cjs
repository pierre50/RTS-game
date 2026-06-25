const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadWaterBorderFrame() {
  const filename = path.join(__dirname, '../app/lib/terrain/topology.js')
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports.getWaterBorderFrame
}

const getWaterBorderFrame = loadWaterBorderFrame()

test('concave shorelines use a continuous corner even without a water diagonal', () => {
  assert.equal(getWaterBorderFrame({ n: false, s: true, w: true, e: false, nw: false, ne: false, sw: false, se: true }), '003')
  assert.equal(getWaterBorderFrame({ n: true, s: false, w: false, e: true, nw: true, ne: false, sw: false, se: false }), '000')
  assert.equal(getWaterBorderFrame({ n: true, s: true, w: false, e: false, nw: false, ne: true, sw: true, se: false }), '008')
})
