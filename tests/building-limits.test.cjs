const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadBuildingLimits() {
  const filename = path.join(__dirname, '../app/lib/buildings/limits.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../constants') {
      return { BUILDING_TYPES: { townCenter: 'TownCenter' } }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { isBuildingLimitReached } = loadBuildingLimits()

test('town center is limited to one living building per owner', () => {
  const owner = {
    buildings: [
      { type: 'TownCenter' },
      { type: 'TownCenter', isDead: true },
      { type: 'House' },
    ],
  }

  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), true)
})

test('non-limited buildings are not blocked by building limits', () => {
  const owner = {
    buildings: [{ type: 'House' }, { type: 'House' }],
  }

  assert.equal(isBuildingLimitReached(owner, 'House'), false)
})
