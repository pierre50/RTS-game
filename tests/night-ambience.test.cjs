const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadNightAmbience() {
  const filename = path.join(__dirname, '../app/lib/nightAmbience.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

test('night ambience follows darkness and clamps invalid values', () => {
  const { NIGHT_AMBIENCE_MAX_VOLUME, getNightAmbienceTargetVolume } = loadNightAmbience()

  assert.equal(getNightAmbienceTargetVolume(0), 0)
  assert.equal(getNightAmbienceTargetVolume(null), 0)
  assert.equal(getNightAmbienceTargetVolume(-1), 0)
  assert.equal(getNightAmbienceTargetVolume(2), NIGHT_AMBIENCE_MAX_VOLUME)
  assert.ok(getNightAmbienceTargetVolume(0.5) > 0)
  assert.ok(getNightAmbienceTargetVolume(0.5) < NIGHT_AMBIENCE_MAX_VOLUME)
})
