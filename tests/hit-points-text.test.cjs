const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHitPointsText() {
  const filename = path.join(__dirname, '../app/lib/hitPointsText.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', code)(module, module.exports)
  return module.exports
}

test('formatHitPointsText rounds decimal hit points for display', () => {
  const { formatHitPointsText } = loadHitPointsText()

  assert.equal(formatHitPointsText(1.5, 100), '2/100')
  assert.equal(formatHitPointsText(99.4, 100), '99/100')
})

test('formatHitPointsText preserves empty display updates', () => {
  const { formatHitPointsText } = loadHitPointsText()

  assert.equal(formatHitPointsText('', 100), '')
})
