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

test('all architectures reuse the shared wall sheet until wall age art is added', () => {
  const technologies = ['UpgradeMediumWall']
  assert.deepEqual(getWallTexture({ civ: 'Kemet', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
  assert.deepEqual(getWallTexture({ civ: 'Xia', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
  assert.deepEqual(getWallTexture({ civ: 'Sumeria', technologies }, 0), { sheet: 'buildings/wall/level-1', frame: 0 })
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

test('wall decorations attach to the display object without calling entity container methods', () => {
  const owner = {}
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ({ has: null })))
  const children = []
  const displayObject = {
    addChild: child => children.push(child),
    getChildByLabel: () => null,
  }
  const wall = {
    type: 'SmallWall',
    owner,
    context: { map: { grid } },
    i: 1,
    j: 1,
    isBuilt: true,
    sprite: { anchor: { copyFrom: () => {} }, texture: null },
    displayObject,
    addChild: () => { throw new Error('entity addChild should not be called') },
    getChildByLabel: () => { throw new Error('entity getChildByLabel should not be called') },
  }
  grid[1][1].has = wall

  updateWallTexture(wall)

  assert.equal(children.length, 1)
  assert.equal(children[0].label, 'deco')
})
