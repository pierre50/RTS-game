const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadWalls() {
  const filename = path.join(__dirname, '../app/lib/buildings/walls.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      AnimatedSprite: class AnimatedSprite {
        constructor() {
          this.anchor = { copyFrom: () => {} }
        }
        play() {}
      },
      Assets: {},
    },
    '../../constants': { BUILDING_TYPES: { smallWall: 'SmallWall' }, LABEL_TYPES: { deco: 'deco' } },
    '../extra': { bindAnimatedSpriteToTicker: () => {} },
    '../graphics/colors': { changeSpriteColor: () => {} },
    '../graphics/textures': { getTexture: name => name, getTextureByFrame: () => ({}) },
    '../grid/wallPath': {
      getWallFrame: (vertical, horizontal, endpoint) => (endpoint || (vertical && horizontal) ? 2 : vertical ? 1 : 0),
    },
  }
  const localRequire = request => mocks[request] || requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { getWallLevel, getWallTexture, updateWallTexture } = loadWalls()

test('wall technology levels progress independently from player age', () => {
  const owner = { age: 3, civ: 'Greek', technologies: [] }
  assert.equal(getWallLevel(owner), 1)
  assert.deepEqual(getWallTexture(owner, 0), { sheet: 'buildings/wall/level-1', frame: 0 })

  owner.technologies.push('UpgradeMediumWall')
  assert.equal(getWallLevel(owner), 2)
  assert.deepEqual(getWallTexture(owner, 0), { sheet: 'buildings/wall/level-1', frame: 0 })

  owner.technologies.push('UpgradeFortification')
  assert.equal(getWallLevel(owner), 3)
  assert.deepEqual(getWallTexture(owner, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
})

test('all architectures reuse the shared wall sheet until wall age art is added', () => {
  const technologies = ['UpgradeMediumWall']
  assert.deepEqual(getWallTexture({ civ: 'Egyptian', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
  assert.deepEqual(getWallTexture({ civ: 'Asian', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
  assert.deepEqual(getWallTexture({ civ: 'Babylonian', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
})

test('isolated walls and wall endpoints use the tower block frame', () => {
  const owner = {}
  const wall = { type: 'SmallWall', owner }
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ has: null })))
  const makeWall = () => ({
    ...wall,
    addChild: () => {},
    context: { map: { grid } },
    getChildByLabel: () => null,
    i: 1,
    isBuilt: true,
    j: 1,
    sprite: { anchor: { copyFrom: () => {} }, texture: null },
  })

  grid[1][1].has = wall
  const isolated = makeWall()
  updateWallTexture(isolated)
  assert.deepEqual(isolated.sprite.texture, { sheet: 'buildings/wall/level-1', frame: 2 })

  grid[0][1].has = { ...wall }
  const endpoint = makeWall()
  updateWallTexture(endpoint)
  assert.deepEqual(endpoint.sprite.texture, { sheet: 'buildings/wall/level-1', frame: 2 })

  grid[2][1].has = { ...wall }
  const vertical = makeWall()
  updateWallTexture(vertical)
  assert.deepEqual(vertical.sprite.texture, { sheet: 'buildings/wall/level-1', frame: 1 })
})

test('granary exposes the complete wall technology chain', () => {
  const buildings = require('../public/assets/data/gameplay/buildings.json')
  const wallTechnologies = buildings.Granary.technologies.filter(
    type => type.includes('Wall') || type === 'UpgradeFortification'
  )
  assert.deepEqual(wallTechnologies, ['ResearchSmallWall', 'UpgradeMediumWall', 'UpgradeFortification'])
})
