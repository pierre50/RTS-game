const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadBuildingLimits() {
  const filename = path.join(__dirname, '../app/lib/buildings/limits.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {}
  const localRequire = request => {
    if (request === '../../constants') {
      return { BUILDING_TYPES: { townCenter: 'TownCenter' } }
    }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { isBuildingLimitReached } = loadBuildingLimits()

test('town center is limited to one living building per owner', () => {
  const owner = {
    buildings: [{ type: 'TownCenter' }, { type: 'TownCenter', isDead: true }, { type: 'House' }],
  }

  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), true)
})

test('non-limited buildings are not blocked by building limits', () => {
  const owner = {
    buildings: [{ type: 'House' }, { type: 'House' }],
  }

  assert.equal(isBuildingLimitReached(owner, 'House'), false)
})

test('rival factions may race, but a completed center blocks every owner on the map', () => {
  const owner = { factionId: 'a', buildings: [] }
  const rival = { factionId: 'b', buildings: [{ type: 'TownCenter', isBuilt: false, hitPoints: 1 }] }
  owner.context = { players: [owner, rival] }
  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), false)
  rival.buildings[0].isBuilt = true
  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), true)
  rival.buildings[0].isDead = true
  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), false)
})

test('regional owners of the same faction share the one-site limit', () => {
  const owner = { factionId: 'a', buildings: [] }
  const ally = { factionId: 'a', buildings: [{ type: 'TownCenter', isBuilt: false, hitPoints: 1 }] }
  owner.context = { players: [owner, ally] }
  assert.equal(isBuildingLimitReached(owner, 'TownCenter'), true)
  assert.equal(isBuildingLimitReached(owner, 'House'), false)
})
