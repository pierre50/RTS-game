const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadOceanAmbience() {
  const filename = path.join(__dirname, '../app/lib/oceanAmbience.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

function createGrid(size = 21) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ({ category: 'Land' })))
}

test('ocean ambience uses water border and water cells inside the proximity radius', () => {
  const { OCEAN_AMBIENCE_MAX_VOLUME, getNearestOceanAmbienceDistance, getOceanAmbienceTargetVolume } =
    loadOceanAmbience()
  const grid = createGrid()
  grid[4][4].waterBorder = true

  assert.equal(getNearestOceanAmbienceDistance(grid, { i: 4, j: 4 }), 0)
  assert.equal(getOceanAmbienceTargetVolume(grid, { i: 4, j: 4 }), OCEAN_AMBIENCE_MAX_VOLUME)

  grid[4][4].waterBorder = false
  grid[4][4].category = 'Water'
  assert.equal(getNearestOceanAmbienceDistance(grid, { i: 4, j: 4 }), 0)
})

test('ocean ambience fades over eight cells and stops beyond that radius', () => {
  const { OCEAN_AMBIENCE_MAX_VOLUME, getNearestOceanAmbienceDistance, getOceanAmbienceTargetVolume } =
    loadOceanAmbience()
  const grid = createGrid()
  grid[4][4].waterBorder = true

  assert.equal(getNearestOceanAmbienceDistance(grid, { i: 4, j: 8 }), 4)
  assert.ok(
    Math.abs(getOceanAmbienceTargetVolume(grid, { i: 4, j: 8 }) - OCEAN_AMBIENCE_MAX_VOLUME * (5 / 9)) < 0.001
  )
  assert.equal(getNearestOceanAmbienceDistance(grid, { i: 18, j: 18 }), null)
  assert.equal(getOceanAmbienceTargetVolume(grid, { i: 18, j: 18 }), 0)
})
