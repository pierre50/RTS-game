const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadWalls() {
  const filename = path.join(__dirname, '../app/lib/buildings/walls.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': { Assets: {} },
    '../../constants': { BUILDING_TYPES: { smallWall: 'SmallWall' } },
    '../graphics/textures': { getTexture: name => name },
    '../grid/wallPath': {
      getWallFrame: (vertical, horizontal, endpoint) => (endpoint || (vertical && horizontal) ? 2 : vertical ? 1 : 0),
    },
  }
  const localRequire = request => mocks[request] || require(request)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { getWallFrameAt, getWallIcon, getWallLevel, getWallSheet } = loadWalls()

test('wall technology levels progress independently from player age', () => {
  const owner = { age: 3, civ: 'Greek', technologies: [] }
  assert.equal(getWallLevel(owner), 1)
  assert.equal(getWallSheet(owner), '599')

  owner.technologies.push('UpgradeMediumWall')
  assert.equal(getWallLevel(owner), 2)
  assert.equal(getWallSheet(owner), '69')

  owner.technologies.push('UpgradeFortification')
  assert.equal(getWallLevel(owner), 3)
  assert.equal(getWallSheet(owner), '67')
})

test('each architecture uses its own upgraded wall sheets', () => {
  const technologies = ['UpgradeMediumWall']
  assert.equal(getWallSheet({ civ: 'Egyptian', technologies }), '25')
  assert.equal(getWallSheet({ civ: 'Asian', technologies }), '113')
  assert.equal(getWallSheet({ civ: 'Babylonian', technologies }), '169')
})

test('wall construction icons follow the researched wall level', () => {
  const owner = { technologies: [] }
  assert.equal(getWallIcon(owner, '042_50704'), '042_50704')
  owner.technologies.push('UpgradeMediumWall')
  assert.equal(getWallIcon(owner, '042_50704'), '045_50704')
  owner.technologies.push('UpgradeFortification')
  assert.equal(getWallIcon(owner, '042_50704'), '048_50704')
})

test('isolated walls and wall endpoints use the tower block frame', () => {
  const owner = {}
  const wall = { type: 'SmallWall', owner }
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ has: null })))

  grid[1][1].has = wall
  assert.equal(getWallFrameAt(grid, 1, 1, owner), 2)

  grid[0][1].has = { ...wall }
  assert.equal(getWallFrameAt(grid, 1, 1, owner), 2)

  grid[2][1].has = { ...wall }
  assert.equal(getWallFrameAt(grid, 1, 1, owner), 1)
})

test('granary exposes the complete wall technology chain', () => {
  const buildings = require('../public/assets/data/gameplay/buildings.json')
  const wallTechnologies = buildings.Granary.technologies.filter(
    type => type.includes('Wall') || type === 'UpgradeFortification'
  )
  assert.deepEqual(wallTechnologies, ['ResearchSmallWall', 'UpgradeMediumWall', 'UpgradeFortification'])
})
